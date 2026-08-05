"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useActionFeedback,
} from "@/components/action-feedback";

import pressableStyles
  from "@/components/pressable.module.css";

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
  label?: string;
  redirectOnCreate?: boolean;
  forceOneTime?: boolean;
};

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
  label = "Create Stripe Link",
  redirectOnCreate = false,
  forceOneTime = true,
}: PaymentLinkButtonProps) {
  const router =
    useRouter();

  const feedback =
    useActionFeedback();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    checkoutUrl,
    setCheckoutUrl,
  ] = useState(
    existingCheckoutUrl ?? "",
  );

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    setCheckoutUrl(
      existingCheckoutUrl ?? "",
    );
  }, [
    existingCheckoutUrl,
  ]);

  function createLink() {
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

                    service_visit_id:
                      serviceVisitId,

                    route_stop_id:
                      routeStopId,

                    payment_id:
                      paymentId,

                    amount,

                    payment_type:
                      paymentType,

                    frequency,

                    bin_count:
                      binCount,

                    add_ons:
                      addOns,

                    returnPath,

                    forceOneTime,
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
              "Could not create a payment link.";

            setError(
              message,
            );

            feedback.error(
              message,
            );

            return;
          }

          if (redirectOnCreate) {
            window.location.assign(
              data.checkoutUrl,
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
              ? "Stripe payment link created and copied."
              : "Stripe payment link created. Use Copy Link to copy it manually.",
          );

          router.refresh();
        } catch {
          const message =
            "The payment-link request failed. Check your connection and try again.";

          setError(message);
          feedback.error(message);
        }
      },
    );
  }

  return (
    <div className="payment-link-control">
      <button
        aria-busy={isPending}
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
        onClick={createLink}
        disabled={isPending}
      >
        {isPending
          ? redirectOnCreate
            ? "Opening Stripe..."
            : "Creating..."
          : label}
      </button>

      {!redirectOnCreate &&
      checkoutUrl ? (
        <a
          className="button button-outline"
          href={checkoutUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open Link
        </a>
      ) : null}

      {!redirectOnCreate &&
      checkoutUrl ? (
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
                    "Payment link copied.",
                  );
                } else {
                  feedback.error(
                    "The payment link could not be copied automatically.",
                  );
                }
              }
            )();
          }}
        >
          Copy Link
        </button>
      ) : null}

      {!redirectOnCreate &&
      checkoutUrl ? (
        <p className="muted">
          Payment link saved to the booking.
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
