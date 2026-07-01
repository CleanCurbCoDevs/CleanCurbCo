import { NextResponse } from "next/server";
import { createAccountSetupLink, createClaimToken, hashClaimToken } from "@/lib/booking-claims";
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
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Online booking is being connected. Please call or email Clean Curb Co. and we will get your route request handled.",
      },
      { status: 503 },
    );
  }

  let body: IncomingBooking;

  try {
    body = (await request.json()) as IncomingBooking;
  } catch {
    return NextResponse.json({ error: "Invalid booking request." }, { status: 400 });
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
    return NextResponse.json(
      { error: `Please complete: ${missingRequired.join(", ")}.` },
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
        .select("id")
        .single();

      if (profile?.id) {
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
  } catch {
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
      referral_code: referralCode,
      referred_by_profile_id: referredByProfileId,
    })
    .select("*")
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "We could not save that booking request. Please try again." },
      { status: 500 },
    );
  }

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

  if (!customerId) {
    const token = createClaimToken();
    const tokenHash = hashClaimToken(token);

    await admin.from("booking_claims").insert({
      booking_id: booking.id,
      email,
      token_hash: tokenHash,
    });

    redirectTo = `/account-setup?booking=${booking.id}&token=${encodeURIComponent(token)}`;
    setupLink = createAccountSetupLink(booking.id, token);
  }

  const emailJobs = [
    sendBookingConfirmation(booking),
    sendAdminBookingNotification(booking),
  ];

  if (setupLink) {
    emailJobs.push(sendAccountSetupEmail(booking, setupLink));
  }

  await Promise.allSettled(emailJobs);

  return NextResponse.json(
    {
      booking: bookingRowToRequest(booking),
      redirectTo,
      message: bookingSuccessLaunchMessage,
    },
    { status: 201 },
  );
}
