import { NextResponse } from "next/server";
import {
  createAccountSetupLink,
  createClaimToken,
  createPaymentSetupLink,
  hashClaimToken,
} from "@/lib/booking-claims";
import {
  bookingRowToRequest,
  validFrequencies,
  validSchedulingPreferences,
} from "@/lib/booking-utils";
import { isSupabaseConfigured } from "@/lib/env";
import { sendAccountSetupEmail } from "@/lib/email/sendAccountSetupEmail";
import { sendAdminBookingNotification } from "@/lib/email/sendAdminBookingNotification";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { calculateBookingEstimate } from "@/lib/pricing";
import { findReferrerByCode } from "@/lib/referrals";
import { createRequestId, getClientIp, logger } from "@/lib/server/logger";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { bookingSuccessLaunchMessage } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  cleanArray,
  cleanLongText,
  cleanString,
  isValidEmail,
  mustBeTrue,
  parsePositiveInt,
  pickEnum,
} from "@/lib/validation";
import type { SchedulingPreference, ServiceFrequency } from "@/types/booking";

type IncomingBooking = {
  turnstileToken?: unknown;
  referralCode?: unknown;
  customer?: {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    email?: unknown;
    serviceAddress?: unknown;
    streetAddress?: unknown;
    city?: unknown;
    state?: unknown;
    zipCode?: unknown;
    neighborhood?: unknown;
  };
  service?: {
    binCount?: unknown;
    binTypes?: unknown;
    frequency?: unknown;
    addOns?: unknown;
  };
  scheduling?: {
    preference?: unknown;
    requestedDate?: unknown;
  };
  instructions?: {
    binLocation?: unknown;
    waterSpigotAvailable?: unknown;
    notes?: unknown;
  };
  agreements?: {
    waterUse?: unknown;
    binCondition?: unknown;
    wastewater?: unknown;
    weatherAccess?: unknown;
    photos?: unknown;
    payment?: unknown;
    launchBilling?: unknown;
  };
};

const validWaterSpigotValues = ["yes", "no", "not_sure"] as const;

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/bookings";
  const startedAt = performance.now();

  if (!isSupabaseConfigured()) {
    logger.warn("booking_submission_unconfigured", { requestId, route });
    return NextResponse.json(
      {
        error:
          "Online booking is being connected. Please call or email Clean Curb Co. and we will get your route request handled.",
        requestId,
      },
      { status: 503 },
    );
  }

  let body: IncomingBooking;

  try {
    body = (await request.json()) as IncomingBooking;
  } catch (error) {
    logger.warn("booking_submission_invalid_json", {
      requestId,
      route,
      error,
    });
    return NextResponse.json(
      { error: "Invalid booking request.", requestId },
      { status: 400 },
    );
  }

  const turnstileResult = await verifyTurnstileToken({
    token: cleanString(body.turnstileToken, 4096),
    remoteIp: getClientIp(request.headers),
    requestId,
    route,
    expectedAction: "booking_submit",
  });

  if (!turnstileResult.success) {
    return NextResponse.json(
      {
        error: turnstileResult.error,
        requestId: turnstileResult.requestId,
        codes: turnstileResult.codes ?? [],
      },
      { status: turnstileResult.status },
    );
  }

  const firstName = cleanString(body.customer?.firstName, 80);
  const lastName = cleanString(body.customer?.lastName, 80);
  const phone = cleanString(body.customer?.phone, 40);
  const email = cleanString(body.customer?.email, 120).toLowerCase();
  const streetAddress =
    cleanString(body.customer?.streetAddress, 180) ||
    cleanString(body.customer?.serviceAddress, 180);
  const city = cleanString(body.customer?.city, 80) || "Summerville";
  const state = cleanString(body.customer?.state, 20) || "SC";
  const zipCode = cleanString(body.customer?.zipCode, 20) || null;
  const neighborhood = cleanString(body.customer?.neighborhood, 120) || null;
  const binCount = parsePositiveInt(body.service?.binCount, 2);
  const frequency = pickEnum<ServiceFrequency>(
    body.service?.frequency,
    validFrequencies,
    "one_time",
  );
  const schedulingPreference = pickEnum<SchedulingPreference>(
    body.scheduling?.preference,
    validSchedulingPreferences,
    "next_available_route_day",
  );
  const requestedDate = cleanString(body.scheduling?.requestedDate, 30) || null;
  const binTypes = cleanArray(body.service?.binTypes);
  const addOns = cleanArray(body.service?.addOns);
  const referralCode = cleanString(body.referralCode, 40).toUpperCase() || null;
  const waterSpigotAvailable = pickEnum(
    body.instructions?.waterSpigotAvailable,
    validWaterSpigotValues,
    "not_sure",
  );

  const agreements = {
    waterUse: mustBeTrue(body.agreements?.waterUse),
    binCondition: mustBeTrue(body.agreements?.binCondition),
    wastewater: mustBeTrue(body.agreements?.wastewater),
    weatherAccess: mustBeTrue(body.agreements?.weatherAccess),
    photos: mustBeTrue(body.agreements?.photos),
    payment: mustBeTrue(body.agreements?.payment),
    launchBilling: mustBeTrue(body.agreements?.launchBilling),
  };

  const missingRequired = [
    !firstName && "first name",
    !lastName && "last name",
    !phone && "phone",
    !email && "email",
    !streetAddress && "street address",
    !city && "city",
    !state && "state",
    !isValidEmail(email) && "valid email",
    !Object.values(agreements).every(Boolean) && "required agreements",
  ].filter(Boolean);

  if (missingRequired.length) {
    logger.warn("booking_submission_validation_failed", {
      requestId,
      route,
      metadata: { missingRequired },
    });
    return NextResponse.json(
      { error: `Please complete: ${missingRequired.join(", ")}.`, requestId },
      { status: 400 },
    );
  }

  const estimatedPrice = calculateBookingEstimate({
    binCount,
    frequency,
    addOns,
    applyFoundingNeighborPromo: false,
  });

  const admin = getSupabaseAdmin();
  let customerId: string | null = null;
  let serviceAddressId: string | null = null;
  let referredByProfileId: string | null = null;
  let existingStripeCustomerId: string | null = null;
  let existingPaymentMethodOnFile = false;
  let existingPaymentSetupCompletedAt: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    customerId = user?.id ?? null;

    if (customerId) {
      const { data: profile } = await admin
        .from("profiles")
        .upsert(
          {
            id: customerId,
            email,
            first_name: firstName,
            last_name: lastName,
            phone,
          },
          { onConflict: "id" },
        )
        .select("id, stripe_customer_id, payment_method_on_file, payment_setup_completed_at")
        .single();

      if (profile?.id) {
        existingStripeCustomerId = profile.stripe_customer_id ?? null;
        existingPaymentMethodOnFile = Boolean(profile.payment_method_on_file);
        existingPaymentSetupCompletedAt = profile.payment_setup_completed_at ?? null;

        const { data: serviceAddress } = await admin
          .from("service_addresses")
          .insert({
            customer_id: profile.id,
            street_address: streetAddress,
            city,
            state,
            zip_code: zipCode,
            neighborhood,
            notes: cleanLongText(body.instructions?.notes, 1000) || null,
            is_primary: true,
          })
          .select("id")
          .single();

        serviceAddressId = serviceAddress?.id ?? null;
      }
    }
  } catch (error) {
    logger.warn("booking_submission_session_profile_lookup_failed", {
      requestId,
      route,
      error,
    });
    customerId = null;
    serviceAddressId = null;
  }

  if (referralCode) {
    const referrer = await findReferrerByCode(referralCode);
    if (referrer && referrer.id !== customerId) {
      referredByProfileId = referrer.id;
    }
  }

  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      customer_id: customerId,
      service_address_id: serviceAddressId,
      status: "new",
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      street_address: streetAddress,
      city,
      state,
      zip_code: zipCode,
      neighborhood,
      bin_count: binCount,
      bin_types: binTypes,
      frequency,
      add_ons: addOns,
      estimated_price: estimatedPrice,
      scheduling_preference: schedulingPreference,
      requested_date: requestedDate,
      bin_location: cleanString(body.instructions?.binLocation, 120) || "Curbside",
      water_spigot_available: waterSpigotAvailable,
      customer_notes: cleanLongText(body.instructions?.notes, 1500) || null,
      agreement_water_use: agreements.waterUse,
      agreement_bin_condition: agreements.binCondition,
      agreement_wastewater: agreements.wastewater,
      agreement_weather_access: agreements.weatherAccess,
      agreement_photos: agreements.photos,
      agreement_payment: agreements.payment,
      payment_status: "not_sent",
      payment_setup_status: existingPaymentMethodOnFile ? "completed" : "not_started",
      stripe_customer_id: existingStripeCustomerId,
      payment_method_on_file: existingPaymentMethodOnFile,
      payment_setup_completed_at: existingPaymentSetupCompletedAt,
      referral_code: referralCode,
      referred_by_profile_id: referredByProfileId,
    })
    .select("*")
    .single();

  if (error || !booking) {
    logger.error("booking_submission_insert_failed", {
      requestId,
      route,
      customerId,
      error,
    });
    return NextResponse.json(
      {
        error: "We could not save that booking request. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  logger.info("booking_submission_created", {
    requestId,
    route,
    customerId,
    bookingId: booking.id,
    durationMs: Math.round(performance.now() - startedAt),
    metadata: {
      frequency,
      binCount,
      addOnCount: addOns.length,
      hasReferralCode: Boolean(referralCode),
    },
  });

  if (referralCode && referredByProfileId) {
    await admin.from("referrals").insert({
      referrer_profile_id: referredByProfileId,
      referred_profile_id: customerId,
      referred_booking_id: booking.id,
      referral_code: referralCode,
      referred_email: email,
      status: "pending",
    });
  }

  let redirectTo: string | null = null;
  let setupLink: string | null = null;
  let paymentSetupUrl: string | null = null;
  let paymentSetupPath: string | null = null;
  let guestClaimToken: string | null = null;

  if (!customerId) {
    const token = createClaimToken();
    guestClaimToken = token;
    const tokenHash = hashClaimToken(token);

    await admin.from("booking_claims").insert({
      booking_id: booking.id,
      email,
      token_hash: tokenHash,
    });

    redirectTo = `/account-setup?booking=${booking.id}&token=${encodeURIComponent(token)}`;
    setupLink = createAccountSetupLink(booking.id, token);
    paymentSetupUrl = createPaymentSetupLink(booking.id, token);
    paymentSetupPath = `/payment-setup?booking=${booking.id}&token=${encodeURIComponent(token)}`;
  } else if (!existingPaymentMethodOnFile) {
    paymentSetupUrl = createPaymentSetupLink(booking.id);
    paymentSetupPath = `/payment-setup?booking=${booking.id}`;
  }

  const emailJobs = [
    sendBookingConfirmation(booking, {
      accountSetupUrl: setupLink,
      paymentSetupUrl,
    }),
    sendAdminBookingNotification(booking),
    createAdminNotification({
      type: "new_booking_request",
      title: "New booking request",
      message: `${booking.first_name} ${booking.last_name} requested service.`,
      href: `/admin/bookings?q=${booking.id}`,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      severity: "info",
    }),
  ];

  if (setupLink) {
    emailJobs.push(sendAccountSetupEmail(booking, setupLink));
  }

  const emailResults = await Promise.allSettled(emailJobs);

  logger.info("booking_submission_email_jobs_settled", {
    requestId,
    route,
    customerId,
    bookingId: booking.id,
    metadata: {
      fulfilled: emailResults.filter((result) => result.status === "fulfilled").length,
      rejected: emailResults.filter((result) => result.status === "rejected").length,
      total: emailResults.length,
    },
  });

  return NextResponse.json(
    {
      booking: bookingRowToRequest(booking),
      redirectTo,
      paymentSetupHref: paymentSetupPath,
      paymentSetupContext: {
        bookingId: booking.id,
        token: guestClaimToken,
      },
      message: bookingSuccessLaunchMessage,
      requestId,
    },
    { status: 201 },
  );
}
