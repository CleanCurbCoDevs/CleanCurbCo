"use server";

import { revalidatePath } from "next/cache";
import {
  humanizeStatus,
  validCustomerRequestStatuses,
  validBookingStatuses,
  validPaymentStatuses,
  validReferralStatuses,
} from "@/lib/booking-utils";
import {
  createAccountSetupLink,
  createClaimToken,
  createPaymentSetupLink,
  hashClaimToken,
} from "@/lib/booking-claims";
import { sendCustomerRequestUpdate } from "@/lib/email/sendCustomerRequestEmail";
import {
  sendAccountDeletionDecision,
  sendBookingDecision,
  sendPaymentSetupInvite,
  sendRouteDateOffer,
} from "@/lib/email/sendOperationsEmail";
import { sendPaymentLink } from "@/lib/email/sendPaymentLink";
import { sendReferralRewardEmail } from "@/lib/email/sendReferralReward";
import { sendReviewRequest } from "@/lib/email/sendReviewRequest";
import { sendRouteConfirmation } from "@/lib/email/sendRouteConfirmation";
import { getSiteUrl, isStripeConfigured } from "@/lib/env";
import {
  calculateBookingEstimate,
  shouldApplyFoundingNeighborSpecial,
} from "@/lib/pricing";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { createRequestId, logger, maskEmail, maskPhone } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";
import { cleanLongText, cleanString, isValidEmail, pickEnum } from "@/lib/validation";
import type { BookingStatus, PaymentStatus } from "@/types/booking";
import type {
  BookingRow,
  CareerApplicationStatus,
  AccountDeletionStatus,
  CustomerRequestStatus,
  Database,
  FieldStopStatus,
  ReferralStatus,
  RouteDayStatus,
} from "@/types/database";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;
export type AdminEmailChangeState = {
  status: "idle" | "success" | "error";
  message: string;
  requestId?: string;
};

const preferredContactMethods = ["email", "phone", "sms"] as const;
const careerApplicationStatuses: readonly CareerApplicationStatus[] = [
  "new",
  "reviewing",
  "contacted",
  "not_now",
  "hired",
  "archived",
];
const routeDayStatuses: readonly RouteDayStatus[] = [
  "planned",
  "active",
  "completed",
  "cancelled",
];
const routeStopStatuses: readonly FieldStopStatus[] = [
  "scheduled",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "skipped",
  "needs_follow_up",
  "rescheduled",
  "cancelled",
];

async function logActivity(
  admin: AdminClient,
  input: Database["public"]["Tables"]["activity_events"]["Insert"],
) {
  try {
    await admin.from("activity_events").insert(input);
  } catch {
    // Activity events are helpful, but should not block admin workflow updates.
  }
}

async function advanceReferralForBooking(admin: AdminClient, bookingId: string) {
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return;

  const isServiceComplete = ["completed", "paid"].includes(booking.status);
  const isPaid = booking.payment_status === "paid";
  const nextStatus: ReferralStatus =
    isServiceComplete && isPaid ? "reward_ready" : "qualified";

  if (!booking.referral_code || (!isServiceComplete && !isPaid)) return;

  await admin
    .from("referrals")
    .update({ status: nextStatus })
    .eq("referred_booking_id", booking.id)
    .in("status", nextStatus === "reward_ready" ? ["pending", "qualified"] : ["pending"]);
}

function actorEmail(auth: Awaited<ReturnType<typeof requireAdmin>>) {
  return auth.status === "ok" ? maskEmail(auth.email) : null;
}

async function rollbackCustomerEmailChange(input: {
  admin: AdminClient;
  profileId: string;
  previousEmail: string | null;
  stripeCustomerId: string | null;
  requestId: string;
}) {
  if (!input.previousEmail) return;

  try {
    await input.admin.auth.admin.updateUserById(input.profileId, {
      email: input.previousEmail,
      email_confirm: true,
    });
  } catch (error) {
    logger.error("admin_customer_email_auth_rollback_failed", {
      requestId: input.requestId,
      customerId: input.profileId,
      error,
    });
  }

  if (input.stripeCustomerId && isStripeConfigured()) {
    try {
      await getStripe().customers.update(input.stripeCustomerId, {
        email: input.previousEmail,
      });
    } catch (error) {
      logger.error("admin_customer_email_stripe_rollback_failed", {
        requestId: input.requestId,
        customerId: input.profileId,
        error,
      });
    }
  }
}

export async function updateBookingAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/bookings");
  if (auth.status !== "ok") return;

  const requestId = createRequestId();
  const bookingId = cleanString(formData.get("bookingId"), 80);
  if (!bookingId) return;

  const status = pickEnum<BookingStatus>(
    formData.get("status"),
    validBookingStatuses,
    "new",
  );
  const paymentStatus = pickEnum<PaymentStatus>(
    formData.get("paymentStatus"),
    validPaymentStatuses,
    "not_sent",
  );
  const confirmedRouteDay =
    cleanString(formData.get("confirmedRouteDay"), 30) || null;
  const internalNotes = cleanLongText(formData.get("internalNotes"), 2000) || null;
  const paymentLink = cleanString(formData.get("paymentLink"), 500) || null;
  const paymentMethod = cleanString(formData.get("paymentMethod"), 80) || null;
  const paymentProvider = cleanString(formData.get("paymentProvider"), 80) || null;
  const paymentReference =
    cleanString(formData.get("paymentReference"), 120) || null;
  const bookingDecision = cleanString(formData.get("bookingDecision"), 40);
  const proposedRouteDay =
    cleanString(formData.get("proposedRouteDay"), 30) || null;
  const customerVisibleAdminMessage =
    cleanLongText(formData.get("customerVisibleAdminMessage"), 1500) || null;

  const admin = getSupabaseAdmin();
  const { data: previousBooking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  const bookingUpdate: Partial<BookingRow> = {
    status,
    confirmed_route_day: confirmedRouteDay,
    internal_notes: internalNotes,
    payment_status: paymentStatus,
    payment_link: paymentLink,
    payment_method: paymentMethod,
    payment_provider: paymentProvider,
    payment_reference: paymentReference,
    customer_visible_admin_message: customerVisibleAdminMessage,
  };

  if (bookingDecision === "accept") {
    bookingUpdate.status = "confirmed";
    bookingUpdate.route_offer_status = "admin_approved";
  }

  if (bookingDecision === "decline") {
    bookingUpdate.status = "cancelled";
    bookingUpdate.route_offer_status = "admin_declined";
  }

  if (bookingDecision === "contact" || bookingDecision === "needs_more_info") {
    bookingUpdate.status = "needs_follow_up";
  }

  if (bookingDecision === "offer_route" && proposedRouteDay) {
    bookingUpdate.status = "needs_follow_up";
    bookingUpdate.route_offer_status = "offered";
    bookingUpdate.proposed_route_day = proposedRouteDay;
    bookingUpdate.route_offer_message = customerVisibleAdminMessage;
    bookingUpdate.route_offer_sent_at = new Date().toISOString();
  }

  if (bookingDecision === "approve_requested_date" && previousBooking?.requested_date) {
    bookingUpdate.status = "scheduled";
    bookingUpdate.route_offer_status = "admin_approved";
    bookingUpdate.confirmed_route_day = previousBooking.requested_date;
  }

  if (bookingDecision === "decline_requested_date") {
    bookingUpdate.status = "needs_follow_up";
    bookingUpdate.route_offer_status = "admin_declined";
  }

  const { data: updatedBooking } = await admin
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", bookingId)
    .select("*")
    .single();

  if (updatedBooking) {
    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: updatedBooking.customer_id,
      booking_id: updatedBooking.id,
      event_type: "booking_updated",
      message: `Booking updated by ${auth.email ?? "admin"}.`,
      metadata: {
        previousStatus: previousBooking?.status ?? null,
        status: updatedBooking.status,
        previousPaymentStatus: previousBooking?.payment_status ?? null,
        paymentStatus: updatedBooking.payment_status,
        confirmedRouteDay: updatedBooking.confirmed_route_day,
      },
    });

    await writeAdminAuditLog({
      action: "booking_updated",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "booking",
      target_id: updatedBooking.id,
      customer_id: updatedBooking.customer_id,
      booking_id: updatedBooking.id,
      before_summary: {
        status: previousBooking?.status ?? null,
        paymentStatus: previousBooking?.payment_status ?? null,
        confirmedRouteDay: previousBooking?.confirmed_route_day ?? null,
      },
      after_summary: {
        status: updatedBooking.status,
        paymentStatus: updatedBooking.payment_status,
        confirmedRouteDay: updatedBooking.confirmed_route_day,
        decision: bookingDecision || null,
        routeOfferStatus: updatedBooking.route_offer_status,
      },
      request_id: requestId,
      status: "success",
    });

    logger.info("admin_booking_updated", {
      requestId,
      action: "booking_updated",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: updatedBooking.customer_id,
      bookingId: updatedBooking.id,
    });

    await advanceReferralForBooking(admin, updatedBooking.id);

    if (bookingDecision) {
      await handleBookingDecisionNotification(updatedBooking, bookingDecision, {
        customerVisibleAdminMessage,
      });
    }
  }

  if (
    updatedBooking &&
    confirmedRouteDay &&
    formData.get("sendRouteEmail") === "on"
  ) {
    await sendRouteConfirmation(updatedBooking, confirmedRouteDay);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/routes");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/referrals");
}

async function handleBookingDecisionNotification(
  booking: BookingRow,
  decision: string,
  options: { customerVisibleAdminMessage?: string | null },
) {
  const message = options.customerVisibleAdminMessage ?? null;
  const portalUrl = `${getSiteUrl()}/portal/bookings?routeOffer=${booking.id}`;

  if (decision === "accept") {
    await sendBookingDecision(booking, "accepted", message);
  }

  if (decision === "decline") {
    await sendBookingDecision(booking, "declined", message);
  }

  if (decision === "contact" || decision === "needs_more_info") {
    await sendBookingDecision(booking, "needs_more_information", message);
  }

  if (decision === "offer_route") {
    await sendRouteDateOffer(booking, portalUrl);
  }

  if (decision === "approve_requested_date") {
    await sendRouteConfirmation(
      booking,
      booking.confirmed_route_day ?? booking.requested_date ?? "your requested date",
    );
  }

  if (decision === "decline_requested_date") {
    await sendBookingDecision(
      booking,
      "needs_more_information",
      message ??
        "We are sorry, that requested route day is full or unavailable. Please contact us or choose another possible date.",
    );
  }
}

export async function updatePaymentStatusAction(
  quickPaymentStatus: PaymentStatus,
  formData: FormData,
) {
  const auth = await requireAdmin("/admin/payments");
  if (auth.status !== "ok") return;

  const requestId = createRequestId();
  const bookingId = cleanString(formData.get("bookingId"), 80);
  const paymentStatus = pickEnum<PaymentStatus>(
    quickPaymentStatus ?? formData.get("paymentStatus"),
    validPaymentStatuses,
    "not_sent",
  );
  if (!bookingId) return;

  const admin = getSupabaseAdmin();
  const { data: previousBooking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  const { data: booking } = await admin
    .from("bookings")
    .update({ payment_status: paymentStatus })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (booking) {
    await admin
      .from("payments")
      .update({
        status: paymentStatus === "not_sent" ? "not_sent" : paymentStatus,
        provider: "manual",
        metadata: {
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
          source: "admin_payment_status_action",
        },
      })
      .eq("booking_id", booking.id);

    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      event_type: "payment_status_changed",
      message: `Payment status changed to ${paymentStatus}.`,
      metadata: { paymentStatus },
    });

    await writeAdminAuditLog({
      action: "booking_updated",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "booking",
      target_id: booking.id,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      before_summary: {
        paymentStatus: previousBooking?.payment_status ?? null,
      },
      after_summary: {
        paymentStatus: booking.payment_status,
      },
      request_id: requestId,
      status: "success",
      metadata: { source: "admin_payment_status_action" },
    });

    logger.info("admin_payment_status_changed", {
      requestId,
      action: "payment_status_changed",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: booking.customer_id,
      bookingId: booking.id,
      metadata: { paymentStatus },
    });
    await advanceReferralForBooking(admin, booking.id);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/referrals");
}

export async function sendPaymentLinkAction(formData: FormData) {
  const auth = await requireAdmin("/admin/payments");
  if (auth.status !== "ok") return;

  const bookingId = cleanString(formData.get("bookingId"), 80);
  if (!bookingId) return;

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (booking) {
    await sendPaymentLink(booking);
    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      event_type: "payment_link_email_sent",
      message: "Payment link email sent from admin.",
      metadata: { paymentLink: booking.payment_link },
    });
  }

  revalidatePath("/admin/payments");
}

export async function sendPaymentSetupInviteAction(formData: FormData) {
  const auth = await requireAdmin("/admin/bookings");
  if (auth.status !== "ok") return;

  const requestId = createRequestId();
  const bookingId = cleanString(formData.get("bookingId"), 80);
  if (!bookingId) return;

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return;

  let setupUrl = createPaymentSetupLink(booking.id);
  let accountSetupUrl: string | null = null;

  if (!booking.customer_id) {
    const token = createClaimToken();
    await admin.from("booking_claims").insert({
      booking_id: booking.id,
      email: booking.email,
      token_hash: hashClaimToken(token),
    });
    setupUrl = createPaymentSetupLink(booking.id, token);
    accountSetupUrl = createAccountSetupLink(booking.id, token);
  }

  await admin
    .from("bookings")
    .update({
      payment_setup_status: "link_sent",
      payment_provider: "stripe",
    })
    .eq("id", booking.id);

  await Promise.allSettled([
    sendPaymentSetupInvite(booking, setupUrl, accountSetupUrl),
    logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      event_type: "payment_setup_invite_sent",
      message: "Payment setup invite sent from admin.",
      metadata: { requestId },
    }),
    writeAdminAuditLog({
      action: "payment_setup_invite_sent",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "booking",
      target_id: booking.id,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      before_summary: {
        paymentSetupStatus: booking.payment_setup_status,
      },
      after_summary: {
        paymentSetupStatus: "link_sent",
      },
      request_id: requestId,
      status: "success",
    }),
    createAdminNotification({
      type: "payment_setup_invite_sent",
      title: "Payment setup invite sent",
      message: `Payment setup invite sent to ${booking.first_name} ${booking.last_name}.`,
      href: `/admin/bookings?q=${booking.id}`,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      severity: "info",
    }),
  ]);

  logger.info("admin_payment_setup_invite_sent", {
    requestId,
    action: "payment_setup_invite_sent",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: booking.customer_id,
    bookingId: booking.id,
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
}

export async function updateCustomerProfileAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/customers");
  if (auth.status !== "ok") return;

  const profileId = cleanString(formData.get("profileId"), 80);
  if (!profileId) return;

  const requestId = createRequestId();
  const admin = getSupabaseAdmin();
  const { data: previousProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  const preferredContactMethod = pickEnum(
    formData.get("preferredContactMethod"),
    preferredContactMethods,
    "email",
  );
  const profileUpdate = {
    first_name: cleanString(formData.get("firstName"), 80) || null,
    last_name: cleanString(formData.get("lastName"), 80) || null,
    phone: cleanString(formData.get("phone"), 40) || null,
    preferred_contact_method: preferredContactMethod,
    marketing_opt_in: formData.get("marketingOptIn") === "on",
    sms_opt_in: formData.get("smsOptIn") === "on",
    internal_notes: cleanLongText(formData.get("internalNotes"), 3000) || null,
  };

  await admin.from("profiles").update(profileUpdate).eq("id", profileId);

  const serviceAddressId = cleanString(formData.get("serviceAddressId"), 80);
  const streetAddress = cleanString(formData.get("streetAddress"), 180);
  if (serviceAddressId && streetAddress) {
    await admin
      .from("service_addresses")
      .update({
        street_address: streetAddress,
        city: cleanString(formData.get("city"), 80) || "Summerville",
        state: cleanString(formData.get("state"), 20) || "SC",
        zip_code: cleanString(formData.get("zipCode"), 20) || null,
        neighborhood: cleanString(formData.get("neighborhood"), 120) || null,
        gate_code: cleanString(formData.get("gateCode"), 80) || null,
        notes: cleanLongText(formData.get("addressNotes"), 1000) || null,
        is_primary: true,
      })
      .eq("id", serviceAddressId)
      .eq("customer_id", profileId);
  } else if (streetAddress) {
    await admin.from("service_addresses").insert({
      customer_id: profileId,
      label: "Home",
      street_address: streetAddress,
      city: cleanString(formData.get("city"), 80) || "Summerville",
      state: cleanString(formData.get("state"), 20) || "SC",
      zip_code: cleanString(formData.get("zipCode"), 20) || null,
      neighborhood: cleanString(formData.get("neighborhood"), 120) || null,
      gate_code: cleanString(formData.get("gateCode"), 80) || null,
      notes: cleanLongText(formData.get("addressNotes"), 1000) || null,
      is_primary: true,
    });
  }

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    customer_id: profileId,
    event_type: "customer_profile_updated",
    message: "Customer profile updated by admin.",
  });

  await writeAdminAuditLog({
    action: "customer_profile_updated",
    actor_user_id: auth.userId,
    actor_email: actorEmail(auth),
    actor_role: auth.profile.role,
    target_type: "profile",
    target_id: profileId,
    customer_id: profileId,
    before_summary: {
      firstName: previousProfile?.first_name ?? null,
      lastName: previousProfile?.last_name ?? null,
      phone: maskPhone(previousProfile?.phone),
      preferredContactMethod: previousProfile?.preferred_contact_method ?? null,
      marketingOptIn: previousProfile?.marketing_opt_in ?? null,
      smsOptIn: previousProfile?.sms_opt_in ?? null,
    },
    after_summary: {
      firstName: profileUpdate.first_name,
      lastName: profileUpdate.last_name,
      phone: maskPhone(profileUpdate.phone),
      preferredContactMethod,
      marketingOptIn: profileUpdate.marketing_opt_in,
      smsOptIn: profileUpdate.sms_opt_in,
    },
    request_id: requestId,
    status: "success",
  });

  logger.info("admin_customer_profile_updated", {
    requestId,
    action: "customer_profile_updated",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: profileId,
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${profileId}`);
}

export async function changeCustomerEmailAdminAction(
  _previousState: AdminEmailChangeState,
  formData: FormData,
): Promise<AdminEmailChangeState> {
  const requestId = createRequestId();
  const auth = await requireAdmin("/admin/customers");

  if (auth.status !== "ok") {
    return {
      status: "error",
      message: "Only authorized admins can change customer email.",
      requestId,
    };
  }

  const profileId = cleanString(formData.get("profileId"), 80);
  const newEmail = cleanString(formData.get("email"), 120).toLowerCase();
  const confirmEmail = cleanString(formData.get("confirmEmail"), 120).toLowerCase();
  const note = cleanLongText(formData.get("note"), 500) || null;

  if (!profileId || !isValidEmail(newEmail)) {
    return {
      status: "error",
      message: "Enter a valid customer email before saving.",
      requestId,
    };
  }

  if (newEmail !== confirmEmail) {
    return {
      status: "error",
      message: "The email fields do not match.",
      requestId,
    };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      status: "error",
      message: "Customer profile was not found.",
      requestId,
    };
  }

  const previousEmail = profile.email?.trim().toLowerCase() || null;
  const beforeSummary = {
    email: maskEmail(previousEmail),
    hasStripeCustomer: Boolean(profile.stripe_customer_id),
  };
  const afterSummary = {
    email: maskEmail(newEmail),
    hasStripeCustomer: Boolean(profile.stripe_customer_id),
  };

  if (previousEmail === newEmail) {
    return {
      status: "success",
      message: "That email is already on this customer.",
      requestId,
    };
  }

  const { data: duplicateProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("email", newEmail)
    .neq("id", profileId)
    .limit(1);

  if (duplicateProfiles?.length) {
    await writeAdminAuditLog({
      action: "customer_email_changed",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "profile",
      target_id: profileId,
      customer_id: profileId,
      before_summary: beforeSummary,
      after_summary: afterSummary,
      note,
      request_id: requestId,
      status: "failure",
      metadata: { reason: "duplicate_profile_email" },
    });
    return {
      status: "error",
      message: "Another Clean Curb Co. profile already uses that email.",
      requestId,
    };
  }

  const { data: authUsers, error: authUsersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsersError) {
    logger.error("admin_customer_email_duplicate_auth_lookup_failed", {
      requestId,
      action: "customer_email_changed",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: profileId,
      error: authUsersError,
    });
    return {
      status: "error",
      message: "Could not verify whether another login already uses that email.",
      requestId,
    };
  }

  const duplicateAuthUser = authUsers.users.find(
    (user) => user.id !== profileId && user.email?.toLowerCase() === newEmail,
  );
  if (duplicateAuthUser) {
    await writeAdminAuditLog({
      action: "customer_email_changed",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "profile",
      target_id: profileId,
      customer_id: profileId,
      before_summary: beforeSummary,
      after_summary: afterSummary,
      note,
      request_id: requestId,
      status: "failure",
      metadata: { reason: "duplicate_auth_email" },
    });
    return {
      status: "error",
      message: "Another Supabase Auth user already uses that email.",
      requestId,
    };
  }

  const { data: customerBookings } = await admin
    .from("bookings")
    .select("id")
    .eq("customer_id", profileId);
  const bookingIds = customerBookings?.map((booking) => booking.id) ?? [];

  if (profile.stripe_customer_id && !isStripeConfigured()) {
    return {
      status: "error",
      message:
        "This customer is linked to Stripe, but Stripe is not configured for email sync.",
      requestId,
    };
  }

  try {
    if (profile.stripe_customer_id) {
      await getStripe().customers.update(profile.stripe_customer_id, {
        email: newEmail,
      });
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      profileId,
      {
        email: newEmail,
        email_confirm: true,
      },
    );
    if (authUpdateError) throw authUpdateError;

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", profileId);
    const { error: bookingUpdateError } = await admin
      .from("bookings")
      .update({ email: newEmail })
      .eq("customer_id", profileId);
    const { error: referralUpdateError } = await admin
      .from("referrals")
      .update({ referred_email: newEmail })
      .eq("referred_profile_id", profileId);
    const { error: claimUpdateError } = bookingIds.length
      ? await admin
          .from("booking_claims")
          .update({ email: newEmail })
          .in("booking_id", bookingIds)
      : { error: null };

    const appError =
      profileUpdateError ||
      bookingUpdateError ||
      referralUpdateError ||
      claimUpdateError;
    if (appError) {
      await rollbackCustomerEmailChange({
        admin,
        profileId,
        previousEmail,
        stripeCustomerId: profile.stripe_customer_id,
        requestId,
      });
      throw appError;
    }

    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: profileId,
      event_type: "customer_email_changed",
      message: "Customer login email changed by admin.",
      metadata: {
        previousEmail: maskEmail(previousEmail),
        newEmail: maskEmail(newEmail),
        stripeCustomerSynced: Boolean(profile.stripe_customer_id),
      },
    });

    await writeAdminAuditLog({
      action: "customer_email_changed",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "profile",
      target_id: profileId,
      customer_id: profileId,
      before_summary: beforeSummary,
      after_summary: {
        ...afterSummary,
        supabaseAuthUpdated: true,
        profileUpdated: true,
        bookingRecordsUpdated: bookingIds.length,
        stripeCustomerUpdated: Boolean(profile.stripe_customer_id),
      },
      note,
      request_id: requestId,
      status: "success",
    });

    logger.info("admin_customer_email_changed", {
      requestId,
      action: "customer_email_changed",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: profileId,
      metadata: {
        bookingRecordsUpdated: bookingIds.length,
        stripeCustomerUpdated: Boolean(profile.stripe_customer_id),
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${profileId}`);
    revalidatePath("/portal");
    revalidatePath("/portal/account");

    return {
      status: "success",
      message:
        "Customer login email updated in Supabase Auth, app records, and Stripe when linked.",
      requestId,
    };
  } catch (error) {
    logger.error("admin_customer_email_change_failed", {
      requestId,
      action: "customer_email_changed",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: profileId,
      error,
    });
    await writeAdminAuditLog({
      action: "customer_email_changed",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "profile",
      target_id: profileId,
      customer_id: profileId,
      before_summary: beforeSummary,
      after_summary: afterSummary,
      note,
      request_id: requestId,
      status: "failure",
      metadata: {
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return {
      status: "error",
      message: "Customer email could not be changed. Check logs for the request ID.",
      requestId,
    };
  }
}

export async function updateCustomerRequestAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/requests");
  if (auth.status !== "ok") return;

  const auditRequestId = createRequestId();
  const requestId = cleanString(formData.get("requestId"), 80);
  const status = pickEnum<CustomerRequestStatus>(
    formData.get("status"),
    validCustomerRequestStatuses,
    "reviewing",
  );
  const bookingStatusInput = cleanString(formData.get("bookingStatus"), 40);
  const paymentStatusInput = cleanString(formData.get("paymentStatus"), 40);
  const adminNotes = cleanLongText(formData.get("adminNotes"), 3000) || null;
  const customerMessage =
    cleanLongText(formData.get("customerVisibleAdminMessage"), 1500) || null;
  if (!requestId) return;

  const admin = getSupabaseAdmin();
  const { data: previousRequest } = await admin
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  const { data: request } = await admin
    .from("customer_requests")
    .update({
      status,
      admin_notes: adminNotes,
      customer_visible_admin_message: customerMessage,
      reviewed_by_user_id: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (request) {
    if (
      request.booking_id &&
      ["approved", "completed"].includes(status)
    ) {
      const { data: booking } = await admin
        .from("bookings")
        .select("*")
        .eq("id", request.booking_id)
        .maybeSingle();

      if (booking) {
        await applyApprovedCustomerRequest(admin, booking, request);
      }
    }

    if (request.booking_id && (bookingStatusInput || paymentStatusInput)) {
      const bookingUpdate: {
        status?: BookingStatus;
        payment_status?: PaymentStatus;
      } = {};

      if (bookingStatusInput) {
        bookingUpdate.status = pickEnum<BookingStatus>(
          bookingStatusInput,
          validBookingStatuses,
          "needs_follow_up",
        );
      }

      if (paymentStatusInput) {
        bookingUpdate.payment_status = pickEnum<PaymentStatus>(
          paymentStatusInput,
          validPaymentStatuses,
          "not_sent",
        );
      }

      await admin.from("bookings").update(bookingUpdate).eq("id", request.booking_id);
    }

    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: request.customer_id,
      booking_id: request.booking_id,
      request_id: request.id,
      event_type: "customer_request_updated",
      message: `Customer request marked ${status}.`,
      metadata: { status },
    });

    await writeAdminAuditLog({
      action: "service_request_handled",
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "customer_request",
      target_id: request.id,
      customer_id: request.customer_id,
      booking_id: request.booking_id,
      before_summary: {},
      after_summary: {
        previousStatus: previousRequest?.status ?? null,
        status: request.status,
        bookingStatus: bookingStatusInput || null,
        paymentStatus: paymentStatusInput || null,
        customerVisibleMessage: Boolean(request.customer_visible_admin_message),
      },
      note: request.admin_notes,
      request_id: auditRequestId,
      status: "success",
    });

    logger.info("admin_customer_request_updated", {
      requestId: auditRequestId,
      action: "service_request_handled",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: request.customer_id,
      bookingId: request.booking_id,
      metadata: { status },
    });

    if (request.customer_id && formData.get("sendUpdateEmail") === "on") {
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", request.customer_id)
        .maybeSingle();
      if (profile) {
        await sendCustomerRequestUpdate(request, profile);
      }
    }
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  if (request?.customer_id) revalidatePath(`/admin/customers/${request.customer_id}`);
}

export async function updateAccountDeletionRequestAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/requests");
  if (auth.status !== "ok") return;

  const auditRequestId = createRequestId();
  const deletionRequestId = cleanString(formData.get("deletionRequestId"), 80);
  const status = pickEnum<AccountDeletionStatus>(
    formData.get("status"),
    ["pending", "approved", "declined", "cancelled", "completed"],
    "pending",
  );
  const adminNote = cleanLongText(formData.get("adminNote"), 3000) || null;
  const customerMessage =
    cleanLongText(formData.get("customerVisibleAdminMessage"), 1500) || null;
  const disablePortalAccess = formData.get("disablePortalAccess") === "on";

  if (!deletionRequestId) return;

  const admin = getSupabaseAdmin();
  const { data: previousRequest } = await admin
    .from("account_deletion_requests")
    .select("*")
    .eq("id", deletionRequestId)
    .maybeSingle();

  if (!previousRequest) return;

  const now = new Date().toISOString();
  const { data: deletionRequest } = await admin
    .from("account_deletion_requests")
    .update({
      status,
      admin_note: adminNote,
      customer_visible_admin_message: customerMessage,
      reviewed_by_user_id: auth.userId,
      reviewed_at: ["approved", "declined", "cancelled", "completed"].includes(status)
        ? now
        : previousRequest.reviewed_at,
      completed_at: status === "completed" ? now : previousRequest.completed_at,
      updated_at: now,
    })
    .eq("id", deletionRequestId)
    .select("*")
    .single();

  if (!deletionRequest) return;

  let profile: Database["public"]["Tables"]["profiles"]["Row"] | null = null;
  if (deletionRequest.customer_id) {
    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("id", deletionRequest.customer_id)
      .maybeSingle();
    profile = data ?? null;
  }

  if (profile) {
    const shouldDisable =
      disablePortalAccess || status === "approved" || status === "completed";
    const profileUpdate =
      status === "completed"
        ? {
            account_status: "deleted" as const,
            portal_access_enabled: false,
            deleted_at: now,
            deletion_requested_at:
              profile.deletion_requested_at ?? previousRequest.created_at,
          }
        : status === "approved"
          ? {
              account_status: "pending_deletion" as const,
              portal_access_enabled: !shouldDisable ? true : false,
              deletion_requested_at:
                profile.deletion_requested_at ?? previousRequest.created_at,
            }
          : status === "declined" || status === "cancelled"
            ? {
                account_status: "active" as const,
                portal_access_enabled: true,
                deletion_requested_at: null,
              }
            : shouldDisable
              ? {
                  account_status: "portal_disabled" as const,
                  portal_access_enabled: false,
                }
              : {};

    await admin.from("profiles").update(profileUpdate).eq("id", profile.id);
  }

  await Promise.allSettled([
    logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: deletionRequest.customer_id,
      event_type: "account_deletion_reviewed",
      message: `Account deletion request marked ${status}.`,
      metadata: { status, deletionRequestId: deletionRequest.id },
    }),
    writeAdminAuditLog({
      action: `account_deletion_${status}`,
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "account_deletion_request",
      target_id: deletionRequest.id,
      customer_id: deletionRequest.customer_id,
      before_summary: {
        status: previousRequest.status,
        completedAt: previousRequest.completed_at,
      },
      after_summary: {
        status: deletionRequest.status,
        completedAt: deletionRequest.completed_at,
        portalDisabled: disablePortalAccess || status === "completed",
      },
      note: adminNote,
      request_id: auditRequestId,
      status: "success",
    }),
    createAdminNotification({
      type: "account_deletion_reviewed",
      title: "Account deletion request updated",
      message: `Deletion request marked ${status}.`,
      href: deletionRequest.customer_id
        ? `/admin/customers/${deletionRequest.customer_id}`
        : "/admin/requests",
      customer_id: deletionRequest.customer_id,
      account_deletion_request_id: deletionRequest.id,
      severity: status === "completed" ? "warning" : "info",
    }),
    profile
      ? sendAccountDeletionDecision(
          deletionRequest,
          profile,
          humanizeStatus(status),
        )
      : Promise.resolve({ status: "skipped" as const, reason: "No profile." }),
  ]);

  logger.info("admin_account_deletion_request_updated", {
    requestId: auditRequestId,
    action: "account_deletion_reviewed",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: deletionRequest.customer_id,
    metadata: { status },
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin/customers");
  if (deletionRequest.customer_id) {
    revalidatePath(`/admin/customers/${deletionRequest.customer_id}`);
  }
}

export async function processCustomerAccountAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/customers");
  if (auth.status !== "ok") return;

  const requestId = createRequestId();
  const profileId = cleanString(formData.get("profileId"), 80);
  const actionType = cleanString(formData.get("accountAction"), 40);
  const confirmation = cleanString(formData.get("confirmation"), 20);
  const adminNote = cleanLongText(formData.get("adminNote"), 3000);
  const customerMessage =
    cleanLongText(formData.get("customerVisibleAdminMessage"), 1500) || null;

  if (!profileId || !adminNote) return;
  if (actionType === "complete_deletion" && confirmation !== "DELETE") return;
  if (actionType !== "complete_deletion" && confirmation !== "DISABLE") return;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return;

  const now = new Date().toISOString();
  const status: AccountDeletionStatus =
    actionType === "complete_deletion" ? "completed" : "approved";
  const accountStatus =
    actionType === "complete_deletion"
      ? "deleted"
      : actionType === "pending_deletion"
        ? "pending_deletion"
        : "portal_disabled";

  const { data: deletionRequest } = await admin
    .from("account_deletion_requests")
    .insert({
      customer_id: profile.id,
      customer_email: profile.email,
      status,
      requested_by_user_id: auth.userId,
      requested_by_role: "admin",
      request_reason: `Admin ${actionType.replaceAll("_", " ")}`,
      admin_note: adminNote,
      customer_visible_admin_message: customerMessage,
      reviewed_by_user_id: auth.userId,
      reviewed_at: now,
      completed_at: status === "completed" ? now : null,
    })
    .select("*")
    .single();

  await admin
    .from("profiles")
    .update({
      account_status: accountStatus,
      portal_access_enabled: false,
      deletion_requested_at:
        actionType === "pending_deletion" || actionType === "complete_deletion"
          ? profile.deletion_requested_at ?? now
          : profile.deletion_requested_at,
      deleted_at: actionType === "complete_deletion" ? now : profile.deleted_at,
    })
    .eq("id", profile.id);

  await Promise.allSettled([
    logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: profile.id,
      event_type: "customer_account_admin_processed",
      message: `Customer account action: ${actionType}.`,
      metadata: { requestId, accountAction: actionType },
    }),
    writeAdminAuditLog({
      action: `customer_account_${actionType}`,
      actor_user_id: auth.userId,
      actor_email: actorEmail(auth),
      actor_role: auth.profile.role,
      target_type: "profile",
      target_id: profile.id,
      customer_id: profile.id,
      before_summary: {
        accountStatus: profile.account_status,
        portalAccessEnabled: profile.portal_access_enabled,
      },
      after_summary: {
        accountStatus,
        portalAccessEnabled: false,
        deletionRequestId: deletionRequest?.id ?? null,
      },
      note: adminNote,
      request_id: requestId,
      status: "success",
    }),
    createAdminNotification({
      type: "customer_account_admin_action",
      title: "Customer account updated",
      message: `Customer account action completed: ${actionType.replaceAll("_", " ")}.`,
      href: `/admin/customers/${profile.id}`,
      customer_id: profile.id,
      account_deletion_request_id: deletionRequest?.id ?? null,
      severity: actionType === "complete_deletion" ? "warning" : "info",
    }),
    deletionRequest
      ? sendAccountDeletionDecision(
          deletionRequest,
          profile,
          humanizeStatus(status),
        )
      : Promise.resolve({ status: "skipped" as const, reason: "No request." }),
  ]);

  logger.info("admin_customer_account_processed", {
    requestId,
    action: "customer_account_processed",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: profile.id,
    metadata: { accountAction: actionType },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${profile.id}`);
  revalidatePath("/admin/requests");
}

async function applyApprovedCustomerRequest(
  admin: AdminClient,
  booking: Database["public"]["Tables"]["bookings"]["Row"],
  request: Database["public"]["Tables"]["customer_requests"]["Row"],
) {
  const update: Partial<BookingRow> = {
    last_customer_change_request_at: new Date().toISOString(),
    cancellation_policy_status: "none",
  };

  if (request.request_type === "cancel_service") {
    update.status = "cancelled";
  }

  if (request.request_type === "pause_service") {
    update.status = "needs_follow_up";
    update.customer_visible_admin_message =
      request.customer_visible_admin_message ?? null;
  }

  if (request.request_type === "reschedule_service" && request.requested_route_day) {
    update.requested_date = request.requested_route_day;
    update.confirmed_route_day = null;
    update.status = "needs_follow_up";
  }

  if (request.request_type === "change_frequency" && request.requested_frequency) {
    update.frequency = request.requested_frequency;
    update.estimated_price = calculateBookingEstimate({
      binCount: booking.bin_count,
      frequency: request.requested_frequency,
      addOns: booking.add_ons ?? [],
      applyFoundingNeighborPromo: shouldApplyFoundingNeighborSpecial({
        binCount: booking.bin_count,
        frequency: request.requested_frequency,
        addOns: booking.add_ons ?? [],
        neighborhood: booking.neighborhood,
        createdAt: booking.created_at,
      }),
    });
  }

  if (request.request_type === "add_service" || request.request_type === "drop_service") {
    const addOns =
      request.request_type === "add_service"
        ? Array.from(new Set([...(booking.add_ons ?? []), ...request.requested_add_ons]))
        : (booking.add_ons ?? []).filter(
            (addOn) => !request.requested_removed_add_ons.includes(addOn),
          );
    update.add_ons = addOns;
    update.estimated_price = calculateBookingEstimate({
      binCount: booking.bin_count,
      frequency: booking.frequency,
      addOns,
      applyFoundingNeighborPromo: shouldApplyFoundingNeighborSpecial({
        binCount: booking.bin_count,
        frequency: booking.frequency,
        addOns,
        neighborhood: booking.neighborhood,
        createdAt: booking.created_at,
      }),
    });
  }

  await admin.from("bookings").update(update).eq("id", booking.id);
}

export async function updateReferralAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/referrals");
  if (auth.status !== "ok") return;

  const referralId = cleanString(formData.get("referralId"), 80);
  const status = pickEnum<ReferralStatus>(
    formData.get("status"),
    validReferralStatuses,
    "pending",
  );
  if (!referralId) return;

  const admin = getSupabaseAdmin();
  const { data: referral } = await admin
    .from("referrals")
    .update({
      status,
      admin_notes: cleanLongText(formData.get("adminNotes"), 3000) || null,
    })
    .eq("id", referralId)
    .select("*")
    .single();

  if (referral) {
    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: referral.referrer_profile_id,
      booking_id: referral.referred_booking_id,
      referral_id: referral.id,
      event_type: "referral_status_changed",
      message: `Referral marked ${status}.`,
      metadata: { status },
    });

    if (
      referral.referrer_profile_id &&
      formData.get("sendRewardEmail") === "on" &&
      ["reward_ready", "reward_sent"].includes(status)
    ) {
      const { data: referrer } = await admin
        .from("profiles")
        .select("*")
        .eq("id", referral.referrer_profile_id)
        .maybeSingle();
      if (referrer) {
        await sendReferralRewardEmail(
          referral,
          referrer,
          status === "reward_sent" ? "sent" : "ready",
        );
      }
    }
  }

  revalidatePath("/admin/referrals");
  if (referral?.referrer_profile_id) {
    revalidatePath(`/admin/customers/${referral.referrer_profile_id}`);
  }
}

export async function sendReviewRequestAction(formData: FormData) {
  const auth = await requireAdmin("/admin/reviews");
  if (auth.status !== "ok") return;

  const bookingId = cleanString(formData.get("bookingId"), 80);
  if (!bookingId) return;

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (booking) {
    await sendReviewRequest(booking);
  }

  revalidatePath("/admin/reviews");
}

export async function createRouteDayAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/routes");
  if (auth.status !== "ok") return;

  const routeDate = cleanString(formData.get("routeDate"), 30);
  if (!routeDate) return;

  const admin = getSupabaseAdmin();
  await admin.from("route_days").insert({
    route_date: routeDate,
    route_name: cleanString(formData.get("routeName"), 120) || null,
    service_area: cleanString(formData.get("serviceArea"), 120) || "Cane Bay",
    status: pickEnum<RouteDayStatus>(
      formData.get("status"),
      routeDayStatuses,
      "planned",
    ),
    assigned_technician_id:
      cleanString(formData.get("assignedTechnicianId"), 80) || null,
    notes: cleanLongText(formData.get("notes"), 1200) || null,
  });

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    event_type: "route_day_created",
    message: `Route day created for ${routeDate}.`,
  });

  revalidatePath("/admin/routes");
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
}

export async function updateRouteDayAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/routes");
  if (auth.status !== "ok") return;

  const routeDayId = cleanString(formData.get("routeDayId"), 80);
  if (!routeDayId) return;

  const admin = getSupabaseAdmin();
  await admin
    .from("route_days")
    .update({
      route_name: cleanString(formData.get("routeName"), 120) || null,
      service_area: cleanString(formData.get("serviceArea"), 120) || "Cane Bay",
      status: pickEnum<RouteDayStatus>(
        formData.get("status"),
        routeDayStatuses,
        "planned",
      ),
      assigned_technician_id:
        cleanString(formData.get("assignedTechnicianId"), 80) || null,
      notes: cleanLongText(formData.get("notes"), 1200) || null,
    })
    .eq("id", routeDayId);

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    event_type: "route_day_updated",
    message: "Route day updated.",
    metadata: { routeDayId },
  });

  revalidatePath("/admin/routes");
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
}

export async function addBookingToRouteAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/routes");
  if (auth.status !== "ok") return;

  const routeDayId = cleanString(formData.get("routeDayId"), 80);
  const bookingId = cleanString(formData.get("bookingId"), 80);
  if (!routeDayId || !bookingId) return;

  const admin = getSupabaseAdmin();
  const [{ data: routeDay }, { data: booking }, { data: existingStop }] =
    await Promise.all([
      admin.from("route_days").select("*").eq("id", routeDayId).maybeSingle(),
      admin.from("bookings").select("*").eq("id", bookingId).maybeSingle(),
      admin
        .from("route_stops")
        .select("*")
        .eq("route_day_id", routeDayId)
        .eq("booking_id", bookingId)
        .maybeSingle(),
    ]);

  if (!routeDay || !booking || existingStop) return;

  const { data: createdVisit } = await admin
    .from("service_visits")
    .insert({
      booking_id: booking.id,
      customer_id: booking.customer_id,
      route_day: routeDay.route_date,
      status: "scheduled",
    })
    .select("*")
    .single();
  const visitId = createdVisit?.id ?? "";
  if (!visitId) return;

  const { data: lastStop } = await admin
    .from("route_stops")
    .select("stop_order")
    .eq("route_day_id", routeDayId)
    .order("stop_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const requestedOrder = Number(formData.get("stopOrder"));
  const stopOrder =
    Number.isFinite(requestedOrder) && requestedOrder > 0
      ? requestedOrder
      : (lastStop?.stop_order ?? 0) + 1;

  await admin.from("route_stops").insert({
    route_day_id: routeDayId,
    booking_id: booking.id,
    service_visit_id: visitId,
    stop_order: stopOrder,
    status: "scheduled",
  });

  await admin
    .from("bookings")
    .update({
      status: "scheduled",
      confirmed_route_day: routeDay.route_date,
    })
    .eq("id", booking.id);

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    customer_id: booking.customer_id,
    booking_id: booking.id,
    event_type: "booking_added_to_route",
    message: "Booking added to route day.",
    metadata: { routeDayId, stopOrder },
  });

  revalidatePath("/admin/routes");
  revalidatePath("/admin/bookings");
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
}

export async function updateRouteStopAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/routes");
  if (auth.status !== "ok") return;

  const routeStopId = cleanString(formData.get("routeStopId"), 80);
  if (!routeStopId) return;

  const stopOrder = Number(formData.get("stopOrder"));
  const status = pickEnum<FieldStopStatus>(
    formData.get("status"),
    routeStopStatuses,
    "scheduled",
  );
  const admin = getSupabaseAdmin();
  const { data: stop } = await admin
    .from("route_stops")
    .update({
      stop_order: Number.isFinite(stopOrder) ? stopOrder : 0,
      status,
      technician_notes: cleanLongText(formData.get("technicianNotes"), 1500) || null,
    })
    .eq("id", routeStopId)
    .select("*")
    .single();

  if (stop?.service_visit_id) {
    await admin
      .from("service_visits")
      .update({ status })
      .eq("id", stop.service_visit_id);
  }

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    booking_id: stop?.booking_id ?? null,
    event_type: "route_stop_updated",
    message: "Route stop updated.",
    metadata: { routeStopId, status },
  });

  revalidatePath("/admin/routes");
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
  if (stop?.service_visit_id) revalidatePath(`/field/stops/${stop.service_visit_id}`);
}

export async function removeRouteStopAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/routes");
  if (auth.status !== "ok") return;

  const routeStopId = cleanString(formData.get("routeStopId"), 80);
  if (!routeStopId) return;

  const admin = getSupabaseAdmin();
  const { data: stop } = await admin
    .from("route_stops")
    .select("*")
    .eq("id", routeStopId)
    .maybeSingle();

  await admin.from("route_stops").delete().eq("id", routeStopId);

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    booking_id: stop?.booking_id ?? null,
    event_type: "route_stop_removed",
    message: "Route stop removed from route day.",
    metadata: { routeStopId },
  });

  revalidatePath("/admin/routes");
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
}

export async function updateCareerApplicationAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/careers");
  if (auth.status !== "ok") return;

  const applicationId = cleanString(formData.get("applicationId"), 80);
  if (!applicationId) return;

  const status = pickEnum<CareerApplicationStatus>(
    formData.get("status"),
    careerApplicationStatuses,
    "reviewing",
  );
  const admin = getSupabaseAdmin();
  await admin
    .from("career_applications")
    .update({
      status,
      admin_notes: cleanLongText(formData.get("adminNotes"), 3000) || null,
    })
    .eq("id", applicationId);

  await logActivity(admin, {
    actor_profile_id: auth.userId,
    event_type: "career_application_updated",
    message: `Career application marked ${status}.`,
    metadata: { applicationId, status },
  });

  revalidatePath("/admin/careers");
}

export async function markAdminNotificationReadAction(formData: FormData) {
  const auth = await requireAdmin("/admin");
  if (auth.status !== "ok") return;

  const notificationId = cleanString(formData.get("notificationId"), 80);
  if (!notificationId) return;

  await getSupabaseAdmin()
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/admin");
}

export async function markAllAdminNotificationsReadAction() {
  const auth = await requireAdmin("/admin");
  if (auth.status !== "ok") return;

  await getSupabaseAdmin()
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  revalidatePath("/admin");
}
