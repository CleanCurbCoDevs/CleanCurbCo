import type { Metadata } from "next";
import { PaymentLinkButton } from "@/components/payment-link-button";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";

export const metadata: Metadata = {
  title: "Portal Billing",
};

export default async function PortalBillingPage() {
  const context = await getPortalContext("/portal/billing");
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
        {records.length ? (
          <div className="data-table">
            {records.map(({ payment, booking }) => {
              const amount = payment?.amount ?? booking?.estimated_price ?? 0;
              const status = payment?.status ?? booking?.payment_status ?? "pending";
              const link = payment?.checkout_url ?? booking?.payment_link ?? "";

              return (
                <article className="data-row billing-row" key={payment?.id ?? booking?.id}>
                  <div>
                    <strong>${amount}</strong>
                    <span>{booking?.street_address ?? payment?.description ?? "Clean Curb Co. service"}</span>
                    <small>{payment?.provider ?? booking?.payment_provider ?? "Payment link"}</small>
                  </div>
                  <span className={`status-badge status-${status}`}>
                    {paymentStatusLabel(status)}
                  </span>
                  {link ? (
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

function paymentStatusLabel(status: string) {
  if (status === "not_sent") return "Payment not yet collected";
  if (status === "paid") return "Paid";
  if (status === "pending") return "Payment pending";
  if (status === "failed") return "Payment failed - please try again or contact us.";
  return humanizeStatus(status);
}
