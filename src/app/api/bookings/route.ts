import { NextResponse } from "next/server";
import { recordBookingEvent } from "@/lib/server/booking-events";
import {
  createAccountSetupLink,
  createClaimToken,
  hashClaimToken,
} from "@/lib/booking-claims";
import {
  bookingRowToRequest,
  validCollectionDays,
  validCollectionTimeWindows,
  validFrequencies,
  validSameDayPreferences,
  validSchedulingPreferences,
} from "@/lib/booking-utils";
import { isSupabaseConfigured } from "@/lib/env";
import { sendAdminBookingNotification } from "@/lib/email/sendAdminBookingNotification";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import {
  calculateBookingEstimate,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import { findReferrerByCode } from "@/lib/referrals";
import { createRequestId, getClientIp, logger } from "@/lib/server/logger";
import { sendGa4ServerEvent } from "@/lib/server/ga4";
import { evaluateServiceArea } from "@/lib/server/service-area";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { createBookingCheckout } from "@/lib/server/booking-checkout";
import { bookingSuccessLaunchMessage } from "@/lib/site";
import { america250PromoInternalNote } from "@/lib/promotions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  cleanArray,
  cleanLongText,
  cleanString,
  isValidEmail,
  isValidPhone,
  mustBeTrue,
  parsePositiveInt,
  pickEnum,
} from "@/lib/validation";
import type {
  CollectionDay,
  CollectionTimeWindow,
  PaymentPreference,
  SameDayPreference,
  SchedulingPreference,
  ServiceFrequency,
} from "@/types/booking";
import { buildBookingSchedulingRecommendation } from "@/lib/server/booking-scheduling";


type IncomingBooking = {
  turnstileToken?: unknown;
  analytics?: {
    clientId?: unknown;
    sessionId?: unknown;
  } | null;
  referralCode?: unknown;
  website?: unknown;
  company?: unknown;
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
  payment?: {
    preference?: unknown;
  };
  scheduling?: {
    preference?: unknown;
    collectionDay?: unknown;
    collectionTimeWindow?: unknown;
    sameDayPreference?: unknown;
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
const customerPaymentPreferences = [
  "stripe",
  "venmo_business",
  "zelle",
  "cash_in_person",
] as const satisfies readonly PaymentPreference[];
const expectedTopLevelFields = new Set([
  "turnstileToken",
  "analytics",
  "referralCode",
  "website",
  "company",
  "customer",
  "service",
  "payment",
  "scheduling",
  "instructions",
  "agreements",
]);

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/bookings";
  const startedAt = performance.now();
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "booking_submit",
  });
  if (originRejection) return originRejection;

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

  const unexpectedFields = Object.keys(body as Record<string, unknown>).filter(
    (field) => !expectedTopLevelFields.has(field),
  );
  if (unexpectedFields.length) {
    logger.warn("booking_submission_unexpected_fields", {
      requestId,
      route,
      metadata: { unexpectedFields },
    });
    return NextResponse.json(
      { error: "Invalid booking request.", requestId },
      { status: 400 },
    );
  }

  const honeypot = cleanString(body.website, 120) || cleanString(body.company, 120);
  if (honeypot) {
    logger.warn("booking_submission_honeypot_blocked", { requestId, route });
    return NextResponse.json(
      {
        message: bookingSuccessLaunchMessage,
        requestId,
      },
      { status: 202 },
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

  const collectionDayValue = cleanString(
    body.scheduling?.collectionDay,
    30,
  );

  const collectionDay = validCollectionDays.includes(
    collectionDayValue as CollectionDay,
  )
    ? (collectionDayValue as CollectionDay)
    : null;

  const collectionTimeWindowValue = cleanString(
    body.scheduling?.collectionTimeWindow,
    40,
  );

  const collectionTimeWindow =
    validCollectionTimeWindows.includes(
      collectionTimeWindowValue as CollectionTimeWindow,
    )
      ? (collectionTimeWindowValue as CollectionTimeWindow)
      : null;

  const sameDayPreference = pickEnum<SameDayPreference>(
    body.scheduling?.sameDayPreference,
    validSameDayPreferences,
    "same_day_when_possible",
  );

  const requestedDate =
    cleanString(body.scheduling?.requestedDate, 30) || null;
  const binTypes = cleanArray(body.service?.binTypes);
  const addOns = cleanArray(body.service?.addOns);
  const rawGa4ClientId = cleanString(
    body.analytics?.clientId,
    100,
  );
  
  const rawGa4SessionId = cleanString(
    body.analytics?.sessionId,
    30,
  );
  
  const ga4ClientId =
    /^[A-Za-z0-9._-]{1,100}$/.test(rawGa4ClientId)
      ? rawGa4ClientId
      : null;
  
  const ga4SessionId =
    /^\d{1,30}$/.test(rawGa4SessionId)
      ? rawGa4SessionId
      : null;
  const referralCode = cleanString(body.referralCode, 40).toUpperCase() || null;
  const waterSpigotAvailable = pickEnum(
    body.instructions?.waterSpigotAvailable,
    validWaterSpigotValues,
    "not_sure",
  );

  const paymentPreference = pickEnum<PaymentPreference>(
    body.payment?.preference,
    customerPaymentPreferences,
    "stripe",
  );
  
  const paymentDueAtService =
    paymentPreference === "cash_in_person";
  
  const inPersonPaymentRequestedAt =
    paymentDueAtService ? new Date().toISOString() : null;
  
  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "booking_submit",
    scope: "booking-submit",
    subject: email,
    limit: 4,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

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
    phone && !isValidPhone(phone) && "valid phone",
    !email && "email",
    !streetAddress && "street address",
    !city && "city",
    !state && "state",
    !zipCode && "ZIP code",
    !collectionDay && "regular collection day",
    !collectionTimeWindow && "typical collection time",
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
      {
        error: `Please complete: ${missingRequired.join(", ")}.`,
        requestId,
      },
      { status: 400 },
    );
  }

  const schedulingRecommendation =
    buildBookingSchedulingRecommendation({
      collectionDay,
      collectionTimeWindow,
      sameDayPreference,
      requestedDate,
    });
  
  const serviceAreaResult = await evaluateServiceArea({
    streetAddress,
    city,
    state,
    zipCode,
  });

  if (serviceAreaResult.status === "not_covered") {
    logger.warn("booking_submission_outside_service_area", {
      requestId,
      route,
      metadata: {
        city,
        state,
        zipCode,
        distanceMiles: serviceAreaResult.distanceMiles ?? null,
        maxRadiusMiles: serviceAreaResult.maxRadiusMiles,
      },
    });

    return NextResponse.json(
      {
        error: serviceAreaResult.message,
        requestId,
      },
      { status: 422 },
    );
  }

  if (serviceAreaResult.status === "unverified") {
    logger.warn("booking_submission_address_unverified", {
      requestId,
      route,
      metadata: {
        city,
        state,
        zipCode,
      },
    });

    return NextResponse.json(
      {
        error: serviceAreaResult.message,
        requestId,
      },
      { status: 422 },
    );
  }

  const serviceAreaCheckedAt = new Date().toISOString();

  const foundingSpecial = getFoundingNeighborSpecialStatus({
    binCount,
    frequency,
    addOns,
    neighborhood,
    createdAt: new Date().toISOString(),
  });
  const estimatedPrice = calculateBookingEstimate({
    binCount,
    frequency,
    addOns,
    applyFoundingNeighborPromo: foundingSpecial.eligible,
  });
  const america250InternalNote =
  frequency === "one_time" ? null : america250PromoInternalNote(new Date());

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
            collection_day: collectionDay,
            collection_time_window: collectionTimeWindow,
            same_day_preference: sameDayPreference,
            latitude: serviceAreaResult.latitude ?? null,
            longitude: serviceAreaResult.longitude ?? null,
            distance_from_hub_miles:
              serviceAreaResult.distanceMiles ?? null,
            notes:
              cleanLongText(body.instructions?.notes, 1000) || null,
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
      collection_day: collectionDay,
      collection_time_window: collectionTimeWindow,
      same_day_preference: sameDayPreference,
      earliest_safe_service_time:
        schedulingRecommendation.earliestSafeServiceTime,
      suggested_service_date:
        schedulingRecommendation.suggestedServiceDate,
      
      approval_status: schedulingRecommendation.requiresManualReview
        ? "needs_review"
        : "pending_review",
      attention_status: "review",
      manual_review_reason:
        schedulingRecommendation.manualReviewReason,
      
      service_latitude: serviceAreaResult.latitude ?? null,
      service_longitude: serviceAreaResult.longitude ?? null,
      service_distance_miles:
        serviceAreaResult.distanceMiles ?? null,
      service_area_checked_at: serviceAreaCheckedAt,
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
      
      payment_preference: paymentPreference,
      payment_due_at_service: paymentDueAtService,
      payment_verification_status: "not_required",
      in_person_payment_requested_at:
        inPersonPaymentRequestedAt,
      payment_status: "not_sent",
      payment_setup_status: existingPaymentMethodOnFile ? "completed" : "not_started",
      stripe_customer_id: existingStripeCustomerId,
      payment_method_on_file: existingPaymentMethodOnFile,
      payment_setup_completed_at: existingPaymentSetupCompletedAt,
      referral_code: referralCode,
      referred_by_profile_id: referredByProfileId,
      internal_notes: america250InternalNote,
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

await recordBookingEvent({
  bookingId: booking.id,
  customerId: booking.customer_id,
  actorProfileId: booking.customer_id,
  requestId,
  route,
  source: "booking_api",
  eventType: "BOOKING_CREATED",
  outcome: "success",
  message: "Booking request created.",
  idempotencyKey: `booking:${booking.id}:created`,
  metadata: {
    status: booking.status,
    approvalStatus: booking.approval_status,
    attentionStatus: booking.attention_status,
    paymentPreference,
    frequency,
    binCount,
    collectionDay,
    collectionTimeWindow,
    suggestedServiceDate:
      schedulingRecommendation.suggestedServiceDate,
    serviceDistanceMiles:
      serviceAreaResult.distanceMiles ?? null,
    customerLinked: Boolean(booking.customer_id),
  },
});

  if (ga4ClientId) {
    await sendGa4ServerEvent({
      eventName: "booking_submitted",
      clientId: ga4ClientId,
      sessionId: ga4SessionId,
      requestId,
      route,
      bookingId: booking.id,
      parameters: {
        service_type: "bin_cleaning",
        service_frequency: frequency,
        bin_count: binCount,
        add_on_count: addOns.length,
        payment_preference: paymentPreference,
        has_referral_code: Boolean(referralCode),
        value: estimatedPrice,
        currency: "USD",
      },
    });
  }
  
  await recordBookingEvent({
  bookingId: booking.id,
  customerId: booking.customer_id,
  actorProfileId: booking.customer_id,
  requestId,
  route,
  source: "booking_api",
  eventType: booking.customer_id
    ? "CUSTOMER_LINKED"
    : "CUSTOMER_LINK_PENDING",
  outcome: booking.customer_id
    ? "success"
    : "info",
  message: booking.customer_id
    ? "Booking attached to the logged-in customer account."
    : "Booking created without a linked customer account.",
  idempotencyKey: booking.customer_id
    ? `booking:${booking.id}:customer_linked:${booking.customer_id}`
    : `booking:${booking.id}:customer_link_pending`,
  metadata: {
    customerId: booking.customer_id,
    accountSetupRequired: !booking.customer_id,
  },
});
  
let redirectTo: string | null = null;
let setupLink: string | null = null;
let claimToken: string | null = null;

const token = createClaimToken();
const tokenHash = hashClaimToken(token);

const { error: claimError } = await admin
  .from("booking_claims")
  .insert({
    booking_id: booking.id,
    email,
    token_hash: tokenHash,
  });

if (claimError) {
  logger.error("booking_claim_creation_failed", {
    requestId,
    route,
    customerId,
    bookingId: booking.id,
    error: claimError,
  });
  await recordBookingEvent({
  bookingId: booking.id,
  customerId: booking.customer_id,
  requestId,
  route,
  source: "booking_api",
  eventType: "BOOKING_CLAIM_FAILED",
  outcome: "failure",
  message: "Secure booking claim could not be created.",
  idempotencyKey: `booking:${booking.id}:claim_failed`,
  metadata: {
    errorCode: claimError.code ?? null,
  },
});
} else {
  claimToken = token;

  await recordBookingEvent({
  bookingId: booking.id,
  customerId: booking.customer_id,
  requestId,
  route,
  source: "booking_api",
  eventType: "BOOKING_CLAIM_CREATED",
  outcome: "success",
  message: "Secure booking claim created.",
  idempotencyKey: `booking:${booking.id}:claim_created`,
  metadata: {
    accountSetupRequired: !customerId,
  },
});
  
  if (!customerId) {
    redirectTo =
      `/account-setup?booking=${booking.id}` +
      `&token=${encodeURIComponent(token)}`;

    setupLink = createAccountSetupLink(
      booking.id,
      token,
    );
  }
}
  
const checkoutResult =
  paymentPreference === "stripe"
    ? claimToken
      ? await createBookingCheckout({
          booking,
          requestId,
          claimToken,
        })
      : {
          checkoutUrl: null,
          error:
            "Your booking was saved, but secure checkout could not start. We will send you a fresh payment link.",
        }
    : {
        checkoutUrl: null,
        error: null,
      };

if (checkoutResult.checkoutUrl) {
  await recordBookingEvent({
    bookingId: booking.id,
    customerId: booking.customer_id,
    requestId,
    route,
    source: "booking_api",
    eventType: "CHECKOUT_CREATED",
    outcome: "success",
    message: "Stripe checkout created.",
    idempotencyKey: `booking:${booking.id}:initial_checkout_created`,
    metadata: {
      paymentPreference,
      paymentStatus: "pending",
      amount: booking.estimated_price,
    },
  });
} else if (
  paymentPreference === "stripe" &&
  checkoutResult.error
) {
  await recordBookingEvent({
    bookingId: booking.id,
    customerId: booking.customer_id,
    requestId,
    route,
    source: "booking_api",
    eventType: "CHECKOUT_CREATION_FAILED",
    outcome: "failure",
    message: "Stripe checkout could not be created.",
    idempotencyKey: `booking:${booking.id}:initial_checkout_failed`,
    metadata: {
      paymentPreference,
      paymentStatus: booking.payment_status,
    },
  });
} else {
  await recordBookingEvent({
    bookingId: booking.id,
    customerId: booking.customer_id,
    requestId,
    route,
    source: "booking_api",
    eventType: "PAYMENT_METHOD_SELECTED",
    outcome: "info",
    message: "Customer selected a non-Stripe payment method.",
    idempotencyKey: `booking:${booking.id}:payment_method_selected`,
    metadata: {
      paymentPreference,
      paymentDueAtService,
    },
  });
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
      collectionDay,
      collectionTimeWindow,
      sameDayPreference,
      paymentPreference,
      paymentDueAtService,
      checkoutStarted: Boolean(checkoutResult.checkoutUrl),
      checkoutIssue: Boolean(checkoutResult.error),
      suggestedServiceDate:
        schedulingRecommendation.suggestedServiceDate,
      earliestSafeServiceTime:
        schedulingRecommendation.earliestSafeServiceTime,
      serviceDistanceMiles:
        serviceAreaResult.distanceMiles ?? null,
      addOnCount: addOns.length,
      hasReferralCode: Boolean(referralCode),
      foundingNeighborSpecial: foundingSpecial.status,
      america250PromoClaimed: Boolean(america250InternalNote),
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

  const emailJobs = [
    sendBookingConfirmation(booking, {
      accountSetupUrl: setupLink,
      paymentSetupUrl: null,
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
    checkoutUrl: checkoutResult.checkoutUrl,
    checkoutError: checkoutResult.error,
    message: bookingSuccessLaunchMessage,
    requestId,
  },
  { status: 201 },
);
}
