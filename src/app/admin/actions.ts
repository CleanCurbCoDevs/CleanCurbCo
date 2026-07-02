"use server";

import { revalidatePath } from "next/cache";
import {
  validCustomerRequestStatuses,
  validBookingStatuses,
  validPaymentStatuses,
  validReferralStatuses,
} from "@/lib/booking-utils";
import { sendCustomerRequestUpdate } from "@/lib/email/sendCustomerRequestEmail";
import { sendPaymentLink } from "@/lib/email/sendPaymentLink";
import { sendReferralRewardEmail } from "@/lib/email/sendReferralReward";
import { sendReviewRequest } from "@/lib/email/sendReviewRequest";
import { sendRouteConfirmation } from "@/lib/email/sendRouteConfirmation";
import { isStripeConfigured } from "@/lib/env";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createRequestId, logger, maskEmail, maskPhone } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";
import { cleanLongText, cleanString, isValidEmail, pickEnum } from "@/lib/validation";
import type { BookingStatus, PaymentStatus } from "@/types/booking";
import type {
  CareerApplicationStatus,
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

  const admin = getSupabaseAdmin();
  const { data: previousBooking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  const { data: updatedBooking } = await admin
    .from("bookings")
    .update({
      status,
      confirmed_route_day: confirmedRouteDay,
      internal_notes: internalNotes,
      payment_status: paymentStatus,
      payment_link: paymentLink,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      payment_reference: paymentReference,
    })
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
  if (!requestId) return;

  const admin = getSupabaseAdmin();
  const { data: request } = await admin
    .from("customer_requests")
    .update({
      status,
      admin_notes: cleanLongText(formData.get("adminNotes"), 3000) || null,
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (request) {
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
        status: request.status,
        bookingStatus: bookingStatusInput || null,
        paymentStatus: paymentStatusInput || null,
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
