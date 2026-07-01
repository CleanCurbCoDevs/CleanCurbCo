import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, type AuthResult } from "@/lib/supabase/auth";
import type {
  BookingRow,
  ActivityEventRow,
  ContactMessageRow,
  CustomerRequestRow,
  ProfileRow,
  ReferralRow,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

export type AdminContext = {
  auth: AuthResult;
  bookings: BookingRow[];
  contacts: ContactMessageRow[];
  requests: CustomerRequestRow[];
  referrals: ReferralRow[];
  activity: ActivityEventRow[];
  profiles: ProfileRow[];
  addresses: ServiceAddressRow[];
  visits: ServiceVisitRow[];
};

export async function getAdminContext(nextPath = "/admin"): Promise<AdminContext> {
  const auth = await requireAdmin(nextPath);

  if (auth.status !== "ok") {
    return {
      auth,
      bookings: [],
      contacts: [],
      requests: [],
      referrals: [],
      activity: [],
      profiles: [],
      addresses: [],
      visits: [],
    };
  }

  const admin = getSupabaseAdmin();
  const [
    bookingsResult,
    contactsResult,
    requestsResult,
    referralsResult,
    activityResult,
    profilesResult,
    addressesResult,
    visitsResult,
  ] =
    await Promise.all([
      admin
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("customer_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("service_addresses")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("service_visits")
        .select("*")
        .order("route_day", { ascending: false }),
    ]);

  return {
    auth,
    bookings: bookingsResult.data ?? [],
    contacts: contactsResult.data ?? [],
    requests: requestsResult.data ?? [],
    referrals: referralsResult.data ?? [],
    activity: activityResult.data ?? [],
    profiles: profilesResult.data ?? [],
    addresses: addressesResult.data ?? [],
    visits: visitsResult.data ?? [],
  };
}
