import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/shells/admin-shell";
import { getAdminContext } from "@/lib/admin-data";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";

export const metadata: Metadata = {
  title: "Admin Checklists",
};

export default async function AdminChecklistsPage() {
  const context = await getAdminContext("/admin/checklists");

  return (
    <AdminShell title="Service checklists" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Checklists</p>
            <h1>Service proof-of-work archive.</h1>
            <p className="muted">
              Open each appointment checklist, save drafts during service, and
              review submitted PDF records.
            </p>
          </div>
          <span className="status-badge">{context.visits.length} visits</span>
        </div>

        {context.visits.length ? (
          <div className="admin-card-list">
            {context.visits.map((visit) => {
              const booking = context.bookings.find(
                (item) => item.id === visit.booking_id,
              );
              const checklist = context.checklists.find(
                (item) => item.service_visit_id === visit.id,
              );
              const documents = context.checklistDocuments.filter(
                (item) => item.service_visit_id === visit.id,
              );

              return (
                <article className="admin-edit-card" key={visit.id}>
                  <div className="admin-row-heading">
                    <div>
                      <h2>
                        {booking
                          ? `${booking.first_name} ${booking.last_name}`
                          : "Unlinked visit"}
                      </h2>
                      <p className="muted">
                        {booking ? formatBookingAddress(booking) : "No booking linked"}
                        <br />
                        Service date:{" "}
                        {visit.route_day ?? booking?.confirmed_route_day ?? "Not scheduled"}
                      </p>
                    </div>
                    <div className="status-stack">
                      <span className={`status-badge status-${visit.status}`}>
                        {humanizeStatus(visit.status)}
                      </span>
                      <span className={`status-badge status-${checklist?.status ?? "draft"}`}>
                        {checklist ? humanizeStatus(checklist.status) : "Not Started"}
                      </span>
                    </div>
                  </div>
                  <div className="admin-data-grid">
                    <div>
                      <span>Checklist PDF</span>
                      <strong>{documents.length ? "Generated" : "Not generated"}</strong>
                    </div>
                    <div>
                      <span>Services</span>
                      <strong>
                        {checklist?.services_performed?.join(", ") ??
                          booking?.add_ons.join(", ") ??
                          "Pending"}
                      </strong>
                    </div>
                  </div>
                  <div className="action-row">
                    <Link
                      className="button button-dark"
                      href={`/admin/checklists/${visit.id}`}
                    >
                      Open Checklist
                    </Link>
                    {booking?.customer_id ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/customers/${booking.customer_id}`}
                      >
                        Customer
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>
            No service visits yet. Add bookings to a route first, then each visit
            will get its own checklist.
          </p>
        )}
      </section>
    </AdminShell>
  );
}
