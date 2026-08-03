"use client";

import { useState } from "react";

import { useActionFeedback } from "@/components/action-feedback";

type GuestCheckoutRetryButtonProps = {
  bookingId: string;
  claimToken: string;
};

export function GuestCheckoutRetryButton({
  bookingId,
  claimToken,
}: GuestCheckoutRetryButtonProps) {
  const feedback = useActionFeedback();
  const [isPending, setIsPending] =
    useState(false);

  async function retryCheckout() {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch(
        "/api/stripe/retry-booking-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId,
            claimToken,
          }),
        },
      );

      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (
        !response.ok ||
        !data.checkoutUrl
      ) {
        throw new Error(
          data.error ??
            "Secure checkout could not be restarted.",
        );
      }

      window.location.assign(
        data.checkoutUrl,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Secure checkout could not be restarted.";

      feedback.error(message);
      setIsPending(false);
    }
  }

  return (
    <button
      className="button button-dark"
      type="button"
      onClick={retryCheckout}
      disabled={isPending}
    >
      {isPending
        ? "Opening Secure Checkout..."
        : "Resume Secure Checkout"}
    </button>
  );
}
