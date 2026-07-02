import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSiteUrl, getStripeEnv, isStripeConfigured } from "@/lib/env";
import { formatBookingAddress } from "@/lib/booking-utils";
import { createRequestId, logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canRoleAccessPath, isFieldRole } from "@/lib/supabase/roles";
import type {
  BookingRow,
  PaymentRow,
  ProfileRow,
  RouteStopRow,
  ServiceFrequency,
  ServiceVisitRow,
} from "@/types/database";

type CheckoutPayload = Record<string, unknown>;
type PaymentType =
  | "booking"
  | "service_visit"
  | "add_on"
  | "cancellation_fee"
  | "last_minute_charge"
  | "manual_invoice"
  | "payment_link";

const validPaymentTypes: readonly PaymentType[] = [
  "booking",
  "service_visit",
  "add_on",
  "cancellation_fee",
  "last_minute_charge",
  "manual_invoice",
  "payment_link",
];

function cleanId(payload: CheckoutPayload, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function cleanText(payload: CheckoutPayload, key: string, fallback = "") {
  const value = payload[key];
  return typeof value === "string" ? value.trim().slice(0, 220) : fallback;
}

function cleanAmount(payload: CheckoutPayload, fallback: number) {
  const rawAmount = payload.amount;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount)
        : fallback;
  return Number.isFinite(amount) ? Math.max(1, Math.round(amount)) : fallback;
}

function cleanFrequency(
  payload: CheckoutPayload,
  fallback: ServiceFrequency | null,
): ServiceFrequency | null {
  const value = cleanText(payload, "frequency");
  if (["one_time", "monthly", "every_other_month", "quarterly"].includes(value)) {
    return value as ServiceFrequency;
  }
  return fallback;
}

function cleanAddOns(payload: CheckoutPayload, fallback: string[]) {
  const rawAddOns = payload.add_ons ?? payload.addOns;
  if (Array.isArray(rawAddOns)) {
    return rawAddOns.map((value) => String(value)).filter(Boolean);
  }
  if (typeof rawAddOns === "string") {
    return rawAddOns
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return fallback;
}

function cleanPaymentType(payload: CheckoutPayload): PaymentType {
  const value = cleanText(payload, "payment_type") || cleanText(payload, "paymentType");
  return validPaymentTypes.includes(value as PaymentType)
    ? (value as PaymentType)
    : "payment_link";
}

function safeReturnPath(value: unknown, role: ProfileRow["role"]) {
  const requested = typeof value === "string" ? value.trim() : "";
  if (requested && canRoleAccessPath(role, requested)) return requested;
  return isFieldRole(role) ? "/field/today" : "/portal/billing";
}

function recurringIntervalCount(frequency: ServiceFrequency | null) {
  if (frequency === "monthly") return 1;
  if (frequency === "every_other_month") return 2;
  if (frequency === "quarterly") return 3;
  return null;
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(",") : String(value ?? ""),
    ]),
  );
}

function stripePermissionError(
  resource: string,
  error: unknown,
  context?: {
    requestId?: string;
    userId?: string | null;
    role?: string | null;
    customerId?: string | null;
    bookingId?: string | null;
  },
) {
  const message = error instanceof Error ? error.message : "Unknown Stripe error.";
  logger.error("stripe_checkout_permission_error", {
    requestId: context?.requestId,
    action: "stripe_checkout_create",
    userId: context?.userId,
    role: context?.role,
    customerId: context?.customerId,
    bookingId: context?.bookingId,
    error,
    metadata: { resource },
  });
  return NextResponse.json(
    {
      error: `Stripe could not access ${resource}. Check restricted key permissions for ${resource}. ${message}`,
      requestId: context?.requestId,
    },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/stripe/create-checkout-session";
  const startedAt = performance.now();

  if (!isStripeConfigured()) {
    logger.warn("stripe_checkout_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Stripe is not configured yet.", requestId },
      { status: 503 },
    );
  }

  const auth = await getCurrentProfile();
  if (auth.status !== "ok") {
    logger.warn("stripe_checkout_auth_failed", {
      requestId,
      route,
      status: auth.status,
    });
    return NextResponse.json(
      { error: auth.message, requestId },
      { status: auth.status === "unconfigured" ? 503 : 401 },
    );
  }

  const payload = (await request.json()) as CheckoutPayload;
  const admin = getSupabaseAdmin();
  const stripe = getStripe();
  const { currency } = getStripeEnv();

  let bookingId = cleanId(payload, "booking_id", "bookingId");
  let serviceVisitId = cleanId(payload, "service_visit_id", "serviceVisitId");
  const paymentId = cleanId(payload, "payment_id", "paymentId");
  const routeStopId = cleanId(payload, "route_stop_id", "routeStopId");
  const requestedCustomerId = cleanId(payload, "customer_id", "customerId");
  const paymentType = cleanPaymentType(payload);

  let routeStop: RouteStopRow | null = null;
  let booking: BookingRow | null = null;
  let payment: PaymentRow | null = null;
  let visit: ServiceVisitRow | null = null;

  if (routeStopId) {
    const { data } = await admin
      .from("route_stops")
      .select("*")
      .eq("id", routeStopId)
      .maybeSingle();
    routeStop = data ?? null;
    bookingId ||= routeStop?.booking_id ?? "";
    serviceVisitId ||= routeStop?.service_visit_id ?? "";
  }

  if (paymentId) {
    const { data, error } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "Payment record was not found." },
        { status: 404 },
      );
    }

    payment = data;
    bookingId ||= data.booking_id ?? "";
    serviceVisitId ||= data.service_visit_id ?? "";
  }

  if (bookingId) {
    const { data, error } = await admin
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Booking was not found." }, { status: 404 });
    }

    booking = data;
  }

  if (serviceVisitId) {
    const { data } = await admin
      .from("service_visits")
      .select("*")
      .eq("id", serviceVisitId)
      .maybeSingle();
    visit = data ?? null;
    bookingId ||= visit?.booking_id ?? "";
  }

  if (!booking && visit?.booking_id) {
    const { data } = await admin
      .from("bookings")
      .select("*")
      .eq("id", visit.booking_id)
      .maybeSingle();
    booking = data ?? null;
  }

  if (!booking && !payment && !requestedCustomerId) {
    return NextResponse.json(
      { error: "Provide booking_id, service_visit_id, payment_id, or customer_id." },
      { status: 400 },
    );
  }

  const isFieldUser = isFieldRole(auth.profile.role);
  const effectiveCustomerId =
    booking?.customer_id ??
    payment?.customer_id ??
    requestedCustomerId ??
    auth.userId;
  const ownsPayment = effectiveCustomerId === auth.userId;

  if (!isFieldUser && !ownsPayment) {
    return NextResponse.json(
      { error: "You cannot create a link for this payment." },
      { status: 403 },
    );
  }

  const profile =
    effectiveCustomerId && effectiveCustomerId !== auth.userId
      ? (
          await admin
            .from("profiles")
            .select("*")
            .eq("id", effectiveCustomerId)
            .maybeSingle()
        ).data ?? auth.profile
      : auth.profile;

  const frequency = cleanFrequency(payload, booking?.frequency ?? null);
  const binCountRaw = payload.bin_count ?? payload.binCount;
  const binCount =
    typeof binCountRaw === "number"
      ? binCountRaw
      : typeof binCountRaw === "string"
        ? Number(binCountRaw)
        : booking?.bin_count ?? 0;
  const addOns = cleanAddOns(payload, booking?.add_ons ?? []);
  const amount = cleanAmount(payload, payment?.amount ?? booking?.estimated_price ?? 0);

  if (amount <= 0) {
    return NextResponse.json(
      { error: "Payment amount must be greater than zero." },
      { status: 400 },
    );
  }

  const customerEmail = booking?.email ?? profile.email ?? auth.email;
  const customerName =
    booking
      ? `${booking.first_name} ${booking.last_name}`.trim()
      : [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  let stripeCustomerId = profile.stripe_customer_id ?? payment?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: customerEmail ?? undefined,
        name: customerName || undefined,
        metadata: {
          profile_id: profile.id,
          source: "clean_curb_co",
        },
      });
      stripeCustomerId = customer.id;
    } catch (error) {
      return stripePermissionError("customers.write", error, {
        requestId,
        userId: auth.userId,
        role: auth.profile.role,
        customerId: effectiveCustomerId,
        bookingId: booking?.id ?? null,
      });
    }

    await admin
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", profile.id);
  }

  const description =
    cleanText(payload, "description") ||
    (booking
      ? `Clean Curb Co. service at ${formatBookingAddress(booking)}`
      : "Clean Curb Co. service");

  let paymentRecord = payment;
  const paymentMetadata = {
    booking_id: booking?.id ?? "",
    customer_id: effectiveCustomerId,
    service_visit_id: visit?.id ?? "",
    route_stop_id: routeStop?.id ?? routeStopId,
    frequency: frequency ?? "",
    bin_count: Number.isFinite(binCount) ? binCount : "",
    add_ons: addOns,
    payment_type: paymentType,
    source: "clean_curb_co",
  };

  if (!paymentRecord) {
    const { data, error } = await admin
      .from("payments")
      .insert({
        customer_id: effectiveCustomerId || null,
        booking_id: booking?.id ?? null,
        service_visit_id: visit?.id ?? null,
        amount,
        currency,
        status: "pending",
        provider: "stripe",
        stripe_customer_id: stripeCustomerId,
        description,
        payment_type: paymentType,
        metadata: paymentMetadata,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not create payment record." },
        { status: 500 },
      );
    }
    paymentRecord = data;
  }

  const recurringCount =
    booking && payload.forceOneTime !== true && paymentType === "booking"
      ? recurringIntervalCount(frequency)
      : null;
  const mode: Stripe.Checkout.SessionCreateParams.Mode = recurringCount
    ? "subscription"
    : "payment";
  const returnPath = safeReturnPath(payload.returnPath, auth.profile.role);
  const siteUrl = getSiteUrl();
  const stripeMetadata = stringifyMetadata({
    ...paymentMetadata,
    payment_id: paymentRecord.id,
  });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode,
      customer: stripeCustomerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount * 100,
            product_data: {
              name:
                mode === "subscription"
                  ? "Clean Curb Co. recurring bin cleaning"
                  : "Clean Curb Co. service payment",
              description,
              metadata: stripeMetadata,
            },
            recurring: recurringCount
              ? {
                  interval: "month",
                  interval_count: recurringCount,
                }
              : undefined,
          },
        },
      ],
      success_url: `${siteUrl}${returnPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${returnPath}?payment=cancelled`,
      metadata: stripeMetadata,
      ...(mode === "payment"
        ? {
            payment_intent_data: {
              metadata: stripeMetadata,
            },
          }
        : {
            subscription_data: {
              metadata: stripeMetadata,
            },
          }),
    });
  } catch (error) {
    return stripePermissionError(
      mode === "subscription"
        ? "checkout.sessions.write/subscriptions.write/prices.write"
        : "checkout.sessions.write/payment_intents.write/prices.write",
      error,
      {
        requestId,
        userId: auth.userId,
        role: auth.profile.role,
        customerId: effectiveCustomerId,
        bookingId: booking?.id ?? null,
      },
    );
  }

  const checkoutUrl = session.url ?? "";
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  await admin
    .from("payments")
    .update({
      amount,
      currency,
      status: "pending",
      provider: "stripe",
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      checkout_url: checkoutUrl,
      description,
      payment_type: paymentType,
      metadata: {
        ...paymentMetadata,
        payment_id: paymentRecord.id,
        stripe_mode: mode,
      },
    })
    .eq("id", paymentRecord.id);

  if (booking?.id) {
    await admin
      .from("bookings")
      .update({
        payment_status: "pending",
        payment_provider: "stripe",
        payment_link: checkoutUrl,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", booking.id);
  }

  logger.info("stripe_checkout_session_created", {
    requestId,
    route,
    action: "stripe_checkout_create",
    userId: auth.userId,
    role: auth.profile.role,
    customerId: effectiveCustomerId,
    bookingId: booking?.id ?? null,
    durationMs: Math.round(performance.now() - startedAt),
    metadata: {
      paymentId: paymentRecord.id,
      mode,
      paymentType,
      amount,
      currency,
    },
  });

  return NextResponse.json({
    checkoutUrl,
    paymentId: paymentRecord.id,
    stripeCheckoutSessionId: session.id,
    mode,
    requestId,
  });
}
