import { NextResponse } from "next/server";
import { hashClaimToken } from "@/lib/booking-claims";
import { isSupabaseConfigured } from "@/lib/env";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { claimBookingForCustomer } from "@/lib/server/booking-customer-link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString, isValidEmail } from "@/lib/validation";

type AccountSetupPayload = {
  bookingId?: unknown;
  token?: unknown;
  email?: unknown;
  password?: unknown;
};

async function cleanupCreatedAccount(input: {
  userId: string;
  requestId: string;
  route: string;
}) {
  const admin = getSupabaseAdmin();

  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("id", input.userId);

  if (profileDeleteError) {
    logger.error("account_setup_profile_cleanup_failed", {
      requestId: input.requestId,
      route: input.route,
      userId: input.userId,
      error: profileDeleteError,
    });
  }

  const { error: userDeleteError } =
    await admin.auth.admin.deleteUser(input.userId);

  if (userDeleteError) {
    logger.error("account_setup_user_cleanup_failed", {
      requestId: input.requestId,
      route: input.route,
      userId: input.userId,
      error: userDeleteError,
    });
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/account-setup";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "account_setup",
  });
  if (originRejection) return originRejection;

  if (!isSupabaseConfigured()) {
    logger.warn("account_setup_unconfigured", { requestId, route });
    return NextResponse.json(
      {
        error: "Account setup is being connected. Please contact us directly.",
        requestId,
      },
      { status: 503 },
    );
  }

  let body: AccountSetupPayload;

  try {
    body = (await request.json()) as AccountSetupPayload;
  } catch {
    logger.warn("account_setup_invalid_json", { requestId, route });
    return NextResponse.json(
      { error: "Invalid account setup request.", requestId },
      { status: 400 },
    );
  }

  
  
  const bookingId = cleanString(body.bookingId, 80);
  const token = cleanString(body.token, 200);
  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "account_setup",
    scope: "account-setup",
    subject: email || bookingId,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  if (!bookingId || !token || !isValidEmail(email) || password.length < 8) {
    logger.warn("account_setup_invalid_payload", { requestId, route });
    return NextResponse.json(
      {
        error: "Please use a valid setup link and an 8+ character password.",
        requestId,
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const tokenHash = hashClaimToken(token);
  const now = new Date().toISOString();

   const { data: claim, error: claimError } = await admin
    .from("booking_claims")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (claimError) {
    logger.error("account_setup_claim_lookup_failed", {
      requestId,
      route,
      bookingId,
      error: claimError,
    });

    return NextResponse.json(
      {
        error:
          "We could not verify that setup link. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  if (!claim || claim.email.toLowerCase() !== email) {
    logger.warn("account_setup_invalid_claim", {
      requestId,
      route,
      metadata: { bookingId, email },
    });

    return NextResponse.json(
      {
        error:
          "That setup link is expired or no longer valid.",
        requestId,
      },
      { status: 400 },
    );
  }

  const { data: booking, error: bookingError } =
    await admin
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

  if (bookingError) {
    logger.error("account_setup_booking_lookup_failed", {
      requestId,
      route,
      bookingId,
      error: bookingError,
    });

    return NextResponse.json(
      {
        error:
          "We could not load the booking for that setup link.",
        requestId,
      },
      { status: 500 },
    );
  }

  if (!booking || booking.email.toLowerCase() !== email) {
    logger.warn("account_setup_booking_not_found", {
      requestId,
      route,
      metadata: { bookingId, email },
    });

    return NextResponse.json(
      {
        error:
          "We could not find the booking for that setup link.",
        requestId,
      },
      { status: 404 },
    );
  }

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: booking.first_name,
        last_name: booking.last_name,
        phone: booking.phone,
      },
    });

  if (createUserError || !createdUser.user) {
    const message =
      createUserError?.message ??
      "Account could not be created.";

    return NextResponse.json(
      {
        error: message.toLowerCase().includes("already")
          ? "An account already exists for this email. Please log in instead."
          : message,
        requestId,
      },
      {
        status: message.toLowerCase().includes("already")
          ? 409
          : 500,
      },
    );
  }

  const userId = createdUser.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        role: "customer",
        first_name: booking.first_name,
        last_name: booking.last_name,
        phone: booking.phone,
        email,
        preferred_contact_method: "email",
        sms_opt_in: booking.sms_opt_in,
        sms_opt_in_at: booking.sms_opt_in_at,
        sms_opt_out_at: null,
        sms_opt_in_source: booking.sms_opt_in_source,
        sms_consent_version: booking.sms_consent_version,
        sms_consent_text: booking.sms_consent_text,
        referred_by_profile_id:
          booking.referred_by_profile_id,
        stripe_customer_id:
          booking.stripe_customer_id,
        payment_method_on_file:
          booking.payment_method_on_file,
        payment_setup_completed_at:
          booking.payment_setup_completed_at,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    logger.error("account_setup_profile_failed", {
      requestId,
      route,
      userId,
      bookingId,
      error: profileError,
    });

    await cleanupCreatedAccount({
      userId,
      requestId,
      route,
    });

    return NextResponse.json(
      {
        error:
          "We could not finish creating your account. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  /*
   * Prove that the new credentials work and establish the
   * browser session before consuming the booking claim.
   */
  const supabase = await createServerSupabaseClient();

  const { error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    logger.error("account_setup_sign_in_failed", {
      requestId,
      route,
      userId,
      bookingId,
      error: signInError,
    });

    await cleanupCreatedAccount({
      userId,
      requestId,
      route,
    });

    return NextResponse.json(
      {
        error:
          "We could not verify the new account credentials. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  const linkResult = await claimBookingForCustomer({
    bookingId: booking.id,
    claimToken: token,
    customerId: userId,
    customerEmail: email,
    requestId,
    route,
  });

  if (!linkResult.ok) {
    await supabase.auth.signOut();

    await cleanupCreatedAccount({
      userId,
      requestId,
      route,
    });

    return NextResponse.json(
      {
        error:
          "We could not securely connect that booking to the new account. The setup link was not used.",
        requestId,
      },
      { status: 409 },
    );
  }

  logger.info("account_setup_completed", {
    requestId,
    route,
    userId,
    customerId: userId,
    bookingId: booking.id,
    metadata: {
      serviceAddressId:
        linkResult.serviceAddressId,
      alreadyLinked:
        linkResult.alreadyLinked,
    },
  });

  return NextResponse.json({
    redirectTo: "/portal",
    requestId,
  });
}
