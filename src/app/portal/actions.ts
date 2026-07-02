"use server";

import { revalidatePath } from "next/cache";
import {
  validFrequencies,
  validRequestTypes,
} from "@/lib/booking-utils";
import {
  sendAdminCustomerRequestAlert,
  sendCustomerRequestReceived,
} from "@/lib/email/sendCustomerRequestEmail";
import {
  sendAccountDeletionRequested,
  sendAdminAccountDeletionRequest,
  sendAdminRouteDateResponse,
  sendRouteDateResponse,
} from "@/lib/email/sendOperationsEmail";
import { getSiteUrl } from "@/lib/env";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { createRequestId, logger } from "@/lib/server/logger";
import {
  evaluatePolicyWindow,
  getBookingServiceDate,
  getCancellationFee,
  getFullChargeApplies,
  namesMatch,
  requiresTypedAcknowledgment,
} from "@/lib/service-policy";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanArray, cleanLongText, cleanString, pickEnum } from "@/lib/validation";
import type { ServiceFrequency } from "@/types/booking";
import type { BookingRow, RequestType } from "@/types/database";

const preferredContactMethods = ["email", "phone", "sms"] as const;

export type AccountDeletionRequestState = {
  status: "idle" | "success" | "error";
  message: string;
  requestId?: string;
};

export async function updatePortalAccountAction(formData: FormData) {
  const auth = await requireAuth("/portal/account");
  if (auth.status !== "ok") return;

  const admin = getSupabaseAdmin();
  const preferredContactMethod = pickEnum(
    formData.get("preferredContactMethod"),
    preferredContactMethods,
    "email",
  );

  await admin
    .from("profiles")
    .update({
      first_name: cleanString(formData.get("firstName"), 80) || null,
      last_name: cleanString(formData.get("lastName"), 80) || null,
      phone: cleanString(formData.get("phone"), 40) || null,
      preferred_contact_method: preferredContactMethod,
      marketing_opt_in: formData.get("marketingOptIn") === "on",
      sms_opt_in: formData.get("smsOptIn") === "on",
    })
    .eq("id", auth.userId);

  const serviceAddressId = cleanString(formData.get("serviceAddressId"), 80);
  const streetAddress = cleanString(formData.get("streetAddress"), 180);
  const addressPayload = {
    street_address: streetAddress,
    city: cleanString(formData.get("city"), 80) || "Summerville",
    state: cleanString(formData.get("state"), 20) || "SC",
    zip_code: cleanString(formData.get("zipCode"), 20) || null,
    neighborhood: cleanString(formData.get("neighborhood"), 120) || null,
    gate_code: cleanString(formData.get("gateCode"), 80) || null,
    notes: cleanLongText(formData.get("addressNotes"), 1000) || null,
    is_primary: true,
  };

  if (serviceAddressId && streetAddress) {
    await admin
      .from("service_addresses")
      .update(addressPayload)
      .eq("id", serviceAddressId)
      .eq("customer_id", auth.userId);
  } else if (streetAddress) {
    await admin.from("service_addresses").insert({
      customer_id: auth.userId,
      label: "Home",
      ...addressPayload,
    });
  }

  await admin.from("activity_events").insert({
    actor_profile_id: auth.userId,
    customer_id: auth.userId,
    event_type: "customer_account_updated",
    message: "Customer updated account settings.",
  });

  revalidatePath("/portal");
  revalidatePath("/portal/account");
}

export async function createCustomerRequestAction(formData: FormData) {
  const requestId = createRequestId();
  const auth = await requireAuth("/portal/manage-service");
  if (auth.status !== "ok") {
    logger.warn("customer_service_request_auth_failed", {
      requestId,
      action: "customer_service_request_submit",
      status: auth.status,
    });
    return { ok: false, error: "Please log in to manage service." };
  }

  const requestType = pickEnum<RequestType>(
    formData.get("requestType"),
    validRequestTypes,
    "general_help",
  );
  const requestedFrequency =
    requestType === "change_frequency"
      ? pickEnum<ServiceFrequency>(
          formData.get("requestedFrequency"),
          validFrequencies,
          "monthly",
        )
      : null;
  const bookingId = cleanString(formData.get("bookingId"), 80) || null;
  const requestedRouteDay = cleanString(formData.get("requestedRouteDay"), 30) || null;
  const requestedAddOns = cleanArray(formData.getAll("requestedAddOns"));
  const requestedRemovedAddOns = cleanArray(
    formData.getAll("requestedRemovedAddOns"),
  );
  const typedName = cleanString(formData.get("policyAcknowledgedName"), 120);
  const customerMessage = cleanLongText(formData.get("message"), 1500);

  const admin = getSupabaseAdmin();
  const { data: booking } = bookingId
    ? await admin
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("customer_id", auth.userId)
        .maybeSingle()
    : { data: null };
  const { data: visits } = booking
    ? await admin
        .from("service_visits")
        .select("*")
        .eq("booking_id", booking.id)
        .eq("customer_id", auth.userId)
    : { data: [] };
  const serviceDate = getBookingServiceDate(booking, visits ?? []);
  const policyWindow = evaluatePolicyWindow(serviceDate);
  const typedAcknowledgmentRequired = requiresTypedAcknowledgment(
    requestType,
    policyWindow,
  );
  const validNames = [
    [auth.profile.first_name, auth.profile.last_name].filter(Boolean).join(" "),
    booking ? [booking.first_name, booking.last_name].filter(Boolean).join(" ") : "",
  ].filter(Boolean);

  if (typedAcknowledgmentRequired && !namesMatch(typedName, validNames)) {
    logger.warn("customer_service_request_policy_ack_failed", {
      requestId,
      action: "customer_service_request_submit",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: auth.userId,
      bookingId,
      metadata: { requestType, policyWindow },
    });
    return {
      ok: false,
      error:
        "Please type the customer full name exactly to acknowledge this service policy.",
    };
  }

  const policyAcknowledged = typedAcknowledgmentRequired;
  const cancellationFee = getCancellationFee(requestType, policyWindow);
  const fullChargeApplies = getFullChargeApplies(requestType, policyWindow);
  const originalEstimatedPrice = booking?.estimated_price ?? null;
  const nextStatus = "new";
  const message = buildRequestMessage(formData, customerMessage);

  const { data: request } = await admin
    .from("customer_requests")
    .insert({
      customer_id: auth.userId,
      booking_id: bookingId,
      request_type: requestType,
      status: nextStatus,
      policy_window: policyWindow,
      policy_acknowledged: policyAcknowledged,
      policy_acknowledged_at: policyAcknowledged ? new Date().toISOString() : null,
      policy_acknowledged_name: policyAcknowledged ? typedName : null,
      original_estimated_price: originalEstimatedPrice,
      cancellation_fee: cancellationFee,
      full_charge_applies: fullChargeApplies,
      requested_frequency: requestedFrequency,
      requested_pause_start: cleanString(formData.get("pauseStart"), 30) || null,
      requested_pause_end: cleanString(formData.get("pauseEnd"), 30) || null,
      requested_route_day: requestedRouteDay,
      requested_add_ons: requestedAddOns,
      requested_removed_add_ons: requestedRemovedAddOns,
      message: message || null,
    })
    .select("*")
    .single();

  if (request) {
    await admin.from("activity_events").insert({
      actor_profile_id: auth.userId,
      customer_id: auth.userId,
      booking_id: bookingId,
      request_id: request.id,
      event_type: "customer_request_submitted",
      message: `Customer submitted ${requestType}.`,
      metadata: {
        requestType,
        policyWindow,
        policyAcknowledged,
        cancellationFee,
        fullChargeApplies,
        originalEstimatedPrice,
      },
    });
    await Promise.allSettled([
      sendCustomerRequestReceived(request, auth.profile, booking, serviceDate),
      sendAdminCustomerRequestAlert(request, auth.profile, booking, serviceDate),
      createAdminNotification({
        type: "customer_service_change_request",
        title: "Service change request",
        message: `${auth.profile.first_name ?? "Customer"} requested ${requestType.replaceAll("_", " ")}.`,
        href: `/admin/requests?q=${request.id}`,
        customer_id: auth.userId,
        booking_id: bookingId,
        customer_request_id: request.id,
        severity: requestType === "cancel_service" ? "warning" : "info",
      }),
    ]);

    logger.info("customer_service_request_submitted", {
      requestId,
      action: "customer_service_request_submit",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: auth.userId,
      bookingId,
      metadata: {
        requestType,
        status: request.status,
        policyWindow,
        policyAcknowledged,
        selfServiceApplied: false,
      },
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/manage-service");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/bookings");

  return { ok: true };
}

export async function requestAccountDeletionAction(
  _previousState: AccountDeletionRequestState,
  formData: FormData,
): Promise<AccountDeletionRequestState> {
  const requestId = createRequestId();
  const auth = await requireAuth("/portal/account");
  if (auth.status !== "ok") {
    return {
      status: "error",
      message: "Please log in before requesting account deletion.",
      requestId,
    };
  }

  const confirmation = cleanString(formData.get("confirmation"), 20);
  const password = cleanString(formData.get("password"), 200);
  const reason = cleanLongText(formData.get("reason"), 1000) || null;

  if (confirmation !== "DELETE") {
    return {
      status: "error",
      message: "Type DELETE to confirm this account deletion request.",
      requestId,
    };
  }

  if (auth.email && password) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: auth.email,
      password,
    });
    if (error) {
      return {
        status: "error",
        message: "Password confirmation failed. Please try again.",
        requestId,
      };
    }
  } else if (auth.email) {
    return {
      status: "error",
      message: "Please confirm your password before submitting this request.",
      requestId,
    };
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("account_deletion_requests")
    .select("*")
    .eq("customer_id", auth.userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    return {
      status: "success",
      message: "Your account deletion request is already pending review.",
      requestId,
    };
  }

  const { data: deletionRequest, error } = await admin
    .from("account_deletion_requests")
    .insert({
      customer_id: auth.userId,
      customer_email: auth.profile.email ?? auth.email,
      status: "pending",
      requested_by_user_id: auth.userId,
      requested_by_role: "customer",
      request_reason: reason,
    })
    .select("*")
    .single();

  if (error || !deletionRequest) {
    logger.error("account_deletion_request_insert_failed", {
      requestId,
      action: "account_deletion_requested",
      userId: auth.userId,
      role: auth.profile.role,
      customerId: auth.userId,
      error,
    });
    return {
      status: "error",
      message: "We could not submit that request. Please contact Clean Curb Co.",
      requestId,
    };
  }

  await admin
    .from("profiles")
    .update({
      account_status: "pending_deletion",
      deletion_requested_at: new Date().toISOString(),
    })
    .eq("id", auth.userId);

  await Promise.allSettled([
    admin.from("activity_events").insert({
      actor_profile_id: auth.userId,
      customer_id: auth.userId,
      event_type: "account_deletion_requested",
      message: "Customer requested account deletion.",
      metadata: { requestId, deletionRequestId: deletionRequest.id },
    }),
    writeAdminAuditLog({
      action: "customer_deletion_requested",
      actor_user_id: auth.userId,
      actor_email: auth.profile.email,
      actor_role: auth.profile.role,
      target_type: "account_deletion_request",
      target_id: deletionRequest.id,
      customer_id: auth.userId,
      before_summary: { accountStatus: auth.profile.account_status },
      after_summary: { accountStatus: "pending_deletion", status: "pending" },
      note: reason,
      request_id: requestId,
      status: "success",
    }),
    createAdminNotification({
      type: "account_deletion_request",
      title: "Account deletion requested",
      message: `${auth.profile.first_name ?? "Customer"} requested account deletion.`,
      href: `/admin/requests?deletion=${deletionRequest.id}`,
      customer_id: auth.userId,
      account_deletion_request_id: deletionRequest.id,
      severity: "warning",
    }),
    sendAccountDeletionRequested(deletionRequest, auth.profile),
    sendAdminAccountDeletionRequest(
      deletionRequest,
      auth.profile,
      `${getSiteUrl()}/admin/requests?deletion=${deletionRequest.id}`,
    ),
  ]);

  revalidatePath("/portal/account");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/customers");

  return {
    status: "success",
    message: "Your account deletion request was submitted for admin review.",
    requestId,
  };
}

export async function respondToRouteDateOfferAction(formData: FormData) {
  const requestId = createRequestId();
  const auth = await requireAuth("/portal/bookings");
  if (auth.status !== "ok") return;

  const bookingId = cleanString(formData.get("bookingId"), 80);
  const response = cleanString(formData.get("response"), 20);
  const note = cleanLongText(formData.get("note"), 1000) || null;
  if (!bookingId || !["confirm", "decline"].includes(response)) return;

  const admin = getSupabaseAdmin();
  const { data: previousBooking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("customer_id", auth.userId)
    .maybeSingle();

  if (!previousBooking || previousBooking.route_offer_status !== "offered") {
    return;
  }

  const confirmed = response === "confirm";
  const update: Partial<BookingRow> = {
    route_offer_status: confirmed ? "customer_confirmed" : "customer_declined",
    route_responded_at: new Date().toISOString(),
    route_response_note: note,
    confirmed_route_day: confirmed
      ? previousBooking.proposed_route_day ?? previousBooking.confirmed_route_day
      : previousBooking.confirmed_route_day,
    status: confirmed ? "scheduled" : "needs_follow_up",
  };

  const { data: booking } = await admin
    .from("bookings")
    .update(update)
    .eq("id", previousBooking.id)
    .select("*")
    .single();

  if (!booking) return;

  await Promise.allSettled([
    admin.from("activity_events").insert({
      actor_profile_id: auth.userId,
      customer_id: auth.userId,
      booking_id: booking.id,
      event_type: confirmed
        ? "route_date_confirmed_by_customer"
        : "route_date_declined_by_customer",
      message: confirmed
        ? "Customer confirmed proposed route date."
        : "Customer declined proposed route date.",
      metadata: { requestId, note },
    }),
    writeAdminAuditLog({
      action: confirmed
        ? "route_date_confirmed_by_customer"
        : "route_date_declined_by_customer",
      actor_user_id: auth.userId,
      actor_email: auth.profile.email,
      actor_role: auth.profile.role,
      target_type: "booking",
      target_id: booking.id,
      customer_id: auth.userId,
      booking_id: booking.id,
      before_summary: {
        status: previousBooking.status,
        routeOfferStatus: previousBooking.route_offer_status,
      },
      after_summary: {
        status: booking.status,
        routeOfferStatus: booking.route_offer_status,
        confirmedRouteDay: booking.confirmed_route_day,
      },
      note,
      request_id: requestId,
      status: "success",
    }),
    createAdminNotification({
      type: confirmed ? "route_date_confirmed" : "route_date_declined",
      title: confirmed ? "Route date confirmed" : "Route date declined",
      message: `${booking.first_name} ${booking.last_name} ${confirmed ? "confirmed" : "declined"} a route date.`,
      href: `/admin/bookings?q=${booking.id}`,
      customer_id: auth.userId,
      booking_id: booking.id,
      severity: confirmed ? "info" : "warning",
    }),
    sendRouteDateResponse(booking, confirmed ? "confirmed" : "declined"),
    sendAdminRouteDateResponse(booking, confirmed ? "confirmed" : "declined"),
  ]);

  logger.info("customer_route_date_response_saved", {
    requestId,
    action: "route_date_response",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: auth.userId,
    bookingId: booking.id,
    metadata: { response },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/bookings");
  revalidatePath("/admin/bookings");
}

function buildRequestMessage(formData: FormData, baseMessage: string) {
  const addressParts = [
    cleanString(formData.get("streetAddress"), 180),
    cleanString(formData.get("city"), 80),
    cleanString(formData.get("state"), 20),
    cleanString(formData.get("zipCode"), 20),
  ].filter(Boolean);
  const neighborhood = cleanString(formData.get("neighborhood"), 120);
  const addressNotes = cleanLongText(formData.get("addressNotes"), 1000);

  if (!addressParts.length && !neighborhood && !addressNotes) return baseMessage;

  return [
    baseMessage,
    addressParts.length ? `Requested address: ${addressParts.join(", ")}` : "",
    neighborhood ? `Neighborhood: ${neighborhood}` : "",
    addressNotes ? `Address notes: ${addressNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
