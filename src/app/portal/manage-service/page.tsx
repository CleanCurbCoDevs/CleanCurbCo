import type { Metadata } from "next";
import Link from "next/link";
import { createCustomerRequestAction } from "@/app/portal/actions";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus, validFrequencies } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";
import { formatFrequency } from "@/lib/pricing";
import { addOns } from "@/lib/site";
import type { RequestType } from "@/types/database";

export const metadata: Metadata = {
  title: "Manage Service",
};

const requestCards: Array<{
  title: string;
  type: RequestType;
  helper: string;
}> = [
  {
    title: "Pause Service",
    type: "pause_service",
    helper: "Heading out of town or need a temporary break? Send the dates.",
  },
  {
    title: "Cancel Service",
    type: "cancel_service",
    helper: "No instant cancellation trapdoor here. We will review and confirm.",
  },
  {
    title: "Change Frequency",
    type: "change_frequency",
    helper: "Move between monthly, every other month, or quarterly service.",
  },
  {
    title: "Request Add-On",
    type: "request_add_on",
    helper: "Trash pad, deodorizer, heavy grime, spot clean, or pet waste help.",
  },
  {
    title: "Ask Billing Question",
    type: "billing_question",
    helper: "Payment links, balances, credits, and route-day billing questions.",
  },
  {
    title: "General Account Help",
    type: "general_help",
    helper: "Anything else that needs a human eyeball.",
  },
];

export default async function PortalManageServicePage() {
  const context = await getPortalContext("/portal/manage-service");
  const recurringBooking =
    context.bookings.find((booking) => booking.frequency !== "one_time") ??
    context.bookings[0];

  return (
    <PortalShell title="Manage service" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Manage Service</p>
        <h1>Need a change? Send a request.</h1>
        <p className="muted">
          We will review pauses, cancellations, frequency changes, add-ons, and
          billing questions before changing your route record.
        </p>

        {recurringBooking ? (
          <div className="card">
            <h3>Current linked service</h3>
            <p>
              {formatFrequency(recurringBooking.frequency)} |{" "}
              {recurringBooking.bin_count}{" "}
              {recurringBooking.bin_count === 1 ? "bin" : "bins"} |{" "}
              {recurringBooking.street_address}
            </p>
          </div>
        ) : (
          <div className="card">
            <h3>No linked booking yet</h3>
            <p>
              Once your booking is linked, service-change requests can attach
              directly to it.
            </p>
            <Link className="button button-dark" href="/book">
              Book a Cleaning
            </Link>
          </div>
        )}

        <div className="grid grid-2">
          {requestCards.map((card) => (
            <form action={createCustomerRequestAction} className="form-section" key={card.type}>
              <input type="hidden" name="requestType" value={card.type} />
              <input
                type="hidden"
                name="bookingId"
                value={recurringBooking?.id ?? ""}
              />
              <h2>{card.title}</h2>
              <p className="muted">{card.helper}</p>
              {card.type === "pause_service" ? (
                <div className="form-grid">
                  <label className="field">
                    <span>Pause start</span>
                    <input type="date" name="pauseStart" />
                  </label>
                  <label className="field">
                    <span>Pause end</span>
                    <input type="date" name="pauseEnd" />
                  </label>
                </div>
              ) : null}
              {card.type === "change_frequency" ? (
                <label className="field">
                  <span>Requested frequency</span>
                  <select name="requestedFrequency" defaultValue="every_other_month">
                    {validFrequencies
                      .filter((frequency) => frequency !== "one_time")
                      .map((frequency) => (
                        <option value={frequency} key={frequency}>
                          {formatFrequency(frequency)}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {card.type === "request_add_on" ? (
                <div className="mini-list">
                  {addOns.map((addOn) => (
                    <span key={addOn.id}>{addOn.name}</span>
                  ))}
                </div>
              ) : null}
              <label className="field">
                <span>Message</span>
                <textarea
                  name="message"
                  placeholder="Tell us what you need and any timing details."
                  required={card.type !== "pause_service"}
                />
              </label>
              <button className="button button-dark" type="submit">
                Submit Request
              </button>
            </form>
          ))}
        </div>

        <section className="detail-panel">
          <h2>Your request status</h2>
          {context.requests.length ? (
            <div className="data-table">
              {context.requests.map((request) => (
                <article className="data-row" key={request.id}>
                  <div>
                    <strong>{humanizeStatus(request.request_type)}</strong>
                    <span>{request.message ?? "No message"}</span>
                  </div>
                  <span className={`status-badge status-${request.status}`}>
                    {humanizeStatus(request.status)}
                  </span>
                  <span>{formatDate(request.created_at)}</span>
                  <span>{request.admin_notes ?? "Review pending"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No service-change requests yet.</p>
          )}
        </section>
      </section>
    </PortalShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
