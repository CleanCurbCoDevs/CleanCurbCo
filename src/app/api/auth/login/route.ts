import { NextResponse } from "next/server";
import { hashClaimToken } from "@/lib/booking-claims";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

async function claimBookingAfterLogin(input: {
  bookingId: string;
  claimToken: string;
  userId: string;
  requestId: string;
}) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: claim, error: claimError } = await admin
    .from("booking_claims")
    .select("*")
    .eq("booking_id", input.bookingId)
    .eq("token_hash", hashClaimToken(input.claimToken))
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  
  if (claimError || !claim) {
    logger.warn("login_booking_claim_invalid", {
      requestId: input.requestId,
      route: "/api/auth/login",
      userId: input.userId,
      bookingId: input.bookingId,
      error: claimError,
    });
  
    return false;
  }

  const { data: booking, error: bookingLookupError } =
    await admin
      .from("bookings")
      .select("*")
      .eq("id", input.bookingId)
      .maybeSingle();
  
  if (bookingLookupError || !booking) {
    logger.warn("login_booking_claim_booking_missing", {
      requestId: input.requestId,
      route: "/api/auth/login",
      userId: input.userId,
      bookingId: input.bookingId,
      error: bookingLookupError,
    });
  
    return false;
  }

  if (booking.customer_id === input.userId) {
    await admin
      .from("booking_claims")
      .update({
        used_at: now,
      })
      .eq("id", claim.id);
  
    logger.info("login_booking_claim_already_connected", {
      requestId: input.requestId,
      route: "/api/auth/login",
      userId: input.userId,
      customerId: input.userId,
      bookingId: booking.id,
    });
  
    return true;
  }
    
  if (
    booking.customer_id &&
    booking.customer_id !== input.userId
  ) {
    logger.warn("login_booking_claim_already_owned", {
      requestId: input.requestId,
      route: "/api/auth/login",
      userId: input.userId,
      bookingId: input.bookingId,
      customerId: booking.customer_id,
    });

    return false;
  }

  let serviceAddressId =
    booking.service_address_id ?? null;

  if (!serviceAddressId) {
    let addressQuery = admin
      .from("service_addresses")
      .select("id")
      .eq("customer_id", input.userId)
      .eq("street_address", booking.street_address)
      .eq("city", booking.city)
      .eq("state", booking.state);

    addressQuery = booking.zip_code
      ? addressQuery.eq("zip_code", booking.zip_code)
      : addressQuery.is("zip_code", null);

    const { data: existingAddress } =
      await addressQuery.limit(1).maybeSingle();

    serviceAddressId = existingAddress?.id ?? null;

    if (!serviceAddressId) {
      const { data: createdAddress, error: addressError } =
        await admin
          .from("service_addresses")
          .insert({
            customer_id: input.userId,
            label: "Home",
            street_address: booking.street_address,
            city: booking.city,
            state: booking.state,
            zip_code: booking.zip_code,
            neighborhood: booking.neighborhood,
            collection_day: booking.collection_day,
            collection_time_window:
              booking.collection_time_window,
            same_day_preference:
              booking.same_day_preference,
            latitude: booking.service_latitude,
            longitude: booking.service_longitude,
            distance_from_hub_miles:
              booking.service_distance_miles,
            notes: booking.customer_notes,
            is_primary: false,
          })
          .select("id")
          .single();

      if (addressError) {
        logger.warn(
          "login_booking_claim_address_creation_failed",
          {
            requestId: input.requestId,
            route: "/api/auth/login",
            userId: input.userId,
            bookingId: input.bookingId,
            error: addressError,
          },
        );
      } else {
        serviceAddressId =
          createdAddress?.id ?? null;
      }
    }
  }

  const { error: bookingError } = await admin
    .from("bookings")
    .update({
      customer_id: input.userId,
      service_address_id: serviceAddressId,
    })
    .eq("id", booking.id);

  if (bookingError) {
    logger.error("login_booking_claim_update_failed", {
      requestId: input.requestId,
      route: "/api/auth/login",
      userId: input.userId,
      bookingId: input.bookingId,
      error: bookingError,
    });

    return false;
  }

  if (booking.referral_code) {
    await admin
      .from("referrals")
      .update({
        referred_profile_id: input.userId,
      })
      .eq("referred_booking_id", booking.id);
  }

  if (booking.stripe_customer_id) {
    await admin
      .from("profiles")
      .update({
        stripe_customer_id:
          booking.stripe_customer_id,
      })
      .eq("id", input.userId);
  }

  await admin
    .from("booking_claims")
    .update({
      used_at: now,
    })
    .eq("id", claim.id);

  logger.info("login_booking_claim_completed", {
    requestId: input.requestId,
    route: "/api/auth/login",
    userId: input.userId,
    customerId: input.userId,
    bookingId: booking.id,
  });

  return true;
}

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

  const bookingClaimed =
    bookingId && claimToken
      ? await claimBookingAfterLogin({
          bookingId,
          claimToken,
          userId: data.user.id,
          requestId,
        })
      : false;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (profile?.role ?? "customer") as AppRole;
  const fallbackRoute = defaultRouteForRole(role);
  const redirectTo = safeRedirectForRole(role, requestedNext, fallbackRoute);

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
    bookingId && claimToken
      ? bookingClaimed
        ? "/portal?bookingLink=success"
        : "/portal?bookingLink=failed"
      : redirectTo;
  
  return NextResponse.json({
    redirectTo: finalRedirectTo,
    requestId,
  });
}
