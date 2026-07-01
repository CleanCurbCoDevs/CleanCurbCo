import Link from "next/link";
import type { Metadata } from "next";
import { FieldShell } from "@/components/shells/field-shell";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { businessToday, getFieldContext } from "@/lib/field-data";

export const metadata: Metadata = {
  title: "Field History",
};

export default async function FieldHistoryPage() {
  const context = await getFieldContext("/field/history");
  const today = businessToday();
  const completedStops = context.routeStops
    .filter((stop) => ["completed", "skipped", "needs_follow_up"].includes(stop.status))
    .sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));
  const completedToday = completedStops.filter((stop) => {
    const routeDay = context.routeDays.find((route) => route.id === stop.route_day_id);
    return routeDay?.route_date === today;
  });
  const needsFollowUp = context.routeStops.filter((stop) => stop.status === "needs_follow_up");
  const recentPaymentLinks = context.payments
    .filter((payment) => payment.checkout_url)
    .slice(0, 8);

  return (
    <FieldShell title="History" auth={context.auth}>
      <section className="field-dashboard-hero compact">
        <div>
          <p className="section-kicker">Service Record</p>
          <h2>Recent stops, issues, payments, and breaks.</h2>
          <p>
            Review completed work, follow-up items, payment links, and route
            pauses from the field.
          </p>
        </div>
      </section>

      <section className="field-stat-grid">
        <Metric label="Recent Stops" value={completedStops.length} />
        <Metric label="Completed Today" value={completedToday.length} tone="success" />
        <Metric label="Needs Follow-Up" value={needsFollowUp.length} tone="danger" />
        <Metric label="Payment Links" value={recentPaymentLinks.length} tone="warning" />
        <Metric label="Recent Breaks" value={context.breaks.length} />
      </section>

      <HistorySection title="Recent Stops" empty="No completed field stops yet.">
        {completedStops.slice(0, 10).map((stop) => {
          const visit = context.visits.find((item) => item.id === stop.service_visit_id);
          const booking = context.bookings.find((item) => item.id === stop.booking_id);
          const photoCount = context.photos.filter((photo) => photo.route_stop_id === stop.id).length;

          return (
            <article className="field-card compact-field-card" key={stop.id}>
              <div className="field-card-top">
                <span className={`status-badge status-${stop.status}`}>
                  {humanizeStatus(stop.status)}
                </span>
                <span>{stop.completed_at ? new Date(stop.completed_at).toLocaleString() : "No end time"}</span>
              </div>
              <h2>
                #{stop.stop_order} {booking ? `${booking.first_name} ${booking.last_name}` : "Stop"}
              </h2>
              {booking ? <p>{formatBookingAddress(booking)}</p> : null}
              <p>{photoCount} photo(s) saved</p>
              {visit ? (
                <Link className="button button-outline" href={`/field/stops/${visit.id}`}>
                  Open Stop
                </Link>
              ) : null}
            </article>
          );
        })}
      </HistorySection>

      <HistorySection title="Needs Follow-Up" empty="No follow-up stops right now.">
        {needsFollowUp.map((stop) => {
          const visit = context.visits.find((item) => item.id === stop.service_visit_id);
          const booking = context.bookings.find((item) => item.id === stop.booking_id);
          return (
            <article className="field-card compact-field-card" key={stop.id}>
              <span className="status-badge status-needs_follow_up">Needs Follow-Up</span>
              <h2>{booking ? `${booking.first_name} ${booking.last_name}` : "Stop"}</h2>
              <p>{booking ? formatBookingAddress(booking) : "No address linked"}</p>
              <p>{stop.technician_notes ?? "No technician notes added."}</p>
              {visit ? (
                <Link className="button button-dark" href={`/field/stops/${visit.id}`}>
                  Review Issue
                </Link>
              ) : null}
            </article>
          );
        })}
      </HistorySection>

      <HistorySection title="Recent Payment Links" empty="No payment links created yet.">
        {recentPaymentLinks.map((payment) => {
          const booking = context.bookings.find((item) => item.id === payment.booking_id);
          return (
            <article className="field-card compact-field-card" key={payment.id}>
              <span className={`status-badge status-${payment.status}`}>
                {humanizeStatus(payment.status)}
              </span>
              <h2>${payment.amount}</h2>
              <p>{booking?.street_address ?? payment.description ?? "Payment link"}</p>
              {payment.checkout_url ? (
                <a className="button button-outline" href={payment.checkout_url}>
                  Open Link
                </a>
              ) : null}
            </article>
          );
        })}
      </HistorySection>

      <HistorySection title="Recent Breaks" empty="No route breaks logged yet.">
        {context.breaks.slice(0, 8).map((routeBreak) => (
          <article className="field-card compact-field-card" key={routeBreak.id}>
            <span className={`status-badge status-${routeBreak.ended_at ? "completed" : "in_progress"}`}>
              {routeBreak.ended_at ? "Ended" : "Active"}
            </span>
            <h2>{humanizeStatus(routeBreak.reason)}</h2>
            <p>{new Date(routeBreak.started_at).toLocaleString()}</p>
          </article>
        ))}
      </HistorySection>
    </FieldShell>
  );
}

function Metric({
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

function HistorySection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="field-section">
      <div className="field-section-heading">
        <div>
          <p className="section-kicker">{title}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {hasChildren ? (
        <div className="field-route-grid">{children}</div>
      ) : (
        <section className="field-empty-state slim">
          <h2>{empty}</h2>
          <p>Route activity will appear here as service days are worked.</p>
        </section>
      )}
    </section>
  );
}
