import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  sendAdminCommercialQuoteNotification,
} from "@/lib/email/sendAdminCommercialQuoteNotification";
import {
  sendCommercialQuoteConfirmation,
} from "@/lib/email/sendCommercialQuoteConfirmation";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { sendGa4ServerEvent } from "@/lib/server/ga4";
import {
  createRequestId,
  getClientIp,
  logger,
} from "@/lib/server/logger";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  cleanArray,
  cleanLongText,
  cleanString,
  isValidEmail,
  isValidPhone,
  mustBeTrue,
  pickEnum,
} from "@/lib/validation";
import {
  commercialDesiredFrequencies,
  commercialPreferredContactMethods,
  commercialPropertyTypes,
  commercialServiceInterests,
  commercialServicePlans,
  commercialSiteConditions,
  commercialStartTimeframes,
  commercialWaterAvailabilityValues,
  type CommercialDesiredFrequency,
  type CommercialPreferredContactMethod,
  type CommercialPropertyType,
  type CommercialServiceInterest,
  type CommercialServicePlan,
  type CommercialSiteCondition,
  type CommercialStartTimeframe,
  type CommercialWaterAvailability,
} from "@/types/commercial";

type IncomingCommercialQuote = {
  website?: unknown;
  turnstileToken?: unknown;

  analytics?: {
    clientId?: unknown;
    sessionId?: unknown;
  } | null;

  contact?: {
    businessName?: unknown;
    contactName?: unknown;
    role?: unknown;
    email?: unknown;
    phone?: unknown;
    preferredContactMethod?: unknown;
  };

  property?: {
    propertyType?: unknown;
    propertyTypeOther?: unknown;
    streetAddress?: unknown;
    city?: unknown;
    state?: unknown;
    zipCode?: unknown;
    locationCount?: unknown;
    accessRestrictions?: unknown;
  };

  service?: {
    interests?: unknown;
    serviceOther?: unknown;
    containerCount?: unknown;
    containerSizes?: unknown;
    siteCondition?: unknown;
    waterSpigotAvailable?: unknown;
    servicePlan?: unknown;
    desiredFrequency?: unknown;
    collectionSchedule?: unknown;
  };

  details?: {
    startTimeframe?: unknown;
    description?: unknown;
    additionalNotes?: unknown;
    acknowledgment?: unknown;
  };
};

const expectedTopLevelFields = new Set([
  "website",
  "turnstileToken",
  "analytics",
  "contact",
  "property",
  "service",
  "details",
]);

const expectedContactFields = new Set([
  "businessName",
  "contactName",
  "role",
  "email",
  "phone",
  "preferredContactMethod",
]);

const expectedPropertyFields = new Set([
  "propertyType",
  "propertyTypeOther",
  "streetAddress",
  "city",
  "state",
  "zipCode",
  "locationCount",
  "accessRestrictions",
]);

const expectedServiceFields = new Set([
  "interests",
  "serviceOther",
  "containerCount",
  "containerSizes",
  "siteCondition",
  "waterSpigotAvailable",
  "servicePlan",
  "desiredFrequency",
  "collectionSchedule",
]);

const expectedDetailsFields = new Set([
  "startTimeframe",
  "description",
  "additionalNotes",
  "acknowledgment",
]);

function findUnexpectedFields(
  value: unknown,
  expectedFields: Set<string>,
  prefix: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value as Record<string, unknown>)
    .filter((field) => !expectedFields.has(field))
    .map((field) => `${prefix}.${field}`);
}

function parseBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function parseOptionalBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return parseBoundedInteger(value, minimum, maximum);
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/commercial-quotes";

  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "commercial_quote_submit",
  });

  if (originRejection) {
    return originRejection;
  }

  if (!isSupabaseConfigured()) {
    logger.warn("commercial_quote_unconfigured", {
      requestId,
      route,
    });

    return NextResponse.json(
      {
        error:
          "Commercial quote requests are being connected. Please call or email Clean Curb Co. directly.",
        requestId,
      },
      { status: 503 },
    );
  }

  let body: IncomingCommercialQuote;

  try {
    body = (await request.json()) as IncomingCommercialQuote;
  } catch (error) {
    logger.warn("commercial_quote_invalid_json", {
      requestId,
      route,
      error,
    });

    return NextResponse.json(
      {
        error: "Invalid commercial quote request.",
        requestId,
      },
      { status: 400 },
    );
  }

  const unexpectedFields = [
    ...Object.keys(body as Record<string, unknown>)
      .filter((field) => !expectedTopLevelFields.has(field)),
    ...findUnexpectedFields(
      body.contact,
      expectedContactFields,
      "contact",
    ),
    ...findUnexpectedFields(
      body.property,
      expectedPropertyFields,
      "property",
    ),
    ...findUnexpectedFields(
      body.service,
      expectedServiceFields,
      "service",
    ),
    ...findUnexpectedFields(
      body.details,
      expectedDetailsFields,
      "details",
    ),
  ];

  if (unexpectedFields.length) {
    logger.warn("commercial_quote_unexpected_fields", {
      requestId,
      route,
      metadata: {
        unexpectedFields,
      },
    });

    return NextResponse.json(
      {
        error: "Invalid commercial quote request.",
        requestId,
      },
      { status: 400 },
    );
  }

  const honeypot = cleanString(body.website, 120);

  if (honeypot) {
    logger.warn("commercial_quote_honeypot_blocked", {
      requestId,
      route,
    });

    return NextResponse.json(
      {
        quote: {
          id: crypto.randomUUID(),
          businessName: "Business",
          contactName: "there",
          createdAt: new Date().toISOString(),
        },
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
    expectedAction: "commercial_quote_submit",
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

  const businessName = cleanString(
    body.contact?.businessName,
    160,
  );

  const contactName = cleanString(
    body.contact?.contactName,
    120,
  );

  const contactRole =
    cleanString(body.contact?.role, 120) || null;

  const email = cleanString(
    body.contact?.email,
    160,
  ).toLowerCase();

  const phone = cleanString(
    body.contact?.phone,
    40,
  );

  const preferredContactMethod =
    pickEnum<CommercialPreferredContactMethod>(
      body.contact?.preferredContactMethod,
      commercialPreferredContactMethods,
      "email",
    );

  const propertyType = pickEnum<CommercialPropertyType>(
    body.property?.propertyType,
    commercialPropertyTypes,
    "other",
  );

  const propertyTypeOther =
    cleanString(
      body.property?.propertyTypeOther,
      160,
    ) || null;

  const streetAddress = cleanString(
    body.property?.streetAddress,
    200,
  );

  const city = cleanString(
    body.property?.city,
    100,
  );

  const state = cleanString(
    body.property?.state,
    20,
  ).toUpperCase();

  const zipCode = cleanString(
    body.property?.zipCode,
    20,
  );

  const locationCount = parseBoundedInteger(
    body.property?.locationCount,
    1,
    1000,
  );

  const accessRestrictions =
    cleanLongText(
      body.property?.accessRestrictions,
      2000,
    ) || null;

  const rawServiceInterests = cleanArray(
    body.service?.interests,
    12,
  );

  const serviceInterests =
    rawServiceInterests.filter(
      (interest): interest is CommercialServiceInterest =>
        commercialServiceInterests.includes(
          interest as CommercialServiceInterest,
        ),
    );

  const serviceOther =
    cleanString(
      body.service?.serviceOther,
      200,
    ) || null;

  const containerCount = parseOptionalBoundedInteger(
    body.service?.containerCount,
    1,
    10000,
  );

  const containerSizes =
    cleanString(
      body.service?.containerSizes,
      300,
    ) || null;

  const siteCondition = pickEnum<CommercialSiteCondition>(
    body.service?.siteCondition,
    commercialSiteConditions,
    "not_sure",
  );

  const waterSpigotAvailable =
    pickEnum<CommercialWaterAvailability>(
      body.service?.waterSpigotAvailable,
      commercialWaterAvailabilityValues,
      "not_sure",
    );

  const servicePlan = pickEnum<CommercialServicePlan>(
    body.service?.servicePlan,
    commercialServicePlans,
    "not_sure",
  );

  const desiredFrequency =
    pickEnum<CommercialDesiredFrequency>(
      body.service?.desiredFrequency,
      commercialDesiredFrequencies,
      "not_sure",
    );

  const collectionSchedule =
    cleanString(
      body.service?.collectionSchedule,
      400,
    ) || null;

  const startTimeframe =
    pickEnum<CommercialStartTimeframe>(
      body.details?.startTimeframe,
      commercialStartTimeframes,
      "not_sure",
    );

  const projectDescription = cleanLongText(
    body.details?.description,
    5000,
  );

  const additionalNotes =
    cleanLongText(
      body.details?.additionalNotes,
      3000,
    ) || null;

  const acknowledgmentAccepted = mustBeTrue(
    body.details?.acknowledgment,
  );

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

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "commercial_quote_submit",
    scope: "commercial-quote-submit",
    subject: email,
    limit: 3,
    windowMs: 15 * 60 * 1000,
  });

  if (limited) {
    return limited;
  }

  const invalidServiceInterest =
    rawServiceInterests.length !==
    serviceInterests.length;

  const missingRequired = [
    !businessName && "business or organization",
    !contactName && "contact name",
    !phone && "phone",
    phone && !isValidPhone(phone) && "valid phone",
    !email && "email",
    email && !isValidEmail(email) && "valid email",
    !streetAddress && "service address",
    !city && "city",
    !state && "state",
    !zipCode && "ZIP code",
    zipCode &&
      !/^\d{5}(?:-\d{4})?$/.test(zipCode) &&
      "valid ZIP code",
    locationCount === null && "valid location count",
    !serviceInterests.length && "at least one service",
    invalidServiceInterest && "valid service selection",
    propertyType === "other" &&
      !propertyTypeOther &&
      "property type description",
    serviceInterests.includes(
      "other_exterior_cleaning",
    ) &&
      !serviceOther &&
      "other service description",
    !projectDescription && "project description",
    !acknowledgmentAccepted && "quote acknowledgment",
  ].filter(Boolean);

  if (missingRequired.length) {
    logger.warn("commercial_quote_validation_failed", {
      requestId,
      route,
      metadata: {
        missingRequired,
      },
    });

    return NextResponse.json(
      {
        error: `Please complete: ${missingRequired.join(", ")}.`,
        requestId,
      },
      { status: 400 },
    );
  }
  
  if (locationCount === null) {
    logger.error("commercial_quote_location_count_invariant_failed", {
      requestId,
      route,
    });
  
    return NextResponse.json(
      {
        error: "Please enter a valid number of locations.",
        requestId,
      },
      { status: 400 },
    );
  }
  
  const admin = getSupabaseAdmin();

  const { data: quote, error } = await admin
    .from("commercial_quote_requests")
    .insert({
      business_name: businessName,
      contact_name: contactName,
      contact_role: contactRole,
      email,
      phone,
      preferred_contact_method: preferredContactMethod,

      property_type: propertyType,
      property_type_other: propertyTypeOther,
      street_address: streetAddress,
      city,
      state,
      zip_code: zipCode,
      location_count: locationCount,
      access_restrictions: accessRestrictions,

      service_interests: serviceInterests,
      service_other: serviceOther,
      container_count: containerCount,
      container_sizes: containerSizes,
      site_condition: siteCondition,
      water_spigot_available: waterSpigotAvailable,
      service_plan: servicePlan,
      desired_frequency:
        servicePlan === "one_time"
          ? null
          : desiredFrequency,
      collection_schedule: collectionSchedule,

      desired_start_timeframe: startTimeframe,
      project_description: projectDescription,
      additional_notes: additionalNotes,
      acknowledgment_accepted: acknowledgmentAccepted,

      status: "new",
      source: "commercial_quote_form",
      submission_request_id: requestId,
    })
    .select("*")
    .single();

  if (error || !quote) {
    logger.error("commercial_quote_insert_failed", {
      requestId,
      route,
      error,
    });

    return NextResponse.json(
      {
        error:
          "We could not save that commercial quote request. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }

  await Promise.allSettled([
    sendCommercialQuoteConfirmation(quote),
    sendAdminCommercialQuoteNotification(quote),

    createAdminNotification({
      type: "commercial_quote_received",
      title: "New commercial quote request",
      message: `${quote.business_name} submitted a commercial cleaning request.`,
      href: "/admin",
      severity: "warning",
      metadata: {
        commercialQuoteId: quote.id,
        propertyType: quote.property_type,
        servicePlan: quote.service_plan,
        serviceInterests: quote.service_interests,
      },
    }),
  ]);

  if (ga4ClientId) {
    await sendGa4ServerEvent({
      eventName: "commercial_quote_submitted",
      clientId: ga4ClientId,
      sessionId: ga4SessionId,
      requestId,
      route,
      parameters: {
        property_type: quote.property_type,
        service_plan: quote.service_plan,
        service_interest_count:
          quote.service_interests.length,
        location_count: quote.location_count,
        has_container_count:
          quote.container_count !== null,
      },
    });
  }

  logger.info("commercial_quote_created", {
    requestId,
    route,
    metadata: {
      commercialQuoteId: quote.id,
      propertyType: quote.property_type,
      servicePlan: quote.service_plan,
      serviceInterestCount:
        quote.service_interests.length,
    },
  });

  return NextResponse.json(
    {
      quote: {
        id: quote.id,
        businessName: quote.business_name,
        contactName: quote.contact_name,
        createdAt: quote.created_at,
      },
      requestId,
    },
    { status: 201 },
  );
}
