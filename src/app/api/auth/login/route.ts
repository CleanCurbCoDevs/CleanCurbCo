import { NextResponse } from "next/server";
import { claimBookingForCustomer } from "@/lib/server/booking-customer-link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { safeRedirectForRole } from "@/lib/security/redirects";
import {
  defaultRouteForRole,
} from "@/lib/supabase/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString, isValidEmail } from "@/lib/validation";
import type { AppRole } from "@/types/database";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
  next?: unknown;
  bookingId?: unknown;
  claimToken?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/auth/login";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "auth_login",
  });
  if (originRejection) return originRejection;

  if (!isSupabaseConfigured()) {
    logger.warn("auth_login_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Login is being connected. Please contact Clean Curb Co.", requestId },
      { status: 503 },
    );
  }

  let body: LoginPayload;
  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    logger.warn("auth_login_invalid_json", { requestId, route });
    return NextResponse.json(
      { error: "We could not log you in. Please check your credentials.", requestId },
      { status: 400 },
    );
  }

  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const requestedNext = cleanString(body.next, 300);
  const bookingId = cleanString(body.bookingId, 80);
  const claimToken = cleanString(body.claimToken, 200);
  
  const ipLimited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "auth_login",
    scope: "auth-login-ip",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (ipLimited) return ipLimited;

  if (!isValidEmail(email) || !password) {
    logger.warn("auth_login_invalid_payload", {
      requestId,
      route,
      metadata: { hasEmail: Boolean(email), hasPassword: Boolean(password) },
    });
    return NextResponse.json(
      { error: "We could not log you in. Please check your credentials.", requestId },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    const failedLimited = rejectLimitedRequest(request, {
      requestId,
      route,
      action: "auth_login_failed",
      scope: "auth-login-failed",
      subject: email,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (failedLimited) return failedLimited;

    logger.warn("auth_login_failed", {
      requestId,
      route,
      metadata: { email },
      error,
    });
    return NextResponse.json(
      { error: "We could not log you in. Please check your credentials.", requestId },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (
    profile?.role ?? "customer"
  ) as AppRole;

  const fallbackRoute =
    defaultRouteForRole(role);

  const redirectTo = safeRedirectForRole(
    role,
    requestedNext,
    fallbackRoute,
  );

  let bookingClaimed = false;

  if (
    bookingId &&
    claimToken &&
    role === "customer"
  ) {
    const authenticatedEmail =
      data.user.email
        ?.trim()
        .toLowerCase() ?? "";

    if (!authenticatedEmail) {
      logger.warn(
        "login_booking_claim_missing_email",
        {
          requestId,
          route,
          userId: data.user.id,
          bookingId,
        },
      );
    } else {
      const linkResult =
        await claimBookingForCustomer({
          bookingId,
          claimToken,
          customerId: data.user.id,
          customerEmail:
            authenticatedEmail,
          requestId,
          route,
        });

      bookingClaimed = linkResult.ok;
    }
  } else if (
    bookingId &&
    claimToken
  ) {
    logger.warn(
      "login_booking_claim_role_rejected",
      {
        requestId,
        route,
        userId: data.user.id,
        role,
        bookingId,
      },
    );
  }
  logger.info("auth_login_success", {
    requestId,
    route,
    userId: data.user.id,
    role,
    metadata: {
      usedRequestedNext: redirectTo === requestedNext,
      bookingClaimed,
    },
  });

  const finalRedirectTo =
    bookingId &&
    claimToken &&
    role === "customer"
      ? bookingClaimed
        ? "/portal?bookingLink=success"
        : "/portal?bookingLink=failed"
      : redirectTo;
  
  return NextResponse.json({
    redirectTo: finalRedirectTo,
    requestId,
  });
}
