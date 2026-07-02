import type { Metadata } from "next";
import Link from "next/link";
import { PaymentSetupButton } from "@/components/payment-setup-button";

export const metadata: Metadata = {
  title: "Payment Setup",
};

type PaymentSetupPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PaymentSetupPage({
  searchParams,
}: PaymentSetupPageProps) {
  const params = await searchParams;
  const bookingId = params.booking ?? "";
  const token = params.token ?? null;
  const status = params.payment_setup;
  const returnPath = `/payment-setup?booking=${encodeURIComponent(bookingId)}${
    token ? `&token=${encodeURIComponent(token)}` : ""
  }`;

  return (
    <main className="section section-cream">
      <div className="container narrow-container">
        <section className="placeholder-panel">
          <p className="section-kicker">Stripe payment setup</p>
          <h1>Add payment information securely.</h1>
          {status === "success" ? (
            <p className="confirmation-panel">
              Payment information was added successfully. Your payment details
              stay securely with Stripe.
            </p>
          ) : status === "cancelled" ? (
            <p className="confirmation-panel">
              No problem. You can add payment information later from your portal.
            </p>
          ) : null}
          <p>
            You can securely add payment information now so your account is
            ready when your route is confirmed. You will not be charged until
            service/payment terms are confirmed.
          </p>
          <p className="muted">
            Clean Curb Co. uses Stripe-hosted payment setup and does not store
            your full card number or CVC.
          </p>
          {bookingId ? (
            <div className="button-row">
              <PaymentSetupButton
                bookingId={bookingId}
                token={token}
                returnPath={returnPath}
              />
              <Link className="button button-outline" href="/portal/billing">
                Go to Billing
              </Link>
            </div>
          ) : (
            <div className="button-row">
              <Link className="button button-dark" href="/portal/billing">
                Open Billing
              </Link>
              <Link className="button button-outline" href="/contact">
                Contact Us
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
