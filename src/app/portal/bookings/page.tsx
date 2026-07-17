import type { Metadata } from "next";
import Link from "next/link";
import { respondToRouteDateOfferAction } from "@/app/portal/actions";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";
import { formatFrequency } from "@/lib/pricing";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ServiceChecklistDocumentRow } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal Bookings",
};

export default async function PortalBookingsPage() {
  const context = await getPortalContext("/portal/bookings");
  const signedDocuments = await createSignedDocuments(context.checklistDocuments);

  return (
    <PortalShell title="Portal bookings" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Bookings</p>
        <h1>Your booking requests.</h1>
        {context.bookings.length ? (
          <div className="data-table">
            {context.bookings.map((booking) => {
              const visit = context.visits.find((item) => item.booking_id === booking.id);
              const checklist = context.checklists.find(
                (item) => item.service_visit_id === visit?.id,
              );
              const documents = signedDocuments.filter(
                (document) => document.service_visit_id === visit?.id,
              );
              return (
                <article className="data-row" key={booking.id}>
                  <div>
                    <strong>{formatFrequency(booking.frequency)}</strong>
                    <span>
                      {booking.bin_count}{" "}
                      {booking.bin_count === 1 ? "bin" : "bins"} at{" "}
                      {booking.street_address}
                    </span>
                    {visit ? (
                      <small>
                        Service: {humanizeStatus(visit.status)}
                        {visit.completed_at
                          ? ` | Completed ${new Date(visit.completed_at).toLocaleDateString()}`
                          : ""}
                      </small>
                    ) : null}
                    {checklist?.service_completed ? (
                      <small>
                        Checklist complete. Photos are available in the Photos tab.
                      </small>
                    ) : null}
                    {documents.map((document) =>
                      document.signedUrl ? (
                        <a
                          href={document.signedUrl}
                          key={document.id}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download service checklist PDF
                        </a>
                      ) : null,
                    )}
                    {booking.route_offer_status === "offered" &&
                    booking.proposed_route_day ? (
                      <div className="route-offer-panel">
                        <strong>
                          Route date offered: {booking.proposed_route_day}
                        </strong>
                        {booking.route_offer_message ? (
                          <span>{booking.route_offer_message}</span>
                        ) : (
                          <span>Please confirm or decline this proposed route day.</span>
                        )}
                        <form
                          action={respondToRouteDateOfferAction}
                          className="action-row"
                        >
                          <input
                            type="hidden"
                            name="bookingId"
                            value={booking.id}
                          />
                          <button
                            className="button button-dark"
                            name="response"
                            type="submit"
                            value="confirm"
                          >
                            Confirm Date
                          </button>
                          <button
                            className="button button-outline"
                            name="response"
                            type="submit"
                            value="decline"
                          >
                            Decline Date
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <span>{bookingStatusLabel(booking)}</span>
                  <span>${booking.estimated_price}</span>
                  <span>
                    {booking.confirmed_route_day ??
                      booking.requested_date ??
                      "Route day pending"}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <>
            <p>No bookings are linked to this account yet.</p>
            <Link className="button button-dark" href="/book">
              Book a Cleaning
            </Link>
          </>
        )}
      </section>
    </PortalShell>
  );
}

async function createSignedDocuments(documents: ServiceChecklistDocumentRow[]) {
  const admin = getSupabaseAdmin();
  return Promise.all(
    documents.map(async (document) => {
      const { data } = await admin.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60 * 60);
      return { ...document, signedUrl: data?.signedUrl ?? null };
    }),
  );
}

function bookingStatusLabel(booking: { status: string; route_offer_status?: string }) {
  if (booking.route_offer_status === "offered") return "Awaiting your confirmation";
  if (booking.route_offer_status === "customer_confirmed") return "Route date confirmed";
  if (booking.route_offer_status === "customer_declined") {
    return "Declined - our team will contact you";
  }
  const { status } = booking;
  if (status === "new") return "Reserved / pending route confirmation";
  if (status === "confirmed") return "Confirmed";
  if (status === "scheduled") return "Scheduled";
  return humanizeStatus(status);
}
