"use client";

import { useState, useTransition } from "react";

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
        setError(data.error ?? "Could not open payment setup.");
        return;
      }

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
