import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";
import { sendPaymentSetupCompleted } from "@/lib/email/sendOperationsEmail";
import { sendPaymentReceived } from "@/lib/email/sendPaymentReceived";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { createRequestId, logger } from "@/lib/server/logger";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow, PaymentRow, PaymentStatus, ProfileRow } from "@/types/database";

export const runtime = "nodejs";

type BookingPaymentStatus = "not_sent" | "pending" | "paid" | "failed" | "refunded";

function getStringId(
  value:
    | string
    | Stripe.PaymentIntent
    | Stripe.SetupIntent
    | Stripe.Subscription
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null,
) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithLegacySubscription = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | null;
      } | null;
    } | null;
  };
  const legacySubscription = invoiceWithLegacySubscription.subscription;
  if (typeof legacySubscription === "string") return legacySubscription;
  if (legacySubscription?.id) return legacySubscription.id;
  return invoiceWithLegacySubscription.parent?.subscription_details?.subscription ?? null;
}

async function findPayment(input: {
  paymentId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  subscriptionId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const queries: Array<[keyof PaymentRow, string | null | undefined]> = [
    ["id", input.paymentId],
    ["stripe_checkout_session_id", input.checkoutSessionId],
    ["stripe_payment_intent_id", input.paymentIntentId],
    ["stripe_subscription_id", input.subscriptionId],
  ];

  for (const [column, value] of queries) {
    if (!value) continue;
    const { data } = await admin
      .from("payments")
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function recordPaymentEvent(input: {
  payment?: PaymentRow | null;
  booking?: BookingRow | null;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdmin();
  try {
    await admin.from("service_events").insert({
      booking_id: input.booking?.id ?? input.payment?.booking_id ?? null,
      service_visit_id: input.payment?.service_visit_id ?? null,
      event_type: input.eventType,
      message: input.message,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Payment webhooks should not fail if optional service event logging is unavailable.
  }
}

async function updatePaymentState(input: {
  paymentId?: string | null;
  bookingId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  subscriptionId?: string | null;
  paymentStatus: PaymentStatus;
  bookingPaymentStatus?: BookingPaymentStatus;
  failureCode?: string | null;
  failureMessage?: string | null;
  sendReceipt?: boolean;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const existingPayment = await findPayment(input);
  const paymentId = input.paymentId ?? existingPayment?.id ?? null;

  const paymentUpdate = {
    status: input.paymentStatus,
    stripe_checkout_session_id: input.checkoutSessionId ?? undefined,
    stripe_payment_intent_id: input.paymentIntentId ?? undefined,
    stripe_subscription_id: input.subscriptionId ?? undefined,
    received_at: input.paymentStatus === "paid" ? now : undefined,
    metadata: {
      ...(existingPayment?.metadata ?? {}),
      ...(input.metadata ?? {}),
      last_stripe_event: input.eventType,
    },
  };

  if (paymentId) {
    await admin.from("payments").update(paymentUpdate).eq("id", paymentId);
  } else if (input.checkoutSessionId) {
    await admin
      .from("payments")
      .update(paymentUpdate)
      .eq("stripe_checkout_session_id", input.checkoutSessionId);
  } else if (input.paymentIntentId) {
    await admin
      .from("payments")
      .update(paymentUpdate)
      .eq("stripe_payment_intent_id", input.paymentIntentId);
  } else if (input.subscriptionId) {
    await admin
      .from("payments")
      .update(paymentUpdate)
      .eq("stripe_subscription_id", input.subscriptionId);
  }

  const payment = await findPayment({
    paymentId,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: input.paymentIntentId,
    subscriptionId: input.subscriptionId,
  });

  const bookingId = input.bookingId || payment?.booking_id || "";
  let booking: BookingRow | null = null;

  if (bookingId) {
    const { data: previousBooking } = await admin
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (previousBooking) {
      const preserveExistingPaidBooking =
        previousBooking.payment_status === "paid" &&
        input.bookingPaymentStatus !== "refunded";

      const bookingUpdate: Partial<BookingRow> = {
        stripe_checkout_session_id:
          input.checkoutSessionId ??
          previousBooking.stripe_checkout_session_id,
        stripe_payment_intent_id:
          input.paymentIntentId ??
          previousBooking.stripe_payment_intent_id,
        stripe_subscription_id:
          input.subscriptionId ??
          previousBooking.stripe_subscription_id,
      };

      if (!preserveExistingPaidBooking && input.bookingPaymentStatus) {
        bookingUpdate.payment_status = input.bookingPaymentStatus;
        bookingUpdate.payment_provider = "stripe";
        bookingUpdate.payment_preference = "stripe";
        bookingUpdate.payment_due_at_service = false;
        bookingUpdate.payment_verification_status = "not_required";
      }

      if (
        !preserveExistingPaidBooking &&
        input.bookingPaymentStatus === "paid"
      ) {
        bookingUpdate.paid_at = now;
        bookingUpdate.payment_failed_at = null;
        bookingUpdate.payment_failure_code = null;
        bookingUpdate.payment_failure_message = null;
      }

      if (
        !preserveExistingPaidBooking &&
        input.bookingPaymentStatus === "failed"
      ) {
        bookingUpdate.payment_failed_at = now;
        bookingUpdate.payment_failure_code =
          input.failureCode ?? null;
        bookingUpdate.payment_failure_message =
          input.failureMessage ??
          "Stripe reported an unsuccessful payment attempt.";
      }

      const { data } = await admin
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", bookingId)
        .select("*")
        .maybeSingle();

      booking = data ?? previousBooking;
    }
  }

  await recordPaymentEvent({
    payment,
    booking,
    eventType: `stripe_${input.eventType}`,
    message: `Stripe payment status updated to ${input.paymentStatus}.`,
    metadata: {
      ...(input.metadata ?? {}),
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
    },
  });

  if (input.sendReceipt && booking && payment?.amount) {
    await sendPaymentReceived(booking, payment.amount);
  }
}
async function updatePaymentSetupState(input: {
  session: Stripe.Checkout.Session;
  requestId: string;
  status: "completed" | "cancelled" | "failed";
}) {
  const admin = getSupabaseAdmin();
  const bookingId = input.session.metadata?.booking_id ?? null;
  if (!bookingId) return;

  const { data: previousBooking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!previousBooking) return;

  const stripeCustomerId = getStringId(input.session.customer);
  const completed = input.status === "completed";
  const { data: booking } = await admin
    .from("bookings")
    .update({
      payment_setup_status: input.status,
      payment_method_on_file: completed,
      payment_setup_completed_at: completed ? new Date().toISOString() : null,
      stripe_setup_session_id: input.session.id,
      stripe_customer_id: stripeCustomerId ?? previousBooking.stripe_customer_id,
      payment_provider: "stripe",
    })
    .eq("id", previousBooking.id)
    .select("*")
    .single();

  if (booking?.customer_id && stripeCustomerId) {
    const profileUpdate: Partial<ProfileRow> = {
      stripe_customer_id: stripeCustomerId,
    };
    if (completed) {
      profileUpdate.payment_method_on_file = true;
      profileUpdate.payment_setup_completed_at = booking.payment_setup_completed_at;
    }

    await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", booking.customer_id);
  }

  await recordPaymentEvent({
    booking: booking ?? previousBooking,
    eventType: `stripe_payment_setup_${input.status}`,
    message: `Stripe payment setup ${input.status}.`,
    metadata: {
      checkoutSessionId: input.session.id,
      setupIntentId: getStringId(input.session.setup_intent),
      purpose: input.session.metadata?.purpose ?? "payment_setup",
    },
  });

  await Promise.allSettled([
    writeAdminAuditLog({
      action: `payment_setup_${input.status}`,
      actor_user_id: null,
      actor_email: null,
      actor_role: "stripe",
      target_type: "booking",
      target_id: previousBooking.id,
      customer_id: previousBooking.customer_id,
      booking_id: previousBooking.id,
      before_summary: {
        paymentSetupStatus: previousBooking.payment_setup_status,
        paymentMethodOnFile: previousBooking.payment_method_on_file,
      },
      after_summary: {
        paymentSetupStatus: input.status,
        paymentMethodOnFile: completed,
        stripeSetupSessionId: input.session.id,
      },
      request_id: input.requestId,
      status: "success",
      metadata: {
        stripeEvent: "checkout.session.completed",
        purpose: input.session.metadata?.purpose ?? "payment_setup",
      },
    }),
    createAdminNotification({
      type: completed ? "payment_setup_completed" : "payment_setup_failed",
      title: completed ? "Payment setup completed" : "Payment setup not completed",
      message: completed
        ? `${previousBooking.first_name} ${previousBooking.last_name} added payment information.`
        : `${previousBooking.first_name} ${previousBooking.last_name} did not complete payment setup.`,
      href: `/admin/bookings?q=${previousBooking.id}`,
      customer_id: previousBooking.customer_id,
      booking_id: previousBooking.id,
      severity: completed ? "info" : "warning",
    }),
    completed && booking
      ? sendPaymentSetupCompleted(booking)
      : Promise.resolve({ status: "skipped" as const, reason: "Not completed." }),
  ]);
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/stripe/webhook";
  const { webhookSecret } = getStripeEnv();
  if (!webhookSecret) {
    logger.error("stripe_webhook_secret_missing", { requestId, route });
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured.", requestId },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    logger.warn("stripe_webhook_signature_missing", { requestId, route });
    return NextResponse.json(
      { error: "Missing Stripe signature.", requestId },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook.";
    logger.warn("stripe_webhook_signature_invalid", {
      requestId,
      route,
      error,
    });
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup" || session.metadata?.purpose === "payment_setup") {
          await updatePaymentSetupState({
            session,
            requestId,
            status: "completed",
          });
          break;
        }
        const paymentStatus: PaymentStatus =
          session.payment_status === "paid" ? "paid" : "pending";
        const bookingStatus: BookingPaymentStatus =
          session.payment_status === "paid" ? "paid" : "pending";
        await updatePaymentState({
          paymentId: session.metadata?.payment_id ?? null,
          bookingId: session.metadata?.booking_id ?? null,
          checkoutSessionId: session.id,
          paymentIntentId: getStringId(session.payment_intent),
          subscriptionId: getStringId(session.subscription),
          paymentStatus,
          bookingPaymentStatus: bookingStatus,
          sendReceipt: paymentStatus === "paid",
          eventType: event.type,
          metadata: session.metadata ?? {},
        });
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup" || session.metadata?.purpose === "payment_setup") {
          await updatePaymentSetupState({
            session,
            requestId,
            status: "cancelled",
          });
          break;
        }
        await updatePaymentState({
          paymentId: session.metadata?.payment_id ?? null,
          bookingId: session.metadata?.booking_id ?? null,
          checkoutSessionId: session.id,
          paymentIntentId: getStringId(session.payment_intent),
          subscriptionId: getStringId(session.subscription),
          paymentStatus: "cancelled",
          bookingPaymentStatus: "pending",
          eventType: event.type,
          metadata: session.metadata ?? {},
        });
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentState({
          paymentId: intent.metadata?.payment_id ?? null,
          bookingId: intent.metadata?.booking_id ?? null,
          paymentIntentId: intent.id,
          paymentStatus: "paid",
          bookingPaymentStatus: "paid",
          eventType: event.type,
          metadata: intent.metadata ?? {},
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentState({
          paymentId: intent.metadata?.payment_id ?? null,
          bookingId: intent.metadata?.booking_id ?? null,
          paymentIntentId: intent.id,
          paymentStatus: "failed",
          bookingPaymentStatus: "failed",
          failureCode: intent.last_payment_error?.code ?? null,
          failureMessage: intent.last_payment_error?.message ?? null,
          eventType: event.type,
          metadata: intent.metadata ?? {},
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await updatePaymentState({
          paymentId: subscription.metadata?.payment_id ?? null,
          bookingId: subscription.metadata?.booking_id ?? null,
          subscriptionId: subscription.id,
          paymentStatus:
            subscription.status === "active" || subscription.status === "trialing"
              ? "paid"
              : "pending",
          bookingPaymentStatus:
            subscription.status === "active" || subscription.status === "trialing"
              ? "paid"
              : "pending",
          eventType: event.type,
          metadata: subscription.metadata ?? {},
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updatePaymentState({
          paymentId: subscription.metadata?.payment_id ?? null,
          bookingId: subscription.metadata?.booking_id ?? null,
          subscriptionId: subscription.id,
          paymentStatus: "cancelled",
          eventType: event.type,
          metadata: subscription.metadata ?? {},
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await updatePaymentState({
          subscriptionId: getInvoiceSubscriptionId(invoice),
          paymentStatus: "paid",
          bookingPaymentStatus: "paid",
          eventType: event.type,
          metadata: invoice.metadata ?? {},
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await updatePaymentState({
          subscriptionId: getInvoiceSubscriptionId(invoice),
          paymentStatus: "failed",
          bookingPaymentStatus: "failed",
          eventType: event.type,
          metadata: invoice.metadata ?? {},
        });
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await updatePaymentState({
          paymentIntentId: getStringId(charge.payment_intent),
          paymentStatus: "refunded",
          bookingPaymentStatus: "refunded",
          eventType: event.type,
          metadata: charge.metadata ?? {},
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logger.error("stripe_webhook_processing_failed", {
      requestId,
      route,
      error,
      metadata: { eventId: event.id, eventType: event.type },
    });
    return NextResponse.json(
      { error: "Stripe webhook processing failed.", requestId },
      { status: 500 },
    );
  }

  logger.info("stripe_webhook_processed", {
    requestId,
    route,
    metadata: { eventId: event.id, eventType: event.type },
  });

  return NextResponse.json({ received: true });
}
