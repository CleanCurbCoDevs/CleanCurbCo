import { NextResponse } from "next/server";

import { hashClaimToken } from "@/lib/booking-claims";
import {
  isStripeConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { createBookingCheckout } from "@/lib/server/booking-checkout";
import {
  openBookingException,
  resolveBookingException,
} from "@/lib/server/booking-exceptions";
import { recordBookingEvent } from "@/lib/server/booking-events";
import {
  createRequestId,
  logger,
} from "@/lib/server/logger";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cleanString } from "@/lib/validation";

type RetryCheckoutPayload = {
  bookingId?: unknown;
  claimToken?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route =
    "/api/stripe/retry-booking-checkout";

  const originRejection =
    rejectCrossOriginRequest(request, {
      requestId,
      route,
      action: "guest_checkout_retry",
    });

  if (originRejection) {
    return originRejection;
  }

  if (
    !isSupabaseConfigured() ||
    !isStripeConfigured()
  ) {
    logger.warn(
      "guest_checkout_retry_unconfigured",
      {
        requestId,
        route,
      },
    );

    return NextResponse.json(
      {
        error:
          "Secure checkout is temporarily unavailable. Please contact Clean Curb Co. for a fresh payment link.",
        requestId,
      },
      { status: 503 },
    );
  }

  let body: RetryCheckoutPayload;

  try {
    body =
      (await request.json()) as RetryCheckoutPayload;
  } catch (error) {
    logger.warn(
      "guest_checkout_retry_invalid_json",
      {
        requestId,
        route,
        error,
      },
    );

    return NextResponse.json(
      {
        error:
          "That checkout request could not be read. Please refresh and try again.",
        requestId,
      },
      { status: 400 },
    );
  }

  const bookingId = cleanString(
    body.bookingId,
    80,
  );

  const claimToken = cleanString(
    body.claimToken,
    200,
  );

  if (!bookingId || !claimToken) {
    logger.warn(
      "guest_checkout_retry_invalid_payload",
      {
        requestId,
        route,
        bookingId: bookingId || null,
      },
    );

    return NextResponse.json(
      {
        error:
          "That secure checkout link is incomplete or no longer valid.",
        requestId,
      },
      { status: 400 },
    );
  }

  const limited = rejectLimitedRequest(
    request,
    {
      requestId,
      route,
      action: "guest_checkout_retry",
      scope: "guest-checkout-retry",
      subject: bookingId,
      limit: 6,
      windowMs: 10 * 60 * 1000,
    },
  );

  if (limited) {
    return limited;
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const {
    data: claim,
    error: claimError,
  } = await admin
    .from("booking_claims")
    .select("id, booking_id, email")
    .eq("booking_id", bookingId)
    .eq(
      "token_hash",
      hashClaimToken(claimToken),
    )
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (claimError) {
    logger.error(
      "guest_checkout_retry_claim_lookup_failed",
      {
        requestId,
        route,
        bookingId,
        error: claimError,
      },
    );

    return NextResponse.json(
      {
        error:
          "We could not verify that secure checkout link. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  if (!claim) {
    logger.warn(
      "guest_checkout_retry_claim_invalid",
      {
        requestId,
        route,
        bookingId,
      },
    );

    return NextResponse.json(
      {
        error:
          "That secure checkout link is expired or no longer valid.",
        requestId,
      },
      { status: 400 },
    );
  }

  const {
    data: booking,
    error: bookingError,
  } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    logger.error(
      "guest_checkout_retry_booking_lookup_failed",
      {
        requestId,
        route,
        bookingId,
        error: bookingError,
      },
    );

    return NextResponse.json(
      {
        error:
          "We could not load that booking. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  const claimEmail =
    claim.email.trim().toLowerCase();

  const bookingEmail =
    booking?.email.trim().toLowerCase() ?? "";

  if (
    !booking ||
    claim.booking_id !== booking.id ||
    claimEmail !== bookingEmail
  ) {
    logger.warn(
      "guest_checkout_retry_booking_mismatch",
      {
        requestId,
        route,
        bookingId,
      },
    );

    return NextResponse.json(
      {
        error:
          "That secure checkout link does not match this booking.",
        requestId,
      },
      { status: 403 },
    );
  }

  const checkoutRetryBlocked =
    booking.status === "cancelled" ||
    booking.status === "paid" ||
    booking.payment_status === "paid" ||
    booking.payment_status === "refunded";

  if (checkoutRetryBlocked) {
    logger.info(
      "guest_checkout_retry_booking_closed",
      {
        requestId,
        route,
        bookingId,
        customerId: booking.customer_id,
        metadata: {
          bookingStatus: booking.status,
          paymentStatus: booking.payment_status,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "This booking is no longer eligible for a new checkout session. Please contact Clean Curb Co. if you need help.",
        requestId,
      },
      { status: 409 },
    );
  }

  const checkoutResult =
    await createBookingCheckout({
      booking,
      requestId,
      claimToken,
    });

  if (
    !checkoutResult.checkoutUrl ||
    checkoutResult.error
  ) {
    await recordBookingEvent({
      bookingId: booking.id,
      customerId: booking.customer_id,
      requestId,
      route,
      source: "booking_api",
      eventType:
        "CHECKOUT_RETRY_CREATION_FAILED",
      outcome: "failure",
      message:
        "A fresh guest checkout session could not be created.",
      idempotencyKey:
        `booking:${booking.id}:checkout_retry_failed:${requestId}`,
      metadata: {
        paymentStatus:
          booking.payment_status,
        claimId: claim.id,
      },
    });
    await openBookingException({
      bookingId: booking.id,
      customerId:
        booking.customer_id,
      requestId,
      route,
      source: "booking_api",
      exceptionType:
        "stripe_checkout_creation_failed",
      severity: "urgent",
      title:
        "Stripe checkout could not be created",
      message:
        "A customer attempted to resume payment, but a fresh Stripe checkout session could not be created.",
      dedupeKey:
        `booking:${booking.id}:stripe_checkout_creation_failed`,
      metadata: {
        stage: "guest_checkout_retry",
        paymentStatus:
          booking.payment_status,
        claimId: claim.id,
        checkoutError:
          checkoutResult.error ?? null,
      },
    });
    return NextResponse.json(
      {
        error:
          checkoutResult.error ??
          "Secure checkout could not be restarted. Please contact Clean Curb Co. for help.",
        requestId,
      },
      { status: 502 },
    );
  }

  await recordBookingEvent({
    bookingId: booking.id,
    customerId: booking.customer_id,
    requestId,
    route,
    source: "booking_api",
    eventType: "CHECKOUT_RETRY_CREATED",
    outcome: "success",
    message:
      "A fresh guest checkout session was created.",
    idempotencyKey:
      `booking:${booking.id}:checkout_retry_created:${requestId}`,
    metadata: {
      paymentStatus:
        booking.payment_status,
      claimId: claim.id,
    },
  });
  await resolveBookingException({
    bookingId: booking.id,
    requestId,
    route,
    dedupeKey:
      `booking:${booking.id}:stripe_checkout_creation_failed`,
    resolutionNote:
      "A fresh guest Stripe checkout session was created successfully.",
  });
  logger.info(
    "guest_checkout_retry_created",
    {
      requestId,
      route,
      bookingId: booking.id,
      customerId: booking.customer_id,
    },
  );

  return NextResponse.json({
    checkoutUrl:
      checkoutResult.checkoutUrl,
    requestId,
  });
}
