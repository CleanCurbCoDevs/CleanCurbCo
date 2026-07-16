import type { Metadata } from "next";
import Link from "next/link";
import { PaymentSetupButton } from "@/components/payment-setup-button";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";
import { formatFrequency } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Customer Portal",
  description: "Clean Curb Co. customer portal.",
};

type PortalPageProps = {
  searchParams: Promise<{
    bookingLink?: string;
  }>;
};

export default async function PortalPage({
  searchParams,
}: PortalPageProps) {
  const params = await searchParams;
  const context = await getPortalContext("/portal");
  const latestBooking = context.bookings[0];
  const profilePaymentMethodOnFile =
    context.auth.status === "ok" && context.auth.profile.payment_method_on_file;
  const paymentSetupBooking = context.bookings.find(
    (booking) =>
      !profilePaymentMethodOnFile &&
      !booking.payment_method_on_file &&
      booking.payment_setup_status !== "completed",
  );
  const nextVisit = context.visits.find((visit) =>
    ["scheduled", "on_the_way", "arrived", "in_progress"].includes(
      visit.status,
    ),
  );

  return (
    <PortalShell title="Customer portal" auth={context.auth}>
      {params.bookingLink === "success" ? (
        <section
          className="confirmation-panel dashboard-banner"
          role="status"
        >
          <h2>Booking connected successfully.</h2>
          <p>
            This booking is now attached to your personal Clean
            Curb Co. account.
          </p>
        </section>
      ) : params.bookingLink === "failed" ? (
        <section
          className="placeholder-panel dashboard-banner"
          role="alert"
        >
          <h2>The booking could not be connected.</h2>
          <p>
            Your login worked, but the booking access link was
            invalid, expired, or already attached to another
            account. Please contact us so we can reconnect it.
          </p>
        </section>
      ) : null}
      <section className="dashboard-grid">
        {paymentSetupBooking ? (
          <article className="placeholder-panel dashboard-banner">
            <p className="section-kicker">Payment setup</p>
            <h2>Payment information not yet added.</h2>
            <p>
              Add a secure payment method through Stripe so your account is
              ready once your route date is confirmed.
            </p>
            <PaymentSetupButton
              bookingId={paymentSetupBooking.id}
              returnPath="/portal"
            />
          </article>
        ) : null}
        <article className="placeholder-panel">
          <p className="section-kicker">Overview</p>
          <h1>
            Hi{" "}
            {context.auth.status === "ok"
              ? context.auth.profile.first_name ?? "there"
              : "there"}
            .
          </h1>
          <p>
            Your Clean Curb Co. service details will stay organized here as
            route days, payment links, and photos are added.
          </p>
          <p className="muted">
            Already booked? Make sure this account uses the same email address
            from your booking. New here? Book your first cleaning and we will
            help connect the account.
          </p>
          <Link className="button button-dark" href="/book">
            Request Another Cleaning
          </Link>
        </article>
        <article className="card">
          <h3>Latest booking</h3>
          {latestBooking ? (
            <p>
              <strong>{humanizeStatus(latestBooking.status)}</strong>
              <br />
              {formatFrequency(latestBooking.frequency)}
              <br />${latestBooking.estimated_price} estimated visit
            </p>
          ) : (
            <p>No bookings are linked to this account yet.</p>
          )}
        </article>
        <article className="card">
          <h3>Next route update</h3>
          {nextVisit?.route_day ? (
            <p>
              <strong>{nextVisit.route_day}</strong>
              <br />
              {humanizeStatus(nextVisit.status)}
            </p>
          ) : latestBooking?.confirmed_route_day ? (
            <p>
              <strong>{latestBooking.confirmed_route_day}</strong>
              <br />
              Route day confirmed
            </p>
          ) : (
            <p>We will text you when your next route day is confirmed.</p>
          )}
        </article>
        <article className="card">
          <h3>Service address</h3>
          {context.addresses[0] ? (
            <p>
              {context.addresses[0].street_address}
              <br />
              {context.addresses[0].city}, {context.addresses[0].state}{" "}
              {context.addresses[0].zip_code}
            </p>
          ) : latestBooking ? (
            <p>
              {latestBooking.street_address}
              <br />
              {latestBooking.city}, {latestBooking.state}{" "}
              {latestBooking.zip_code}
            </p>
          ) : (
            <p>No address is linked yet.</p>
          )}
        </article>
      </section>
    </PortalShell>
  );
}
