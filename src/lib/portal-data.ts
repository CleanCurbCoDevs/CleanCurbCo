import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAuth, type AuthResult } from "@/lib/supabase/auth";
import type {
  ActivityEventRow,
  AccountDeletionRequestRow,
  BookingRow,
  CustomerRequestRow,
  PaymentRow,
  ReferralRow,
  ServiceAddressRow,
  ServiceChecklistDocumentRow,
  ServiceChecklistItemRow,
  ServiceChecklistRow,
  ServicePhotoRow,
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
  checklists: ServiceChecklistRow[];
  checklistItems: ServiceChecklistItemRow[];
  checklistDocuments: ServiceChecklistDocumentRow[];
  photos: ServicePhotoRow[];
  payments: PaymentRow[];
  deletionRequests: AccountDeletionRequestRow[];
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
      checklists: [],
      checklistItems: [],
      checklistDocuments: [],
      photos: [],
      payments: [],
      deletionRequests: [],
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
    checklistsResult,
    checklistItemsResult,
    checklistDocumentsResult,
    photosResult,
    paymentsResult,
    deletionRequestsResult,
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
    supabase
      .from("service_checklists")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("service_checklist_items")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_checklist_documents")
      .select("*")
      .order("generated_at", { ascending: false }),
    supabase
      .from("service_photos")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("account_deletion_requests")
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
    checklists: checklistsResult.data ?? [],
    checklistItems: checklistItemsResult.data ?? [],
    checklistDocuments: checklistDocumentsResult.data ?? [],
    photos: photosResult.data ?? [],
    payments: paymentsResult.data ?? [],
    deletionRequests: deletionRequestsResult.data ?? [],
  };
}
