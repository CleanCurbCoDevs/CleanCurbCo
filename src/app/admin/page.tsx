import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Admin",
  description: "Clean Curb Co. admin portal.",
};

export default async function AdminPage() {
  const context = await getAdminContext("/admin");
  const totalEstimatedRevenue = context.bookings.reduce(
    (total, booking) => total + booking.estimated_price,
    0,
  );
  const newBookings = context.bookings.filter(
    (booking) => booking.status === "new",
  ).length;
  const needsFollowUp = context.bookings.filter(
    (booking) => booking.status === "needs_follow_up",
  ).length;

  return (
    <AdminShell title="Admin portal" auth={context.auth}>
      <section className="dashboard-grid">
        <article className="placeholder-panel">
          <p className="section-kicker">Command Center</p>
          <h1>Clean Curb Co. admin.</h1>
          <p>
            Booking requests, route grouping, customer records, payment status,
            and review follow-up all live behind this protected area.
          </p>
          <div className="action-row">
            <Link className="button button-dark" href="/admin/bookings">
              Review Bookings
            </Link>
            <Link className="button button-outline" href="/field">
              Open Field App
            </Link>
          </div>
        </article>
        <StatCard label="New requests" value={newBookings} />
        <StatCard label="Needs follow-up" value={needsFollowUp} />
        <StatCard label="Estimated revenue" value={`$${totalEstimatedRevenue}`} />
        <article className="placeholder-panel">
          <p className="section-kicker">Recent Requests</p>
          <div className="data-table">
            {context.bookings.slice(0, 5).map((booking) => (
              <article className="data-row" key={booking.id}>
                <div>
                  <strong>
                    {booking.first_name} {booking.last_name}
                  </strong>
                  <span>{booking.street_address}</span>
                </div>
                <span>{humanizeStatus(booking.status)}</span>
                <span>{booking.neighborhood ?? "No neighborhood"}</span>
              </article>
            ))}
            {!context.bookings.length ? <p>No booking requests yet.</p> : null}
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
