import type { Metadata } from "next";
import {
  endBreakAction,
  readyForNextStopAction,
  startBreakAction,
} from "@/app/field/actions";
import { FieldShell } from "@/components/shells/field-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getFieldContext } from "@/lib/field-data";

export const metadata: Metadata = {
  title: "Field Breaks",
};

type FieldBreaksPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const breakReasons = [
  ["lunch", "Lunch"],
  ["bathroom", "Bathroom"],
  ["tank_empty", "Tank Empty"],
  ["tank_refill", "Tank Refill"],
  ["equipment_issue", "Equipment Issue"],
  ["fuel_stop", "Fuel Stop"],
  ["weather_pause", "Weather Pause"],
  ["customer_delay", "Customer Delay"],
  ["other", "Other"],
] as const;

export default async function FieldBreaksPage({
  searchParams,
}: FieldBreaksPageProps) {
  const params = await searchParams;
  const context = await getFieldContext("/field/breaks");
  const routeStopId = params.routeStopId ?? "";
  const activeBreak = context.breaks.find(
    (routeBreak) =>
      !routeBreak.ended_at &&
      context.auth.status === "ok" &&
      routeBreak.technician_id === context.auth.userId,
  );
  const activeRouteDay = context.routeDays.find(
    (routeDay) => routeDay.id === activeBreak?.route_day_id,
  );
  const openRoutes = context.routeDays.filter((routeDay) =>
    ["planned", "active"].includes(routeDay.status),
  );

  return (
    <FieldShell title="Breaks" auth={context.auth}>
      <section className="field-dashboard-hero compact">
        <div>
          <p className="section-kicker">Route Pause</p>
          <h2>Log breaks without notifying the next customer.</h2>
          <p>
            Lunch, tank refill, weather, customer delays, and equipment pauses
            all stay attached to the route record.
          </p>
        </div>
        <span className={`status-badge status-${activeBreak ? "in_progress" : "standard"}`}>
          {activeBreak ? "Break Active" : "Ready"}
        </span>
      </section>

      {activeBreak ? (
        <section className="field-break-active">
          <span className="status-badge status-in_progress">On Break</span>
          <h2>{humanizeStatus(activeBreak.reason)}</h2>
          <p>
            Started {new Date(activeBreak.started_at).toLocaleTimeString()} on{" "}
            {activeRouteDay?.route_name ?? activeRouteDay?.route_date ?? "route"}.
          </p>
          {activeBreak.notes ? <p className="field-note">{activeBreak.notes}</p> : null}
          <form action={endBreakAction} className="field-form">
            <input type="hidden" name="breakId" value={activeBreak.id} />
            <input type="hidden" name="routeStopId" value={routeStopId} />
            <label className="inline-check">
              <input type="checkbox" name="readyForNext" defaultChecked={Boolean(routeStopId)} />
              <span>Ready for next stop after ending break</span>
            </label>
            <button className="button button-primary field-big-button" type="submit">
              End Break
            </button>
          </form>
        </section>
      ) : (
        <section className="field-card">
          <p className="section-kicker">Start Break</p>
          <h2>Choose a reason.</h2>
          {!openRoutes.length ? (
            <p className="muted">
              No active route is available yet. Breaks can still be logged, but
              they are most useful once a route day is active.
            </p>
          ) : null}
          <form action={startBreakAction} className="field-form">
            <div className="form-grid">
              <label>
                Route
                <select name="routeDayId" defaultValue={openRoutes[0]?.id ?? ""}>
                  <option value="">No route selected</option>
                  {openRoutes.map((routeDay) => (
                    <option key={routeDay.id} value={routeDay.id}>
                      {routeDay.route_date} - {routeDay.route_name ?? routeDay.service_area}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <input name="notes" placeholder="Optional internal note" />
              </label>
            </div>
            <div className="break-reason-grid">
              {breakReasons.map(([value, label]) => (
                <button
                  className="break-reason-button"
                  key={value}
                  name="reason"
                  type="submit"
                  value={value}
                >
                  {label}
                </button>
              ))}
            </div>
          </form>
        </section>
      )}

      <section className="field-section">
        <div className="field-section-heading">
          <div>
            <p className="section-kicker">Recent Breaks</p>
            <h2>Pause history.</h2>
          </div>
        </div>
        {context.breaks.length ? (
          <div className="field-route-grid">
            {context.breaks.slice(0, 12).map((routeBreak) => (
              <article className="field-card compact-field-card" key={routeBreak.id}>
                <div className="field-card-top">
                  <span className={`status-badge status-${routeBreak.ended_at ? "completed" : "in_progress"}`}>
                    {routeBreak.ended_at ? "Ended" : "Active"}
                  </span>
                  <span>{new Date(routeBreak.started_at).toLocaleString()}</span>
                </div>
                <h2>{humanizeStatus(routeBreak.reason)}</h2>
                <p>
                  Ended:{" "}
                  {routeBreak.ended_at
                    ? new Date(routeBreak.ended_at).toLocaleTimeString()
                    : "Still running"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <section className="field-empty-state slim">
            <h2>No breaks logged yet.</h2>
            <p>Break records will appear here once route pauses are started.</p>
          </section>
        )}
      </section>

      {routeStopId && !activeBreak ? (
        <form action={readyForNextStopAction} className="field-floating-action">
          <input type="hidden" name="routeStopId" value={routeStopId} />
          <button className="button button-primary" type="submit">
            Ready for Next Stop
          </button>
        </form>
      ) : null}
    </FieldShell>
  );
}
