import type { Metadata } from "next";
import Link from "next/link";
import { FieldStopCard } from "@/components/field-stop-card";
import { LogoutButton } from "@/components/logout-button";
import { FieldShell } from "@/components/shells/field-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { businessToday, getFieldContext } from "@/lib/field-data";
import { sortStopsForField } from "@/lib/optimoroute/route-sync";
import { isAdminRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Field Today",
  applicationName: "CCC Field",
  manifest: "/field/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CCC Field",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

const fieldTools = [
  "View today's route",
  "Open stops in Apple or Google Maps",
  "Start and complete service",
  "Upload before/after photos",
  "Complete service checklist",
  "Send payment links",
  "Log breaks and route notes",
];

export default async function FieldTodayPage() {
  const context = await getFieldContext("/field/today");
  const today = businessToday();
  const canUseAdminTools =
    context.auth.status === "ok" && isAdminRole(context.auth.profile.role);
  const todaysRoutes = context.routeDays.filter(
    (routeDay) =>
      routeDay.route_date === today &&
      routeDay.status !== "cancelled" &&
      routeDay.status !== "completed",
  );
  const routeDayIds = new Set(todaysRoutes.map((routeDay) => routeDay.id));
  const todaysStops = context.routeStops
    .filter((stop) => stop.route_day_id && routeDayIds.has(stop.route_day_id))
    .sort(sortStopsForField);
  const activeRoute = todaysRoutes[0] ?? null;
  const completedCount = todaysStops.filter((stop) => stop.status === "completed").length;
  const followUpCount = todaysStops.filter((stop) => stop.status === "needs_follow_up").length;
  const unpaidCount = todaysStops.filter((stop) => {
    const booking = context.bookings.find((item) => item.id === stop.booking_id);
    const payment = context.payments.find((item) => item.booking_id === booking?.id);
    return (payment?.status ?? booking?.payment_status) !== "paid";
  }).length;
  const nextStop =
    todaysStops.find(
      (stop) => !["completed", "cancelled", "skipped"].includes(stop.status),
    ) ?? null;
  const assignedTech = context.profiles.find(
    (profile) => profile.id === activeRoute?.assigned_technician_id,
  );

  return (
    <FieldShell title="Today's Route" auth={context.auth}>
      <section className="field-dashboard-hero">
        <div>
          <p className="section-kicker">Route Operations</p>
          <h2>{activeRoute?.route_name ?? "Today's Route"}</h2>
          <p>
            Work each stop from top to bottom. Open maps, start service, upload
            photos, complete the checklist, and move to the next stop when
            ready.
          </p>
        </div>
        <div className="field-hero-meta">
          <span className={`status-badge status-${activeRoute?.status ?? "scheduled"}`}>
            {activeRoute ? humanizeStatus(activeRoute.status) : "No Route"}
          </span>
          <span>{today}</span>
          <span>
            Tech:{" "}
            {assignedTech
              ? [assignedTech.first_name, assignedTech.last_name]
                  .filter(Boolean)
                  .join(" ") || assignedTech.email
              : context.auth.status === "ok"
                ? context.auth.email ?? "Team member"
                : "Unassigned"}
          </span>
        </div>
      </section>

      <section className="field-stat-grid" aria-label="Today's route summary">
        <MetricCard label="Today's Stops" value={todaysStops.length} />
        <MetricCard label="Completed" value={completedCount} tone="success" />
        <MetricCard
          label="Remaining"
          value={Math.max(todaysStops.length - completedCount, 0)}
          tone="warning"
        />
        <MetricCard label="Unpaid" value={unpaidCount} tone="warning" />
        <MetricCard label="Needs Follow-Up" value={followUpCount} tone="danger" />
      </section>

      <section className="field-quick-actions">
        <div>
          <p className="section-kicker">Quick Actions</p>
          <h2>Don&apos;t get stranded mid-route.</h2>
        </div>
        <div className="field-actions">
          {canUseAdminTools ? (
            <>
              <Link className="button button-dark" href="/admin">
                Admin Dashboard
              </Link>
              <Link className="button button-outline" href="/admin/routes">
                Admin Routes
              </Link>
              <Link className="button button-outline" href="/admin/payments">
                Payments
              </Link>
              <Link className="button button-outline" href="/admin/customers">
                Customers
              </Link>
            </>
          ) : (
            <>
              <Link className="button button-dark" href="/field/today">
                Today&apos;s Route
              </Link>
              <Link className="button button-outline" href="/field/breaks">
                Breaks
              </Link>
              <Link className="button button-outline" href="/field/history">
                History
              </Link>
              <LogoutButton />
            </>
          )}
        </div>
      </section>

      {nextStop ? (
        <section className="field-section">
          <div className="field-section-heading">
            <div>
              <p className="section-kicker">Next Stop</p>
              <h2>Start here.</h2>
            </div>
          </div>
          <FieldStopCard
            address={context.addresses.find((item) => {
              const booking = context.bookings.find(
                (bookingItem) => bookingItem.id === nextStop.booking_id,
              );
              return item.customer_id === booking?.customer_id && item.is_primary;
            })}
            booking={context.bookings.find((item) => item.id === nextStop.booking_id)}
            payment={context.payments.find(
              (item) =>
                item.booking_id === nextStop.booking_id ||
                item.service_visit_id === nextStop.service_visit_id,
            )}
            routeDay={activeRoute}
            stop={nextStop}
            visit={context.visits.find((item) => item.id === nextStop.service_visit_id)}
          />
        </section>
      ) : null}

      {todaysStops.length ? (
        <section className="field-section">
          <div className="field-section-heading">
            <div>
              <p className="section-kicker">Full Stop List</p>
              <h2>{todaysStops.length} stop(s) on deck.</h2>
            </div>
          </div>
          <div className="field-stop-grid">
            {todaysStops.map((stop) => {
              const visit = context.visits.find((item) => item.id === stop.service_visit_id);
              const booking = context.bookings.find((item) => item.id === stop.booking_id);
              const address = context.addresses.find(
                (item) => item.customer_id === booking?.customer_id && item.is_primary,
              );
              const routeDay = context.routeDays.find((item) => item.id === stop.route_day_id);
              const payment = context.payments.find(
                (item) => item.booking_id === booking?.id || item.service_visit_id === visit?.id,
              );

              return (
                <FieldStopCard
                  address={address}
                  booking={booking}
                  key={stop.id}
                  payment={payment}
                  routeDay={routeDay}
                  stop={stop}
                  visit={visit}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <section className="field-empty-state">
          <div>
            <p className="section-kicker">No Route</p>
            <h2>No route scheduled for today</h2>
            <p>
              There are no route stops assigned for today yet. Admins can
              create a route day and add bookings from the route builder.
            </p>
          </div>
          <div className="field-actions">
            {canUseAdminTools ? (
              <>
                <Link className="button button-primary" href="/admin/routes">
                  Create Route Day
                </Link>
                <Link className="button button-outline" href="/admin/routes">
                  Go to Admin Routes
                </Link>
                <Link className="button button-outline" href="/field/routes">
                  View All Routes
                </Link>
                <Link className="button button-outline" href="/admin">
                  Back to Admin Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link className="button button-primary" href="/field/routes">
                  View Routes
                </Link>
                <Link className="button button-outline" href="/field/today">
                  Refresh
                </Link>
                <LogoutButton />
              </>
            )}
          </div>
        </section>
      )}

      <section className="field-tools-card">
        <p className="section-kicker">Field App Tools</p>
        <h2>Built for service day.</h2>
        <div className="field-tool-grid">
          {fieldTools.map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
      </section>
    </FieldShell>
  );
}

function MetricCard({
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
