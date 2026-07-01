import Link from "next/link";
import type { Metadata } from "next";
import { FieldShell } from "@/components/shells/field-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { businessToday, getFieldContext } from "@/lib/field-data";
import { isAdminRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Field Routes",
};

export default async function FieldRoutesPage() {
  const context = await getFieldContext("/field/routes");
  const today = businessToday();
  const canUseAdminTools =
    context.auth.status === "ok" && isAdminRole(context.auth.profile.role);
  const upcomingRoutes = context.routeDays.filter(
    (routeDay) => routeDay.route_date >= today && routeDay.status !== "cancelled",
  );
  const activeRoutes = context.routeDays.filter((routeDay) => routeDay.status === "active");
  const completedRoutes = context.routeDays.filter((routeDay) => routeDay.status === "completed");
  const cancelledRoutes = context.routeDays.filter((routeDay) => routeDay.status === "cancelled");

  return (
    <FieldShell title="Routes" auth={context.auth}>
      <section className="field-dashboard-hero compact">
        <div>
          <p className="section-kicker">Route Board</p>
          <h2>Upcoming and recent route days.</h2>
          <p>
            Review assigned routes, check progress, and jump into the stops
            that need attention.
          </p>
        </div>
        <div className="field-actions">
          {canUseAdminTools ? (
            <>
              <Link className="button button-primary" href="/admin/routes">
                Create Route Day
              </Link>
              <Link className="button button-outline" href="/admin/routes">
                Admin Route Builder
              </Link>
            </>
          ) : (
            <Link className="button button-primary" href="/field/today">
              Today&apos;s Route
            </Link>
          )}
        </div>
      </section>

      <section className="field-stat-grid">
        <Metric label="Upcoming Routes" value={upcomingRoutes.length} />
        <Metric label="Today" value={context.routeDays.filter((route) => route.route_date === today).length} />
        <Metric label="Active" value={activeRoutes.length} tone="warning" />
        <Metric label="Completed" value={completedRoutes.length} tone="success" />
        <Metric label="Cancelled" value={cancelledRoutes.length} tone="danger" />
      </section>

      {context.routeDays.length ? (
        <section className="field-route-grid">
          {context.routeDays.map((routeDay) => {
            const stops = context.routeStops
              .filter((stop) => stop.route_day_id === routeDay.id)
              .sort((a, b) => a.stop_order - b.stop_order);
            const completed = stops.filter((stop) => stop.status === "completed").length;
            const unpaid = stops.filter((stop) => {
              const booking = context.bookings.find((item) => item.id === stop.booking_id);
              const payment = context.payments.find((item) => item.booking_id === booking?.id);
              return (payment?.status ?? booking?.payment_status) !== "paid";
            }).length;
            const technician = context.profiles.find(
              (profile) => profile.id === routeDay.assigned_technician_id,
            );

            return (
              <article className="field-route-card" key={routeDay.id}>
                <div className="field-card-top">
                  <span className={`status-badge status-${routeDay.status}`}>
                    {humanizeStatus(routeDay.status)}
                  </span>
                  <span className="status-badge">
                    {completed}/{stops.length} complete
                  </span>
                </div>
                <h2>{routeDay.route_name ?? `${routeDay.service_area} route`}</h2>
                <p>
                  {routeDay.route_date} | {routeDay.service_area ?? "Cane Bay"}
                </p>
                <div className="field-meta-grid">
                  <span>
                    Technician:{" "}
                    {technician
                      ? [technician.first_name, technician.last_name]
                          .filter(Boolean)
                          .join(" ") || technician.email
                      : "Unassigned"}
                  </span>
                  <span>{stops.length} stop(s)</span>
                  <span>{unpaid} unpaid</span>
                  <span>{routeDay.notes ?? "No route notes"}</span>
                </div>
                <div className="field-actions">
                  {stops[0]?.service_visit_id ? (
                    <Link
                      className="button button-dark"
                      href={`/field/stops/${stops[0].service_visit_id}`}
                    >
                      Open Route
                    </Link>
                  ) : null}
                  <Link className="button button-outline" href="/field/today">
                    Today
                  </Link>
                  {canUseAdminTools ? (
                    <Link className="button button-outline" href="/admin/routes">
                      Edit in Admin
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="field-empty-state">
          <div>
            <p className="section-kicker">Assigned Routes</p>
            <h2>No route days are built yet.</h2>
            <p>
              Routes will appear here after admin creates a route day and adds
              booking stops.
            </p>
          </div>
          <div className="field-actions">
            {canUseAdminTools ? (
              <>
                <Link className="button button-primary" href="/admin/routes">
                  Create Route Day
                </Link>
                <Link className="button button-outline" href="/admin">
                  Back to Admin
                </Link>
              </>
            ) : (
              <>
                <Link className="button button-primary" href="/field/today">
                  Check Today
                </Link>
                <Link className="button button-outline" href="/field/history">
                  Recent Routes
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </FieldShell>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <article className={`field-metric field-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
