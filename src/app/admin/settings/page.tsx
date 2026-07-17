import type { Metadata } from "next";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { AdminShell } from "@/components/shells/admin-shell";
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
} from "@/lib/action-result";
import { getAdminContext } from "@/lib/admin-data";
import {
  accountDeletionDecisionTemplate,
  accountDeletionRequestedTemplate,
  accountSetupTemplate,
  adminAccountDeletionRequestTemplate,
  adminBookingNotificationTemplate,
  adminCareerApplicationTemplate,
  adminContactNotificationTemplate,
  adminCustomerRequestAlertTemplate,
  adminRouteDateResponseTemplate,
  bookingConfirmationTemplate,
  bookingDecisionTemplate,
  careerApplicationConfirmationTemplate,
  contactConfirmationTemplate,
  customerRequestReceivedTemplate,
  customerRequestUpdatedTemplate,
  fieldOnTheWayTemplate,
  paymentLinkTemplate,
  paymentReceivedTemplate,
  paymentSetupCompletedTemplate,
  paymentSetupInviteTemplate,
  referralRewardTemplate,
  routeConfirmationTemplate,
  routeDateOfferedTemplate,
  routeDateResponseTemplate,
  serviceCompletedTemplate,
  type EmailTemplate,
} from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { sendFieldReviewRequestEmail } from "@/lib/email/sendFieldNotifications";
import {
  getResendEnv,
  getSiteUrl,
  isResendConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { pricingConfig } from "@/lib/pricing";
import { requireAdmin } from "@/lib/supabase/auth";
import type {
  AccountDeletionRequestRow,
  BookingRow,
  CareerApplicationRow,
  ContactMessageRow,
  CustomerRequestRow,
  ProfileRow,
  ReferralRow,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Settings",
};

const TEST_ID = "00000000-0000-4000-8000-000000000001";
const TEST_TIMESTAMP = "2026-07-17T18:00:00.000Z";

const EMAIL_TEST_OPTIONS = [
  { value: "booking_confirmation", label: "Customer · Booking confirmation" },
  { value: "admin_booking_notification", label: "Internal · New booking alert" },
  { value: "account_setup", label: "Customer · Account setup" },
  { value: "route_confirmation", label: "Customer · Route confirmation" },
  { value: "facebook_review_request", label: "Customer · Facebook review request" },
  { value: "payment_link", label: "Customer · Payment link" },
  { value: "payment_received_new", label: "Customer · Payment received, new account" },
  { value: "payment_received_existing", label: "Customer · Payment received, existing account" },
  { value: "field_on_the_way", label: "Customer · Technician on the way" },
  { value: "service_completed", label: "Customer · Service completed" },
  { value: "service_completed_payment_due", label: "Customer · Service completed, payment due" },
  { value: "customer_request_received", label: "Customer · Service request received" },
  { value: "customer_request_updated", label: "Customer · Service request decision" },
  { value: "admin_customer_request", label: "Internal · Customer service request alert" },
  { value: "account_deletion_requested", label: "Customer · Account deletion requested" },
  { value: "admin_account_deletion", label: "Internal · Account deletion alert" },
  { value: "account_deletion_decision", label: "Customer · Account deletion decision" },
  { value: "booking_accepted", label: "Customer · Booking accepted" },
  { value: "booking_declined", label: "Customer · Booking declined" },
  { value: "booking_more_information", label: "Customer · Booking needs more information" },
  { value: "route_date_offered", label: "Customer · Route date offered" },
  { value: "route_date_confirmed", label: "Customer · Route date confirmed" },
  { value: "route_date_declined", label: "Customer · Route date declined" },
  { value: "admin_route_confirmed", label: "Internal · Customer confirmed route" },
  { value: "admin_route_declined", label: "Internal · Customer declined route" },
  { value: "payment_setup_invite", label: "Customer · Payment setup invite" },
  { value: "payment_setup_completed", label: "Customer · Payment setup completed" },
  { value: "referral_reward_ready", label: "Customer · Referral reward ready" },
  { value: "referral_reward_sent", label: "Customer · Referral reward sent" },
  { value: "contact_confirmation", label: "Customer · Contact form confirmation" },
  { value: "admin_contact_notification", label: "Internal · Contact form alert" },
  { value: "career_confirmation", label: "Customer · Career form confirmation" },
  { value: "admin_career_notification", label: "Internal · Career application alert" },
] as const;

type EmailTestKey = (typeof EMAIL_TEST_OPTIONS)[number]["value"];

function isEmailTestKey(value: string): value is EmailTestKey {
  return EMAIL_TEST_OPTIONS.some((option) => option.value === value);
}

function sampleBooking(recipient: string): BookingRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    updated_at: TEST_TIMESTAMP,
    customer_id: null,
    service_address_id: null,
    status: "confirmed",
    first_name: "Josh",
    last_name: "Test Customer",
    phone: "(843) 555-0147",
    email: recipient,
    street_address: "123 Fresh Start Lane",
    city: "Summerville",
    state: "SC",
    zip_code: "29486",
    neighborhood: "Cane Bay",
    bin_count: 2,
    bin_types: ["trash", "recycling"],
    frequency: "monthly",
    add_ons: ["deodorizer"],
    estimated_price: 29.33,
    scheduling_preference: "next_available_route_day",
    requested_date: "2026-07-21",
    confirmed_route_day: "2026-07-21",
    proposed_route_day: "2026-07-21",
    route_offer_message: "Tuesday works for our Cane Bay route.",
    customer_notes: "Please leave the bins beside the garage.",
    internal_notes: null,
    payment_status: "pending",
    payment_due_at_service: false,
    payment_link: getSiteUrl(),
    route_offer_status: "offered",
    payment_setup_status: "link_sent",
    payment_method_on_file: false,
    review_request_sent_at: null,
    tip_request_sent_at: null,
  } as unknown as BookingRow;
}

function sampleProfile(recipient: string): ProfileRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    updated_at: TEST_TIMESTAMP,
    role: "customer",
    first_name: "Josh",
    last_name: "Test Customer",
    phone: "(843) 555-0147",
    email: recipient,
    marketing_opt_in: true,
    sms_opt_in: true,
    preferred_contact_method: "email",
    account_status: "active",
    portal_access_enabled: true,
  } as unknown as ProfileRow;
}

function sampleCustomerRequest(): CustomerRequestRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    updated_at: TEST_TIMESTAMP,
    customer_id: null,
    booking_id: TEST_ID,
    request_type: "reschedule_service",
    status: "approved",
    policy_window: "standard",
    policy_acknowledged: true,
    policy_acknowledged_at: TEST_TIMESTAMP,
    policy_acknowledged_name: "Josh Test Customer",
    original_estimated_price: 29.33,
    cancellation_fee: null,
    full_charge_applies: false,
    requested_frequency: null,
    requested_pause_start: null,
    requested_pause_end: null,
    requested_route_day: "2026-07-28",
    requested_add_ons: [],
    requested_removed_add_ons: [],
    message: "Could we move service to next Tuesday?",
    admin_notes: "Test request for email preview.",
    customer_visible_admin_message: "Your new service date has been approved.",
    reviewed_by_user_id: null,
    reviewed_at: TEST_TIMESTAMP,
    requested_services: [],
    metadata_json: {},
  };
}

function sampleDeletionRequest(recipient: string): AccountDeletionRequestRow {
  return {
    id: TEST_ID,
    customer_id: null,
    customer_email: recipient,
    status: "approved",
    requested_by_user_id: null,
    requested_by_role: "customer",
    request_reason: "Testing the account deletion email layout.",
    admin_note: "Email preview only.",
    customer_visible_admin_message: "Your request was approved for this test preview.",
    reviewed_by_user_id: null,
    reviewed_at: TEST_TIMESTAMP,
    completed_at: null,
    created_at: TEST_TIMESTAMP,
    updated_at: TEST_TIMESTAMP,
  };
}

function sampleReferral(recipient: string): ReferralRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    referrer_profile_id: null,
    referred_profile_id: null,
    referred_booking_id: null,
    referral_code: "FRESH-JOSH",
    referred_email: recipient,
    status: "reward_ready",
    reward_type: "service_credit",
    reward_value: 5,
    admin_notes: "Email preview only.",
  };
}

function sampleContact(recipient: string): ContactMessageRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    name: "Josh Test Customer",
    phone: "(843) 555-0147",
    email: recipient,
    address_or_neighborhood: "Cane Bay",
    reason: "Booking question",
    message: "This is sample content used only to preview the email template.",
    status: "new",
  };
}

function sampleCareerApplication(recipient: string): CareerApplicationRow {
  return {
    id: TEST_ID,
    created_at: TEST_TIMESTAMP,
    updated_at: TEST_TIMESTAMP,
    first_name: "Josh",
    last_name: "Applicant",
    email: recipient,
    phone: "(843) 555-0147",
    city: "Summerville",
    state: "SC",
    zip: "29486",
    role_interest: "Route Technician",
    availability: ["Weekdays", "Weekends"],
    has_valid_drivers_license: true,
    comfortable_outdoors: true,
    comfortable_lifting: true,
    experience: "Customer service, outdoor work, and equipment operation.",
    message: "This is sample content used only to preview the email template.",
    status: "new",
    admin_notes: null,
  };
}

function buildTestTemplate(
  templateKey: EmailTestKey,
  recipient: string,
): EmailTemplate | null {
  const siteUrl = getSiteUrl();
  const booking = sampleBooking(recipient);
  const profile = sampleProfile(recipient);
  const request = sampleCustomerRequest();
  const deletionRequest = sampleDeletionRequest(recipient);
  const referral = sampleReferral(recipient);
  const contact = sampleContact(recipient);
  const career = sampleCareerApplication(recipient);

  switch (templateKey) {
    case "booking_confirmation":
      return bookingConfirmationTemplate(booking, {
        accountSetupUrl: `${siteUrl}/signup`,
        paymentSetupUrl: siteUrl,
      });
    case "admin_booking_notification":
      return adminBookingNotificationTemplate(booking);
    case "account_setup":
      return accountSetupTemplate(booking, `${siteUrl}/signup`);
    case "route_confirmation":
      return routeConfirmationTemplate(booking, "Tuesday, July 21, 2026");
    case "payment_link":
      return paymentLinkTemplate(booking);
    case "payment_received_new":
      return paymentReceivedTemplate(booking, 29.33, {
        accountMode: "new",
        accountUrl: `${siteUrl}/signup`,
        loginUrl: `${siteUrl}/login`,
      });
    case "payment_received_existing":
      return paymentReceivedTemplate(booking, 29.33, {
        accountMode: "existing",
        accountUrl: `${siteUrl}/login`,
        loginUrl: `${siteUrl}/login`,
      });
    case "field_on_the_way":
      return fieldOnTheWayTemplate(booking);
    case "service_completed":
      return serviceCompletedTemplate(booking);
    case "service_completed_payment_due":
      return serviceCompletedTemplate(booking, siteUrl);
    case "customer_request_received":
      return customerRequestReceivedTemplate(request, booking, "July 21, 2026");
    case "customer_request_updated":
      return customerRequestUpdatedTemplate(request);
    case "admin_customer_request":
      return adminCustomerRequestAlertTemplate(
        request,
        profile,
        booking,
        "July 21, 2026",
      );
    case "account_deletion_requested":
      return accountDeletionRequestedTemplate(deletionRequest, profile);
    case "admin_account_deletion":
      return adminAccountDeletionRequestTemplate(
        deletionRequest,
        profile,
        `${siteUrl}/admin/requests`,
      );
    case "account_deletion_decision":
      return accountDeletionDecisionTemplate(deletionRequest, "approved");
    case "booking_accepted":
      return bookingDecisionTemplate(
        booking,
        "accepted",
        "Your booking is approved and ready for route scheduling.",
      );
    case "booking_declined":
      return bookingDecisionTemplate(
        booking,
        "declined",
        "This is sample wording for an email preview.",
      );
    case "booking_more_information":
      return bookingDecisionTemplate(
        booking,
        "needs_more_information",
        "Please reply with the best location for the bins.",
      );
    case "route_date_offered":
      return routeDateOfferedTemplate(booking, `${siteUrl}/portal`);
    case "route_date_confirmed":
      return routeDateResponseTemplate(booking, "confirmed");
    case "route_date_declined":
      return routeDateResponseTemplate(booking, "declined");
    case "admin_route_confirmed":
      return adminRouteDateResponseTemplate(booking, "confirmed");
    case "admin_route_declined":
      return adminRouteDateResponseTemplate(booking, "declined");
    case "payment_setup_invite":
      return paymentSetupInviteTemplate(
        booking,
        siteUrl,
        `${siteUrl}/signup`,
      );
    case "payment_setup_completed":
      return paymentSetupCompletedTemplate(booking);
    case "referral_reward_ready":
      return referralRewardTemplate(referral, "ready");
    case "referral_reward_sent":
      return referralRewardTemplate(
        { ...referral, status: "reward_sent" },
        "sent",
      );
    case "contact_confirmation":
      return contactConfirmationTemplate(contact);
    case "admin_contact_notification":
      return adminContactNotificationTemplate(contact);
    case "career_confirmation":
      return careerApplicationConfirmationTemplate(career);
    case "admin_career_notification":
      return adminCareerApplicationTemplate(
        career,
        `${siteUrl}/admin/careers`,
      );
    case "facebook_review_request":
      return null;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown email error.";
  }
}

export default async function AdminSettingsPage() {
  const context = await getAdminContext("/admin/settings");
  const resendEnv = getResendEnv();
  const defaultRecipient =
    context.auth.status === "ok"
      ? context.auth.email ??
        context.auth.profile.email ??
        resendEnv.adminEmails[0] ??
        ""
      : resendEnv.adminEmails[0] ?? "";

  async function sendEmailTestAction(
    formData: FormData,
  ): Promise<ActionResult> {
    "use server";

    const auth = await requireAdmin("/admin/settings");

    if (auth.status !== "ok") {
      return actionFailure("Admin access is required to send email tests.");
    }

    const recipient = String(formData.get("recipient") ?? "")
      .trim()
      .toLowerCase();
    const rawTemplateKey = String(formData.get("templateKey") ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return actionFailure("Enter a valid test recipient email address.");
    }

    if (!isEmailTestKey(rawTemplateKey)) {
      return actionFailure("Choose a valid email template.");
    }

    if (rawTemplateKey === "facebook_review_request") {
      const result = await sendFieldReviewRequestEmail(
        sampleBooking(recipient),
        {},
      );

      if (result.status === "sent") {
        return actionSuccess(
          `Facebook review request sent to ${recipient}.`,
        );
      }

      if (result.status === "skipped") {
        return actionFailure(result.reason);
      }

      return actionFailure(
        `The Facebook review request failed: ${getErrorMessage(result.error)}`,
      );
    }

    const template = buildTestTemplate(rawTemplateKey, recipient);

    if (!template) {
      return actionFailure("That email template could not be generated.");
    }

    const result = await sendTransactionalEmail({
      to: recipient,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateKey: `admin_email_test_${rawTemplateKey}`,
    });

    if (result.status === "sent") {
      return actionSuccess(
        `${template.subject} sent to ${recipient}.`,
      );
    }

    if (result.status === "skipped") {
      return actionFailure(result.reason);
    }

    return actionFailure(
      `The test email failed: ${getErrorMessage(result.error)}`,
    );
  }

  return (
    <AdminShell title="Settings and pricing" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Settings</p>
        <h1>Launch configuration.</h1>
        <div className="grid grid-3">
          <article className="card">
            <h3>Supabase</h3>
            <p>{isSupabaseConfigured() ? "Configured" : "Needs env vars"}</p>
          </article>
          <article className="card">
            <h3>Resend</h3>
            <p>{isResendConfigured() ? "Configured" : "Needs env vars"}</p>
          </article>
          <article className="card">
            <h3>Admin recipients</h3>
            <p>{resendEnv.adminEmails.join(", ")}</p>
          </article>
          <article className="card">
            <h3>Founding Neighbor Special</h3>
            <p>
              {pricingConfig.foundingNeighborSpecialEnabled
                ? "Enabled"
                : "Disabled"}
              <br />$
              {
                pricingConfig.foundingNeighborRecurringTwoBinFirstCleanPrice
              }{" "}
              first 2-bin recurring clean
              <br />
              {pricingConfig.foundingNeighborRouteLabel} for bookings before
              August 1, 2026. Admin may approve manual exceptions.
            </p>
          </article>
        </div>
      </section>

      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Email Test Center</p>
            <h2>Preview every production email in your inbox.</h2>
            <p className="muted">
              Choose a template and send it immediately using synthetic test
              data. Test sends do not modify customer bookings, payment status,
              route records, or scheduled review requests.
            </p>
          </div>
          <span className="status-badge">
            {EMAIL_TEST_OPTIONS.length} templates
          </span>
        </div>

        <article className="card">
          <FeedbackForm
            action={sendEmailTestAction}
            pendingMessage="Sending test email..."
            successMessage="Test email sent."
          >
            <div className="grid grid-2">
              <label>
                Send test to
                <input
                  type="email"
                  name="recipient"
                  defaultValue={defaultRecipient}
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                Email template
                <select
                  name="templateKey"
                  defaultValue="facebook_review_request"
                  required
                >
                  {EMAIL_TEST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="muted">
              The message uses the real subject, HTML, text fallback, buttons,
              and footer. Sample names, addresses, dates, and links are clearly
              separated from live customer records.
            </p>

            <ActionSubmitButton
              className="button button-primary"
              pendingLabel="Sending..."
            >
              Send Test Email
            </ActionSubmitButton>
          </FeedbackForm>
        </article>
      </section>
    </AdminShell>
  );
}
