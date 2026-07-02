import type { Metadata } from "next";
import Link from "next/link";
import { PaymentSetupButton } from "@/components/payment-setup-button";
import { sanitizeInternalRedirectPath } from "@/lib/security/redirects";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Payment Setup Status",
  robots: {
    index: false,
    follow: false,
  },
};

type PaymentSetupSuccessPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PaymentSetupSuccessPage({
  searchParams,
}: PaymentSetupSuccessPageProps) {
  const params = await searchParams;
  const bookingId = params.booking ?? "";
  const status = params.payment_setup ?? "success";
  const returnPath =
    sanitizeInternalRedirectPath(params.returnPath, {
      allowedPrefixes: ["/portal", "/payment-setup", "/account-setup"],
    }) ?? "/portal/billing";
  const token = getTokenFromReturnPath(returnPath);
  const copy = getPaymentSetupCopy(status);

  return (
    <main className="section section-cream">
      <div className="container narrow-container">
        <section className="payment-result-card">
          <p className="section-kicker">Stripe payment setup</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <div className="payment-result-next">
            <h2>What happens next</h2>
            <ul className="check-list">
              <li>Your payment details stay securely with Stripe.</li>
              <li>You will not be charged until service/payment terms are confirmed.</li>
              <li>We will text you before your route day.</li>
            </ul>
          </div>
          <div className="button-row">
            <Link className="button button-dark" href={returnPath}>
              Continue
            </Link>
            {status !== "success" && bookingId ? (
              <PaymentSetupButton
                bookingId={bookingId}
                token={token}
                returnPath={returnPath}
                className="button button-outline"
                label="Try Again"
              />
            ) : null}
            <Link className="button button-outline" href="/contact">
              Contact Support
            </Link>
          </div>
          <p className="muted">
            If something looks wrong, contact {brand.email}. Clean Curb Co. does
            not store your full card number or CVC.
          </p>
        </section>
      </div>
    </main>
  );
}

function getTokenFromReturnPath(returnPath: string) {
  try {
    const url = new URL(returnPath, "https://cleancurbco.local");
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

function getPaymentSetupCopy(status: string) {
  if (status === "cancelled") {
    return {
      title: "Payment setup cancelled.",
      body:
        "No problem. You can securely add payment information later from your portal or account setup page.",
    };
  }

  if (status === "failed") {
    return {
      title: "Payment setup was not completed.",
      body:
        "Stripe did not confirm the setup session. Please try again or contact us so we can help.",
    };
  }

  return {
    title: "Payment method saved. You are all set.",
    body:
      "Your payment information was added through Stripe. Your account is ready for service once route details and payment terms are confirmed.",
  };
}
