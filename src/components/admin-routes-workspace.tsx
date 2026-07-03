"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addBookingToRouteAdminAction,
  createRouteDayAdminAction,
  deleteRouteDayAdminAction,
  removeRouteStopAdminAction,
  updateRouteDayAdminAction,
  updateRouteStopAdminAction,
} from "@/app/admin/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { AdminOptimoRouteControls } from "@/components/admin-optimoroute-controls";
import { humanizeStatus } from "@/lib/booking-utils";

export type AdminRoutesWorkspaceProps = {
  routeDays: RouteDayView[];
  routeableBookings: SelectOption[];
  technicians: SelectOption[];
};

export type RouteDayView = {
  id: string;
  routeDate: string;
  routeName: string | null;
  serviceArea: string | null;
  status: string;
  assignedTechnicianId: string | null;
  assignedTechnicianLabel: string;
  notes: string | null;
  optimoroutePlanningId: number | null;
  optimoroutePlanningStatus: string | null;
  optimoroutePlanningError: string | null;
  optimorouteLastImportedAt: string | null;
  counts: {
    eligible: number;
    imported: number;
    needsReview: number;
    scheduled: number;
    stops: number;
    synced: number;
    unscheduled: number;
  };
  needsReviewItems: Array<{ id: string; label: string; summary: string }>;
  stops: RouteStopView[];
  unscheduledItems: RouteStopView[];
};

type RouteStopView = {
  id: string;
  address: string;
  bookingId: string | null;
  customerName: string;
  eligibilitySummary: string;
  eligible: boolean;
  fieldHref: string | null;
  checklistHref: string | null;
  issue: string | null;
  manualOrder: number;
  optimorouteOrderNo: string;
  optimorouteScheduledAt: string | null;
  optimorouteSequence: number | null;
  optimorouteStatus: string;
  routeStopStatus: string;
  stopOrder: number;
  technicianNotes: string | null;
};

type SelectOption = {
  id: string;
  label: string;
};

type RouteTab = "overview" | "stops" | "optimize" | "add" | "notes";

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

export function AdminRoutesWorkspace({
  routeDays,
  routeableBookings,
  technicians,
}: AdminRoutesWorkspaceProps) {
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(
    routeDays[0]?.id ?? null,
  );
  const [activeTab, setActiveTab] = useState<RouteTab>("overview");

  const sortedRouteDays = useMemo(
    () =>
      [...routeDays].sort((a, b) => {
        const priorityDifference = getRoutePriority(a) - getRoutePriority(b);
        if (priorityDifference !== 0) return priorityDifference;
        return b.routeDate.localeCompare(a.routeDate);
      }),
    [routeDays],
  );

  const expandedRoute = useMemo(
    () => sortedRouteDays.find((routeDay) => routeDay.id === expandedRouteId),
    [expandedRouteId, sortedRouteDays],
  );

  function openRoute(routeId: string) {
    setExpandedRouteId(routeId);
    setActiveTab("overview");
  }

  return (
    <div className="route-workspace route-operator-workspace">
      <details className="route-create-drawer">
        <summary>Create a new route day</summary>
        <FeedbackForm
          action={createRouteDayAdminAction}
          className="filter-bar route-create-form"
          pendingMessage="Creating route day..."
          resetOnSuccess
          successMessage="Route day created."
        >
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
                    {profile.label}
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
            <textarea
              name="notes"
              placeholder="Tank plan, route reminders, HOA notes..."
            />
          </label>

          <ActionSubmitButton className="button button-primary" pendingLabel="Creating...">
            Create Route Day
          </ActionSubmitButton>
        </FeedbackForm>
      </details>

      <div className="route-operator-grid">
        <aside className="route-list-panel" aria-label="Route days">
          <div className="route-list-heading">
            <div>
              <p className="section-kicker">Route days</p>
              <h2>Choose a route.</h2>
            </div>
            <span className="status-badge">{sortedRouteDays.length} total</span>
          </div>

          <div className="route-card-list">
            {sortedRouteDays.map((routeDay) => {
              const expanded = routeDay.id === expandedRouteId;
              const nextAction = getRouteNextAction(routeDay);

              return (
                <button
                  className={
                    expanded
                      ? "route-day-card route-day-button is-expanded"
                      : "route-day-card route-day-button"
                  }
                  key={routeDay.id}
                  type="button"
                  onClick={() => openRoute(routeDay.id)}
                  aria-pressed={expanded}
                >
                  <span className={`needs-dot needs-dot-${nextAction.tone}`} />

                  <div>
                    <span className={`status-badge status-${routeDay.status}`}>
                      {humanizeStatus(routeDay.status)}
                    </span>

                    <h3>{routeDay.routeName ?? `${routeDay.serviceArea} route`}</h3>

                    <p>
                      {routeDay.routeDate} · {routeDay.assignedTechnicianLabel}
                    </p>
                  </div>

                  <div className="route-summary-metrics" aria-hidden="true">
                    <span>{routeDay.counts.stops} stops</span>
                    <span>{routeDay.counts.imported} imported</span>
                    <span>{routeDay.counts.needsReview} review</span>
                  </div>

                  <strong className="route-next-action">{nextAction.label}</strong>
                </button>
              );
            })}

            {!sortedRouteDays.length ? (
              <div className="empty-state-card">
                <h2>No route days yet.</h2>
                <p>Create your first route day above, then add bookings.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="route-detail-panel">
          {expandedRoute ? (
            <RouteDayEditor
              activeTab={activeTab}
              routeDay={expandedRoute}
              routeableBookings={routeableBookings}
              setActiveTab={setActiveTab}
              technicians={technicians}
            />
          ) : (
            <div className="empty-state-card">
              <h2>Select a route day.</h2>
              <p>
                Open one route to view stops, add bookings, run OptimoRoute, and
                prepare the field app.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RouteDayEditor({
  activeTab,
  routeDay,
  routeableBookings,
  setActiveTab,
  technicians,
}: {
  activeTab: RouteTab;
  routeDay: RouteDayView;
  routeableBookings: SelectOption[];
  setActiveTab: (tab: RouteTab) => void;
  technicians: SelectOption[];
}) {
  const nextAction = getRouteNextAction(routeDay);

  return (
    <div className="route-day-editor route-detail-workflow">
      <div className="route-detail-hero">
        <div>
          <p className="section-kicker">Selected route</p>
          <h2>{routeDay.routeName ?? `${routeDay.serviceArea} route`}</h2>
          <p>
            {routeDay.routeDate} · {routeDay.serviceArea ?? "No area"} · Tech:{" "}
            {routeDay.assignedTechnicianLabel}
          </p>
        </div>

        <div className="route-next-card">
          <span>Next action</span>
          <strong>{nextAction.label}</strong>
          <small>{nextAction.description}</small>
        </div>
      </div>

      <nav className="route-detail-tabs" aria-label="Route workflow tabs">
        <RouteTabButton
          active={activeTab === "overview"}
          label="Overview"
          onClick={() => setActiveTab("overview")}
        />
        <RouteTabButton
          active={activeTab === "stops"}
          label={`Stops (${routeDay.counts.stops})`}
          onClick={() => setActiveTab("stops")}
        />
        <RouteTabButton
          active={activeTab === "optimize"}
          label="Optimize"
          onClick={() => setActiveTab("optimize")}
        />
        <RouteTabButton
          active={activeTab === "add"}
          label="Add Booking"
          onClick={() => setActiveTab("add")}
        />
        <RouteTabButton
          active={activeTab === "notes"}
          label="Notes"
          onClick={() => setActiveTab("notes")}
        />
      </nav>

      {activeTab === "overview" ? (
        <RouteOverview routeDay={routeDay} setActiveTab={setActiveTab} />
      ) : null}

      {activeTab === "stops" ? <RouteStops routeDay={routeDay} /> : null}

      {activeTab === "optimize" ? <RouteOptimize routeDay={routeDay} /> : null}

      {activeTab === "add" ? (
        <RouteAddBooking
          routeDay={routeDay}
          routeableBookings={routeableBookings}
        />
      ) : null}

      {activeTab === "notes" ? (
        <RouteNotes routeDay={routeDay} technicians={technicians} />
      ) : null}
    </div>
  );
}

function RouteTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "route-tab is-active" : "route-tab"}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RouteOverview({
  routeDay,
  setActiveTab,
}: {
  routeDay: RouteDayView;
  setActiveTab: (tab: RouteTab) => void;
}) {
  return (
    <section className="detail-panel route-overview-panel">
      <div className="admin-record-overview">
        <InfoTile label="Total stops" value={String(routeDay.counts.stops)} />
        <InfoTile label="Eligible" value={String(routeDay.counts.eligible)} />
        <InfoTile label="Imported" value={String(routeDay.counts.imported)} />
        <InfoTile label="Scheduled" value={String(routeDay.counts.scheduled)} />
        <InfoTile label="Needs review" value={String(routeDay.counts.needsReview)} />
        <InfoTile label="Unscheduled" value={String(routeDay.counts.unscheduled)} />
        <InfoTile
          label="OptimoRoute"
          value={
            routeDay.optimoroutePlanningStatus
              ? humanizeStatus(routeDay.optimoroutePlanningStatus)
              : "Not started"
          }
        />
        <InfoTile
          label="Last import"
          value={
            routeDay.optimorouteLastImportedAt
              ? formatAdminDateTime(routeDay.optimorouteLastImportedAt)
              : "None"
          }
        />
      </div>

      <div className="route-overview-actions">
        {routeDay.counts.stops === 0 ? (
          <button
            className="button button-dark"
            type="button"
            onClick={() => setActiveTab("add")}
          >
            Add Bookings
          </button>
        ) : null}

        {routeDay.counts.needsReview > 0 || routeDay.counts.unscheduled > 0 ? (
          <button
            className="button button-dark"
            type="button"
            onClick={() => setActiveTab("stops")}
          >
            Review Stops
          </button>
        ) : null}

        {routeDay.counts.stops > 0 ? (
          <button
            className="button button-outline"
            type="button"
            onClick={() => setActiveTab("optimize")}
          >
            Optimize Route
          </button>
        ) : null}

        <Link className="button button-outline" href="/field/today">
          Open Field App
        </Link>
      </div>

      {routeDay.needsReviewItems.length ? (
        <div className="route-alert-list">
          <h3>Needs review</h3>
          {routeDay.needsReviewItems.slice(0, 4).map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.summary}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!routeDay.needsReviewItems.length && routeDay.counts.stops ? (
        <div className="empty-state-card">
          <h2>Route looks ready for the next step.</h2>
          <p>Review stops, optimize order, or open the field app.</p>
        </div>
      ) : null}
    </section>
  );
}

function RouteOptimize({ routeDay }: { routeDay: RouteDayView }) {
  return (
    <section className="optimoroute-panel" aria-label="OptimoRoute routing tools">
      <div className="admin-row-heading">
        <div>
          <p className="section-kicker">OptimoRoute Supplement</p>
          <h2>Optimize this route day.</h2>
          <p className="muted">
            Sync eligible Clean Curb Co stops to OptimoRoute, start planning,
            check until finished, then import the optimized order back here.
          </p>
        </div>

        <div className="status-stack">
          <span
            className={`status-badge status-${
              routeDay.optimoroutePlanningStatus ?? "not_sent"
            }`}
          >
            {routeDay.optimoroutePlanningStatus
              ? humanizeStatus(routeDay.optimoroutePlanningStatus)
              : "Not Sent"}
          </span>
          {routeDay.optimorouteLastImportedAt ? (
            <span className="status-badge status-imported">Imported</span>
          ) : null}
        </div>
      </div>

      <div className="route-optimization-steps">
        <StepBadge
          active={routeDay.counts.synced > 0}
          label="1. Synced"
          value={`${routeDay.counts.synced}/${routeDay.counts.stops}`}
        />
        <StepBadge
          active={Boolean(routeDay.optimoroutePlanningId)}
          label="2. Planning"
          value={
            routeDay.optimoroutePlanningStatus
              ? humanizeStatus(routeDay.optimoroutePlanningStatus)
              : "Not started"
          }
        />
        <StepBadge
          active={routeDay.optimoroutePlanningStatus === "finished"}
          label="3. Finished"
          value={routeDay.optimoroutePlanningStatus === "finished" ? "Ready" : "Waiting"}
        />
        <StepBadge
          active={routeDay.counts.imported > 0}
          label="4. Imported"
          value={`${routeDay.counts.imported} stops`}
        />
      </div>

      <AdminOptimoRouteControls
        eligibleCount={routeDay.counts.eligible}
        importedCount={routeDay.counts.imported}
        needsReviewCount={routeDay.counts.needsReview}
        planningId={routeDay.optimoroutePlanningId}
        planningStatus={routeDay.optimoroutePlanningStatus}
        routeDate={routeDay.routeDate}
        routeDayId={routeDay.id}
        syncedCount={routeDay.counts.synced}
      />

      <a
        className="button button-outline"
        href="https://my.optimoroute.com/"
        target="_blank"
        rel="noreferrer"
      >
        Open OptimoRoute
      </a>

      {routeDay.optimoroutePlanningError ? (
        <p className="optimoroute-message error">
          {routeDay.optimoroutePlanningError}
        </p>
      ) : null}

      {routeDay.unscheduledItems.length ? (
        <div className="optimoroute-review-list">
          <p className="optimoroute-note">
            {routeDay.counts.imported
              ? `${routeDay.unscheduledItems.length} synced stop(s) need route review.`
              : "OptimoRoute did not schedule any synced stops. Check driver availability, work hours, route date, timezone, depot/start location, vehicle settings, and stop constraints."}
          </p>

          {routeDay.unscheduledItems.map((item) => (
            <div key={item.id}>
              <span className="status-badge status-unscheduled">Unscheduled</span>
              <strong>{item.customerName}</strong>
              <span>{item.address}</span>
              <span>Order {item.optimorouteOrderNo}</span>
              <span>
                {item.issue ??
                  "OptimoRoute did not return a schedule for this stop. Check driver availability, work hours, route date, depot/start location, and stop constraints."}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <details className="technical-details">
        <summary>How to check OptimoRoute</summary>
        <p className="muted">
          Clean Curb Co sends stops as OptimoRoute orders using the matching route
          date. If checking OptimoRoute directly, filter to this same date.
          Customers and techs should still use Clean Curb Co.
        </p>
      </details>
    </section>
  );
}

function RouteAddBooking({
  routeDay,
  routeableBookings,
}: {
  routeDay: RouteDayView;
  routeableBookings: SelectOption[];
}) {
  return (
    <section className="detail-panel">
      <div className="admin-row-heading">
        <div>
          <p className="section-kicker">Add booking</p>
          <h2>Add a customer stop.</h2>
          <p className="muted">
            Add bookings here first, then sync/optimize from the Optimize tab.
          </p>
        </div>
      </div>

      <FeedbackForm
        action={addBookingToRouteAdminAction}
        className="compact-admin-form"
        pendingMessage="Adding booking..."
        resetOnSuccess
        successMessage="Booking added to route."
      >
        <input type="hidden" name="routeDayId" value={routeDay.id} />

        <div className="form-grid">
          <label className="field">
            <span>Booking</span>
            <select name="bookingId" required defaultValue="">
              <option value="">Choose booking</option>
              {routeableBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Stop order</span>
            <input
              min="1"
              name="stopOrder"
              placeholder={`${routeDay.counts.stops + 1}`}
              type="number"
            />
          </label>
        </div>

        <ActionSubmitButton className="button button-dark" pendingLabel="Adding...">
          Add Booking to Route
        </ActionSubmitButton>
      </FeedbackForm>

      {!routeableBookings.length ? (
        <div className="empty-state-card">
          <h2>No available bookings.</h2>
          <p>
            Every active booking may already be on a route, or filters/statuses may
            need review.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RouteNotes({
  routeDay,
  technicians,
}: {
  routeDay: RouteDayView;
  technicians: SelectOption[];
}) {
  return (
    <section className="detail-panel">
      <div className="admin-row-heading">
        <div>
          <p className="section-kicker">Route settings</p>
          <h2>Notes and assignment.</h2>
          <p className="muted">
            Keep route admin details here so the stop list stays clean.
          </p>
        </div>
      </div>

      <FeedbackForm
        action={updateRouteDayAdminAction}
        className="compact-admin-form"
        pendingMessage="Saving route..."
        successMessage="Route saved."
      >
        <input type="hidden" name="routeDayId" value={routeDay.id} />

        <div className="form-grid">
          <label className="field">
            <span>Route name</span>
            <input name="routeName" defaultValue={routeDay.routeName ?? ""} />
          </label>

          <label className="field">
            <span>Service area</span>
            <input name="serviceArea" defaultValue={routeDay.serviceArea ?? "Cane Bay"} />
          </label>

          <label className="field">
            <span>Technician</span>
            <select
              name="assignedTechnicianId"
              defaultValue={routeDay.assignedTechnicianId ?? ""}
            >
              <option value="">Unassigned</option>
              {technicians.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={routeDay.status}>
              {routeStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanizeStatus(status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea name="notes" defaultValue={routeDay.notes ?? ""} />
        </label>

        <ActionSubmitButton className="button button-dark" pendingLabel="Saving...">
          Save Route
        </ActionSubmitButton>
      </FeedbackForm>

      <div className="danger-zone-card">
        <div>
          <p className="section-kicker">Danger Zone</p>
          <h3>Delete this route day</h3>
          <p>
            This removes the internal route day, route stops, and generated field
            visits. It does <strong>not</strong> delete bookings or customers.
            Scheduled bookings will be released so they can be added to the
            correct route.
          </p>
        </div>

        <FeedbackForm
          action={deleteRouteDayAdminAction}
          className="compact-admin-form"
          confirmMessage="Delete this route day? Bookings/customers will be kept, but the internal route assignment will be removed."
          pendingMessage="Deleting route..."
          successMessage="Route deleted."
        >
          <input type="hidden" name="routeDayId" value={routeDay.id} />

          <label className="field">
            <span>Type DELETE to confirm</span>
            <input
              name="deleteConfirmation"
              placeholder="DELETE"
              autoComplete="off"
            />
          </label>

          <ActionSubmitButton
            className="button button-outline destructive"
            pendingLabel="Deleting..."
          >
            Delete Route Day
          </ActionSubmitButton>
        </FeedbackForm>
      </div>
    </section>
  );
}

function RouteStops({ routeDay }: { routeDay: RouteDayView }) {
  return (
    <section className="route-stop-list route-stop-queue">
      {routeDay.stops.map((stop) => (
        <article className="route-stop-card route-stop-summary-card" key={stop.id}>
          <div className="admin-row-heading">
            <div>
              <div className="status-stack">
                <span className={`status-badge status-${stop.optimorouteStatus}`}>
                  OptimoRoute: {humanizeStatus(stop.optimorouteStatus)}
                </span>

                {stop.optimorouteSequence ? (
                  <span className="status-badge status-imported">
                    Optimized #{stop.optimorouteSequence}
                  </span>
                ) : (
                  <span className="status-badge status-neutral">
                    Manual #{stop.manualOrder}
                  </span>
                )}

                <span
                  className={`status-badge status-${
                    stop.eligible ? "synced" : "warning"
                  }`}
                >
                  {stop.eligible ? "Eligible" : "Needs Review"}
                </span>
              </div>

              <h3>
                #{stop.stopOrder} {stop.customerName}
              </h3>

              <p className="muted">
                {stop.address} · {humanizeStatus(stop.routeStopStatus)}
              </p>

              {stop.optimorouteScheduledAt ? (
                <p>Scheduled {formatAdminDateTime(stop.optimorouteScheduledAt)}</p>
              ) : (
                <p>{stop.eligibilitySummary}</p>
              )}

              {stop.issue ? (
                <p className="optimoroute-message error">{stop.issue}</p>
              ) : null}
            </div>

            <div className="action-row">
              {stop.fieldHref ? (
                <Link className="button button-outline" href={stop.fieldHref}>
                  Field View
                </Link>
              ) : null}

              {stop.checklistHref ? (
                <Link className="button button-outline" href={stop.checklistHref}>
                  Checklist
                </Link>
              ) : null}
            </div>
          </div>

          <details className="technical-details">
            <summary>Edit stop / technical details</summary>

            <div className="admin-record-overview">
              <InfoTile label="OptimoRoute order" value={stop.optimorouteOrderNo} />
              <InfoTile
                label="OptimoRoute status"
                value={humanizeStatus(stop.optimorouteStatus)}
              />
              <InfoTile label="Manual order" value={String(stop.manualOrder)} />
              <InfoTile
                label="Optimized sequence"
                value={stop.optimorouteSequence ? String(stop.optimorouteSequence) : "None"}
              />
            </div>

            <FeedbackForm
              action={updateRouteStopAdminAction}
              className="data-row"
              pendingMessage="Saving stop..."
              successMessage="Stop saved."
            >
              <input type="hidden" name="routeStopId" value={stop.id} />

              <label>
                Order
                <input
                  min="1"
                  name="stopOrder"
                  type="number"
                  defaultValue={stop.stopOrder}
                />
              </label>

              <label>
                Status
                <select name="status" defaultValue={stop.routeStopStatus}>
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
                  defaultValue={stop.technicianNotes ?? ""}
                  placeholder="Tech note"
                />
              </label>

              <ActionSubmitButton className="button button-outline" pendingLabel="Saving...">
                Save Stop
              </ActionSubmitButton>
            </FeedbackForm>

            <FeedbackForm
              action={removeRouteStopAdminAction}
              confirmMessage="Remove this stop from the route?"
              pendingMessage="Removing stop..."
              successMessage="Stop removed from route."
            >
              <input type="hidden" name="routeStopId" value={stop.id} />
              <ActionSubmitButton
                className="link-button destructive"
                pendingLabel="Removing..."
              >
                Remove stop
              </ActionSubmitButton>
            </FeedbackForm>
          </details>
        </article>
      ))}

      {!routeDay.stops.length ? (
        <div className="empty-state-card">
          <h2>No stops on this route yet.</h2>
          <p>Add bookings to this route before syncing to OptimoRoute.</p>
        </div>
      ) : null}
    </section>
  );
}

function StepBadge({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={active ? "route-step-badge is-active" : "route-step-badge"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getRoutePriority(routeDay: RouteDayView) {
  if (routeDay.status === "active") return 10;
  if (routeDay.counts.unscheduled > 0) return 20;
  if (routeDay.counts.needsReview > 0) return 30;
  if (routeDay.counts.stops === 0) return 40;
  if (!routeDay.optimoroutePlanningStatus) return 50;
  if (routeDay.optimoroutePlanningStatus === "finished" && routeDay.counts.imported === 0) {
    return 60;
  }
  if (routeDay.counts.imported > 0) return 70;
  if (routeDay.status === "completed") return 90;
  if (routeDay.status === "cancelled") return 100;
  return 80;
}

function getRouteNextAction(routeDay: RouteDayView) {
  if (routeDay.status === "cancelled") {
    return {
      label: "Cancelled",
      description: "This route is not active.",
      tone: "neutral" as const,
    };
  }

  if (routeDay.status === "completed") {
    return {
      label: "Completed",
      description: "This route has been completed.",
      tone: "good" as const,
    };
  }

  if (routeDay.counts.stops === 0) {
    return {
      label: "Add stops",
      description: "Add customer bookings before routing.",
      tone: "warning" as const,
    };
  }

  if (routeDay.counts.unscheduled > 0) {
    return {
      label: "Review unscheduled stops",
      description: "OptimoRoute left at least one stop unscheduled.",
      tone: "danger" as const,
    };
  }

  if (routeDay.counts.needsReview > 0) {
    return {
      label: "Review stop issues",
      description: "Some stops are missing routing or service requirements.",
      tone: "danger" as const,
    };
  }

  if (!routeDay.optimoroutePlanningStatus) {
    return {
      label: "Sync to OptimoRoute",
      description: "Stops are ready to send for route optimization.",
      tone: "warning" as const,
    };
  }

  if (routeDay.optimoroutePlanningStatus === "finished" && routeDay.counts.imported === 0) {
    return {
      label: "Import optimized route",
      description: "Optimization finished. Bring the result back to Clean Curb Co.",
      tone: "warning" as const,
    };
  }

  if (routeDay.counts.imported > 0) {
    return {
      label: "Ready for field app",
      description: "The route has imported stops and can be used in the field app.",
      tone: "good" as const,
    };
  }

  return {
    label: "Check optimization",
    description: "Check planning status or continue route prep.",
    tone: "warning" as const,
  };
}

function formatAdminDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}