import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPinned,
  Route,
} from "lucide-react";
import Link from "next/link";

import { FieldShell } from "@/components/shells/field-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { businessToday, getFieldContext } from "@/lib/field-data";
import { sortStopsForField } from "@/lib/optimoroute/route-sync";

export const metadata: Metadata = {
  title: "Routes | CCC Field",
};

export default async function FieldRoutesPage() {
  const context = await getFieldContext("/field/routes");
  const today = businessToday();

  const visibleRoutes = context.routeDays
    .filter((routeDay) => routeDay.status !== "cancelled")
    .sort((a, b) => a.route_date.localeCompare(b.route_date));

  const todaysRoutes = visibleRoutes.filter(
    (routeDay) => routeDay.route_date === today,
  );

  const upcomingRoutes = visibleRoutes.filter(
    (routeDay) => routeDay.route_date > today,
  );

  const completedRoutes = visibleRoutes
    .filter(
      (routeDay) =>
        routeDay.route_date < today ||
        routeDay.status === "completed",
    )
    .sort((a, b) => b.route_date.localeCompare(a.route_date))
    .slice(0, 6);

  return (
    <FieldShell
      title="Routes"
      subtitle="Today, upcoming work, and recently completed routes."
      auth={context.auth}
    >
      <section className="field-routes-hero">
        <div>
          <p className="section-kicker">Route Board</p>
          <h2>Your work, without the clutter.</h2>

          <p>
            Resume today’s route, preview upcoming service days, or
            review recently completed work.
          </p>
        </div>

        <Link
          className="button button-primary"
          href="/field/today"
        >
          <MapPinned size={20} aria-hidden="true" />
          Open Today
        </Link>
      </section>

      <RouteGroup
        emptyDescription="Nothing is assigned for today."
        emptyTitle="No route today"
        icon={Route}
        routes={todaysRoutes}
        title="Today’s Route"
        today={today}
        context={context}
      />

      <RouteGroup
        emptyDescription="New route days will appear here when they are assigned."
        emptyTitle="No upcoming routes"
        icon={CalendarDays}
        routes={upcomingRoutes}
        title="Upcoming Routes"
        today={today}
        context={context}
      />

      <RouteGroup
        emptyDescription="Completed route days will collect here."
        emptyTitle="No completed routes yet"
        icon={CheckCircle2}
        routes={completedRoutes}
        title="Recently Completed"
        today={today}
        context={context}
      />
    </FieldShell>
  );
}

function RouteGroup({
  title,
  emptyTitle,
  emptyDescription,
  routes,
  context,
  today,
  icon: Icon,
}: {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  routes: Awaited<
    ReturnType<typeof getFieldContext>
  >["routeDays"];
  context: Awaited<ReturnType<typeof getFieldContext>>;
  today: string;
  icon: typeof Route;
}) {
  return (
    <section className="field-route-group">
      <div className="field-route-group-heading">
        <div>
          <Icon size={22} aria-hidden="true" />
          <h2>{title}</h2>
        </div>

        <span>{routes.length}</span>
      </div>

      {routes.length ? (
        <div className="field-route-list">
          {routes.map((routeDay) => {
            const stops = context.routeStops
              .filter(
                (stop) =>
                  stop.route_day_id === routeDay.id &&
                  stop.status !== "cancelled",
              )
              .sort(sortStopsForField);

            const completedStops = stops.filter(
              (stop) => stop.status === "completed",
            );

            const remainingStops = stops.filter(
              (stop) =>
                ![
                  "completed",
                  "cancelled",
                  "skipped",
                  "rescheduled",
                ].includes(stop.status),
            );

            const problemStops = stops.filter(
              (stop) => stop.status === "needs_follow_up",
            );

            const nextStop = remainingStops[0] ?? null;

            const progress =
              stops.length > 0
                ? Math.round(
                    (completedStops.length / stops.length) * 100,
                  )
                : 0;

            const isComplete =
              stops.length > 0 &&
              remainingStops.length === 0;

            const routeHref = nextStop?.service_visit_id
              ? `/field/stops/${nextStop.service_visit_id}`
              : routeDay.route_date === today
                ? "/field/today"
                : "/field/history";

            return (
              <article
                className={[
                  "field-route-summary-card",
                  isComplete ? "is-complete" : "",
                  problemStops.length ? "needs-attention" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={routeDay.id}
              >
                <div className="field-route-summary-top">
                  <div>
                    <p className="section-kicker">
                      {formatRouteDate(
                        routeDay.route_date,
                        today,
                      )}
                    </p>

                    <h3>
                      {routeDay.route_name ??
                        `${routeDay.service_area ?? "Service"} Route`}
                    </h3>

                    <p>
                      {routeDay.service_area ??
                        "Service area not listed"}
                    </p>
                  </div>

                  <span
                    className={`status-badge status-${routeDay.status}`}
                  >
                    {humanizeStatus(routeDay.status)}
                  </span>
                </div>

                <div className="field-route-progress">
                  <span style={{ width: `${progress}%` }} />
                </div>

                <div className="field-route-summary-stats">
                  <div>
                    <Route size={20} aria-hidden="true" />
                    <span>Total</span>
                    <strong>{stops.length}</strong>
                  </div>

                  <div>
                    <CheckCircle2
                      size={20}
                      aria-hidden="true"
                    />
                    <span>Done</span>
                    <strong>{completedStops.length}</strong>
                  </div>

                  <div>
                    <Clock3 size={20} aria-hidden="true" />
                    <span>Left</span>
                    <strong>{remainingStops.length}</strong>
                  </div>

                  <div>
                    <AlertTriangle
                      size={20}
                      aria-hidden="true"
                    />
                    <span>Issues</span>
                    <strong>{problemStops.length}</strong>
                  </div>
                </div>

                {routeDay.notes ? (
                  <p className="field-route-note">
                    {routeDay.notes}
                  </p>
                ) : null}

                <Link
                  className={
                    isComplete
                      ? "field-route-open-button is-complete"
                      : "field-route-open-button"
                  }
                  href={routeHref}
                >
                  <span>
                    {isComplete
                      ? "View Completed Route"
                      : nextStop
                        ? "Resume Route"
                        : "View Route"}
                  </span>

                  <ChevronRight
                    size={22}
                    aria-hidden="true"
                  />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="field-route-group-empty">
          <Icon size={34} aria-hidden="true" />

          <div>
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function formatRouteDate(
  routeDate: string,
  today: string,
) {
  if (routeDate === today) return "Today";

  const date = new Date(`${routeDate}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}
