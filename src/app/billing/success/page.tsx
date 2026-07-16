import type { Metadata } from "next";
import Link from "next/link";
import {
  createAccountSetupLink,
  createLoginClaimLink,
  hashClaimToken,
} from "@/lib/booking-claims";
import {
  isStripeConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { brand } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Payment Status",
  robots: {
    index: false,
    follow: false,
  },
};

type BillingSuccessPageProps = {
  searchParams: Promise<
    Record<string, string | undefined>
  >;
};

type BillingContext = {
  booking: BookingRow;
  accountSetupHref: string;
  loginHref: string;
  retryHref: string | null;
  paymentConfirmed: boolean;
};

export default async function BillingSuccessPage({
  searchParams,
}: BillingSuccessPageProps) {
  const params = await searchParams;
  const status = params.payment ?? "success";

  const context = await getBillingContext({
    bookingId: params.booking ?? "",
    token: params.token ?? "",
    sessionId: params.session_id ?? "",
  });

  const cancelled = status === "cancelled";
  const failed = status === "failed";

  const title = cancelled
    ? "Your booking is still saved."
    : failed
      ? "Payment was not completed."
      : context?.paymentConfirmed
        ? "Payment received — you’re all set."
        : "Payment is being confirmed.";

  const body = cancelled
    ? "You left secure checkout before payment was completed. Your booking was not cancelled, and we did not mark the payment as failed."
    : failed
      ? "The payment provider reported an unsuccessful transaction attempt. Your booking is still saved."
      : context?.paymentConfirmed
        ? "Stripe confirmed your checkout. Thank you for choosing Clean Curb Co."
        : "Your checkout returned successfully, but the final payment confirmation may still be syncing.";

  return (
    <main className="section section-cream">
      <div className="container narrow-container">
        <section className="payment-result-card">
          <p className="section-kicker">
            Clean Curb Co. billing
          </p>

          <h1>{title}</h1>
          <p>{body}</p>

          <div className="payment-result-next">
            <h2>What happens next</h2>

            <ul className="check-list">
              {cancelled ? (
                <>
                  <li>
                    Resume the same secure checkout whenever
                    you are ready.
                  </li>
                  <li>
                    Your route is not finalized until payment
                    and scheduling are confirmed.
                  </li>
                  <li>
                    Create an account to keep track of this
                    booking.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    We will confirm your route based on your
                    normal collection schedule.
                  </li>
                  <li>
                    Your account will show booking and payment
                    updates.
                  </li>
                  <li>
                    Completion photos are available after
                    service.
                  </li>
                </>
              )}
            </ul>
          </div>

          {context ? (
            <>
              <div className="button-row">
                {cancelled && context.retryHref ? (
                  <a
                    className="button button-dark"
                    href={context.retryHref}
                  >
                    Resume Secure Checkout
                  </a>
                ) : (
                  <a
                    className="button button-dark"
                    href={context.accountSetupHref}
                  >
                    Create Your Personal Account
                  </a>
                )}

                {cancelled ? (
                  <a
                    className="button button-outline"
                    href={context.accountSetupHref}
                  >
                    Create Your Personal Account
                  </a>
                ) : (
                  <Link
                    className="button button-outline"
                    href="/"
                  >
                    Back to Clean Curb Co.
                  </Link>
                )}
              </div>

              <p className="muted">
                Already have an account?{" "}
                <a href={context.loginHref}>
                  Sign in and connect this booking
                </a>
                .
              </p>
            </>
          ) : (
            <div className="button-row">
              <Link
                className="button button-dark"
                href="/"
              >
                Back to Clean Curb Co.
              </Link>

              <Link
                className="button button-outline"
                href="/contact"
              >
                Contact Support
              </Link>
            </div>
          )}

          <p className="muted">
            Questions? Contact {brand.email}. Clean Curb Co.
            does not store your full card number or security
            code.
          </p>
        </section>
      </div>
    </main>
  );
}

async function getBillingContext(input: {
  bookingId: string;
  token: string;
  sessionId: string;
}): Promise<BillingContext | null> {
  if (
    !isSupabaseConfigured() ||
    !input.bookingId ||
    !input.token
  ) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: claim } = await admin
    .from("booking_claims")
    .select("*")
    .eq("booking_id", input.bookingId)
    .eq("token_hash", hashClaimToken(input.token))
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (!claim) {
    return null;
  }

  const { data: bookingData } = await admin
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .maybeSingle();

  const booking = bookingData as BookingRow | null;

  if (
    !booking ||
    booking.email.trim().toLowerCase() !==
      String(claim.email).trim().toLowerCase()
  ) {
    return null;
  }

  let paymentConfirmed =
    booking.payment_status === "paid";

  if (
    input.sessionId &&
    isStripeConfigured()
  ) {
    try {
      const session =
        await getStripe().checkout.sessions.retrieve(
          input.sessionId,
        );

      const sessionBookingId =
        session.metadata?.booking_id ??
        session.client_reference_id;

      const sessionPaid =
        session.payment_status === "paid" ||
        session.payment_status ===
          "no_payment_required";

      if (
        sessionBookingId === booking.id &&
        sessionPaid
      ) {
        paymentConfirmed = true;
      }
    } catch {
      // The webhook and booking record remain the source
      // of truth if Stripe retrieval is temporarily unavailable.
    }
  }

  return {
    booking,
    accountSetupHref: createAccountSetupLink(
      booking.id,
      input.token,
    ),
    loginHref: createLoginClaimLink(
      booking.id,
      input.token,
    ),
    retryHref:
      booking.payment_status === "paid"
        ? null
        : booking.payment_link,
    paymentConfirmed,
  };
}
