import Link from "next/link";
import { updateStopStatusAction } from "@/app/field/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import { formatFrequency } from "@/lib/pricing";
import type {
  BookingRow,
  PaymentRow,
  RouteDayRow,
  RouteStopRow,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

type FieldStopCardProps = {
  stop: RouteStopRow;
  visit?: ServiceVisitRow | null;
  booking?: BookingRow | null;
  address?: ServiceAddressRow | null;
  routeDay?: RouteDayRow | null;
  payment?: PaymentRow | null;
};

export function FieldStopCard({
  stop,
  visit,
  booking,
  address,
  routeDay,
  payment,
}: FieldStopCardProps) {
  if (!booking || !visit) {
    return (
      <article className="field-card">
        <span className="status-badge status-needs_follow_up">Needs Setup</span>
        <h2>Stop #{stop.stop_order}</h2>
        <p>This route stop is missing a linked booking or service visit.</p>
      </article>
    );
  }

  const addressText = formatBookingAddress(booking);
  const encodedAddress = encodeURIComponent(addressText);
  const appleMaps = `https://maps.apple.com/?q=${encodedAddress}`;
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const addOns = booking.add_ons.length ? booking.add_ons.join(", ") : "None";
  const paymentStatus = payment?.status ?? booking.payment_status;
  const clearance = getServiceClearanceStatus(booking, payment);
  const actionLabel = getStopActionLabel(stop.status, clearance.cleared);
  const displayStopNumber = stop.optimoroute_stop_sequence ?? stop.stop_order ?? 1;
  const isOptimized = Boolean(stop.optimoroute_stop_sequence);
  const scheduledTime = stop.optimoroute_scheduled_at
    ? formatFieldTime(stop.optimoroute_scheduled_at)
    : null;
  const eta = stop.optimoroute_eta ? formatFieldTime(stop.optimoroute_eta) : null;

  return (
    <article className="field-card">
      <div className="field-card-top">
        <span className="field-stop-number">#{displayStopNumber}</span>
        <div className="status-stack">
          <span className={`status-badge status-${stop.status}`}>
            {humanizeStatus(stop.status)}
          </span>
          <span className={`status-badge status-${paymentStatus}`}>
            {humanizeStatus(paymentStatus)}
          </span>
          {isOptimized ? (
            <span className="status-badge status-imported">Optimized by OptimoRoute</span>
          ) : (
            <span className="status-badge status-neutral">Clean Curb Order</span>
          )}
        </div>
      </div>
      <h2>
        {booking.first_name} {booking.last_name}
      </h2>
      <p className="field-address">{addressText}</p>
      <div className="field-meta-grid">
        <span>{booking.neighborhood ?? "No neighborhood"}</span>
        <span>{booking.bin_count} bin(s)</span>
        <span>{booking.bin_types.join(", ") || "Bin type pending"}</span>
        <span>{formatFrequency(booking.frequency)}</span>
        <span>Add-ons: {addOns}</span>
        <span>Water: {booking.water_spigot_available ?? "not sure"}</span>
        <span>Gate: {address?.gate_code ?? "none"}</span>
        <span>Route: {routeDay?.route_name ?? routeDay?.route_date ?? "not assigned"}</span>
        <span>
          Schedule:{" "}
          {scheduledTime
            ? `${scheduledTime}${eta && eta !== scheduledTime ? ` ETA ${eta}` : ""}`
            : "not imported"}
        </span>
        <span>
          Travel:{" "}
          {stop.optimoroute_travel_time_seconds
            ? formatDuration(stop.optimoroute_travel_time_seconds)
            : "not imported"}
          {stop.optimoroute_distance_meters
            ? ` / ${formatDistance(stop.optimoroute_distance_meters)}`
            : ""}
        </span>
        <span>Driver: {stop.optimoroute_driver_name ?? "not assigned"}</span>
      </div>
      {stop.issue_flags.length ? (
        <div className="status-stack">
          {stop.issue_flags.slice(0, 3).map((flag) => (
            <span className="status-badge status-needs_follow_up" key={flag}>
              {humanizeStatus(flag)}
            </span>
          ))}
        </div>
      ) : null}
      {booking.customer_notes || address?.notes || stop.technician_notes ? (
        <p className="field-note">
          {booking.customer_notes ?? address?.notes ?? stop.technician_notes}
        </p>
      ) : null}
      <div className={`field-payment-clearance clearance-${clearance.tone}`}>
        <div>
          <p className="section-kicker">Service Clearance</p>
          <h3>{clearance.label}</h3>
          <p>{clearance.detail}</p>
        </div>
        <p>
          <strong>Field action:</strong> {clearance.action}
        </p>
      </div>
      <div className="field-actions">
        <a className="button button-outline" href={appleMaps} target="_blank" rel="noreferrer">
          Apple Maps
        </a>
        <a className="button button-outline" href={googleMaps} target="_blank" rel="noreferrer">
          Google Maps
        </a>
        {stop.status === "scheduled" && clearance.cleared ? (
          <FeedbackForm
            action={updateStopStatusAction}
            pendingMessage="Marking On The Way..."
            successMessage="Marked On The Way."
          >
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="status" value="on_the_way" />
            <ActionSubmitButton
              className="button button-primary"
              pendingLabel="Marking..."
            >
              Mark On The Way
            </ActionSubmitButton>
          </FeedbackForm>
        ) : stop.status === "completed" || stop.status === "needs_follow_up" ? (
          <Link className="button button-primary" href={`/field/stops/${visit.id}`}>
            {actionLabel}
          </Link>
        ) : (
          <Link className="button button-primary" href={`/field/stops/${visit.id}`}>
            {actionLabel}
          </Link>
        )}
        <Link className="button button-dark" href={`/field/stops/${visit.id}`}>
          View Details
        </Link>
      </div>
    </article>
  );
}

function formatFieldTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${meters} m`;
  return `${miles.toFixed(1)} mi`;
}

function getStopActionLabel(status: RouteStopRow["status"], cleared: boolean) {
  if (status === "scheduled") return cleared ? "Mark On The Way" : "Review Payment";
  if (status === "on_the_way") return "Continue";
  if (status === "in_progress") return "Continue Service";
  if (status === "completed") return "View Completed Stop";
  if (status === "needs_follow_up") return "Review Issue";
  return "Open Stop";
}
