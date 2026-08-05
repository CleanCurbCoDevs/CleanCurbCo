import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSiteUrl, getStripeEnv, isStripeConfigured } from "@/lib/env";
import { formatBookingAddress } from "@/lib/booking-utils";
import { getFoundingNeighborSpecialStatus } from "@/lib/pricing";
import { rejectCrossOriginRequest } from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { safeRedirectForRole } from "@/lib/security/redirects";
import { getStripe } from "@/lib/stripe";
import {
  getAuthorizedFieldStopBundle,
} from "@/lib/server/field-access";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isAdminRole,
  isFieldRole,
} from "@/lib/supabase/roles";
import {
  failStripeCheckout,
  finalizeStripeCheckout,
  reserveStripeCheckout,
} from "@/lib/server/payment-operations";
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

function cleanAmount(
  payload: CheckoutPayload,
  fallback: number,
) {
  const rawAmount =
    payload.amount;

  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount ===
          "string"
        ? Number(rawAmount)
        : fallback;

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  return Math.round(
    amount * 100,
  ) / 100;
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
  const fallback = isFieldRole(role) ? "/field/today" : "/portal/billing";
  return safeRedirectForRole(role, value, fallback) ?? fallback;
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
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "stripe_checkout_create",
  });
  if (originRejection) return originRejection;

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
  let routeStopId = cleanId(payload, "route_stop_id", "routeStopId");
  const requestedCustomerId = cleanId(payload, "customer_id", "customerId");
  const requestedPaymentType =
    cleanPaymentType(payload);

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

  if (
    routeStop &&
    visit &&
    routeStop.service_visit_id &&
    routeStop.service_visit_id !==
      visit.id
  ) {
    return NextResponse.json(
      {
        error:
          "The route stop and service visit do not match.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    routeStop &&
    booking &&
    routeStop.booking_id &&
    routeStop.booking_id !==
      booking.id
  ) {
    return NextResponse.json(
      {
        error:
          "The route stop and booking do not match.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    visit &&
    booking &&
    visit.booking_id &&
    visit.booking_id !==
      booking.id
  ) {
    return NextResponse.json(
      {
        error:
          "The service visit and booking do not match.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    payment &&
    booking &&
    payment.booking_id &&
    payment.booking_id !==
      booking.id
  ) {
    return NextResponse.json(
      {
        error:
          "The payment record does not belong to this booking.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    payment &&
    visit &&
    payment.service_visit_id &&
    payment.service_visit_id !==
      visit.id
  ) {
    return NextResponse.json(
      {
        error:
          "The payment record does not belong to this service visit.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    requestedCustomerId &&
    booking?.customer_id &&
    requestedCustomerId !==
      booking.customer_id
  ) {
    return NextResponse.json(
      {
        error:
          "The requested customer does not own this booking.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }
  
  if (
    auth.profile.role ===
    "technician"
  ) {
    const access =
      await getAuthorizedFieldStopBundle(
        {
          auth,
          routeStopId:
            routeStop?.id ??
            routeStopId,
          visitId:
            visit?.id ??
            serviceVisitId,
          bookingId:
            booking?.id ??
            bookingId,
        },
      );
  
    if (!access.ok) {
      logger.warn(
        "stripe_checkout_field_access_denied",
        {
          requestId,
          route,
          action:
            "stripe_checkout_create",
          userId:
            auth.userId,
          role:
            auth.profile.role,
          bookingId:
            booking?.id ??
            bookingId ??
            null,
          metadata: {
            routeStopId:
              routeStop?.id ??
              routeStopId ??
              null,
            serviceVisitId:
              visit?.id ??
              serviceVisitId ??
              null,
            reason:
              access.message,
          },
        },
      );
  
      return NextResponse.json(
        {
          error:
            access.message,
          requestId,
        },
        {
          status:
            access.status,
        },
      );
    }
  
    routeStop =
      access.stop;
  
    visit =
      access.visit;
  
    booking =
      access.booking;
  
    routeStopId =
      access.stop.id;
  
    serviceVisitId =
      access.visit.id;
  
    bookingId =
      access.booking.id;
  
    if (
      payment &&
      (
        (
          payment.booking_id &&
          payment.booking_id !==
            access.booking.id
        ) ||
        (
          payment.service_visit_id &&
          payment.service_visit_id !==
            access.visit.id
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The payment record is not attached to your assigned field stop.",
          requestId,
        },
        {
          status: 403,
        },
      );
    }
  }
  
  if (!booking && !payment && !requestedCustomerId) {
    return NextResponse.json(
      { error: "Provide booking_id, service_visit_id, payment_id, or customer_id." },
      { status: 400 },
    );
  }

  const isFieldUser =
    isFieldRole(
      auth.profile.role,
    );

  const isAdminUser =
    isAdminRole(
      auth.profile.role,
    );

  const effectiveCustomerId =
    booking?.customer_id ??
    payment?.customer_id ??
    (
      requestedCustomerId ||
      (
        auth.profile.role ===
        "customer"
          ? auth.userId
          : null
      )
    );

  const ownsPayment =
    Boolean(
      effectiveCustomerId,
    ) &&
    effectiveCustomerId ===
      auth.userId;

  if (
    !isFieldUser &&
    !ownsPayment
  ) {
    return NextResponse.json(
      {
        error:
          "You cannot create a link for this payment.",
        requestId,
      },
      {
        status: 403,
      },
    );
  }

  if (
    !isAdminUser &&
    !booking &&
    !payment
  ) {
    return NextResponse.json(
      {
        error:
          "A customer or technician checkout must be linked to an existing booking or payment.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }

  let customerProfile:
    | ProfileRow
    | null =
      effectiveCustomerId ===
      auth.userId
        ? auth.profile
        : null;

  if (
    effectiveCustomerId &&
    effectiveCustomerId !==
      auth.userId
  ) {
    const {
      data,
      error,
    } = await admin
      .from("profiles")
      .select("*")
      .eq(
        "id",
        effectiveCustomerId,
      )
      .maybeSingle();

    if (error) {
      logger.error(
        "stripe_checkout_profile_lookup_failed",
        {
          requestId,
          route,
          action:
            "stripe_checkout_create",
          userId:
            auth.userId,
          role:
            auth.profile.role,
          customerId:
            effectiveCustomerId,
          bookingId:
            booking?.id ??
            null,
          error,
        },
      );

      return NextResponse.json(
        {
          error:
            "The customer payment profile could not be loaded.",
          requestId,
        },
        {
          status: 500,
        },
      );
    }

    customerProfile =
      data ?? null;
  }

  const existingPaymentType =
    payment?.payment_type &&
    validPaymentTypes.includes(
      payment.payment_type as PaymentType,
    )
      ? (
          payment.payment_type as PaymentType
        )
      : null;

  const paymentType:
    PaymentType =
      isAdminUser
        ? requestedPaymentType
        : existingPaymentType ??
          (
            requestedPaymentType ===
            "booking"
              ? "booking"
              : "payment_link"
          );

  if (
    payment?.status ===
      "paid" ||
    payment?.status ===
      "refunded"
  ) {
    return NextResponse.json(
      {
        error:
          "This payment is already settled.",
        requestId,
      },
      {
        status: 409,
      },
    );
  }

  if (
    !isAdminUser &&
    booking?.payment_status ===
      "paid"
  ) {
    return NextResponse.json(
      {
        error:
          "This booking is already paid.",
        requestId,
      },
      {
        status: 409,
      },
    );
  }

  if (
    isAdminUser &&
    booking?.payment_status ===
      "paid" &&
    (
      paymentType ===
        "booking" ||
      paymentType ===
        "payment_link"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The booking is already paid. Use an add-on or manual-invoice payment type for a separate charge.",
        requestId,
      },
      {
        status: 409,
      },
    );
  }

  const existingAmount =
    Number(
      payment?.total_amount ??
      payment?.amount ??
      booking?.estimated_price ??
      0,
    );

  const requestedAmount =
    cleanAmount(
      payload,
      existingAmount,
    );

  const amount =
    isAdminUser
      ? requestedAmount
      : existingAmount;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 50000
  ) {
    return NextResponse.json(
      {
        error:
          "Payment amount must be between $0.01 and $50,000.",
        requestId,
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isAdminUser &&
    Number.isFinite(
      requestedAmount,
    ) &&
    Math.abs(
      requestedAmount -
      amount,
    ) >= 0.01
  ) {
    logger.warn(
      "stripe_checkout_client_amount_ignored",
      {
        requestId,
        route,
        action:
          "stripe_checkout_create",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          effectiveCustomerId,
        bookingId:
          booking?.id ??
          null,
        metadata: {
          requestedAmount,
          authoritativeAmount:
            amount,
        },
      },
    );
  }

  const amountCents =
    Math.round(
      amount * 100,
    );

  const frequency =
    booking
      ? booking.frequency
      : cleanFrequency(
          payload,
          null,
        );

  const binCount =
    booking
      ? booking.bin_count
      : Number(
          payload.bin_count ??
          payload.binCount ??
          0,
        );

  const addOns =
    booking
      ? booking.add_ons
      : cleanAddOns(
          payload,
          [],
        );

  const customerEmail =
    booking?.email ??
    customerProfile?.email ??
    auth.email;

  const customerName =
    booking
      ? `${booking.first_name} ${booking.last_name}`.trim()
      : [
          customerProfile
            ?.first_name,
          customerProfile
            ?.last_name,
        ]
          .filter(Boolean)
          .join(" ");

  const description =
    isAdminUser
      ? (
          cleanText(
            payload,
            "description",
          ) ||
          (
            booking
              ? `Clean Curb Co. service at ${formatBookingAddress(
                  booking,
                )}`
              : "Clean Curb Co. service"
          )
        )
      : payment?.description ??
        (
          booking
            ? `Clean Curb Co. service at ${formatBookingAddress(
                booking,
              )}`
            : "Clean Curb Co. service"
        );

  let stripeCustomerId =
    booking
      ?.stripe_customer_id ??
    customerProfile
      ?.stripe_customer_id ??
    payment
      ?.stripe_customer_id ??
    null;

  const paymentMetadata = {
    booking_id:
      booking?.id ?? "",
    customer_id:
      effectiveCustomerId ??
      "",
    service_visit_id:
      visit?.id ?? "",
    route_stop_id:
      routeStop?.id ??
      routeStopId,
    frequency:
      frequency ?? "",
    bin_count:
      Number.isFinite(
        binCount,
      )
        ? binCount
        : "",
    add_ons:
      addOns,
    payment_type:
      paymentType,
    source:
      "clean_curb_co",
    service_amount:
      amount,
    tip_amount:
      0,
    total_amount:
      amount,
  };

  const reservation =
    await reserveStripeCheckout(
      admin,
      {
        paymentId:
          paymentId ||
          null,
        customerId:
          effectiveCustomerId ??
          null,
        bookingId:
          booking?.id ??
          null,
        serviceVisitId:
          visit?.id ??
          null,
        amount,
        currency,
        description,
        paymentType,
        stripeCustomerId,
        metadata:
          paymentMetadata,
      },
    );

  if (!reservation.ok) {
    logger.error(
      "stripe_checkout_reservation_failed",
      {
        requestId,
        route,
        action:
          "stripe_checkout_create",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          effectiveCustomerId,
        bookingId:
          booking?.id ??
          null,
        error:
          reservation.error,
      },
    );

    return NextResponse.json(
      {
        error:
          reservation.message,
        requestId,
      },
      {
        status: 500,
      },
    );
  }

  if (
    reservation.data
      .reuseExisting &&
    reservation.data
      .checkoutUrl
  ) {
    return NextResponse.json({
      checkoutUrl:
        reservation.data
          .checkoutUrl,
      paymentId:
        reservation.data
          .paymentId,
      stripeCheckoutSessionId:
        reservation.data
          .stripeCheckoutSessionId ??
        null,
      reused:
        true,
      requestId,
    });
  }

  if (
    reservation.data
      .inProgress
  ) {
    return NextResponse.json(
      {
        error:
          "A payment link is already being created. Try again in a moment.",
        paymentId:
          reservation.data
            .paymentId,
        requestId,
      },
      {
        status: 409,
      },
    );
  }

  const reservedPaymentId =
    reservation.data
      .paymentId;

  const generation =
    reservation.data
      .generation;

  if (!stripeCustomerId) {
    try {
      const customer =
        await stripe.customers.create(
          {
            email:
              customerEmail ??
              undefined,
            name:
              customerName ||
              undefined,
            metadata: {
              profile_id:
                effectiveCustomerId ??
                "",
              booking_id:
                booking?.id ??
                "",
              source:
                "clean_curb_co",
            },
          },
          {
            idempotencyKey:
              `payment-customer-${reservedPaymentId}-${generation}`,
          },
        );

      stripeCustomerId =
        customer.id;
    } catch (error) {
      await failStripeCheckout(
        admin,
        {
          paymentId:
            reservedPaymentId,
          generation,
          error:
            error instanceof
            Error
              ? error.message
              : "Stripe customer creation failed.",
          metadata: {
            failure_stage:
              "customer_creation",
          },
        },
      );

      return stripePermissionError(
        "customers.write",
        error,
        {
          requestId,
          userId:
            auth.userId,
          role:
            auth.profile.role,
          customerId:
            effectiveCustomerId,
          bookingId:
            booking?.id ??
            null,
        },
      );
    }

    const customerUpdates:
      Array<
        PromiseLike<{
          error:
            | unknown
            | null;
        }>
      > = [];

    if (customerProfile) {
      customerUpdates.push(
        admin
          .from("profiles")
          .update({
            stripe_customer_id:
              stripeCustomerId,
          })
          .eq(
            "id",
            customerProfile.id,
          ),
      );
    }

    if (booking) {
      customerUpdates.push(
        admin
          .from("bookings")
          .update({
            stripe_customer_id:
              stripeCustomerId,
          })
          .eq(
            "id",
            booking.id,
          ),
      );
    }

    const updateResults =
      await Promise.all(
        customerUpdates,
      );

    const customerSaveError =
      updateResults.find(
        (result) =>
          result.error,
      )?.error;

    if (customerSaveError) {
      logger.warn(
        "stripe_customer_id_save_incomplete",
        {
          requestId,
          route,
          action:
            "stripe_checkout_create",
          userId:
            auth.userId,
          role:
            auth.profile.role,
          customerId:
            effectiveCustomerId,
          bookingId:
            booking?.id ??
            null,
          error:
            customerSaveError,
          metadata: {
            stripeCustomerId,
          },
        },
      );
    }
  }

  const forceOneTime =
    payload.forceOneTime ===
    true;

  const recurringCount =
    booking &&
    !forceOneTime &&
    paymentType === "booking"
      ? recurringIntervalCount(
          frequency,
        )
      : null;

  const mode:
    Stripe.Checkout.SessionCreateParams.Mode =
      recurringCount
        ? "subscription"
        : "payment";

  const returnPath =
    safeReturnPath(
      payload.returnPath,
      auth.profile.role,
    );

  const siteUrl =
    getSiteUrl();

  const stripeMetadata =
    stringifyMetadata({
      ...paymentMetadata,
      payment_id:
        reservedPaymentId,
      checkout_generation:
        generation,

      founding_neighbor_special:
        booking
          ? getFoundingNeighborSpecialStatus(
              {
                binCount:
                  booking.bin_count,
                frequency:
                  booking.frequency,
                addOns:
                  booking.add_ons,
                neighborhood:
                  booking.neighborhood,
                createdAt:
                  booking.created_at,
                estimatedPrice:
                  amount,
              },
            ).status
          : "",
    });

  const encodedReturnPath =
    encodeURIComponent(
      returnPath,
    );

  let session:
    Stripe.Checkout.Session;

  try {
    session =
      await stripe.checkout.sessions.create(
        {
          mode,
          customer:
            stripeCustomerId,

          line_items: [
            {
              quantity: 1,

              price_data: {
                currency,

                unit_amount:
                  amountCents,

                product_data: {
                  name:
                    mode ===
                    "subscription"
                      ? "Clean Curb Co. recurring bin cleaning"
                      : "Clean Curb Co. service payment",

                  description,

                  metadata:
                    stripeMetadata,
                },

                recurring:
                  recurringCount
                    ? {
                        interval:
                          "month",

                        interval_count:
                          recurringCount,
                      }
                    : undefined,
              },
            },
          ],

          success_url:
            `${siteUrl}/billing/success` +
            `?payment=success` +
            `&returnPath=${encodedReturnPath}` +
            `&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${siteUrl}/billing/success` +
            `?payment=cancelled` +
            `&returnPath=${encodedReturnPath}`,

          metadata:
            stripeMetadata,

          ...(mode ===
          "payment"
            ? {
                payment_intent_data:
                  {
                    metadata:
                      stripeMetadata,
                  },
              }
            : {
                subscription_data:
                  {
                    metadata:
                      stripeMetadata,
                  },
              }),
        },
        {
          idempotencyKey:
            `payment-checkout-${reservedPaymentId}-${generation}`,
        },
      );
  } catch (error) {
    await failStripeCheckout(
      admin,
      {
        paymentId:
          reservedPaymentId,
        generation,
        error:
          error instanceof
          Error
            ? error.message
            : "Stripe checkout creation failed.",
        metadata: {
          failure_stage:
            "session_creation",
          stripe_mode:
            mode,
        },
      },
    );

    return stripePermissionError(
      mode ===
      "subscription"
        ? "checkout.sessions.write/subscriptions.write/prices.write"
        : "checkout.sessions.write/payment_intents.write/prices.write",
      error,
      {
        requestId,
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          effectiveCustomerId,
        bookingId:
          booking?.id ??
          null,
      },
    );
  }

  const checkoutUrl =
    session.url ?? "";

  if (!checkoutUrl) {
    await failStripeCheckout(
      admin,
      {
        paymentId:
          reservedPaymentId,
        generation,
        error:
          "Stripe created a session without a checkout URL.",
        metadata: {
          failure_stage:
            "missing_checkout_url",
          stripe_checkout_session_id:
            session.id,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "Stripe created an incomplete checkout session.",
        requestId,
      },
      {
        status: 502,
      },
    );
  }

  const paymentIntentId =
    typeof session.payment_intent ===
    "string"
      ? session.payment_intent
      : null;

  const subscriptionId =
    typeof session.subscription ===
    "string"
      ? session.subscription
      : null;

  const finalization =
    await finalizeStripeCheckout(
      admin,
      {
        paymentId:
          reservedPaymentId,
        generation,
        stripeCustomerId,
        checkoutSessionId:
          session.id,
        paymentIntentId,
        subscriptionId,
        checkoutUrl,
        metadata: {
          ...paymentMetadata,
          payment_id:
            reservedPaymentId,
          stripe_mode:
            mode,
          checkout_started_at:
            new Date().toISOString(),
        },
      },
    );

  if (!finalization.ok) {
    let expirationError:
      unknown = null;

    try {
      if (
        session.status ===
        "open"
      ) {
        await stripe
          .checkout
          .sessions
          .expire(
            session.id,
          );
      }
    } catch (error) {
      expirationError =
        error;
    }

    await failStripeCheckout(
      admin,
      {
        paymentId:
          reservedPaymentId,
        generation,
        error:
          finalization.message,
        metadata: {
          failure_stage:
            "database_finalization",
          stripe_checkout_session_id:
            session.id,
          stripe_session_expiration_failed:
            Boolean(
              expirationError,
            ),
        },
      },
    );

    logger.error(
      "stripe_checkout_database_finalization_failed",
      {
        requestId,
        route,
        action:
          "stripe_checkout_create",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          effectiveCustomerId,
        bookingId:
          booking?.id ??
          null,
        error:
          finalization.error ??
          expirationError,
        metadata: {
          paymentId:
            reservedPaymentId,
          stripeCheckoutSessionId:
            session.id,
          generation,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "Stripe Checkout could not be safely attached to the payment record. No usable link was returned.",
        requestId,
      },
      {
        status: 500,
      },
    );
  }

  logger.info(
    "stripe_checkout_session_created",
    {
      requestId,
      route,
      action:
        "stripe_checkout_create",
      userId:
        auth.userId,
      role:
        auth.profile.role,
      customerId:
        effectiveCustomerId,
      bookingId:
        booking?.id ??
        null,
      durationMs:
        Math.round(
          performance.now() -
          startedAt,
        ),
      metadata: {
        paymentId:
          reservedPaymentId,
        mode,
        paymentType,
        amount,
        amountCents,
        currency,
        generation,
      },
    },
  );

  return NextResponse.json({
    checkoutUrl,
    paymentId:
      reservedPaymentId,
    stripeCheckoutSessionId:
      session.id,
    mode,
    reused:
      false,
    requestId,
  });
}
