import type { Metadata } from "next";
import { PaymentSetupButton } from "@/components/payment-setup-button";
import { PaymentLinkButton } from "@/components/payment-link-button";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";
import { getFoundingNeighborSpecialStatus } from "@/lib/pricing";
import {
  getStripePaymentMethodState,
  type SavedCardSummary,
} from "@/lib/server/stripe-payment-method";

export const metadata: Metadata = {
  title: "Portal Billing",
};

export default async function PortalBillingPage() {
  const context = await getPortalContext("/portal/billing");
  const stripeCustomerId =
    context.auth.status === "ok"
      ? context.auth.profile.stripe_customer_id ??
        context.bookings.find(
          (booking) =>
            Boolean(booking.stripe_customer_id),
        )?.stripe_customer_id ??
        null
      : null;
  
  const recurringBooking = context.bookings.find(
    (booking) =>
      booking.frequency !== "one_time" &&
      Boolean(booking.stripe_subscription_id),
  );
  
  const paymentMethodState =
    await getStripePaymentMethodState({
      stripeCustomerId,
      stripeSubscriptionId:
        recurringBooking?.stripe_subscription_id ??
        null,
    });
  
  const paymentSetupBookingId =
    context.bookings.find(
      (booking) =>
        Boolean(stripeCustomerId) &&
        booking.stripe_customer_id ===
          stripeCustomerId,
    )?.id ??
    context.bookings[0]?.id ??
    null;
  
  const records = context.payments.length
    ? context.payments.map((payment) => {
        const booking = context.bookings.find((item) => item.id === payment.booking_id);
        return { payment, booking };
      })
    : context.bookings.map((booking) => ({ payment: null, booking }));

  return (
    <PortalShell title="Billing and payments" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Billing</p>
        <h1>Payment history and links.</h1>
        
    {paymentMethodState.status === "saved" ? (
      <div className="confirmation-panel">
        <strong>Payment method on file.</strong>
    
        <p>
          {formatCardDescription(
            paymentMethodState.card,
          )}
        </p>
    
        <p className="muted">
          Stripe securely stores your payment
          information. Clean Curb Co. cannot view
          your full card number or security code.
        </p>
    
        <PaymentSetupButton
          bookingId={paymentSetupBookingId}
          returnPath="/portal/billing"
          label="Update Payment Method"
          className="button button-outline"
        />
      </div>
    ) : paymentMethodState.status === "missing" ? (
      <div className="confirmation-panel">
        <strong>No payment method saved.</strong>
    
        <p>
          Add a secure payment method through
          Stripe so future recurring payments are
          ready before your next service.
        </p>
    
        <PaymentSetupButton
          bookingId={paymentSetupBookingId}
          returnPath="/portal/billing"
          label="Add Payment Method"
        />
      </div>
    ) : (
      <div className="confirmation-panel">
        <strong>
          Payment method status is temporarily
          unavailable.
        </strong>
    
        <p>
          Stripe could not confirm your saved
          payment method right now. Please refresh
          the page or try again shortly.
        </p>
    
        <PaymentSetupButton
          bookingId={paymentSetupBookingId}
          returnPath="/portal/billing"
          label="Manage Payment Method"
          className="button button-outline"
        />
      </div>
    )}
        {records.length ? (
          <div className="data-table">
            {records.map(({ payment, booking }) => {
              const amount = payment?.amount ?? booking?.estimated_price ?? 0;
              const status = payment?.status ?? booking?.payment_status ?? "pending";
              const link = payment?.checkout_url ?? booking?.payment_link ?? "";
              const foundingSpecial = booking
                ? getFoundingNeighborSpecialStatus({
                    binCount: booking.bin_count,
                    frequency: booking.frequency,
                    addOns: booking.add_ons,
                    neighborhood: booking.neighborhood,
                    createdAt: booking.created_at,
                    estimatedPrice: booking.estimated_price,
                  })
                : null;

              return (
                <article className="data-row billing-row" key={payment?.id ?? booking?.id}>
                  <div>
                    <strong>${amount}</strong>
                    <span>{booking?.street_address ?? payment?.description ?? "Clean Curb Co. service"}</span>
                    <small>{payment?.provider ?? booking?.payment_provider ?? "Payment link"}</small>
                    {foundingSpecial?.applied ? (
                      <small>Founding Neighbor Special applied.</small>
                    ) : null}
                  </div>
                  <span className={`status-badge status-${status}`}>
                    {paymentStatusLabel(status)}
                  </span>
                  {status === "paid" ? null : link ? (
                    <a className="button button-outline" href={link}>
                      Pay Now
                    </a>
                  ) : booking ? (
                    <PaymentLinkButton
                      amount={booking.estimated_price}
                      addOns={booking.add_ons}
                      binCount={booking.bin_count}
                      bookingId={booking.id}
                      frequency={booking.frequency}
                      paymentId={payment?.id}
                      paymentType="payment_link"
                      returnPath="/portal/billing"
                    />
                  ) : (
                    <span>Payment link pending</span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p>No billing records are linked yet.</p>
        )}
      </section>
    </PortalShell>
  );
}

function formatCardDescription(
  card: SavedCardSummary,
) {
  const brand =
    card.brand.charAt(0).toUpperCase() +
    card.brand.slice(1);

  const expirationMonth = String(
    card.expMonth,
  ).padStart(2, "0");

  const expirationYear = String(
    card.expYear,
  ).slice(-2);

  return `${brand} ending in ${card.last4} · Expires ${expirationMonth}/${expirationYear}`;
}

function paymentStatusLabel(status: string) {
  if (status === "not_sent") return "Payment not yet collected";
  if (status === "paid") return "Paid";
  if (status === "pending") return "Payment pending";
  if (status === "failed") return "Payment failed - please try again or contact us.";
  return humanizeStatus(status);
}
