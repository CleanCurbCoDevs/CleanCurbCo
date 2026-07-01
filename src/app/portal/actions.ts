"use server";

import { revalidatePath } from "next/cache";
import {
  validFrequencies,
  validRequestTypes,
} from "@/lib/booking-utils";
import { sendCustomerRequestReceived } from "@/lib/email/sendCustomerRequestEmail";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth";
import { cleanLongText, cleanString, pickEnum } from "@/lib/validation";
import type { ServiceFrequency } from "@/types/booking";
import type { RequestType } from "@/types/database";

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
  const auth = await requireAuth("/portal/manage-service");
  if (auth.status !== "ok") return;

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

  const admin = getSupabaseAdmin();
  const { data: request } = await admin
    .from("customer_requests")
    .insert({
      customer_id: auth.userId,
      booking_id: bookingId,
      request_type: requestType,
      requested_frequency: requestedFrequency,
      requested_pause_start: cleanString(formData.get("pauseStart"), 30) || null,
      requested_pause_end: cleanString(formData.get("pauseEnd"), 30) || null,
      message: cleanLongText(formData.get("message"), 1500) || null,
      status: "new",
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
      metadata: { requestType },
    });
    await sendCustomerRequestReceived(request, auth.profile);
  }

  revalidatePath("/portal");
  revalidatePath("/portal/manage-service");
  revalidatePath("/admin/requests");
}
