import type { Metadata } from "next";
import Link from "next/link";
import {
  addBookingToRouteAdminAction,
  createRouteDayAdminAction,
  removeRouteStopAdminAction,
  updateRouteDayAdminAction,
  updateRouteStopAdminAction,
} from "@/app/admin/actions";
import { AdminOptimoRouteControls } from "@/components/admin-optimoroute-controls";
import { AdminShell } from "@/components/shells/admin-shell";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import {
  getRouteStopEligibility,
  sortStopsForField,
} from "@/lib/optimoroute/route-sync";

export const metadata: Metadata = {
  title: "Admin Routes",
};

const routeStatuses = ["planned", "active", "completed", "cancelled"] as const;
const stopStatuses = [
  "scheduled",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "skipped",
  "needs_follow_up",
  "rescheduled",
  "cancelled",
] as const;

export default async function AdminRoutesPage() {
  const context = await getAdminContext("/admin/routes");
  const technicians = context.profiles.filter((profile) =>
    ["technician", "admin", "owner"].includes(profile.role),
  );
  const routedBookingIds = new Set(context.routeStops.map((stop) => stop.booking_id));
  const routeableBookings = context.bookings.filter(
    (booking) => !routedBookingIds.has(booking.id) && booking.status !== "cancelled",
  );

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

        <form action={createRouteDayAdminAction} className="filter-bar">
          <div className="form-grid">
            <label>
              Route date
              <input name="routeDate" required type="date" />
            </label>
            <label>
              Route name
              <input name="routeName" placeholder="Cane Bay Tuesday" />
            </label>
            <label>
              Service area
              <input name="serviceArea" defaultValue="Cane Bay" />
            </label>
            <label>
              Technician
              <select name="assignedTechnicianId" defaultValue="">
                <option value="">Unassigned</option>
                {technicians.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {displayProfile(profile)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="planned">
                {routeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanizeStatus(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Route notes
            <textarea name="notes" placeholder="Tank plan, route reminders, HOA notes..." />
          </label>
          <button className="button button-primary" type="submit">
            Create Route Day
          </button>
        </form>

        <div className="detail-grid">
          {context.routeDays.map((routeDay) => {
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
              return {
                stop,
                booking,
                visit,
                payment,
                eligibility: getRouteStopEligibility({
                  routeDay,
                  stop,
                  booking,
                  visit,
                  payment,
                }),
              };
            });
            const eligibleCount = stopItems.filter((item) => item.eligibility.eligible).length;
            const needsReviewCount = stopItems.length - eligibleCount;
            const syncedCount = stopItems.filter((item) =>
              [
                "synced",
                "planning_pending",
                "scheduled",
                "unscheduled",
                "imported",
              ].includes(item.stop.optimoroute_sync_status),
            ).length;
            const importedCount = stopItems.filter(
              (item) => item.stop.optimoroute_sync_status === "imported",
            ).length;

            return (
              <article className="detail-panel" key={routeDay.id}>
                <div className="admin-row-heading">
                  <div>
                    <span className={`status-badge status-${routeDay.status}`}>
                      {humanizeStatus(routeDay.status)}
                    </span>
                    <h2>{routeDay.route_name ?? `${routeDay.service_area} route`}</h2>
                    <p>
                      {routeDay.route_date} | Tech:{" "}
                      {assignedTech ? displayProfile(assignedTech) : "Unassigned"}
                    </p>
                  </div>
                  <span className="status-badge">{stops.length} stop(s)</span>
                </div>

                <form action={updateRouteDayAdminAction} className="filter-bar">
                  <input type="hidden" name="routeDayId" value={routeDay.id} />
                  <div className="form-grid">
                    <label>
                      Route name
                      <input name="routeName" defaultValue={routeDay.route_name ?? ""} />
                    </label>
                    <label>
                      Service area
                      <input name="serviceArea" defaultValue={routeDay.service_area ?? "Cane Bay"} />
                    </label>
                    <label>
                      Technician
                      <select
                        name="assignedTechnicianId"
                        defaultValue={routeDay.assigned_technician_id ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {displayProfile(profile)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select name="status" defaultValue={routeDay.status}>
                        {routeStatuses.map((status) => (
                          <option key={status} value={status}>
                            {humanizeStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Notes
                    <textarea name="notes" defaultValue={routeDay.notes ?? ""} />
                  </label>
                  <button className="button button-outline" type="submit">
                    Save Route
                  </button>
                </form>

                <section className="optimoroute-panel" aria-label="OptimoRoute routing tools">
                  <div className="admin-row-heading">
                    <div>
                      <p className="section-kicker">OptimoRoute Supplement</p>
                      <h2>Optimize this route day.</h2>
                      <p className="muted">
                        Sync eligible stops, start planning, then import the
                        optimized stop order back into Clean Curb Co.
                      </p>
                    </div>
                    <div className="status-stack">
                      <span className={`status-badge status-${routeDay.optimoroute_planning_status ?? "not_sent"}`}>
                        {routeDay.optimoroute_planning_status
                          ? humanizeStatus(routeDay.optimoroute_planning_status)
                          : "Not Sent"}
                      </span>
                      {routeDay.optimoroute_last_imported_at ? (
                        <span className="status-badge status-imported">Imported</span>
                      ) : null}
                    </div>
                  </div>

                  <AdminOptimoRouteControls
                    eligibleCount={eligibleCount}
                    importedCount={importedCount}
                    needsReviewCount={needsReviewCount}
                    planningId={routeDay.optimoroute_planning_id}
                    planningStatus={routeDay.optimoroute_planning_status}
                    routeDate={routeDay.route_date}
                    routeDayId={routeDay.id}
                    syncedCount={syncedCount}
                  />

                  {routeDay.optimoroute_planning_error ? (
                    <p className="optimoroute-message error">
                      {routeDay.optimoroute_planning_error}
                    </p>
                  ) : null}

                  {needsReviewCount ? (
                    <div className="optimoroute-review-list">
                      {stopItems
                        .filter((item) => !item.eligibility.eligible)
                        .map((item) => (
                          <div key={item.stop.id}>
                            <span className="status-badge status-warning">Needs Review</span>
                            <strong>
                              #{item.stop.stop_order}{" "}
                              {item.booking
                                ? `${item.booking.first_name} ${item.booking.last_name}`
                                : "Missing booking"}
                            </strong>
                            <span>{item.eligibility.summary}</span>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </section>

                <form action={addBookingToRouteAdminAction} className="filter-bar">
                  <input type="hidden" name="routeDayId" value={routeDay.id} />
                  <div className="form-grid">
                    <label>
                      Add booking
                      <select name="bookingId" required defaultValue="">
                        <option value="">Choose booking</option>
                        {routeableBookings.map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.first_name} {booking.last_name} -{" "}
                            {booking.street_address}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Stop order
                      <input min="1" name="stopOrder" placeholder={`${stops.length + 1}`} type="number" />
                    </label>
                  </div>
                  <button className="button button-dark" type="submit">
                    Add Booking to Route
                  </button>
                </form>

                <div className="admin-data-grid">
                  {stopItems.map(({ stop, booking, visit, eligibility }) => {
                    return (
                      <div key={stop.id}>
                        <div className="admin-row-heading">
                          <div>
                            <div className="status-stack">
                              <span className={`status-badge status-${stop.optimoroute_sync_status}`}>
                                OptimoRoute: {humanizeStatus(stop.optimoroute_sync_status)}
                              </span>
                              {stop.optimoroute_stop_sequence ? (
                                <span className="status-badge status-imported">
                                  Optimized #{stop.optimoroute_stop_sequence}
                                </span>
                              ) : (
                                <span className="status-badge status-neutral">
                                  Manual #{stop.stop_order}
                                </span>
                              )}
                              <span
                                className={`status-badge status-${
                                  eligibility.eligible ? "eligible" : "warning"
                                }`}
                              >
                                {eligibility.eligible ? "Eligible" : "Needs Review"}
                              </span>
                            </div>
                            <strong>
                              #{stop.stop_order}{" "}
                              {booking
                                ? `${booking.first_name} ${booking.last_name}`
                                : "Missing booking"}
                            </strong>
                            <span>
                              {booking ? formatBookingAddress(booking) : "No address"} |{" "}
                              {humanizeStatus(stop.status)}
                            </span>
                            {stop.optimoroute_scheduled_at ||
                            stop.optimoroute_driver_name ||
                            stop.optimoroute_sync_error ? (
                              <span>
                                {stop.optimoroute_scheduled_at
                                  ? `Scheduled ${formatAdminDateTime(stop.optimoroute_scheduled_at)}`
                                  : ""}
                                {stop.optimoroute_driver_name
                                  ? ` | Driver ${stop.optimoroute_driver_name}`
                                  : ""}
                                {stop.optimoroute_sync_error
                                  ? ` | ${stop.optimoroute_sync_error}`
                                  : ""}
                              </span>
                            ) : (
                              <span>{eligibility.summary}</span>
                            )}
                          </div>
                          {visit ? (
                            <div className="action-row">
                              <Link
                                className="button button-outline"
                                href={`/field/stops/${visit.id}`}
                              >
                                Field View
                              </Link>
                              <Link
                                className="button button-outline"
                                href={`/admin/checklists/${visit.id}`}
                              >
                                Checklist
                              </Link>
                            </div>
                          ) : null}
                        </div>
                        <form action={updateRouteStopAdminAction} className="data-row">
                          <input type="hidden" name="routeStopId" value={stop.id} />
                          <label>
                            Order
                            <input
                              min="1"
                              name="stopOrder"
                              type="number"
                              defaultValue={stop.stop_order}
                            />
                          </label>
                          <label>
                            Status
                            <select name="status" defaultValue={stop.status}>
                              {stopStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {humanizeStatus(status)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Route notes
                            <input
                              name="technicianNotes"
                              defaultValue={stop.technician_notes ?? ""}
                              placeholder="Tech note"
                            />
                          </label>
                          <button className="button button-outline" type="submit">
                            Save Stop
                          </button>
                        </form>
                        <form action={removeRouteStopAdminAction}>
                          <input type="hidden" name="routeStopId" value={stop.id} />
                          <button className="link-button destructive" type="submit">
                            Remove stop
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
          {!context.routeDays.length ? (
            <p>No route days yet. Create the first route above.</p>
          ) : null}
        </div>
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

function formatAdminDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
