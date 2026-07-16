import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Recycle,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { updateStopStatusAction } from "@/app/field/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import type {
  BookingRow,
  PaymentRow,
  RouteStopRow,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

type FieldMissionCardProps = {
  booking: BookingRow;
  visit: ServiceVisitRow;
  stop: RouteStopRow;
  address?: ServiceAddressRow | null;
  payment?: PaymentRow | null;
  position: number;
  totalStops: number;
};

export function FieldMissionCard({
  booking,
  visit,
  stop,
  address,
  payment,
  position,
  totalStops,
}: FieldMissionCardProps) {
  const addressText = formatBookingAddress(booking);
  const encodedAddress = encodeURIComponent(addressText);

  const googleMaps =
    `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  const clearance = getServiceClearanceStatus(booking, payment);

  const paymentStatus =
    booking.payment_status === "paid" || payment?.status === "paid"
      ? "paid"
      : payment?.status ?? booking.payment_status;

  const primaryAction = getPrimaryAction(
    stop.status,
    visit.id,
    clearance.cleared,
  );

  const customerName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
    "Customer";

  const binTypes = booking.bin_types ?? [];
  const hasRecycling = binTypes.some((type) =>
    type.toLowerCase().includes("recycl"),
  );

  return (
    <article className="mission-card">
      <div className="mission-card-progress">
        <span>
          Stop {position} of {totalStops}
        </span>

        <span className={`status-badge status-${stop.status}`}>
          {humanizeStatus(stop.status)}
        </span>
      </div>

      <div className="mission-customer">
        <div>
          <p className="section-kicker">Up Next</p>
          <h2>{customerName}</h2>
          <p className="mission-address">
            <MapPin size={18} aria-hidden="true" />
            <span>{addressText}</span>
          </p>
        </div>

        <div className="mission-stop-number" aria-label={`Stop ${position}`}>
          {position}
        </div>
      </div>

      <div className="mission-service-grid">
        <div>
          <Trash2 size={21} aria-hidden="true" />
          <span>Bins</span>
          <strong>{booking.bin_count}</strong>
        </div>

        <div>
          {hasRecycling ? (
            <Recycle size={21} aria-hidden="true" />
          ) : (
            <Trash2 size={21} aria-hidden="true" />
          )}
          <span>Types</span>
          <strong>{binTypes.join(", ") || "Not listed"}</strong>
        </div>

        <div>
          <Clock3 size={21} aria-hidden="true" />
          <span>Arrival</span>
          <strong>
            {formatArrivalWindow(
              visit.arrival_window_start,
              visit.arrival_window_end,
            )}
          </strong>
        </div>
      </div>

      {booking.customer_notes ||
      address?.notes ||
      address?.gate_code ||
      booking.water_spigot_available ? (
        <div className="mission-alert">
          <TriangleAlert size={22} aria-hidden="true" />

          <div>
            <strong>Before you roll in</strong>

            {address?.gate_code ? <p>Gate: {address.gate_code}</p> : null}

            {booking.water_spigot_available ? (
              <p>Water: {booking.water_spigot_available}</p>
            ) : null}

            {booking.customer_notes || address?.notes ? (
              <p>{booking.customer_notes ?? address?.notes}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`mission-clearance clearance-${clearance.tone}`}
      >
        <CheckCircle2 size={21} aria-hidden="true" />

        <div>
          <strong>{clearance.label}</strong>
          <span>
            Payment: {humanizeStatus(paymentStatus)}
          </span>
        </div>
      </div>

      <div className="mission-contact-actions">
        <a
          className="mission-secondary-action"
          href={googleMaps}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation size={21} aria-hidden="true" />
          Navigate
        </a>

        {booking.phone ? (
          <a
            className="mission-secondary-action"
            href={`tel:${booking.phone}`}
          >
            <Phone size={21} aria-hidden="true" />
            Call
          </a>
        ) : null}
      </div>

      {stop.status === "scheduled" && clearance.cleared ? (
        <FeedbackForm
          action={updateStopStatusAction}
          pendingMessage="Marking on the way..."
          successMessage="Stop marked on the way."
        >
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="status" value="on_the_way" />

          <ActionSubmitButton
            className="mission-primary-action"
            pendingLabel="Updating..."
          >
            <span>Mark On The Way</span>
            <ArrowRight size={24} aria-hidden="true" />
          </ActionSubmitButton>
        </FeedbackForm>
      ) : (
        <Link
          className="mission-primary-action"
          href={primaryAction.href}
        >
          <span>{primaryAction.label}</span>
          <ArrowRight size={24} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function getPrimaryAction(
  status: RouteStopRow["status"],
  visitId: string,
  cleared: boolean,
) {
  const href = `/field/stops/${visitId}`;

  if (!cleared) {
    return {
      href,
      label: "Review Payment",
    };
  }

  if (status === "on_the_way") {
    return {
      href,
      label: "I’ve Arrived",
    };
  }

  if (status === "in_progress") {
    return {
      href,
      label: "Continue Service",
    };
  }

  if (status === "completed") {
    return {
      href,
      label: "View Completed Stop",
    };
  }

  if (status === "needs_follow_up") {
    return {
      href,
      label: "Review Issue",
    };
  }

  return {
    href,
    label: "Open Stop",
  };
}

function formatArrivalWindow(
  start?: string | null,
  end?: string | null,
) {
  if (!start && !end) return "Flexible";

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (start && end) {
    return `${formatter.format(new Date(start))}–${formatter.format(
      new Date(end),
    )}`;
  }

  return formatter.format(new Date(start ?? end!));
}