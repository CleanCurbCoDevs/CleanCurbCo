import type {
  BookingRequest,
  BookingStatus,
  CollectionDay,
  PaymentStatus,
  SchedulingPreference,
  ServiceFrequency,
} from "@/types/booking";
import type {
  BookingRow,
  CustomerRequestStatus,
  ReferralStatus,
  RequestType,
} from "@/types/database";

export const validFrequencies: readonly ServiceFrequency[] = [
  "one_time",
  "monthly",
  "every_other_month",
  "quarterly",
];

export const validSchedulingPreferences: readonly SchedulingPreference[] = [
  "next_available_route_day",
  "specific_day",
  "urgent",
];

export const validCollectionDays: readonly CollectionDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "varies",
  "not_sure",
];

export const validBookingStatuses: readonly BookingStatus[] = [
  "new",
  "confirmed",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
  "needs_follow_up",
  "cancelled",
];

export const validPaymentStatuses: readonly PaymentStatus[] = [
  "not_sent",
  "pending",
  "paid",
  "failed",
  "refunded",
];

export const validRequestTypes: readonly RequestType[] = [
  "pause_service",
  "cancel_service",
  "reschedule_service",
  "change_frequency",
  "update_address",
  "add_service",
  "drop_service",
  "request_add_on",
  "billing_question",
  "general_help",
];

export const validCustomerRequestStatuses: readonly CustomerRequestStatus[] = [
  "new",
  "reviewing",
  "approved",
  "completed",
  "denied",
  "cancelled",
];

export const validReferralStatuses: readonly ReferralStatus[] = [
  "pending",
  "qualified",
  "reward_ready",
  "reward_sent",
  "cancelled",
];

export function bookingRowToRequest(row: BookingRow): BookingRequest {
  const serviceAddress = formatBookingAddress(row);

  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    customer: {
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      serviceAddress,
      streetAddress: row.street_address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code ?? undefined,
      neighborhood: row.neighborhood ?? undefined,
    },
    service: {
      binCount: row.bin_count,
      binTypes: row.bin_types ?? [],
      frequency: row.frequency,
      addOns: row.add_ons ?? [],
      estimatedPrice: row.estimated_price,
    },
    scheduling: {
      preference: row.scheduling_preference,
      collectionDay: row.collection_day ?? undefined,
      requestedDate: row.requested_date ?? undefined,
      confirmedRouteDay: row.confirmed_route_day ?? undefined,
    },
    instructions: {
      binLocation: row.bin_location ?? "Curbside",
      waterSpigotAvailable: row.water_spigot_available ?? "not_sure",
      notes: row.customer_notes ?? undefined,
    },
    agreements: {
      waterUse: row.agreement_water_use,
      binCondition: row.agreement_bin_condition,
      wastewater: row.agreement_wastewater,
      weatherAccess: row.agreement_weather_access,
      photos: row.agreement_photos,
      payment: row.agreement_payment,
    },
    payment: {
      status: row.payment_status,
      method: row.payment_method ?? undefined,
      paymentLink: row.payment_link ?? undefined,
      provider: row.payment_provider ?? undefined,
      reference: row.payment_reference ?? undefined,
    },
    internalNotes: row.internal_notes ?? undefined,
  };
}

export function formatBookingAddress(row: Pick<BookingRow, "street_address" | "city" | "state" | "zip_code">) {
  return [row.street_address, row.city, [row.state, row.zip_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export function humanizeStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
