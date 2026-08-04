import "server-only";

import { hashClaimToken } from "@/lib/booking-claims";
import {
  resolveBookingException,
} from "@/lib/server/booking-exceptions";
import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ClaimBookingForCustomerInput = {
  bookingId: string;
  claimToken: string;
  customerId: string;
  customerEmail: string;
  requestId: string;
  route: string;
};

type ClaimBookingResult =
  | {
      ok: true;
      bookingId: string;
      customerId: string;
      serviceAddressId: string | null;
      alreadyLinked: boolean;
    }
  | {
      ok: false;
      error: string;
    };

type ClaimBookingRpcResult = {
  bookingId?: string;
  customerId?: string;
  serviceAddressId?: string | null;
  alreadyLinked?: boolean;
};

export async function claimBookingForCustomer(
  input: ClaimBookingForCustomerInput,
): Promise<ClaimBookingResult> {
  const customerEmail =
    input.customerEmail.trim().toLowerCase();

  if (
    !input.bookingId ||
    !input.claimToken ||
    !input.customerId ||
    !customerEmail
  ) {
    return {
      ok: false,
      error: "Invalid booking claim input.",
    };
  }

  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc(
    "claim_booking_to_customer",
    {
      p_booking_id: input.bookingId,
      p_customer_id: input.customerId,
      p_customer_email: customerEmail,
      p_token_hash: hashClaimToken(
        input.claimToken,
      ),
    },
  );

  if (error) {
    logger.warn(
      "booking_customer_link_failed",
      {
        requestId: input.requestId,
        route: input.route,
        userId: input.customerId,
        customerId: input.customerId,
        bookingId: input.bookingId,
        error,
      },
    );

    return {
      ok: false,
      error: error.message,
    };
  }

  const result =
    (data ?? {}) as ClaimBookingRpcResult;

  if (
    result.bookingId !== input.bookingId ||
    result.customerId !== input.customerId
  ) {
    logger.error(
      "booking_customer_link_invalid_result",
      {
        requestId: input.requestId,
        route: input.route,
        userId: input.customerId,
        customerId: input.customerId,
        bookingId: input.bookingId,
        metadata: {
          result,
        },
      },
    );

    return {
      ok: false,
      error:
        "Booking link operation returned an invalid result.",
    };
  }

  await Promise.allSettled([
    resolveBookingException({
      bookingId:
        input.bookingId,
      dedupeKey:
        `booking:${input.bookingId}:booking_claim_creation_failed`,
      resolutionNote:
        "The booking claim was successfully used to connect the booking to a customer account.",
      resolvedByProfileId:
        input.customerId,
      requestId:
        input.requestId,
      route:
        input.route,
    }),

    ...(result.serviceAddressId
      ? [
          resolveBookingException({
            bookingId:
              input.bookingId,
            dedupeKey:
              `booking:${input.bookingId}:service_address_link_failed`,
            resolutionNote:
              "The customer-claim process successfully created or linked the booking service address.",
            resolvedByProfileId:
              input.customerId,
            requestId:
              input.requestId,
            route:
              input.route,
          }),
        ]
      : []),
  ]);
  
  logger.info(
    "booking_customer_link_completed",
    {
      requestId: input.requestId,
      route: input.route,
      userId: input.customerId,
      customerId: input.customerId,
      bookingId: input.bookingId,
      metadata: {
        serviceAddressId:
          result.serviceAddressId ?? null,
        alreadyLinked:
          Boolean(result.alreadyLinked),
      },
    },
  );

  return {
    ok: true,
    bookingId: result.bookingId,
    customerId: result.customerId,
    serviceAddressId:
      result.serviceAddressId ?? null,
    alreadyLinked:
      Boolean(result.alreadyLinked),
  };
}
