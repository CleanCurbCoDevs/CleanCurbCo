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
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";
import { cleanLongText, cleanString, pickEnum } from "@/lib/validation";
import type { BookingStatus, PaymentStatus } from "@/types/booking";
import type {
  CustomerRequestStatus,
  Database,
  ReferralStatus,
} from "@/types/database";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;
const preferredContactMethods = ["email", "phone", "sms"] as const;

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

export async function updateBookingAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/bookings");
  if (auth.status !== "ok") return;

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

export async function updatePaymentStatusAction(formData: FormData) {
  const auth = await requireAdmin("/admin/payments");
  if (auth.status !== "ok") return;

  const bookingId = cleanString(formData.get("bookingId"), 80);
  const paymentStatus = pickEnum<PaymentStatus>(
    formData.get("quickPaymentStatus") ?? formData.get("paymentStatus"),
    validPaymentStatuses,
    "not_sent",
  );
  if (!bookingId) return;

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .update({ payment_status: paymentStatus })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (booking) {
    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      event_type: "payment_status_changed",
      message: `Payment status changed to ${paymentStatus}.`,
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

  const admin = getSupabaseAdmin();
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

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${profileId}`);
}

export async function updateCustomerRequestAdminAction(formData: FormData) {
  const auth = await requireAdmin("/admin/requests");
  if (auth.status !== "ok") return;

  const requestId = cleanString(formData.get("requestId"), 80);
  const status = pickEnum<CustomerRequestStatus>(
    formData.get("status"),
    validCustomerRequestStatuses,
    "reviewing",
  );
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
    await logActivity(admin, {
      actor_profile_id: auth.userId,
      customer_id: request.customer_id,
      booking_id: request.booking_id,
      request_id: request.id,
      event_type: "customer_request_updated",
      message: `Customer request marked ${status}.`,
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
