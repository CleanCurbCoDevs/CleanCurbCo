import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeInternalRedirectPath } from "@/lib/security/redirects";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Payment Status",
  robots: {
    index: false,
    follow: false,
  },
};

type BillingSuccessPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function BillingSuccessPage({
  searchParams,
}: BillingSuccessPageProps) {
  const params = await searchParams;
  const status = params.payment ?? "success";
  const returnPath =
    sanitizeInternalRedirectPath(params.returnPath, {
      allowedPrefixes: ["/portal", "/field", "/admin"],
    }) ?? "/portal/billing";
  const copy = getPaymentCopy(status);

  return (
    <main className="section section-cream">
      <div className="container narrow-container">
        <section className="payment-result-card">
          <p className="section-kicker">Clean Curb Co. billing</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <div className="payment-result-next">
            <h2>What happens next</h2>
            <ul className="check-list">
              <li>We will text before your route day.</li>
              <li>We will clean your bins when service is confirmed.</li>
              <li>Completion photos are sent after service.</li>
            </ul>
          </div>
          <div className="button-row">
            <Link className="button button-dark" href={returnPath}>
              Back to Clean Curb Co.
            </Link>
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

function getPaymentCopy(status: string) {
  if (status === "cancelled") {
    return {
      title: "Checkout cancelled.",
      body:
        "No problem. Your payment was not completed, and you can return to Clean Curb Co. to try again or contact us.",
    };
  }

  if (status === "failed") {
    return {
      title: "Payment was not completed.",
      body:
        "Stripe did not confirm the payment. Please try again or contact us so we can help.",
    };
  }

  return {
    title: "Payment received. You are all set.",
    body:
      "Your Clean Curb Co. payment was completed through Stripe. We will text you before your route day and send completion photos after service.",
  };
}
