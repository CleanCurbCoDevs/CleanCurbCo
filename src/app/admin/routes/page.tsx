import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminRoutesWorkspace,
  type RouteDayView,
} from "@/components/admin-routes-workspace";
import { AdminShell } from "@/components/shells/admin-shell";
import { formatBookingAddress } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import {
  getRouteStopEligibility,
  sortStopsForField,
} from "@/lib/optimoroute/route-sync";

export const metadata: Metadata = {
  title: "Admin Routes",
};

export default async function AdminRoutesPage() {
  const context = await getAdminContext("/admin/routes");
  const technicians = context.profiles.filter((profile) =>
    ["technician", "admin", "owner"].includes(profile.role),
  );
  const routedBookingIds = new Set(context.routeStops.map((stop) => stop.booking_id));
  const routeableBookings = context.bookings.filter(
    (booking) => !routedBookingIds.has(booking.id) && booking.status !== "cancelled",
  );
  const routeDayViews = context.routeDays.map<RouteDayView>((routeDay) => {
    const stops = context.routeStops
      .filter((stop) => stop.route_day_id === routeDay.id)
      .sort(sortStopsForField);
    const assignedTech = context.profiles.find(
      (profile) => profile.id === routeDay.assigned_technician_id,
    );
    const stopItems = stops.map((stop) => {
      const booking = context.bookings.find((item) => item.id === stop.booking_id) ?? null;
      const visit = context.visits.find((item) => item.id === stop.service_visit_id) ?? null;
      const payment =
        context.payments.find(
          (item) =>
            item.booking_id === booking?.id ||
            item.service_visit_id === visit?.id,
        ) ?? null;
      const eligibility = getRouteStopEligibility({
        routeDay,
        stop,
        booking,
        visit,
        payment,
      });
      const customerName = booking
        ? `${booking.first_name} ${booking.last_name}`
        : "Missing booking";

      return {
        id: stop.id,
        address: booking ? formatBookingAddress(booking) : "No address",
        bookingId: booking?.id ?? null,
        customerName,
        eligibilitySummary: eligibility.summary,
        eligible: eligibility.eligible,
        fieldHref: visit ? `/field/stops/${visit.id}` : null,
        checklistHref: visit ? `/admin/checklists/${visit.id}` : null,
        issue: stop.optimoroute_sync_error,
        manualOrder: stop.stop_order,
        optimorouteOrderNo: stop.optimoroute_order_no ?? `CCC-${stop.id}`,
        optimorouteScheduledAt: stop.optimoroute_scheduled_at,
        optimorouteSequence: stop.optimoroute_stop_sequence,
        optimorouteStatus: stop.optimoroute_sync_status,
        routeStopStatus: stop.status,
        stopOrder: stop.stop_order,
        technicianNotes: stop.technician_notes,
      };
    });
    const eligibleCount = stopItems.filter((item) => item.eligible).length;
    const needsReviewItems = stopItems
      .filter((item) => !item.eligible)
      .map((item) => ({
        id: item.id,
        label: `#${item.stopOrder} ${item.customerName}`,
        summary: item.eligibilitySummary,
      }));
    const syncedCount = stopItems.filter((item) =>
      [
        "synced",
        "planning_pending",
        "scheduled",
        "unscheduled",
        "imported",
      ].includes(item.optimorouteStatus),
    ).length;
    const importedCount = stopItems.filter(
      (item) => item.optimorouteStatus === "imported",
    ).length;
    const unscheduledItems = stopItems.filter(
      (item) => item.optimorouteStatus === "unscheduled",
    );

    return {
      id: routeDay.id,
      routeDate: routeDay.route_date,
      routeName: routeDay.route_name,
      serviceArea: routeDay.service_area,
      status: routeDay.status,
      assignedTechnicianId: routeDay.assigned_technician_id,
      assignedTechnicianLabel: assignedTech ? displayProfile(assignedTech) : "Unassigned",
      notes: routeDay.notes,
      optimoroutePlanningId: routeDay.optimoroute_planning_id,
      optimoroutePlanningStatus: routeDay.optimoroute_planning_status,
      optimoroutePlanningError: routeDay.optimoroute_planning_error,
      optimorouteLastImportedAt: routeDay.optimoroute_last_imported_at,
      counts: {
        eligible: eligibleCount,
        imported: importedCount,
        needsReview: stopItems.length - eligibleCount,
        scheduled: stopItems.filter((item) => Boolean(item.optimorouteScheduledAt)).length,
        stops: stopItems.length,
        synced: syncedCount,
        unscheduled: unscheduledItems.length,
      },
      needsReviewItems,
      stops: stopItems,
      unscheduledItems,
    };
  });

  return (
    <AdminShell title="Route builder" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Routes</p>
            <h1>Build field-ready route days.</h1>
            <p className="muted">
              Create the day, add bookings, confirm eligibility, then optimize
              stop order with OptimoRoute when you want routing help. Clean
              Curb Co still owns the service workflow.
            </p>
          </div>
          <Link className="button button-dark" href="/field/today">
            Open Field App
          </Link>
        </div>
        <AdminRoutesWorkspace
          routeDays={routeDayViews}
          routeableBookings={routeableBookings.map((booking) => ({
            id: booking.id,
            label: `${booking.first_name} ${booking.last_name} - ${booking.street_address}`,
          }))}
          technicians={technicians.map((profile) => ({
            id: profile.id,
            label: displayProfile(profile),
          }))}
        />
      </section>
    </AdminShell>
  );
}

function displayProfile(profile: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Unnamed user"
  );
}
