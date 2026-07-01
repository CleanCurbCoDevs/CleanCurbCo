import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAuth, type AuthResult } from "@/lib/supabase/auth";
import type {
  ActivityEventRow,
  BookingRow,
  CustomerRequestRow,
  ReferralRow,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

export type PortalContext = {
  auth: AuthResult;
  bookings: BookingRow[];
  addresses: ServiceAddressRow[];
  visits: ServiceVisitRow[];
  requests: CustomerRequestRow[];
  referrals: ReferralRow[];
  activity: ActivityEventRow[];
};

export async function getPortalContext(nextPath = "/portal"): Promise<PortalContext> {
  const auth = await requireAuth(nextPath);

  if (auth.status !== "ok") {
    return {
      auth,
      bookings: [],
      addresses: [],
      visits: [],
      requests: [],
      referrals: [],
      activity: [],
    };
  }

  const supabase = await createServerSupabaseClient();
  const [
    bookingsResult,
    addressesResult,
    visitsResult,
    requestsResult,
    referralsResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("service_addresses")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("service_visits")
      .select("*")
      .order("route_day", { ascending: false }),
    supabase
      .from("customer_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return {
    auth,
    bookings: bookingsResult.data ?? [],
    addresses: addressesResult.data ?? [],
    visits: visitsResult.data ?? [],
    requests: requestsResult.data ?? [],
    referrals: referralsResult.data ?? [],
    activity: activityResult.data ?? [],
  };
}
