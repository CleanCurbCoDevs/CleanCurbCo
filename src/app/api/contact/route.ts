import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendAdminContactNotification } from "@/lib/email/sendAdminContactNotification";
import { sendContactConfirmation } from "@/lib/email/sendContactConfirmation";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  cleanLongText,
  cleanString,
  isValidEmail,
  isValidPhone,
} from "@/lib/validation";

type ContactPayload = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  location?: unknown;
  reason?: unknown;
  message?: unknown;
  website?: unknown;
  company?: unknown;
};

const validReasons = [
  "Booking question",
  "Waitlist",
  "General question",
  "HOA or group route",
] as const;

const expectedFields = new Set([
  "name",
  "phone",
  "email",
  "location",
  "reason",
  "message",
  "website",
  "company",
]);

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/contact";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "contact_submit",
  });
  if (originRejection) return originRejection;

  if (!isSupabaseConfigured()) {
    logger.warn("contact_submit_unconfigured", { requestId, route });
    return NextResponse.json(
      {
        error:
          "Messaging is being connected. Please call or email Clean Curb Co. and we will help directly.",
        requestId,
      },
      { status: 503 },
    );
  }

  let body: ContactPayload;

  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    logger.warn("contact_submit_invalid_json", { requestId, route });
    return NextResponse.json(
      { error: "Invalid contact request.", requestId },
      { status: 400 },
    );
  }

  const unexpectedFields = Object.keys(body as Record<string, unknown>).filter(
    (field) => !expectedFields.has(field),
  );
  if (unexpectedFields.length) {
    logger.warn("contact_submit_unexpected_fields", {
      requestId,
      route,
      metadata: { unexpectedFields },
    });
    return NextResponse.json(
      { error: "Invalid contact request.", requestId },
      { status: 400 },
    );
  }

  const honeypot = cleanString(body.website, 120) || cleanString(body.company, 120);
  if (honeypot) {
    logger.warn("contact_submit_honeypot_blocked", { requestId, route });
    return NextResponse.json(
      {
        message:
          "Thanks! Your note has been received. We will follow up soon.",
        requestId,
      },
      { status: 202 },
    );
  }

  const name = cleanString(body.name, 120);
  const phone = cleanString(body.phone, 40) || null;
  const email = cleanString(body.email, 120).toLowerCase();
  const location = cleanString(body.location, 200) || null;
  const reason = validReasons.includes(body.reason as (typeof validReasons)[number])
    ? (body.reason as (typeof validReasons)[number])
    : "General question";
  const message = cleanLongText(body.message, 2000);

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "contact_submit",
    scope: "contact-submit",
    subject: email,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  if (
    !name ||
    !phone ||
    !isValidPhone(phone) ||
    !email ||
    !isValidEmail(email) ||
    !location ||
    !message
  ) {
    logger.warn("contact_submit_validation_failed", {
      requestId,
      route,
      metadata: {
        hasName: Boolean(name),
        hasPhone: Boolean(phone),
        validPhone: Boolean(phone && isValidPhone(phone)),
        hasEmail: Boolean(email),
        validEmail: isValidEmail(email),
        hasLocation: Boolean(location),
        hasMessage: Boolean(message),
      },
    });
    return NextResponse.json(
      {
        error:
          "Please include your name, valid phone, valid email, address or neighborhood, and message.",
        requestId,
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("contact_messages")
    .insert({
      name,
      phone,
      email,
      address_or_neighborhood: location,
      reason,
      message,
    })
    .select("*")
    .single();

  if (error || !data) {
    logger.error("contact_submit_insert_failed", {
      requestId,
      route,
      error,
    });
    return NextResponse.json(
      { error: "We could not save that message. Please try again.", requestId },
      { status: 500 },
    );
  }

  await Promise.allSettled([
    sendContactConfirmation(data),
    sendAdminContactNotification(data),
  ]);

  return NextResponse.json(
    {
      message:
        "Thanks! Your note has been received. We will follow up soon.",
      requestId,
    },
    { status: 201 },
  );
}
