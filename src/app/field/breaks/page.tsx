import type { Metadata } from "next";
import {
  AlertTriangle,
  Bath,
  Car,
  ChevronDown,
  Clock3,
  CloudRain,
  Coffee,
  Droplets,
  Fuel,
  Gauge,
  LockKeyhole,
  PauseCircle,
  Play,
  ShieldAlert,
  UserRound,
  Wrench,
} from "lucide-react";

import {
  endBreakAction,
  readyForNextStopAction,
  startBreakAction,
} from "@/app/field/actions";
import { FieldShell } from "@/components/shells/field-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getFieldContext } from "@/lib/field-data";
import { isAdminRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Breaks | CCC Field",
};

type FieldBreaksPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

type BreakReason = {
  value: string;
  label: string;
  description: string;
  requiresNote: boolean;
  icon: typeof Coffee;
};

const quickBreakReasons: BreakReason[] = [
  {
    value: "lunch",
    label: "Lunch",
    description: "Meal break",
    requiresNote: false,
    icon: Coffee,
  },
  {
    value: "bathroom",
    label: "Bathroom",
    description: "Quick personal stop",
    requiresNote: false,
    icon: Bath,
  },
  {
    value: "hydration_rest",
    label: "Water / Rest",
    description: "Hydrate or cool down",
    requiresNote: false,
    icon: Droplets,
  },
  {
    value: "fuel_stop",
    label: "Fuel Stop",
    description: "Refuel the service vehicle",
    requiresNote: false,
    icon: Fuel,
  },
  {
    value: "tank_refill",
    label: "Tank Refill",
    description: "Refill service water",
    requiresNote: false,
    icon: Gauge,
  },
  {
    value: "scheduled_break",
    label: "Scheduled Break",
    description: "Planned route pause",
    requiresNote: false,
    icon: Clock3,
  },
];

const detailedBreakReasons: BreakReason[] = [
  {
    value: "tank_empty",
    label: "Tank Empty",
    description: "Unexpected water shortage",
    requiresNote: true,
    icon: Gauge,
  },
  {
    value: "equipment_issue",
    label: "Equipment Issue",
    description: "Tool or machine problem",
    requiresNote: true,
    icon: Wrench,
  },
  {
    value: "vehicle_issue",
    label: "Vehicle Issue",
    description: "Vehicle problem or delay",
    requiresNote: true,
    icon: Car,
  },
  {
    value: "access_issue",
    label: "Access Issue",
    description: "Gate, lock, or property access",
    requiresNote: true,
    icon: LockKeyhole,
  },
  {
    value: "safety_concern",
    label: "Safety Concern",
    description: "Unsafe condition requiring a pause",
    requiresNote: true,
    icon: ShieldAlert,
  },
  {
    value: "customer_issue",
    label: "Customer Issue",
    description: "Customer-related delay",
    requiresNote: true,
    icon: UserRound,
  },
  {
    value: "weather_pause",
    label: "Weather Pause",
    description: "Rain, lightning, heat, or wind",
    requiresNote: true,
    icon: CloudRain,
  },
  {
    value: "customer_delay",
    label: "Customer Delay",
    description: "Waiting on customer action",
    requiresNote: true,
    icon: Clock3,
  },
  {
    value: "other",
    label: "Other",
    description: "Anything not listed above",
    requiresNote: true,
    icon: AlertTriangle,
  },
];

export default async function FieldBreaksPage({
  searchParams,
}: FieldBreaksPageProps) {
  const params = await searchParams;
  const context = await getFieldContext("/field/breaks");

  if (context.auth.status !== "ok") {
    return (
      <FieldShell title="Breaks" auth={context.auth}>
        <section className="field-empty-state">
          <h2>Break tools are unavailable.</h2>
          <p>Please sign in again to continue.</p>
        </section>
      </FieldShell>
    );
  }

  const canViewAllBreaks = isAdminRole(
    context.auth.profile.role,
  );

  const userId = context.auth.userId;
  const routeStopId = params.routeStopId ?? "";
  const notesRequiredError =
    params.break_error === "notes_required";
  const failedReason = params.reason ?? "";

  /*
   * Permission boundary:
   * - Owners/admins may view company-wide break history.
   * - Technicians may view only their own breaks.
   */
  const visibleBreaks = (
    canViewAllBreaks
      ? context.breaks
      : context.breaks.filter(
          (routeBreak) =>
            routeBreak.technician_id === userId,
        )
  ).sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  );

  const activeBreak = visibleBreaks.find(
    (routeBreak) =>
      !routeBreak.ended_at &&
      routeBreak.technician_id === userId,
  );

  const activeRouteDay = context.routeDays.find(
    (routeDay) =>
      routeDay.id === activeBreak?.route_day_id,
  );

  /*
   * Technicians should only choose from routes assigned to them.
   * Owners/admins may select any open route.
   */
  const openRoutes = context.routeDays
    .filter((routeDay) =>
      ["planned", "active"].includes(routeDay.status),
    )
    .filter(
      (routeDay) =>
        canViewAllBreaks ||
        routeDay.assigned_technician_id === userId,
    )
    .sort((a, b) =>
      a.route_date.localeCompare(b.route_date),
    );

  const preferredRouteId =
    activeRouteDay?.id ??
    openRoutes.find(
      (routeDay) => routeDay.status === "active",
    )?.id ??
    openRoutes[0]?.id ??
    "";

  const technicianNames = new Map(
    context.profiles.map((profile) => {
      const name =
        [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(" ") ||
        profile.email ||
        "Technician";

      return [profile.id, name];
    }),
  );

  const groupedBreaks = groupBreaksByDay(
    visibleBreaks.filter(
      (routeBreak) => routeBreak.id !== activeBreak?.id,
    ),
  );

  return (
    <FieldShell
      title="Breaks"
      subtitle="Pause your route, handle what you need, and get moving again."
      auth={context.auth}
    >
      <section className="field-breaks-hero">
        <div>
          <p className="section-kicker">Route Pause</p>

          <h2>
            {activeBreak
              ? "Take the time you need."
              : "Need a quick pause?"}
          </h2>

          <p>
            Breaks stay attached to the route record without
            notifying the next customer.
          </p>
        </div>

        <div
          className={[
            "field-breaks-hero-status",
            activeBreak ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {activeBreak ? (
            <PauseCircle size={24} aria-hidden="true" />
          ) : (
            <Play size={24} aria-hidden="true" />
          )}

          <div>
            <strong>
              {activeBreak ? "Break active" : "Ready"}
            </strong>

            <small>
              {activeBreak
                ? formatElapsed(activeBreak.started_at)
                : "Route available"}
            </small>
          </div>
        </div>
      </section>

      {notesRequiredError ? (
        <section
          className="field-break-error"
          role="alert"
        >
          <AlertTriangle size={22} aria-hidden="true" />

          <div>
            <strong>Tell admin what happened.</strong>

            <p>
              Notes are required for{" "}
              {humanizeStatus(
                failedReason || "that break",
              )}.
            </p>
          </div>
        </section>
      ) : null}

      {activeBreak ? (
        <section className="field-break-active-v2">
          <div className="field-break-active-heading">
            <div className="field-break-active-icon">
              <PauseCircle
                size={30}
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="section-kicker">
                Currently On Break
              </p>

              <h2>
                {humanizeStatus(activeBreak.reason)}
              </h2>

              <p>
                Started{" "}
                {formatBreakTime(activeBreak.started_at)}
                {" · "}
                {formatElapsed(activeBreak.started_at)}
              </p>
            </div>
          </div>

          <div className="field-break-active-route">
            <span>Route</span>

            <strong>
              {activeRouteDay?.route_name ??
                activeRouteDay?.service_area ??
                activeRouteDay?.route_date ??
                "No route linked"}
            </strong>
          </div>

          {activeBreak.notes ? (
            <div className="field-break-active-note">
              <strong>Break note</strong>
              <p>{activeBreak.notes}</p>
            </div>
          ) : null}

          <form
            action={endBreakAction}
            className="field-break-end-form"
          >
            <input
              type="hidden"
              name="breakId"
              value={activeBreak.id}
            />

            <input
              type="hidden"
              name="routeStopId"
              value={routeStopId}
            />

            {routeStopId ? (
              <input
                type="hidden"
                name="readyForNext"
                value="on"
              />
            ) : null}

            <button type="submit">
              <Play size={22} aria-hidden="true" />

              <span>
                {routeStopId
                  ? "End Break & Resume Route"
                  : "End Break"}
              </span>
            </button>
          </form>
        </section>
      ) : (
        <>
          {!openRoutes.length ? (
            <section className="field-break-no-route">
              <AlertTriangle
                size={22}
                aria-hidden="true"
              />

              <div>
                <strong>No active route found.</strong>

                <p>
                  You can still log a break, but it will not be
                  linked to a route day.
                </p>
              </div>
            </section>
          ) : null}

          <section className="field-break-start-card">
            <div className="field-break-start-heading">
              <div>
                <p className="section-kicker">
                  Quick Break
                </p>

                <h2>Tap a reason and go.</h2>

                <p>
                  Common breaks start immediately. No extra
                  paperwork.
                </p>
              </div>

              {openRoutes.length > 1 ? (
                <span>
                  {openRoutes.length} open routes
                </span>
              ) : null}
            </div>

            <div className="field-break-quick-grid">
              {quickBreakReasons.map((reason) => {
                const Icon = reason.icon;

                return (
                  <form
                    action={startBreakAction}
                    key={reason.value}
                  >
                    <input
                      type="hidden"
                      name="routeDayId"
                      value={preferredRouteId}
                    />

                    <input
                      type="hidden"
                      name="reason"
                      value={reason.value}
                    />

                    <button
                      className="field-break-quick-button"
                      type="submit"
                    >
                      <Icon
                        size={25}
                        aria-hidden="true"
                      />

                      <span>
                        <strong>{reason.label}</strong>
                        <small>
                          {reason.description}
                        </small>
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          </section>

          <details
            className="field-break-detailed-panel"
            open={notesRequiredError}
          >
            <summary>
              <span>
                <AlertTriangle
                  size={21}
                  aria-hidden="true"
                />

                <span>
                  <strong>
                    Problem, delay, or unusual pause
                  </strong>

                  <small>
                    Add a note so admin knows what happened.
                  </small>
                </span>
              </span>

              <ChevronDown
                size={21}
                aria-hidden="true"
              />
            </summary>

            <div className="field-break-detailed-content">
              {detailedBreakReasons.map((reason) => {
                const Icon = reason.icon;

                return (
                  <details
                    className="field-break-reason-details"
                    key={reason.value}
                    open={
                      notesRequiredError &&
                      failedReason === reason.value
                    }
                  >
                    <summary>
                      <Icon
                        size={22}
                        aria-hidden="true"
                      />

                      <span>
                        <strong>{reason.label}</strong>
                        <small>
                          {reason.description}
                        </small>
                      </span>

                      <ChevronDown
                        size={19}
                        aria-hidden="true"
                      />
                    </summary>

                    <form
                      action={startBreakAction}
                      className="field-break-detail-form"
                    >
                      <input
                        type="hidden"
                        name="reason"
                        value={reason.value}
                      />

                      <label>
                        Route

                        <select
                          name="routeDayId"
                          defaultValue={preferredRouteId}
                        >
                          <option value="">
                            No route selected
                          </option>

                          {openRoutes.map((routeDay) => (
                            <option
                              key={routeDay.id}
                              value={routeDay.id}
                            >
                              {formatRouteOption(routeDay)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        What happened?

                        <textarea
                          name="notes"
                          placeholder="Give admin enough detail to understand the delay or problem."
                          required
                        />
                      </label>

                      <button type="submit">
                        Start {reason.label} Break
                      </button>
                    </form>
                  </details>
                );
              })}
            </div>
          </details>
        </>
      )}

      <section className="field-break-history-section">
        <div className="field-break-history-heading">
          <div>
            <p className="section-kicker">
              {canViewAllBreaks
                ? "Company Break History"
                : "Your Break History"}
            </p>

            <h2>Recent route pauses.</h2>

            <p>
              {canViewAllBreaks
                ? "Breaks from every technician."
                : "Only breaks logged under your account."}
            </p>
          </div>

          <span>{visibleBreaks.length}</span>
        </div>

        {groupedBreaks.length ? (
          <div className="field-break-history-groups">
            {groupedBreaks.map((group) => (
              <section
                className="field-break-history-group"
                key={group.dateKey}
              >
                <div className="field-break-history-date">
                  <h3>{group.label}</h3>
                  <span>{group.breaks.length}</span>
                </div>

                <div className="field-break-history-list">
                  {group.breaks.map((routeBreak) => {
                    const routeDay =
                      context.routeDays.find(
                        (route) =>
                          route.id ===
                          routeBreak.route_day_id,
                      );

                    const technicianName = routeBreak.technician_id
                      ? technicianNames.get(routeBreak.technician_id) ??
                        "Technician"
                      : "Technician not recorded";

                    return (
                      <details
                        className="field-break-history-row"
                        key={routeBreak.id}
                      >
                        <summary>
                          <span className="field-break-history-icon">
                            <Clock3
                              size={20}
                              aria-hidden="true"
                            />
                          </span>

                          <span className="field-break-history-main">
                            <strong>
                              {humanizeStatus(
                                routeBreak.reason,
                              )}
                            </strong>

                            <small>
                              {formatBreakRange(
                                routeBreak.started_at,
                                routeBreak.ended_at,
                              )}
                              {" · "}
                              {formatBreakDuration(
                                routeBreak.started_at,
                                routeBreak.ended_at,
                              )}
                            </small>
                          </span>

                          <span
                            className={[
                              "field-break-history-state",
                              routeBreak.ended_at
                                ? "is-ended"
                                : "is-active",
                            ].join(" ")}
                          >
                            {routeBreak.ended_at
                              ? "Ended"
                              : "Active"}
                          </span>

                          <ChevronDown
                            className="field-break-history-chevron"
                            size={19}
                            aria-hidden="true"
                          />
                        </summary>

                        <div className="field-break-history-details">
                          {canViewAllBreaks ? (
                            <p>
                              <strong>Technician:</strong>{" "}
                              {technicianName}
                            </p>
                          ) : null}

                          <p>
                            <strong>Route:</strong>{" "}
                            {routeDay?.route_name ??
                              routeDay?.service_area ??
                              routeDay?.route_date ??
                              "No route linked"}
                          </p>

                          {routeBreak.notes ? (
                            <p>
                              <strong>Notes:</strong>{" "}
                              {routeBreak.notes}
                            </p>
                          ) : (
                            <p className="muted">
                              No notes were added.
                            </p>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className="field-empty-state slim">
            <Clock3 size={34} aria-hidden="true" />

            <h2>No breaks logged yet.</h2>

            <p>
              Route pauses will appear here after the first
              break is started.
            </p>
          </section>
        )}
      </section>

      {routeStopId && !activeBreak ? (
        <form
          action={readyForNextStopAction}
          className="field-floating-action"
        >
          <input
            type="hidden"
            name="routeStopId"
            value={routeStopId}
          />

          <button
            className="button button-primary"
            type="submit"
          >
            Ready for Next Stop
          </button>
        </form>
      ) : null}
    </FieldShell>
  );
}

function groupBreaksByDay<
  T extends {
    started_at: string;
  },
>(breaks: T[]) {
  const groups = new Map<string, T[]>();

  breaks.forEach((routeBreak) => {
    const dateKey = getEasternDateKey(
      routeBreak.started_at,
    );

    const existing = groups.get(dateKey) ?? [];
    existing.push(routeBreak);
    groups.set(dateKey, existing);
  });

  return Array.from(groups.entries()).map(
    ([dateKey, groupedBreaks]) => ({
      dateKey,
      label: formatBreakDateLabel(dateKey),
      breaks: groupedBreaks,
    }),
  );
}

function getEasternDateKey(value: string) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(new Date(value));

  const year =
    parts.find((part) => part.type === "year")
      ?.value ?? "";

  const month =
    parts.find((part) => part.type === "month")
      ?.value ?? "";

  const day =
    parts.find((part) => part.type === "day")
      ?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatBreakDateLabel(dateKey: string) {
  const today = getEasternDateKey(
    new Date().toISOString(),
  );

  const yesterday = getEasternDateKey(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString(),
  );

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${dateKey}T12:00:00-04:00`));
}

function formatBreakTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatBreakRange(
  start: string,
  end: string | null,
) {
  const startTime = formatBreakTime(start);

  if (!end) {
    return `${startTime}–Now`;
  }

  return `${startTime}–${formatBreakTime(end)}`;
}

function formatBreakDuration(
  start: string,
  end: string | null,
) {
  const startMs = new Date(start).getTime();
  const endMs = end
    ? new Date(end).getTime()
    : Date.now();

  const minutes = Math.max(
    1,
    Math.round((endMs - startMs) / 60000),
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

function formatElapsed(start: string) {
  return `${formatBreakDuration(start, null)} elapsed`;
}

function formatRouteOption(routeDay: {
  route_date: string;
  route_name: string | null;
  service_area: string | null;
}) {
  const label =
    routeDay.route_name ??
    routeDay.service_area ??
    "Route";

  return `${routeDay.route_date} — ${label}`;
}
