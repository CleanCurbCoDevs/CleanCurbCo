import "server-only";

import { isStripeConfigured } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";

export type SavedCardSummary = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type StripePaymentMethodState =
  | {
      status: "saved";
      card: SavedCardSummary;
    }
  | {
      status: "missing";
      card: null;
    }
  | {
      status: "unavailable";
      card: null;
    };

type GetStripePaymentMethodStateInput = {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

function getObjectId(
  value:
    | string
    | { id: string }
    | null
    | undefined,
) {
  if (!value) return null;

  return typeof value === "string"
    ? value
    : value.id;
}

function isMissingStripeResource(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(
      (error as { code?: unknown }).code ?? "",
    ) === "resource_missing"
  );
}

export async function getStripePaymentMethodState({
  stripeCustomerId,
  stripeSubscriptionId,
}: GetStripePaymentMethodStateInput): Promise<StripePaymentMethodState> {
  if (!isStripeConfigured() || !stripeCustomerId) {
    return {
      status: "missing",
      card: null,
    };
  }

  const stripe = getStripe();

  try {
    const customer =
      await stripe.customers.retrieve(
        stripeCustomerId,
      );

    if (customer.deleted) {
      return {
        status: "missing",
        card: null,
      };
    }

    let defaultPaymentMethodId = getObjectId(
      customer.invoice_settings
        .default_payment_method,
    );

    if (stripeSubscriptionId) {
      try {
        const subscription =
          await stripe.subscriptions.retrieve(
            stripeSubscriptionId,
          );

        defaultPaymentMethodId =
          getObjectId(
            subscription.default_payment_method,
          ) ?? defaultPaymentMethodId;
      } catch (error) {
        if (!isMissingStripeResource(error)) {
          throw error;
        }

        logger.warn(
          "portal_subscription_not_found_in_stripe",
          {
            customerId: stripeCustomerId,
            metadata: {
              stripeSubscriptionId,
            },
          },
        );
      }
    }

    if (!defaultPaymentMethodId) {
      return {
        status: "missing",
        card: null,
      };
    }

    const paymentMethod =
      await stripe.paymentMethods.retrieve(
        defaultPaymentMethodId,
      );

    if (
      paymentMethod.type !== "card" ||
      !paymentMethod.card
    ) {
      return {
        status: "missing",
        card: null,
      };
    }

    return {
      status: "saved",
      card: {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      },
    };
  } catch (error) {
    logger.warn(
      "portal_payment_method_lookup_failed",
      {
        customerId: stripeCustomerId,
        error,
        metadata: {
          stripeSubscriptionId:
            stripeSubscriptionId ?? null,
        },
      },
    );

    return {
      status: "unavailable",
      card: null,
    };
  }
}
