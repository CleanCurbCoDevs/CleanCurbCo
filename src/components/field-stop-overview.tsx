import {
  ArrowLeft,
  Banknote,
  Droplets,
  ExternalLink,
  KeyRound,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import type {
  BookingRow,
  PaymentRow,
  RouteDayRow,
  RouteStopRow,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

type ServiceClearance = ReturnType<
  typeof getServiceClearanceStatus
>;

type FieldStopOverviewProps = {
  booking: BookingRow;
  visit: ServiceVisitRow;
  stop: RouteStopRow;
  address?: ServiceAddressRow | null;
  payment?: PaymentRow | null;
  routeDay?: RouteDayRow | null;
  clearance: ServiceClearance;
};

export function FieldStopOverview({
  booking,
  visit,
  stop,
  address,
  payment,
  routeDay,
  clearance,
}: FieldStopOverviewProps) {
  const customerName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
    "Customer";

  const addressText = formatBookingAddress(booking);
  const encodedAddress = encodeURIComponent(addressText);

  const googleMaps =
    `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  const phone = booking.phone?.trim() ?? "";

  const paymentStatus =
    booking.payment_status === "paid" || payment?.status === "paid"
      ? "paid"
      : payment?.status ?? booking.payment_status;

  const stopNumber =
    stop.optimoroute_stop_sequence ?? stop.stop_order ?? 1;

  const notes =
    booking.customer_notes ??
    address?.notes ??
    stop.technician_notes ??
    null;

  return (
    <section className="stop-overview">
      <div className="stop-overview-topbar">
        <Link className="stop-back-link" href="/field/today">
          <ArrowLeft size={19} aria-hidden="true" />
          Today
        </Link>

        <div className="stop-overview-badges">
          <span className={`status-badge status-${stop.status}`}>
            {humanizeStatus(stop.status)}
          </span>

          <span className={`status-badge status-${paymentStatus}`}>
            {humanizeStatus(paymentStatus)}
          </span>
        </div>
      </div>

      <div className="stop-overview-customer">
        <div>
          <p className="section-kicker">
            Stop {stopNumber}
          </p>

          <h2>{customerName}</h2>

          <p className="stop-overview-address">
            <MapPin size={19} aria-hidden="true" />
            <span>{addressText}</span>
          </p>
        </div>

        <div className="stop-overview-number">
          {stopNumber}
        </div>
      </div>

      <div className="stop-primary-actions">
        <a
          className="stop-primary-button"
          href={googleMaps}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation size={22} aria-hidden="true" />
          Navigate
        </a>

        {phone ? (
          <a
            className="stop-secondary-button"
            href={`tel:${phone}`}
          >
            <Phone size={20} aria-hidden="true" />
            Call
          </a>
        ) : null}

        {phone ? (
          <a
            className="stop-secondary-button"
            href={`sms:${phone}`}
          >
            <MessageSquareText size={20} aria-hidden="true" />
            Text
          </a>
        ) : null}
      </div>

      <div className="stop-essential-grid">
        <div>
          <Trash2 size={21} aria-hidden="true" />
          <span>Service</span>
          <strong>
            {booking.bin_count} bin
            {booking.bin_count === 1 ? "" : "s"}
          </strong>
          <small>
            {booking.bin_types.join(", ") || "Types not listed"}
          </small>
        </div>

        <div>
          <KeyRound size={21} aria-hidden="true" />
          <span>Access</span>
          <strong>{address?.gate_code || "No gate code"}</strong>
          <small>
            {booking.neighborhood || "Neighborhood not listed"}
          </small>
        </div>

        <div>
          <Droplets size={21} aria-hidden="true" />
          <span>Water</span>
          <strong>
            {humanizeStatus(
              booking.water_spigot_available ?? "not_sure",
            )}
          </strong>
          <small>
            {routeDay?.route_name ??
              routeDay?.route_date ??
              visit.route_day ??
              "Route not listed"}
          </small>
        </div>
      </div>

      {notes ? (
        <div className="stop-important-note">
          <TriangleAlert size={23} aria-hidden="true" />

          <div>
            <strong>Read before service</strong>
            <p>{notes}</p>
          </div>
        </div>
      ) : null}

      <div
        className={`stop-clearance-card clearance-${clearance.tone}`}
      >
        <Banknote size={23} aria-hidden="true" />

        <div>
          <strong>{clearance.label}</strong>
          <p>{clearance.detail}</p>
          <small>{clearance.action}</small>
        </div>

        {payment?.checkout_url || booking.payment_link ? (
          <a
            href={payment?.checkout_url ?? booking.payment_link ?? ""}
            target="_blank"
            rel="noreferrer"
            aria-label="Open payment link"
          >
            <ExternalLink size={20} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </section>
  );
}