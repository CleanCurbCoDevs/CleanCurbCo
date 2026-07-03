"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addBookingToRouteAdminAction,
  createRouteDayAdminAction,
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
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const expandedRoute = useMemo(
    () => routeDays.find((routeDay) => routeDay.id === expandedRouteId),
    [expandedRouteId, routeDays],
  );

  return (
    <div className="route-workspace">
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
          <textarea name="notes" placeholder="Tank plan, route reminders, HOA notes..." />
        </label>
        <ActionSubmitButton className="button button-primary" pendingLabel="Creating...">
          Create Route Day
        </ActionSubmitButton>
      </FeedbackForm>

      <div className="route-card-list">
        {routeDays.map((routeDay) => {
          const expanded = routeDay.id === expandedRouteId;
          return (
            <article
              className={expanded ? "route-day-card is-expanded" : "route-day-card"}
              key={routeDay.id}
            >
              <button
                className="route-day-summary"
                type="button"
                onClick={() => setExpandedRouteId(expanded ? null : routeDay.id)}
                aria-expanded={expanded}
              >
                <div>
                  <span className={`status-badge status-${routeDay.status}`}>
                    {humanizeStatus(routeDay.status)}
                  </span>
                  <h2>{routeDay.routeName ?? `${routeDay.serviceArea} route`}</h2>
                  <p>
                    {routeDay.routeDate} | Tech: {routeDay.assignedTechnicianLabel}
                  </p>
                </div>
                <div className="route-summary-metrics" aria-hidden="true">
                  <span>{routeDay.counts.stops} stops</span>
                  <span>{routeDay.counts.imported} imported</span>
                  <span>{routeDay.counts.needsReview} review</span>
                </div>
              </button>

              {expanded ? (
                <RouteDayEditor
                  routeDay={routeDay}
                  routeableBookings={routeableBookings}
                  technicians={technicians}
                />
              ) : null}
            </article>
          );
        })}
        {!routeDays.length ? (
          <p>No route days yet. Create the first route above.</p>
        ) : null}
      </div>

      {routeDays.length && !expandedRoute ? (
        <p className="route-workspace-hint">
          Select one route day to edit stops, add bookings, and run OptimoRoute.
        </p>
      ) : null}
    </div>
  );
}

function RouteDayEditor({
  routeDay,
  routeableBookings,
  technicians,
}: {
  routeDay: RouteDayView;
  routeableBookings: SelectOption[];
  technicians: SelectOption[];
}) {
  return (
    <div className="route-day-editor">
      <FeedbackForm
        action={updateRouteDayAdminAction}
        className="filter-bar"
        pendingMessage="Saving route..."
        successMessage="Route saved."
      >
        <input type="hidden" name="routeDayId" value={routeDay.id} />
        <div className="form-grid">
          <label>
            Route name
            <input name="routeName" defaultValue={routeDay.routeName ?? ""} />
          </label>
          <label>
            Service area
            <input name="serviceArea" defaultValue={routeDay.serviceArea ?? "Cane Bay"} />
          </label>
          <label>
            Technician
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
        <ActionSubmitButton className="button button-outline" pendingLabel="Saving...">
          Save Route
        </ActionSubmitButton>
      </FeedbackForm>

      <section className="optimoroute-panel" aria-label="OptimoRoute routing tools">
        <div className="admin-row-heading">
          <div>
            <p className="section-kicker">OptimoRoute Supplement</p>
            <h2>Optimize this route day.</h2>
            <p className="muted">
              Stops are sent to OptimoRoute as orders. After optimization
              finishes and the schedule is imported, Clean Curb Co remains the
              main route and field view. If checking OptimoRoute directly, use
              the same route date/filter in the OptimoRoute web app.
            </p>
            <a
              className="button button-outline"
              href="https://my.optimoroute.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open OptimoRoute
            </a>
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

        {routeDay.needsReviewItems.length ? (
          <div className="optimoroute-review-list">
            {routeDay.needsReviewItems.map((item) => (
              <div key={item.id}>
                <span className="status-badge status-warning">Needs Review</span>
                <strong>{item.label}</strong>
                <span>{item.summary}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <FeedbackForm
        action={addBookingToRouteAdminAction}
        className="filter-bar"
        pendingMessage="Adding booking..."
        resetOnSuccess
        successMessage="Booking added to route."
      >
        <input type="hidden" name="routeDayId" value={routeDay.id} />
        <div className="form-grid">
          <label>
            Add booking
            <select name="bookingId" required defaultValue="">
              <option value="">Choose booking</option>
              {routeableBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stop order
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

      <div className="route-stop-list">
        {routeDay.stops.map((stop) => (
          <article className="route-stop-card" key={stop.id}>
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
                      stop.eligible ? "eligible" : "warning"
                    }`}
                  >
                    {stop.eligible ? "Eligible" : "Needs Review"}
                  </span>
                </div>
                <strong>
                  #{stop.stopOrder} {stop.customerName}
                </strong>
                <span>
                  {stop.address} | {humanizeStatus(stop.routeStopStatus)}
                </span>
                <span>OptimoRoute order: {stop.optimorouteOrderNo}</span>
                {stop.optimorouteScheduledAt ? (
                  <span>Scheduled {formatAdminDateTime(stop.optimorouteScheduledAt)}</span>
                ) : (
                  <span>{stop.eligibilitySummary}</span>
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
          </article>
        ))}
        {!routeDay.stops.length ? (
          <p className="muted">No stops on this route yet.</p>
        ) : null}
      </div>
    </div>
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
