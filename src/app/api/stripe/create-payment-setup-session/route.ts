import { NextResponse } from "next/server";
import Stripe from "stripe";
import { hashClaimToken } from "@/lib/booking-claims";
import { getSiteUrl, isStripeConfigured, getStripeEnv } from "@/lib/env";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { createRequestId, logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { canRoleAccessPath, isFieldRole } from "@/lib/supabase/roles";
import { cleanString } from "@/lib/validation";
import type { ProfileRow } from "@/types/database";

type PaymentSetupPayload = {
  bookingId?: unknown;
  token?: unknown;
  returnPath?: unknown;
};

function safeReturnPath(value: unknown, profile?: ProfileRow | null) {
  const requested = typeof value === "string" ? value.trim() : "";
  if (profile && requested && canRoleAccessPath(profile.role, requested)) {
    return requested;
  }
  if (requested.startsWith("/payment-setup") || requested.startsWith("/account-setup")) {
    return requested;
  }
  return profile ? "/portal/billing" : "/payment-setup";
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, String(value ?? "")]),
  );
}

function stripePermissionError(
  resource: string,
  error: unknown,
  context: {
    requestId: string;
    userId?: string | null;
    role?: string | null;
    customerId?: string | null;
    bookingId?: string | null;
  },
) {
  const message = error instanceof Error ? error.message : "Unknown Stripe error.";
  logger.error("stripe_payment_setup_permission_error", {
    requestId: context.requestId,
    action: "stripe_payment_setup_create",
    userId: context.userId,
    role: context.role,
    customerId: context.customerId,
    bookingId: context.bookingId,
    error,
    metadata: { resource },
  });
  return NextResponse.json(
    {
      error: `Stripe could not access ${resource}. ${message}`,
      requestId: context.requestId,
    },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/stripe/create-payment-setup-session";
  const startedAt = performance.now();

  if (!isStripeConfigured()) {
    logger.warn("stripe_payment_setup_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Stripe payment setup is not configured yet.", requestId },
      { status: 503 },
    );
  }

  let payload: PaymentSetupPayload;
  try {
    payload = (await request.json()) as PaymentSetupPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid payment setup request.", requestId },
      { status: 400 },
    );
  }

  const bookingId = cleanString(payload.bookingId, 80);
  const token = cleanString(payload.token, 200);
  if (!bookingId) {
    return NextResponse.json(
      { error: "Booking is required for payment setup.", requestId },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json(
      { error: "Booking was not found.", requestId },
      { status: 404 },
    );
  }

  const auth = await getCurrentProfile();
  let profile: ProfileRow | null = auth.status === "ok" ? auth.profile : null;
  let isAuthorized = false;

  if (auth.status === "ok") {
    isAuthorized =
      booking.customer_id === auth.userId ||
      isFieldRole(auth.profile.role);
  }

  if (!isAuthorized && token) {
    const { data: claim } = await admin
      .from("booking_claims")
      .select("*")
      .eq("booking_id", booking.id)
      .eq("token_hash", hashClaimToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (claim && claim.email.toLowerCase() === booking.email.toLowerCase()) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    logger.warn("stripe_payment_setup_auth_failed", {
      requestId,
      route,
      action: "stripe_payment_setup_create",
      userId: auth.status === "ok" ? auth.userId : null,
      role: auth.status === "ok" ? auth.profile.role : null,
      customerId: booking.customer_id,
      bookingId: booking.id,
    });
    return NextResponse.json(
      { error: "You cannot create payment setup for this booking.", requestId },
      { status: 403 },
    );
  }

  if (!profile && booking.customer_id) {
    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("id", booking.customer_id)
      .maybeSingle();
    profile = data ?? null;
  }

  const stripe = getStripe();
  const customerName = `${booking.first_name} ${booking.last_name}`.trim();
  let stripeCustomerId = profile?.stripe_customer_id ?? booking.stripe_customer_id;

  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: booking.email,
        name: customerName || undefined,
        phone: booking.phone || undefined,
        metadata: {
          booking_id: booking.id,
          profile_id: profile?.id ?? "",
          source: "clean_curb_co_payment_setup",
        },
      });
      stripeCustomerId = customer.id;
    } catch (error) {
      return stripePermissionError("customers.write", error, {
        requestId,
        userId: auth.status === "ok" ? auth.userId : null,
        role: auth.status === "ok" ? auth.profile.role : null,
        customerId: booking.customer_id,
        bookingId: booking.id,
      });
    }
  }

  const returnPath = safeReturnPath(payload.returnPath, profile);
  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}payment_setup=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}payment_setup=cancelled`;
  const metadata = stringifyMetadata({
    customer_id: booking.customer_id ?? profile?.id ?? "",
    booking_id: booking.id,
    purpose: "payment_setup",
  });

  const { currency } = getStripeEnv();

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "setup",
      currency: currency || "usd",
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      setup_intent_data: {
        metadata,
      },
    });
  } catch (error) {
    return stripePermissionError("checkout.sessions.write/setup_intents.write", error, {
      requestId,
      userId: auth.status === "ok" ? auth.userId : null,
      role: auth.status === "ok" ? auth.profile.role : null,
      customerId: booking.customer_id,
      bookingId: booking.id,
    });
  }

  await admin
    .from("bookings")
    .update({
      payment_setup_status: "pending",
      payment_provider: "stripe",
      stripe_customer_id: stripeCustomerId,
      stripe_setup_session_id: session.id,
    })
    .eq("id", booking.id);

  if (profile?.id) {
    await admin
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", profile.id);
  }

  await Promise.allSettled([
    admin.from("activity_events").insert({
      actor_profile_id: auth.status === "ok" ? auth.userId : null,
      customer_id: booking.customer_id ?? profile?.id ?? null,
      booking_id: booking.id,
      event_type: "payment_setup_session_created",
      message: "Stripe payment setup session created.",
      metadata: {
        requestId,
        stripeCheckoutSessionId: session.id,
      },
    }),
    writeAdminAuditLog({
      action: "payment_setup_session_created",
      actor_user_id: auth.status === "ok" ? auth.userId : null,
      actor_email: auth.status === "ok" ? auth.email : null,
      actor_role: auth.status === "ok" ? auth.profile.role : "guest",
      target_type: "booking",
      target_id: booking.id,
      customer_id: booking.customer_id ?? profile?.id ?? null,
      booking_id: booking.id,
      before_summary: {
        paymentSetupStatus: booking.payment_setup_status,
        stripeCustomerId: booking.stripe_customer_id,
      },
      after_summary: {
        paymentSetupStatus: "pending",
        stripeCustomerId,
        stripeSetupSessionId: session.id,
      },
      request_id: requestId,
      status: "success",
    }),
    createAdminNotification({
      type: "payment_setup_started",
      title: "Payment setup started",
      message: `${booking.first_name} ${booking.last_name} opened Stripe payment setup.`,
      href: `/admin/bookings?q=${booking.id}`,
      customer_id: booking.customer_id ?? profile?.id ?? null,
      booking_id: booking.id,
      severity: "info",
    }),
  ]);

  logger.info("stripe_payment_setup_session_created", {
    requestId,
    route,
    action: "stripe_payment_setup_create",
    userId: auth.status === "ok" ? auth.userId : null,
    role: auth.status === "ok" ? auth.profile.role : null,
    customerId: booking.customer_id ?? profile?.id ?? null,
    bookingId: booking.id,
    durationMs: Math.round(performance.now() - startedAt),
    metadata: {
      stripeCheckoutSessionId: session.id,
      hasCustomerId: Boolean(stripeCustomerId),
    },
  });

  return NextResponse.json({
    checkoutUrl: session.url,
    stripeCheckoutSessionId: session.id,
    requestId,
  });
}
