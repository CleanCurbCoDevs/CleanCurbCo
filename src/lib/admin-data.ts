import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, type AuthResult } from "@/lib/supabase/auth";
import type {
  BookingRow,
  ActivityEventRow,
  CareerApplicationRow,
  ContactMessageRow,
  CustomerRequestRow,
  NotificationEventRow,
  PaymentRow,
  ProfileRow,
  ReferralRow,
  RouteBreakRow,
  RouteDayRow,
  RouteStopRow,
  ServiceChecklistDocumentRow,
  ServiceChecklistItemRow,
  ServiceChecklistRow,
  ServiceAddressRow,
  ServiceEventRow,
  ServicePhotoRow,
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
  routeDays: RouteDayRow[];
  routeStops: RouteStopRow[];
  checklists: ServiceChecklistRow[];
  checklistItems: ServiceChecklistItemRow[];
  checklistDocuments: ServiceChecklistDocumentRow[];
  photos: ServicePhotoRow[];
  breaks: RouteBreakRow[];
  serviceEvents: ServiceEventRow[];
  notificationEvents: NotificationEventRow[];
  payments: PaymentRow[];
  careerApplications: CareerApplicationRow[];
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
      routeDays: [],
      routeStops: [],
      checklists: [],
      checklistItems: [],
      checklistDocuments: [],
      photos: [],
      breaks: [],
      serviceEvents: [],
      notificationEvents: [],
      payments: [],
      careerApplications: [],
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
    routeDaysResult,
    routeStopsResult,
    checklistsResult,
    checklistItemsResult,
    checklistDocumentsResult,
    photosResult,
    breaksResult,
    serviceEventsResult,
    notificationEventsResult,
    paymentsResult,
    careerApplicationsResult,
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
      admin
        .from("route_days")
        .select("*")
        .order("route_date", { ascending: false }),
      admin
        .from("route_stops")
        .select("*")
        .order("stop_order", { ascending: true }),
      admin
        .from("service_checklists")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("service_checklist_items")
        .select("*")
        .order("sort_order", { ascending: true }),
      admin
        .from("service_checklist_documents")
        .select("*")
        .order("generated_at", { ascending: false }),
      admin
        .from("service_photos")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("route_breaks")
        .select("*")
        .order("started_at", { ascending: false }),
      admin
        .from("service_events")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("notification_events")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("career_applications")
        .select("*")
        .order("created_at", { ascending: false }),
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
    routeDays: routeDaysResult.data ?? [],
    routeStops: routeStopsResult.data ?? [],
    checklists: checklistsResult.data ?? [],
    checklistItems: checklistItemsResult.data ?? [],
    checklistDocuments: checklistDocumentsResult.data ?? [],
    photos: photosResult.data ?? [],
    breaks: breaksResult.data ?? [],
    serviceEvents: serviceEventsResult.data ?? [],
    notificationEvents: notificationEventsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    careerApplications: careerApplicationsResult.data ?? [],
  };
}
