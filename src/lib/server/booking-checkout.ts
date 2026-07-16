import "server-only";

import {
  getSiteUrl,
  getStripeEnv,
  isStripeConfigured,
} from "@/lib/env";
import { getFoundingNeighborSpecialStatus } from "@/lib/pricing";
import { logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow } from "@/types/database";

type CreateBookingCheckoutInput = {
  booking: BookingRow;
  requestId: string;
  claimToken: string;
};

export type BookingCheckoutResult = {
  checkoutUrl: string | null;
  error: string | null;
};

function stringifyMetadata(
  metadata: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.join(",")
        : String(value ?? ""),
    ]),
  );
}

export async function createBookingCheckout({
  booking,
  requestId,
  claimToken,
}: CreateBookingCheckoutInput): Promise<BookingCheckoutResult> {
  const customerMessage =
    "Your booking was saved, but secure checkout could not start. We will send you a fresh card-payment link.";

  if (!isStripeConfigured()) {
    logger.warn("booking_checkout_unconfigured", {
      requestId,
      route: "/api/bookings",
      bookingId: booking.id,
    });

    return {
      checkoutUrl: null,
      error: customerMessage,
    };
  }

  const admin = getSupabaseAdmin();
  const stripe = getStripe();
  const { currency } = getStripeEnv();
  const siteUrl = getSiteUrl();
  const amount = Number(booking.estimated_price);

  if (!Number.isFinite(amount) || amount <= 0) {
    logger.error("booking_checkout_invalid_amount", {
      requestId,
      route: "/api/bookings",
      bookingId: booking.id,
      metadata: {
        estimatedPrice: booking.estimated_price,
      },
    });

    return {
      checkoutUrl: null,
      error: customerMessage,
    };
  }

  const paymentMetadata = {
    source: "booking_form",
    booking_id: booking.id,
    customer_id: booking.customer_id ?? "",
    frequency: booking.frequency,
    bin_count: booking.bin_count,
    add_ons: booking.add_ons,
    payment_type: "booking",
    service_amount: amount,
    tip_amount: 0,
    total_amount: amount,
  };

  let paymentId: string | null = null;

  try {
let stripeCustomerId = booking.stripe_customer_id;

if (stripeCustomerId) {
  try {
    const existingCustomer =
      await stripe.customers.retrieve(
        stripeCustomerId,
      );

    if (existingCustomer.deleted) {
      stripeCustomerId = null;
    }
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(
            (error as { code?: unknown }).code ?? "",
          )
        : "";

    if (code === "resource_missing") {
      logger.warn(
        "booking_checkout_stale_stripe_customer",
        {
          requestId,
          route: "/api/bookings",
          bookingId: booking.id,
          customerId: booking.customer_id,
          metadata: {
            staleStripeCustomerId:
              booking.stripe_customer_id,
          },
        },
      );

      stripeCustomerId = null;
    } else {
      throw error;
    }
  }
}

if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: booking.email,
        name: `${booking.first_name} ${booking.last_name}`.trim(),
        phone: booking.phone || undefined,
        metadata: {
          booking_id: booking.id,
          profile_id: booking.customer_id ?? "",
          source: "clean_curb_co_booking",
        },
      });

      stripeCustomerId = customer.id;

      await admin
        .from("bookings")
        .update({
          stripe_customer_id: stripeCustomerId,
        })
        .eq("id", booking.id);

      if (booking.customer_id) {
        await admin
          .from("profiles")
          .update({
            stripe_customer_id: stripeCustomerId,
          })
          .eq("id", booking.customer_id);
      }
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        customer_id: booking.customer_id,
        booking_id: booking.id,
        service_visit_id: null,
        amount,
        service_amount: amount,
        tip_amount: 0,
        total_amount: amount,
        tip_source: null,
        received_at: null,
        recorded_by_user_id: null,
        currency,
        status: "pending",
        provider: "stripe",
        stripe_customer_id: stripeCustomerId,
        description:
          `Clean Curb Co. booking for ${booking.street_address}`,
        payment_type: "booking",
        metadata: paymentMetadata,
      })
      .select("*")
      .single();

    if (paymentError || !payment) {
      throw new Error(
        paymentError?.message ??
          "The pending payment record could not be created.",
      );
    }

    paymentId = payment.id;

    const stripeMetadata = stringifyMetadata({
      ...paymentMetadata,
      payment_id: payment.id,
      founding_neighbor_special:
        getFoundingNeighborSpecialStatus({
          binCount: booking.bin_count,
          frequency: booking.frequency,
          addOns: booking.add_ons,
          neighborhood: booking.neighborhood,
          createdAt: booking.created_at,
          estimatedPrice: amount,
        }).status,
    });

    const accountQuery = new URLSearchParams({
      booking: booking.id,
      token: claimToken,
    }).toString();
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      client_reference_id: booking.id,
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Clean Curb Co. bin cleaning",
              description:
                `First service visit at ${booking.street_address}`,
              metadata: stripeMetadata,
            },
          },
        },
      ],
    success_url:
      `${siteUrl}/billing/success` +
      `?payment=success` +
      `&session_id={CHECKOUT_SESSION_ID}` +
      `&${accountQuery}`,
    cancel_url:
      `${siteUrl}/billing/success` +
      `?payment=cancelled` +
      `&${accountQuery}`,
      metadata: stripeMetadata,
      payment_intent_data: {
        metadata: stripeMetadata,
      },
    });

    const checkoutUrl = session.url ?? null;

    if (!checkoutUrl) {
      throw new Error(
        "Stripe created a session without a checkout URL.",
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    const [paymentUpdate, bookingUpdate] = await Promise.all([
      admin
        .from("payments")
        .update({
          status: "pending",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          checkout_url: checkoutUrl,
          metadata: {
            ...paymentMetadata,
            payment_id: payment.id,
            stripe_mode: "payment",
            checkout_started_at: new Date().toISOString(),
          },
        })
        .eq("id", payment.id),

      admin
        .from("bookings")
        .update({
          payment_status: "pending",
          payment_preference: "stripe",
          payment_due_at_service: false,
          payment_verification_status: "not_required",
          payment_provider: "stripe",
          payment_link: checkoutUrl,
          checkout_started_at: new Date().toISOString(),
          stripe_customer_id: stripeCustomerId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", booking.id),
    ]);

    if (paymentUpdate.error || bookingUpdate.error) {
      logger.warn("booking_checkout_database_update_incomplete", {
        requestId,
        route: "/api/bookings",
        bookingId: booking.id,
        error:
          paymentUpdate.error ??
          bookingUpdate.error,
        metadata: {
          paymentId: payment.id,
          stripeCheckoutSessionId: session.id,
        },
      });
    }

    logger.info("booking_checkout_created", {
      requestId,
      route: "/api/bookings",
      bookingId: booking.id,
      customerId: booking.customer_id,
      metadata: {
        paymentId: payment.id,
        stripeCheckoutSessionId: session.id,
        amount,
        currency,
        frequency: booking.frequency,
      },
    });

    return {
      checkoutUrl,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Stripe checkout error.";

    if (paymentId) {
      await admin
        .from("payments")
        .update({
          status: "cancelled",
          metadata: {
            ...paymentMetadata,
            checkout_creation_failed_at:
              new Date().toISOString(),
            checkout_creation_error: message,
          },
        })
        .eq("id", paymentId);
    }

    logger.error("booking_checkout_creation_failed", {
      requestId,
      route: "/api/bookings",
      bookingId: booking.id,
      customerId: booking.customer_id,
      error,
      metadata: {
        paymentId,
      },
    });

    return {
      checkoutUrl: null,
      error: customerMessage,
    };
  }
}
