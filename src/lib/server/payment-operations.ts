import "server-only";

import type {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

type AdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type PaymentRpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error: PaymentRpcError | null;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};

type PaymentOperationFailure = {
  ok: false;
  message: string;
  error: PaymentRpcError | null;
};

type PaymentOperationSuccess<Data> = {
  ok: true;
  data: Data;
};

type PaymentOperationResult<Data> =
  | PaymentOperationSuccess<Data>
  | PaymentOperationFailure;

export type StripeCheckoutReservation = {
  paymentId: string;
  generation: number;
  reuseExisting: boolean;
  inProgress: boolean;
  checkoutUrl?: string;
  stripeCheckoutSessionId?: string;
};

export type StripeCheckoutFinalization = {
  alreadyFinalized: boolean;
  paymentId: string;
  checkoutUrl: string;
};

export type ManualPaymentResult = {
  alreadyPaid: boolean;
  paymentId?: string;
  serviceAmount: number;
  tipAmount: number;
  totalAmount: number;
};

export type PaymentEmailTrackingResult = {
  paymentId: string;
  sentAt: string;
};

async function invokePaymentRpc<Data>(
  admin: AdminClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<
  PaymentOperationResult<Data>
> {
  const client =
    admin as unknown as RpcClient;

  const {
    data,
    error,
  } = await client.rpc(
    functionName,
    args,
  );

  if (error) {
    return {
      ok: false,
      message:
        paymentErrorMessage(
          error.message,
        ),
      error,
    };
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {
      ok: false,
      message:
        "The payment operation did not return a valid result.",
      error: null,
    };
  }

  return {
    ok: true,
    data: data as Data,
  };
}

function paymentErrorMessage(
  message: string,
) {
  if (
    message.includes(
      "payment_integrity:invalid_amount",
    )
  ) {
    return "Enter a valid payment amount.";
  }

  if (
    message.includes(
      "payment_integrity:payment_settled",
    )
  ) {
    return "This payment is already settled and cannot receive another checkout link.";
  }

  if (
    message.includes(
      "payment_integrity:admin_override_required",
    )
  ) {
    return "Only an admin or owner may override the scheduled payment method.";
  }

  if (
    message.includes(
      "payment_integrity:manual_notes_required",
    )
  ) {
    return "Add a payment note when using another payment method.";
  }

  if (
    message.includes(
      "payment_integrity:not_assigned",
    )
  ) {
    return "This payment belongs to another technician’s route.";
  }

  if (
    message.includes(
      "payment_integrity:stale_generation",
    )
  ) {
    return "A newer checkout attempt already exists. Refresh the page and use the latest payment link.";
  }

  if (
    message.includes(
      "payment_integrity:booking_missing",
    ) ||
    message.includes(
      "payment_integrity:visit_missing",
    ) ||
    message.includes(
      "payment_integrity:stop_missing",
    ) ||
    message.includes(
      "payment_integrity:payment_missing",
    )
  ) {
    return "The related payment or service record could not be loaded.";
  }

  if (
    message.includes(
      "payment_integrity:booking_mismatch",
    ) ||
    message.includes(
      "payment_integrity:visit_mismatch",
    ) ||
    message.includes(
      "payment_integrity:customer_mismatch",
    ) ||
    message.includes(
      "payment_integrity:relationship_mismatch",
    )
  ) {
    return "The submitted payment records do not belong to the same service.";
  }

  return "The payment operation failed. Refresh the page and try again.";
}

export function reserveStripeCheckout(
  admin: AdminClient,
  input: {
    paymentId: string | null;
    customerId: string | null;
    bookingId: string | null;
    serviceVisitId: string | null;
    amount: number;
    currency: string;
    description: string;
    paymentType: string;
    stripeCustomerId: string | null;
    metadata: Record<string, unknown>;
  },
) {
  return invokePaymentRpc<
    StripeCheckoutReservation
  >(
    admin,
    "payment_reserve_stripe_checkout_atomic",
    {
      p_payment_id:
        input.paymentId,
      p_customer_id:
        input.customerId,
      p_booking_id:
        input.bookingId,
      p_service_visit_id:
        input.serviceVisitId,
      p_amount:
        input.amount,
      p_currency:
        input.currency,
      p_description:
        input.description,
      p_payment_type:
        input.paymentType,
      p_stripe_customer_id:
        input.stripeCustomerId,
      p_metadata:
        input.metadata,
    },
  );
}

export function finalizeStripeCheckout(
  admin: AdminClient,
  input: {
    paymentId: string;
    generation: number;
    stripeCustomerId: string;
    checkoutSessionId: string;
    paymentIntentId: string | null;
    subscriptionId: string | null;
    checkoutUrl: string;
    metadata: Record<string, unknown>;
  },
) {
  return invokePaymentRpc<
    StripeCheckoutFinalization
  >(
    admin,
    "payment_finalize_stripe_checkout_atomic",
    {
      p_payment_id:
        input.paymentId,
      p_generation:
        input.generation,
      p_stripe_customer_id:
        input.stripeCustomerId,
      p_checkout_session_id:
        input.checkoutSessionId,
      p_payment_intent_id:
        input.paymentIntentId ?? "",
      p_subscription_id:
        input.subscriptionId ?? "",
      p_checkout_url:
        input.checkoutUrl,
      p_metadata:
        input.metadata,
    },
  );
}

export function failStripeCheckout(
  admin: AdminClient,
  input: {
    paymentId: string;
    generation: number;
    error: string;
    metadata?: Record<string, unknown>;
  },
) {
  return invokePaymentRpc<{
    changed: boolean;
    paymentId?: string;
    reason?: string;
  }>(
    admin,
    "payment_fail_stripe_checkout_atomic",
    {
      p_payment_id:
        input.paymentId,
      p_generation:
        input.generation,
      p_error:
        input.error,
      p_metadata:
        input.metadata ?? {},
    },
  );
}

export function recordManualFieldPayment(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    serviceAmount: number;
    tipAmount: number;
    method: string;
    notes: string | null;
  },
) {
  return invokePaymentRpc<
    ManualPaymentResult
  >(
    admin,
    "field_record_manual_payment_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_service_amount:
        input.serviceAmount,
      p_tip_amount:
        input.tipAmount,
      p_method:
        input.method,
      p_notes:
        input.notes,
    },
  );
}

export function markFieldPaymentEmailSent(
  admin: AdminClient,
  input: {
    paymentId: string;
    routeStopId: string;
    serviceVisitId: string;
    actorProfileId: string;
  },
) {
  return invokePaymentRpc<
    PaymentEmailTrackingResult
  >(
    admin,
    "field_mark_payment_email_sent_atomic",
    {
      p_payment_id:
        input.paymentId,
      p_route_stop_id:
        input.routeStopId,
      p_service_visit_id:
        input.serviceVisitId,
      p_actor_profile_id:
        input.actorProfileId,
    },
  );
}
