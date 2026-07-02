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
import { calculateBookingEstimate } from "@/lib/pricing";
import { createRequestId, logger } from "@/lib/server/logger";
import {
  evaluatePolicyWindow,
  getBookingServiceDate,
  getCancellationFee,
  getCancellationPolicyStatus,
  getFullChargeApplies,
  namesMatch,
  type PolicyWindow,
  requiresTypedAcknowledgment,
} from "@/lib/service-policy";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth";
import { cleanArray, cleanLongText, cleanString, pickEnum } from "@/lib/validation";
import type { ServiceFrequency } from "@/types/booking";
import type { BookingRow, CustomerRequestStatus, RequestType } from "@/types/database";

const preferredContactMethods = ["email", "phone", "sms"] as const;

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
  const nextStatus = getInitialRequestStatus(requestType, policyWindow, Boolean(booking));
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
    if (booking) {
      await applyEligibleSelfServiceChange({
        admin,
        booking,
        requestType,
        policyWindow,
        requestedFrequency,
        requestedRouteDay,
        requestedAddOns,
        requestedRemovedAddOns,
        formData,
      });
    }

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
        selfServiceApplied: ["approved", "completed"].includes(request.status),
      },
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/manage-service");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/bookings");

  return { ok: true };
}

function getInitialRequestStatus(
  requestType: RequestType,
  policyWindow: PolicyWindow,
  hasBooking: boolean,
): CustomerRequestStatus {
  if (policyWindow !== "standard" || !hasBooking) return "new";

  if (
    [
      "cancel_service",
      "change_frequency",
      "update_address",
      "add_service",
      "drop_service",
    ].includes(requestType)
  ) {
    return "completed";
  }

  if (requestType === "reschedule_service") {
    return "approved";
  }

  return "new";
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

async function applyEligibleSelfServiceChange({
  admin,
  booking,
  requestType,
  policyWindow,
  requestedFrequency,
  requestedRouteDay,
  requestedAddOns,
  requestedRemovedAddOns,
  formData,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  booking: BookingRow;
  requestType: RequestType;
  policyWindow: PolicyWindow;
  requestedFrequency: ServiceFrequency | null;
  requestedRouteDay: string | null;
  requestedAddOns: string[];
  requestedRemovedAddOns: string[];
  formData: FormData;
}) {
  if (policyWindow !== "standard") {
    await admin
      .from("bookings")
      .update({
        last_customer_change_request_at: new Date().toISOString(),
        cancellation_policy_status: getCancellationPolicyStatus(
          requestType,
          policyWindow,
        ),
      })
      .eq("id", booking.id);
    return;
  }

  const update: Partial<BookingRow> = {
    last_customer_change_request_at: new Date().toISOString(),
    cancellation_policy_status: "none",
  };

  if (requestType === "cancel_service") {
    update.status = "cancelled";
  }

  if (requestType === "reschedule_service" && requestedRouteDay) {
    update.requested_date = requestedRouteDay;
    update.confirmed_route_day = null;
    update.status = "needs_follow_up";
  }

  if (requestType === "change_frequency" && requestedFrequency) {
    update.frequency = requestedFrequency;
    update.estimated_price = calculateBookingEstimate({
      binCount: booking.bin_count,
      frequency: requestedFrequency,
      addOns: booking.add_ons ?? [],
      applyFoundingNeighborPromo: requestedFrequency !== "one_time",
    });
  }

  if (requestType === "add_service" || requestType === "drop_service") {
    const addOns =
      requestType === "add_service"
        ? Array.from(new Set([...(booking.add_ons ?? []), ...requestedAddOns]))
        : (booking.add_ons ?? []).filter(
            (addOn) => !requestedRemovedAddOns.includes(addOn),
          );
    update.add_ons = addOns;
    update.estimated_price = calculateBookingEstimate({
      binCount: booking.bin_count,
      frequency: booking.frequency,
      addOns,
      applyFoundingNeighborPromo: booking.frequency !== "one_time",
    });
  }

  if (requestType === "update_address") {
    const streetAddress = cleanString(formData.get("streetAddress"), 180);
    if (streetAddress) {
      const addressUpdate = {
        street_address: streetAddress,
        city: cleanString(formData.get("city"), 80) || "Summerville",
        state: cleanString(formData.get("state"), 20) || "SC",
        zip_code: cleanString(formData.get("zipCode"), 20) || null,
        neighborhood: cleanString(formData.get("neighborhood"), 120) || null,
        notes: cleanLongText(formData.get("addressNotes"), 1000) || null,
        is_primary: true,
      };

      update.street_address = addressUpdate.street_address;
      update.city = addressUpdate.city;
      update.state = addressUpdate.state;
      update.zip_code = addressUpdate.zip_code;
      update.neighborhood = addressUpdate.neighborhood;

      if (booking.service_address_id && booking.customer_id) {
        await admin
          .from("service_addresses")
          .update(addressUpdate)
          .eq("id", booking.service_address_id)
          .eq("customer_id", booking.customer_id);
      } else if (booking.customer_id) {
        const { data: address } = await admin
          .from("service_addresses")
          .insert({
            customer_id: booking.customer_id,
            label: "Home",
            ...addressUpdate,
          })
          .select("id")
          .single();
        update.service_address_id = address?.id ?? null;
      }
    }
  }

  await admin.from("bookings").update(update).eq("id", booking.id);
}
