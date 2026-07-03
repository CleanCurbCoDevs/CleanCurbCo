"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionFeedback } from "@/components/action-feedback";

type PaymentLinkButtonProps = {
  bookingId: string;
  serviceVisitId?: string | null;
  routeStopId?: string | null;
  paymentId?: string | null;
  amount?: number;
  paymentType?: string;
  frequency?: string | null;
  binCount?: number | null;
  addOns?: string[];
  existingCheckoutUrl?: string | null;
  returnPath: string;
};

export function PaymentLinkButton({
  bookingId,
  serviceVisitId,
  routeStopId,
  paymentId,
  amount,
  paymentType = "payment_link",
  frequency,
  binCount,
  addOns,
  existingCheckoutUrl,
  returnPath,
}: PaymentLinkButtonProps) {
  const router = useRouter();
  const feedback = useActionFeedback();
  const [isPending, startTransition] = useTransition();
  const [checkoutUrl, setCheckoutUrl] = useState(existingCheckoutUrl ?? "");
  const [error, setError] = useState("");

  function createLink() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          service_visit_id: serviceVisitId,
          route_stop_id: routeStopId,
          payment_id: paymentId,
          amount,
          payment_type: paymentType,
          frequency,
          bin_count: binCount,
          add_ons: addOns,
          returnPath,
          forceOneTime: true,
        }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        const message = data.error ?? "Could not create a payment link.";
        setError(message);
        feedback.error(message);
        return;
      }

      setCheckoutUrl(data.checkoutUrl);
      await navigator.clipboard?.writeText(data.checkoutUrl).catch(() => undefined);
      feedback.success("Stripe payment link created and copied.");
      router.refresh();
    });
  }

  return (
    <div className="payment-link-control">
      <button
        className="button button-dark"
        type="button"
        onClick={createLink}
        disabled={isPending}
      >
        {isPending ? "Creating..." : "Create Stripe Link"}
      </button>
      {checkoutUrl ? (
        <a className="button button-outline" href={checkoutUrl} target="_blank" rel="noreferrer">
          Open Link
        </a>
      ) : null}
      {checkoutUrl ? (
        <button
          className="button button-outline"
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(checkoutUrl);
            feedback.success("Payment link copied.");
          }}
        >
          Copy Link
        </button>
      ) : null}
      {checkoutUrl ? <p className="muted">Link copied and saved to the booking.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
