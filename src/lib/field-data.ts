import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireField, type AuthResult } from "@/lib/supabase/auth";
import type {
  BookingRow,
  PaymentRow,
  ProfileRow,
  RouteBreakRow,
  RouteDayRow,
  RouteStopRow,
  ServiceAddressRow,
  ServiceChecklistRow,
  ServicePhotoRow,
  ServiceVisitRow,
} from "@/types/database";

export type FieldContext = {
  auth: AuthResult;
  routeDays: RouteDayRow[];
  routeStops: RouteStopRow[];
  bookings: BookingRow[];
  visits: ServiceVisitRow[];
  addresses: ServiceAddressRow[];
  checklists: ServiceChecklistRow[];
  photos: ServicePhotoRow[];
  breaks: RouteBreakRow[];
  payments: PaymentRow[];
  profiles: ProfileRow[];
};

export function businessToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export async function getFieldContext(nextPath = "/field/today"): Promise<FieldContext> {
  const auth = await requireField(nextPath);

  if (auth.status !== "ok") {
    return {
      auth,
      routeDays: [],
      routeStops: [],
      bookings: [],
      visits: [],
      addresses: [],
      checklists: [],
      photos: [],
      breaks: [],
      payments: [],
      profiles: [],
    };
  }

  const admin = getSupabaseAdmin();
  const [
    routeDaysResult,
    routeStopsResult,
    bookingsResult,
    visitsResult,
    addressesResult,
    checklistsResult,
    photosResult,
    breaksResult,
    paymentsResult,
    profilesResult,
  ] = await Promise.all([
    admin
      .from("route_days")
      .select("*")
      .order("route_date", { ascending: false }),
    admin
      .from("route_stops")
      .select("*")
      .order("stop_order", { ascending: true }),
    admin
      .from("bookings")
      .select("*")
      .order("confirmed_route_day", { ascending: true }),
    admin
      .from("service_visits")
      .select("*")
      .order("route_day", { ascending: true }),
    admin
      .from("service_addresses")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("service_checklists")
      .select("*")
      .order("updated_at", { ascending: false }),
    admin
      .from("service_photos")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("route_breaks")
      .select("*")
      .order("started_at", { ascending: false }),
    admin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return {
    auth,
    routeDays: routeDaysResult.data ?? [],
    routeStops: routeStopsResult.data ?? [],
    bookings: bookingsResult.data ?? [],
    visits: visitsResult.data ?? [],
    addresses: addressesResult.data ?? [],
    checklists: checklistsResult.data ?? [],
    photos: photosResult.data ?? [],
    breaks: breaksResult.data ?? [],
    payments: paymentsResult.data ?? [],
    profiles: profilesResult.data ?? [],
  };
}
