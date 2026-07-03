"use client";

import { useState, useTransition } from "react";
import { useActionFeedback } from "@/components/action-feedback";

type PaymentSetupButtonProps = {
  bookingId: string;
  token?: string | null;
  returnPath: string;
  label?: string;
  className?: string;
};

export function PaymentSetupButton({
  bookingId,
  token,
  returnPath,
  label = "Add Payment Info",
  className = "button button-dark",
}: PaymentSetupButtonProps) {
  const feedback = useActionFeedback();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function createSetupSession() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/stripe/create-payment-setup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          token,
          returnPath,
        }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        const message = data.error ?? "Could not open payment setup.";
        setError(message);
        feedback.error(message);
        return;
      }

      feedback.success("Opening secure Stripe payment setup.");
      window.location.assign(data.checkoutUrl);
    });
  }

  return (
    <div className="payment-setup-control">
      <button
        className={className}
        type="button"
        onClick={createSetupSession}
        disabled={isPending}
      >
        {isPending ? "Opening Stripe..." : label}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
