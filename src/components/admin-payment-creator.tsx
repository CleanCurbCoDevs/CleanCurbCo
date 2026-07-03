"use client";

import { useState, useTransition } from "react";
import { useActionFeedback } from "@/components/action-feedback";

const paymentTypes = [
  ["booking", "Booking"],
  ["add_on", "Add-on"],
  ["cancellation_fee", "Cancellation fee"],
  ["last_minute_charge", "Last-minute full charge"],
  ["manual_invoice", "Manual invoice"],
  ["payment_link", "Payment link"],
] as const;

export function AdminPaymentCreator({
  bookingId,
  customerId,
  serviceVisitId,
  routeStopId,
  paymentId,
  defaultAmount,
  defaultDescription,
  frequency,
  binCount,
  addOns,
}: {
  bookingId: string;
  customerId?: string | null;
  serviceVisitId?: string | null;
  routeStopId?: string | null;
  paymentId?: string | null;
  defaultAmount: number;
  defaultDescription: string;
  frequency?: string | null;
  binCount?: number | null;
  addOns?: string[];
}) {
  const feedback = useActionFeedback();
  const [amount, setAmount] = useState(String(defaultAmount));
  const [paymentType, setPaymentType] = useState("booking");
  const [description, setDescription] = useState(defaultDescription);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function createCheckout() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          customer_id: customerId,
          service_visit_id: serviceVisitId,
          route_stop_id: routeStopId,
          payment_id: paymentId,
          amount: Number(amount),
          description,
          frequency,
          bin_count: binCount,
          add_ons: addOns,
          payment_type: paymentType,
          returnPath: "/admin/payments",
          forceOneTime: paymentType !== "booking",
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        const message = data.error ?? "Could not create checkout session.";
        setError(message);
        feedback.error(message);
        return;
      }

      setCheckoutUrl(data.checkoutUrl);
      await navigator.clipboard?.writeText(data.checkoutUrl).catch(() => undefined);
      feedback.success("Checkout created and copied.");
    });
  }

  return (
    <div className="payment-creator">
      <div className="form-grid">
        <label className="field">
          <span>Payment type</span>
          <select
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value)}
          >
            {paymentTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            min="1"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      <div className="action-row">
        <button
          className="button button-dark"
          type="button"
          onClick={createCheckout}
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create Checkout"}
        </button>
        {checkoutUrl ? (
          <a className="button button-outline" href={checkoutUrl} target="_blank" rel="noreferrer">
            Open Checkout
          </a>
        ) : null}
        {checkoutUrl ? (
          <button
            className="button button-outline"
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(checkoutUrl);
              feedback.success("Checkout link copied.");
            }}
          >
            Copy Checkout
          </button>
        ) : null}
      </div>
      {checkoutUrl ? <p className="muted">Checkout URL copied and saved.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
