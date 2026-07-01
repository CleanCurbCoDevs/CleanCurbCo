import { addOns } from "@/lib/site";
import { formatFrequency } from "@/lib/pricing";
import { policyWindowLabels, requestTypeLabels } from "@/lib/service-policy";
import type {
  BookingRow,
  ContactMessageRow,
  CustomerRequestRow,
  CareerApplicationRow,
  ProfileRow,
  ReferralRow,
} from "@/types/database";

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shell(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f4ef;padding:28px;color:#111">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        <div style="background:#050505;color:white;padding:22px;border-bottom:5px solid #00ff38">
          <h1 style="margin:0;font-size:26px">Clean Curb Co.</h1>
          <p style="margin:6px 0 0;color:#ffe38a;font-weight:700">Fresh Starts at the Curb.</p>
        </div>
        <div style="padding:24px">
          <h2 style="margin-top:0">${escapeHtml(title)}</h2>
          ${body}
        </div>
      </div>
    </div>
  `;
}

function addOnLabels(addOnIds: string[]) {
  if (!addOnIds.length) return "None";

  return addOnIds
    .map((id) => addOns.find((addOn) => addOn.id === id)?.name ?? id)
    .join(", ");
}

export function bookingSummaryHtml(booking: BookingRow) {
  return `
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Name:</strong> ${escapeHtml(booking.first_name)} ${escapeHtml(booking.last_name)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(booking.phone)}</li>
      <li><strong>Email:</strong> ${escapeHtml(booking.email)}</li>
      <li><strong>Address:</strong> ${escapeHtml(booking.street_address)}, ${escapeHtml(booking.city)}, ${escapeHtml(booking.state)} ${escapeHtml(booking.zip_code)}</li>
      <li><strong>Neighborhood:</strong> ${escapeHtml(booking.neighborhood ?? "Not sure")}</li>
      <li><strong>Bins:</strong> ${booking.bin_count}</li>
      <li><strong>Frequency:</strong> ${escapeHtml(formatFrequency(booking.frequency))}</li>
      <li><strong>Add-ons:</strong> ${escapeHtml(addOnLabels(booking.add_ons))}</li>
      <li><strong>Estimated price:</strong> $${booking.estimated_price}</li>
      <li><strong>Notes:</strong> ${escapeHtml(booking.customer_notes ?? "None")}</li>
    </ul>
  `;
}

export function bookingConfirmationTemplate(booking: BookingRow): EmailTemplate {
  const body = `
    <p>Thanks for booking with Clean Curb Co. We received your request and will confirm your Cane Bay route day and final price by text or email.</p>
    ${bookingSummaryHtml(booking)}
    <p>Trash day should not stink all week. We are on it.</p>
  `;

  return {
    subject: "We received your Clean Curb Co. booking request",
    html: shell("Booking request received", body),
    text: `We received your Clean Curb Co. booking request for ${booking.street_address}. Estimated price: $${booking.estimated_price}.`,
  };
}

export function adminBookingNotificationTemplate(
  booking: BookingRow,
): EmailTemplate {
  return {
    subject: "New Clean Curb Co. booking request",
    html: shell("New booking request", bookingSummaryHtml(booking)),
    text: `New booking: ${booking.first_name} ${booking.last_name}, ${booking.phone}, ${booking.email}, ${booking.street_address}, $${booking.estimated_price}.`,
  };
}

export function accountSetupTemplate(
  booking: BookingRow,
  setupLink: string,
): EmailTemplate {
  const body = `
    <p>Want to manage everything online? Create your Clean Curb Co. account to view booking status, service updates, payment links, and future before/after photos.</p>
    <p><a href="${escapeHtml(setupLink)}" style="display:inline-block;background:#00ff38;color:#050505;padding:12px 18px;border-radius:8px;font-weight:800;text-decoration:none">Set up your account</a></p>
    ${bookingSummaryHtml(booking)}
  `;

  return {
    subject: "Set up your Clean Curb Co. account",
    html: shell("Set up your account", body),
    text: `Set up your Clean Curb Co. account: ${setupLink}`,
  };
}

export function routeConfirmationTemplate(
  booking: BookingRow,
  routeDay: string,
): EmailTemplate {
  return {
    subject: "Your Clean Curb Co. route day is confirmed",
    html: shell(
      "Route day confirmed",
      `<p>Your route day is confirmed for <strong>${escapeHtml(routeDay)}</strong>.</p>${bookingSummaryHtml(booking)}`,
    ),
    text: `Your Clean Curb Co. route day is confirmed for ${routeDay}.`,
  };
}

export function reviewRequestTemplate(booking: BookingRow): EmailTemplate {
  return {
    subject: "How did we do?",
    html: shell(
      "How did we do?",
      `<p>Thanks for trusting Clean Curb Co. with your bins. If the fresh start felt good, we would love a quick review.</p>${bookingSummaryHtml(booking)}`,
    ),
    text: "Thanks for trusting Clean Curb Co. with your bins. We would love a quick review.",
  };
}

export function paymentLinkTemplate(booking: BookingRow): EmailTemplate {
  const paymentLink = booking.payment_link ?? "";
  const body = `
    <p>Your Clean Curb Co. payment link is ready for the cleaning request below.</p>
    ${
      paymentLink
        ? `<p><a href="${escapeHtml(paymentLink)}" style="display:inline-block;background:#00ff38;color:#050505;padding:12px 18px;border-radius:8px;font-weight:800;text-decoration:none">Open payment link</a></p>`
        : "<p>The payment link is being prepared. We will follow up shortly.</p>"
    }
    ${bookingSummaryHtml(booking)}
  `;

  return {
    subject: "Your Clean Curb Co. payment link",
    html: shell("Payment link ready", body),
    text: paymentLink
      ? `Your Clean Curb Co. payment link: ${paymentLink}`
      : "Your Clean Curb Co. payment link is being prepared.",
  };
}

export function paymentReceivedTemplate(
  booking: BookingRow,
  amount: number,
): EmailTemplate {
  const body = `
    <p>Hi ${escapeHtml(booking.first_name)},</p>
    <p>Payment received. Thank you for trusting Clean Curb Co. with your bins.</p>
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Amount paid:</strong> $${amount}</li>
      <li><strong>Service address:</strong> ${escapeHtml(booking.street_address)}, ${escapeHtml(booking.city)}, ${escapeHtml(booking.state)} ${escapeHtml(booking.zip_code)}</li>
      <li><strong>Service:</strong> ${escapeHtml(formatFrequency(booking.frequency))} | ${booking.bin_count} bin(s)</li>
      <li><strong>Add-ons:</strong> ${escapeHtml(addOnLabels(booking.add_ons))}</li>
    </ul>
    <p>Your customer portal will show updated payment status after Stripe finishes syncing.</p>
    <p><strong>Fresh Starts at the Curb.</strong></p>
  `;

  return {
    subject: "Payment received - Clean Curb Co.",
    html: shell("Payment received", body),
    text: `Payment received for Clean Curb Co. Amount paid: $${amount}. Fresh Starts at the Curb.`,
  };
}

export function fieldOnTheWayTemplate(booking: BookingRow): EmailTemplate {
  const body = `
    <p>Hi ${escapeHtml(booking.first_name)},</p>
    <p>We are heading your way for your Clean Curb Co. service.</p>
    <p>Please make sure your bins are empty and accessible.</p>
    <p><strong>Fresh Starts at the Curb.</strong></p>
  `;

  return {
    subject: "We're on the way - Clean Curb Co.",
    html: shell("We're on the way", body),
    text: `Hi ${booking.first_name}, we are heading your way for your Clean Curb Co. service. Please make sure your bins are empty and accessible. Fresh Starts at the Curb.`,
  };
}

export function serviceCompletedTemplate(
  booking: BookingRow,
  paymentLink?: string | null,
): EmailTemplate {
  const body = `
    <p>Hi ${escapeHtml(booking.first_name)},</p>
    <p>Your Clean Curb Co. service is complete. Thanks for letting us handle the grime at the curb.</p>
    <p>Your before/after photos will be available in your customer portal when your account is connected.</p>
    ${
      paymentLink
        ? `<p><a href="${escapeHtml(paymentLink)}" style="display:inline-block;background:#00ff38;color:#050505;padding:12px 18px;border-radius:8px;font-weight:800;text-decoration:none">Pay for this service</a></p>`
        : ""
    }
    <p><strong>Fresh Starts at the Curb.</strong></p>
  `;

  return {
    subject: "Your Clean Curb Co. service is complete",
    html: shell("Service complete", body),
    text: paymentLink
      ? `Your Clean Curb Co. service is complete. Payment link: ${paymentLink}`
      : "Your Clean Curb Co. service is complete. Fresh Starts at the Curb.",
  };
}

export function customerRequestReceivedTemplate(
  request: CustomerRequestRow,
  booking?: BookingRow | null,
  serviceDate?: string | null,
): EmailTemplate {
  const body = `
    <p>We received your service request. If review is needed, Clean Curb Co. will follow up before making final changes.</p>
    ${customerRequestSummaryHtml(request, booking, serviceDate)}
    <p>No service is paused, cancelled, or changed until Clean Curb Co. confirms it.</p>
  `;

  return {
    subject: "We received your Clean Curb Co. service request",
    html: shell("Service request received", body),
    text: `We received your Clean Curb Co. service request: ${request.request_type}.`,
  };
}

export function customerRequestUpdatedTemplate(
  request: CustomerRequestRow,
): EmailTemplate {
  const body = `
    <p>Your service request has been updated.</p>
    ${customerRequestSummaryHtml(request)}
  `;

  return {
    subject: "Update on your Clean Curb Co. service request",
    html: shell("Service request update", body),
    text: `Your Clean Curb Co. service request is now ${request.status}.`,
  };
}

export function adminCustomerRequestAlertTemplate(
  request: CustomerRequestRow,
  profile: ProfileRow,
  booking?: BookingRow | null,
  serviceDate?: string | null,
): EmailTemplate {
  const body = `
    <p>A customer submitted a service change request.</p>
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Customer:</strong> ${escapeHtml([profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Customer")}</li>
      <li><strong>Email:</strong> ${escapeHtml(profile.email ?? booking?.email ?? "No email")}</li>
      <li><strong>Phone:</strong> ${escapeHtml(profile.phone ?? booking?.phone ?? "No phone")}</li>
      <li><strong>Booking:</strong> ${escapeHtml(booking?.id ?? request.booking_id ?? "No booking")}</li>
      <li><strong>Scheduled date:</strong> ${escapeHtml(serviceDate ?? "No scheduled date")}</li>
    </ul>
    ${customerRequestSummaryHtml(request, booking, serviceDate)}
  `;

  return {
    subject: "Customer service change request - Clean Curb Co.",
    html: shell("Customer service change request", body),
    text: `Customer service change request: ${request.request_type}, ${request.policy_window}.`,
  };
}

function customerRequestSummaryHtml(
  request: CustomerRequestRow,
  booking?: BookingRow | null,
  serviceDate?: string | null,
) {
  return `
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Request:</strong> ${escapeHtml(requestTypeLabels[request.request_type] ?? request.request_type.replaceAll("_", " "))}</li>
      <li><strong>Status:</strong> ${escapeHtml(request.status.replaceAll("_", " "))}</li>
      <li><strong>Scheduled date:</strong> ${escapeHtml(serviceDate ?? booking?.confirmed_route_day ?? booking?.requested_date ?? "Not scheduled")}</li>
      <li><strong>Policy window:</strong> ${escapeHtml(policyWindowLabels[request.policy_window] ?? request.policy_window)}</li>
      <li><strong>Acknowledgment:</strong> ${request.policy_acknowledged ? `Completed by ${escapeHtml(request.policy_acknowledged_name ?? "customer")}` : "Not required or not completed"}</li>
      <li><strong>Original estimated price:</strong> ${request.original_estimated_price === null ? "Not recorded" : `$${request.original_estimated_price}`}</li>
      <li><strong>Cancellation fee:</strong> ${request.cancellation_fee === null ? "None configured" : `$${request.cancellation_fee}`}</li>
      <li><strong>Full charge may apply:</strong> ${request.full_charge_applies ? "Yes" : "No"}</li>
      <li><strong>Message:</strong> ${escapeHtml(request.message ?? "None provided")}</li>
      <li><strong>Admin note:</strong> ${escapeHtml(request.admin_notes ?? "No note added")}</li>
    </ul>
  `;
}

export function referralRewardTemplate(
  referral: ReferralRow,
  mode: "ready" | "sent",
): EmailTemplate {
  const rewardValue = referral.reward_value ?? 5;
  const body = `
    <p>Your neighbor referral is ${mode === "ready" ? "ready for reward review" : "marked as rewarded"}.</p>
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Referral code:</strong> ${escapeHtml(referral.referral_code ?? "Not provided")}</li>
      <li><strong>Status:</strong> ${escapeHtml(referral.status.replaceAll("_", " "))}</li>
      <li><strong>Reward:</strong> $${rewardValue} service credit</li>
    </ul>
  `;

  return {
    subject:
      mode === "ready"
        ? "Your Clean Curb Co. referral reward is ready"
        : "Your Clean Curb Co. referral reward was sent",
    html: shell(
      mode === "ready" ? "Referral reward ready" : "Referral reward sent",
      body,
    ),
    text: `Your Clean Curb Co. referral reward is ${mode}.`,
  };
}

export function contactConfirmationTemplate(
  message: ContactMessageRow,
): EmailTemplate {
  return {
    subject: "We received your message - Clean Curb Co.",
    html: shell(
      "Message received",
      `<p>Thanks, ${escapeHtml(message.name)}. We received your message and will follow up soon.</p><p><strong>Reason:</strong> ${escapeHtml(message.reason)}</p><p>${escapeHtml(message.message)}</p>`,
    ),
    text: `Thanks, ${message.name}. We received your Clean Curb Co. message and will follow up soon.`,
  };
}

export function adminContactNotificationTemplate(
  message: ContactMessageRow,
): EmailTemplate {
  return {
    subject: "New Clean Curb Co. contact message",
    html: shell(
      "New contact message",
      `<ul style="line-height:1.7;padding-left:18px">
        <li><strong>Name:</strong> ${escapeHtml(message.name)}</li>
        <li><strong>Phone:</strong> ${escapeHtml(message.phone ?? "Not provided")}</li>
        <li><strong>Email:</strong> ${escapeHtml(message.email)}</li>
        <li><strong>Area:</strong> ${escapeHtml(message.address_or_neighborhood ?? "Not provided")}</li>
        <li><strong>Reason:</strong> ${escapeHtml(message.reason)}</li>
      </ul>
      <p>${escapeHtml(message.message)}</p>`,
    ),
    text: `New contact message from ${message.name}: ${message.reason}. ${message.message}`,
  };
}

export function careerApplicationConfirmationTemplate(
  application: CareerApplicationRow,
): EmailTemplate {
  const body = `
    <p>Hi ${escapeHtml(application.first_name)},</p>
    <p>Thanks for your interest in Clean Curb Co.</p>
    <p>We received your information and will keep it on file as we grow our local route team.</p>
    <p><strong>Fresh Starts at the Curb,</strong><br />Clean Curb Co.</p>
  `;

  return {
    subject: "We received your Clean Curb Co. career interest form",
    html: shell("Career interest received", body),
    text: `Hi ${application.first_name}, thanks for your interest in Clean Curb Co. We received your information and will keep it on file as we grow our local route team. Fresh Starts at the Curb, Clean Curb Co.`,
  };
}

export function adminCareerApplicationTemplate(
  application: CareerApplicationRow,
  adminUrl: string,
): EmailTemplate {
  const body = `
    <p>A new Clean Curb Co. career interest form was submitted.</p>
    <ul style="line-height:1.7;padding-left:18px">
      <li><strong>Name:</strong> ${escapeHtml(application.first_name)} ${escapeHtml(application.last_name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(application.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(application.phone ?? "Not provided")}</li>
      <li><strong>Role interest:</strong> ${escapeHtml(application.role_interest ?? "General Interest")}</li>
      <li><strong>Availability:</strong> ${escapeHtml(application.availability.join(", ") || "Not provided")}</li>
      <li><strong>Location:</strong> ${escapeHtml([application.city, application.state, application.zip].filter(Boolean).join(", ") || "Not provided")}</li>
    </ul>
    <p><strong>Experience:</strong><br />${escapeHtml(application.experience ?? "Not provided")}</p>
    <p><strong>Message:</strong><br />${escapeHtml(application.message ?? "Not provided")}</p>
    <p><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#00ff38;color:#050505;padding:12px 18px;border-radius:8px;font-weight:800;text-decoration:none">Open admin careers</a></p>
  `;

  return {
    subject: "New Clean Curb Co. career application",
    html: shell("New career application", body),
    text: `New career application: ${application.first_name} ${application.last_name}, ${application.email}, ${application.role_interest ?? "General Interest"}. Admin: ${adminUrl}`,
  };
}
