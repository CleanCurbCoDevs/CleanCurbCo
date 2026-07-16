import type { Metadata } from "next";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPinned,
  PartyPopper,
  Route,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { FieldMissionCard } from "@/components/field-mission-card";
import { FieldShell } from "@/components/shells/field-shell";
import {
  formatBookingAddress,
  humanizeStatus,
} from "@/lib/booking-utils";
import { businessToday, getFieldContext } from "@/lib/field-data";
import { sortStopsForField } from "@/lib/optimoroute/route-sync";

export const metadata: Metadata = {
  title: "Today | CCC Field",
  applicationName: "CCC Field",
  manifest: "/field/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CCC Field",
    statusBarStyle: "black-translucent",
  },
};

export default async function FieldTodayPage() {
  const context = await getFieldContext("/field/today");
  const today = businessToday();

  const todaysRoutes = context.routeDays.filter(
    (routeDay) =>
      routeDay.route_date === today &&
      routeDay.status !== "cancelled",
  );

  const routeDayIds = new Set(
    todaysRoutes.map((routeDay) => routeDay.id),
  );

  const todaysStops = context.routeStops
    .filter(
      (stop) =>
        stop.route_day_id &&
        routeDayIds.has(stop.route_day_id) &&
        stop.status !== "cancelled",
    )
    .sort(sortStopsForField);

  const completedStops = todaysStops.filter(
    (stop) => stop.status === "completed",
  );

  const unfinishedStops = todaysStops.filter(
    (stop) =>
      !["completed", "cancelled", "skipped"].includes(stop.status),
  );

  const nextStop = unfinishedStops[0] ?? null;
  const activeRoute = todaysRoutes[0] ?? null;

  const nextBooking = nextStop
    ? context.bookings.find(
        (booking) => booking.id === nextStop.booking_id,
      )
    : null;

  const nextVisit = nextStop
    ? context.visits.find(
        (visit) => visit.id === nextStop.service_visit_id,
      )
    : null;

  const nextAddress = nextBooking
    ? context.addresses.find(
        (address) =>
          address.customer_id === nextBooking.customer_id &&
          address.is_primary,
      )
    : null;

  const nextPayment = nextStop
    ? context.payments.find(
        (payment) =>
          payment.booking_id === nextStop.booking_id ||
          payment.service_visit_id === nextStop.service_visit_id,
      )
    : null;

  const remainingCount = unfinishedStops.length;
  const progress =
    todaysStops.length > 0
      ? Math.round(
          (completedStops.length / todaysStops.length) * 100,
        )
      : 0;

  return (
    <FieldShell
      title="Today’s Route"
      subtitle="One stop at a time. The app will keep you moving."
      auth={context.auth}
    >
      {activeRoute ? (
        <section className="mission-route-summary">
          <div className="mission-route-heading">
            <div>
              <p className="section-kicker">Active Route</p>
              <h2>
                {activeRoute.route_name ??
                  activeRoute.route_date ??
                  "Today’s Route"}
              </h2>
            </div>

            <span
              className={`status-badge status-${activeRoute.status}`}
            >
              {humanizeStatus(activeRoute.status)}
            </span>
          </div>

          <div className="mission-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="mission-route-stats">
            <div>
              <Route size={22} aria-hidden="true" />
              <span>Total</span>
              <strong>{todaysStops.length}</strong>
            </div>

            <div>
              <CheckCircle2 size={22} aria-hidden="true" />
              <span>Done</span>
              <strong>{completedStops.length}</strong>
            </div>

            <div>
              <Clock3 size={22} aria-hidden="true" />
              <span>Left</span>
              <strong>{remainingCount}</strong>
            </div>

            <div>
              <MapPinned size={22} aria-hidden="true" />
              <span>Progress</span>
              <strong>{progress}%</strong>
            </div>
          </div>
        </section>
      ) : null}

      {nextStop && nextBooking && nextVisit ? (
        <FieldMissionCard
          address={nextAddress}
          booking={nextBooking}
          payment={nextPayment}
          position={
            todaysStops.findIndex(
              (stop) => stop.id === nextStop.id,
            ) + 1
          }
          stop={nextStop}
          totalStops={todaysStops.length}
          visit={nextVisit}
        />
      ) : todaysStops.length > 0 ? (
        <section className="mission-complete-card">
          <PartyPopper size={48} aria-hidden="true" />

          <p className="section-kicker">Route Complete</p>
          <h2>That’s the whole route.</h2>

          <p>
            Every scheduled stop has been completed or closed out.
            Nice work—those cans never stood a chance.
          </p>

          <Link
            className="button button-primary"
            href="/field/history"
          >
            View Today’s Work
          </Link>
        </section>
      ) : (
        <section className="mission-empty-card">
          <MapPinned size={44} aria-hidden="true" />

          <p className="section-kicker">No Route Yet</p>
          <h2>Nothing is scheduled for today.</h2>

          <p>
            Once a route is assigned, your first stop will appear
            here automatically.
          </p>

          <Link
            className="button button-outline"
            href="/field/routes"
          >
            View Available Routes
          </Link>
        </section>
      )}

      {todaysStops.length > 1 ? (
        <details className="mission-queue">
          <summary>
            <span>
              <ChevronDown size={21} aria-hidden="true" />
              Full Route Queue
            </span>

            <strong>{todaysStops.length} stops</strong>
          </summary>

          <div className="mission-queue-list">
            {todaysStops.map((stop, index) => {
              const booking = context.bookings.find(
                (item) => item.id === stop.booking_id,
              );

              const visit = context.visits.find(
                (item) => item.id === stop.service_visit_id,
              );

              if (!booking || !visit) {
                return null;
              }

              const name =
                [booking.first_name, booking.last_name]
                  .filter(Boolean)
                  .join(" ") || "Customer";

              return (
                <Link
                  className={`mission-queue-item mission-queue-${stop.status}`}
                  href={`/field/stops/${visit.id}`}
                  key={stop.id}
                >
                  <span className="mission-queue-number">
                    {index + 1}
                  </span>

                  <span className="mission-queue-customer">
                    <strong>{name}</strong>
                    <small>
                      {booking.neighborhood || formatBookingAddress(booking)}
                    </small>
                  </span>

                  <span
                    className={`status-badge status-${stop.status}`}
                  >
                    {humanizeStatus(stop.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </details>
      ) : null}

      {todaysStops.some(
        (stop) => stop.status === "needs_follow_up",
      ) ? (
        <Link className="mission-warning-link" href="/field/routes">
          <TriangleAlert size={22} aria-hidden="true" />

          <span>
            <strong>Route needs attention</strong>
            <small>
              One or more stops were marked for follow-up.
            </small>
          </span>
        </Link>
      ) : null}
    </FieldShell>
  );
}