import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getSiteUrl,
  getStripeEnv,
  isStripeConfigured,
} from "@/lib/env";
import { createRequestId, logger } from "@/lib/server/logger";
import { rejectCrossOriginRequest } from "@/lib/server/request-guards";
import { safeRedirectForRole } from "@/lib/security/redirects";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/auth";

type AccountPaymentSetupPayload = {
  returnPath?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(
    request.headers,
  );

  const route =
    "/api/stripe/create-account-payment-setup-session";

  const originRejection =
    rejectCrossOriginRequest(request, {
      requestId,
      route,
      action:
        "stripe_account_payment_setup_create",
    });

  if (originRejection) {
    return originRejection;
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe payment setup is not configured yet.",
        requestId,
      },
      {
        status: 503,
      },
    );
  }

  const auth = await getCurrentProfile();

  if (auth.status !== "ok") {
    return NextResponse.json(
      {
        error:
          "Please sign in before managing your payment method.",
        requestId,
      },
      {
        status: 401,
      },
    );
  }

  let payload: AccountPaymentSetupPayload = {};

  try {
    payload =
      (await request.json()) as AccountPaymentSetupPayload;
  } catch {
    // The return path is optional.
  }

  const returnPath =
    safeRedirectForRole(
      auth.profile.role,
      payload.returnPath,
      "/portal/billing",
    ) ?? "/portal/billing";

  const stripe = getStripe();
  const admin = getSupabaseAdmin();

  let stripeCustomerId =
    auth.profile.stripe_customer_id;

  const customerEmail =
    auth.profile.email ?? auth.email;

  const customerName = [
    auth.profile.first_name,
    auth.profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!stripeCustomerId) {
    try {
      const customer =
        await stripe.customers.create({
          email: customerEmail || undefined,
          name: customerName || undefined,
          phone:
            auth.profile.phone || undefined,
          metadata: {
            profile_id: auth.userId,
            source:
              "clean_curb_co_customer_portal",
          },
        });

      stripeCustomerId = customer.id;
    } catch (error) {
      logger.error(
        "stripe_account_customer_create_failed",
        {
          requestId,
          route,
          action:
            "stripe_account_payment_setup_create",
          userId: auth.userId,
          customerId: auth.userId,
          error,
        },
      );

      return NextResponse.json(
        {
          error:
            "Stripe could not prepare your billing account.",
          requestId,
        },
        {
          status: 502,
        },
      );
    }
  }

  const metadata = {
    customer_id: auth.userId,
    profile_id: auth.userId,
    purpose: "payment_setup",
    source: "customer_portal",
  };

  const siteUrl = getSiteUrl();

  const encodedReturnPath =
    encodeURIComponent(returnPath);

  const successUrl =
    `${siteUrl}/payment-setup/success` +
    `?payment_setup=success` +
    `&returnPath=${encodedReturnPath}` +
    `&session_id={CHECKOUT_SESSION_ID}`;

  const cancelUrl =
    `${siteUrl}/payment-setup/success` +
    `?payment_setup=cancelled` +
    `&returnPath=${encodedReturnPath}`;

  const { currency } = getStripeEnv();

  let session: Stripe.Checkout.Session;

  try {
    session =
      await stripe.checkout.sessions.create({
        mode: "setup",
        currency: currency || "usd",
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        setup_intent_data: {
          metadata,
        },
      });
  } catch (error) {
    logger.error(
      "stripe_account_payment_setup_failed",
      {
        requestId,
        route,
        action:
          "stripe_account_payment_setup_create",
        userId: auth.userId,
        customerId: auth.userId,
        error,
      },
    );

    return NextResponse.json(
      {
        error:
          "Stripe could not open payment setup.",
        requestId,
      },
      {
        status: 502,
      },
    );
  }

  const { error: profileUpdateError } =
    await admin
      .from("profiles")
      .update({
        stripe_customer_id:
          stripeCustomerId,
      })
      .eq("id", auth.userId);

  if (profileUpdateError) {
    logger.error(
      "stripe_account_profile_update_failed",
      {
        requestId,
        route,
        userId: auth.userId,
        customerId: auth.userId,
        error: profileUpdateError,
      },
    );

    return NextResponse.json(
      {
        error:
          "Your Stripe account was created, but the portal could not save the connection.",
        requestId,
      },
      {
        status: 500,
      },
    );
  }

  logger.info(
    "stripe_account_payment_setup_created",
    {
      requestId,
      route,
      action:
        "stripe_account_payment_setup_create",
      userId: auth.userId,
      customerId: auth.userId,
      status: "created",
      metadata: {
        stripeCheckoutSessionId:
          session.id,
      },
    },
  );

  return NextResponse.json({
    checkoutUrl: session.url,
    stripeCheckoutSessionId:
      session.id,
    requestId,
  });
}
