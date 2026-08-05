"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  useActionFeedback,
} from "@/components/action-feedback";

import pressableStyles
  from "@/components/pressable.module.css";

const paymentTypes = [
  [
    "booking",
    "Booking",
  ],
  [
    "add_on",
    "Add-on",
  ],
  [
    "cancellation_fee",
    "Cancellation fee",
  ],
  [
    "last_minute_charge",
    "Last-minute full charge",
  ],
  [
    "manual_invoice",
    "Manual invoice",
  ],
  [
    "payment_link",
    "Payment link",
  ],
] as const;

async function copyText(
  value: string,
) {
  if (
    !navigator.clipboard
      ?.writeText
  ) {
    return false;
  }

  try {
    await navigator.clipboard
      .writeText(value);

    return true;
  } catch {
    return false;
  }
}

export function AdminPaymentCreator({
  bookingId,
  customerId,
  serviceVisitId,
  routeStopId,
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
  defaultAmount: number;
  defaultDescription: string;
  frequency?: string | null;
  binCount?: number | null;
  addOns?: string[];
}) {
  const feedback =
    useActionFeedback();

  const [
    amount,
    setAmount,
  ] = useState(
    String(
      defaultAmount,
    ),
  );

  const [
    paymentType,
    setPaymentType,
  ] = useState(
    "booking",
  );

  const [
    description,
    setDescription,
  ] = useState(
    defaultDescription,
  );

  const [
    checkoutUrl,
    setCheckoutUrl,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    isPending,
    startTransition,
  ] = useTransition();

  function createCheckout() {
    setError("");

    startTransition(
      async () => {
        try {
          const response =
            await fetch(
              "/api/stripe/create-checkout-session",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    booking_id:
                      bookingId,

                    customer_id:
                      customerId,

                    service_visit_id:
                      serviceVisitId,

                    route_stop_id:
                      routeStopId,

                    amount:
                      Number(
                        amount,
                      ),

                    description,

                    frequency,

                    bin_count:
                      binCount,

                    add_ons:
                      addOns,

                    payment_type:
                      paymentType,

                    returnPath:
                      "/admin/payments",

                    forceOneTime:
                      paymentType !==
                      "booking",
                  }),
              },
            );

          let data: {
            checkoutUrl?: string;
            error?: string;
          } = {};

          try {
            data =
              await response.json();
          } catch {
            data = {};
          }

          if (
            !response.ok ||
            !data.checkoutUrl
          ) {
            const message =
              data.error ??
              "Could not create checkout session.";

            setError(
              message,
            );

            feedback.error(
              message,
            );

            return;
          }

          setCheckoutUrl(
            data.checkoutUrl,
          );

          const copied =
            await copyText(
              data.checkoutUrl,
            );

          feedback.success(
            copied
              ? "Checkout created and copied."
              : "Checkout created. Use Copy Checkout to copy it manually.",
          );
        } catch {
          const message =
            "The checkout request failed. Check your connection and try again.";

          setError(message);
          feedback.error(message);
        }
      },
    );
  }

  return (
    <div className="payment-creator">
      <div className="form-grid">
        <label className="field">
          <span>
            Payment type
          </span>

          <select
            value={paymentType}
            onChange={(
              event,
            ) =>
              setPaymentType(
                event.target
                  .value,
              )
            }
          >
            {paymentTypes.map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="field">
          <span>
            Amount
          </span>

          <input
            min="0.01"
            max="50000"
            step="0.01"
            type="number"
            value={amount}
            onChange={(
              event,
            ) =>
              setAmount(
                event.target
                  .value,
              )
            }
          />
        </label>

        <label className="field">
          <span>
            Description
          </span>

          <input
            value={
              description
            }
            onChange={(
              event,
            ) =>
              setDescription(
                event.target
                  .value,
              )
            }
          />
        </label>
      </div>

      <div className="action-row">
        <button
          aria-busy={
            isPending
          }
          className={[
            "button",
            "button-dark",
            pressableStyles.pressable,
          ].join(" ")}
          data-pending={
            isPending
              ? "true"
              : undefined
          }
          type="button"
          onClick={
            createCheckout
          }
          disabled={
            isPending
          }
        >
          {isPending
            ? "Creating..."
            : "Create Checkout"}
        </button>

        {checkoutUrl ? (
          <a
            className="button button-outline"
            href={
              checkoutUrl
            }
            target="_blank"
            rel="noreferrer"
          >
            Open Checkout
          </a>
        ) : null}

        {checkoutUrl ? (
          <button
            className={[
              "button",
              "button-outline",
              pressableStyles.pressable,
            ].join(" ")}
            type="button"
            onClick={() => {
              void (
                async () => {
                  const copied =
                    await copyText(
                      checkoutUrl,
                    );

                  if (copied) {
                    feedback.success(
                      "Checkout link copied.",
                    );
                  } else {
                    feedback.error(
                      "The checkout link could not be copied automatically.",
                    );
                  }
                }
              )();
            }}
          >
            Copy Checkout
          </button>
        ) : null}
      </div>

      {checkoutUrl ? (
        <p className="muted">
          Checkout URL saved.
        </p>
      ) : null}

      {error ? (
        <p className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
