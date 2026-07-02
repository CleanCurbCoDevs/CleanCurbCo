"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendCareerApplicationEmails } from "@/lib/email/sendCareerApplicationEmail";
import { checkRateLimit } from "@/lib/server/request-guards";
import { createRequestId, getClientIp, logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cleanLongText, cleanString, isValidEmail } from "@/lib/validation";

const roleInterests = [
  "Field Service Technician",
  "Route Lead",
  "Customer Support / Scheduling",
  "Part-Time Launch Help",
  "General Interest",
] as const;

const availabilityOptions = [
  "Weekdays",
  "Weekends",
  "Mornings",
  "Afternoons",
  "Flexible",
  "Not sure yet",
] as const;

function cleanAllowed(value: FormDataEntryValue | null, allowed: readonly string[]) {
  const cleaned = cleanString(value, 120);
  return allowed.includes(cleaned) ? cleaned : "General Interest";
}

function cleanAvailability(formData: FormData) {
  return formData
    .getAll("availability")
    .map((value) => cleanString(value, 80))
    .filter((value) => availabilityOptions.includes(value as (typeof availabilityOptions)[number]));
}

export async function submitCareerApplicationAction(formData: FormData) {
  const headersList = await headers();
  const requestId = createRequestId(headersList);
  const route = "/careers";
  const firstName = cleanString(formData.get("first_name"), 80);
  const lastName = cleanString(formData.get("last_name"), 80);
  const email = cleanString(formData.get("email"), 160).toLowerCase();
  const honeypot =
    cleanString(formData.get("website"), 120) ||
    cleanString(formData.get("company"), 120);
  const understands = formData.get("understands") === "on";
  const consent = formData.get("consent") === "on";

  if (honeypot) {
    logger.warn("career_submit_honeypot_blocked", { requestId, route });
    redirect("/careers?submitted=1");
  }

  const ip = getClientIp(headersList) ?? "unknown";
  const rateLimit = checkRateLimit({
    key: `career-submit:${ip}:${email}`,
    limit: 4,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    logger.warn("career_submit_rate_limited", {
      requestId,
      route,
      metadata: { retryAfter: rateLimit.retryAfter },
    });
    redirect("/careers?error=rate");
  }

  if (!firstName || !lastName || !isValidEmail(email) || !understands || !consent) {
    logger.warn("career_submit_validation_failed", { requestId, route });
    redirect("/careers?error=missing");
  }

  const admin = getSupabaseAdmin();
  const { data: application, error } = await admin
    .from("career_applications")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: cleanString(formData.get("phone"), 40) || null,
      city: cleanString(formData.get("city"), 80) || null,
      state: cleanString(formData.get("state"), 20) || null,
      zip: cleanString(formData.get("zip"), 20) || null,
      role_interest: cleanAllowed(formData.get("role_interest"), roleInterests),
      availability: cleanAvailability(formData),
      has_valid_drivers_license: formData.get("has_valid_drivers_license") === "on",
      comfortable_outdoors: formData.get("comfortable_outdoors") === "on",
      comfortable_lifting: formData.get("comfortable_lifting") === "on",
      experience: cleanLongText(formData.get("experience"), 2000) || null,
      message: cleanLongText(formData.get("message"), 2000) || null,
    })
    .select("*")
    .single();

  if (!application || error) {
    logger.error("career_submit_insert_failed", {
      requestId,
      route,
      error,
    });
    redirect("/careers?error=submit");
  }

  await sendCareerApplicationEmails(application);
  logger.info("career_submit_created", {
    requestId,
    route,
    metadata: { applicationId: application.id },
  });
  redirect("/careers?submitted=1");
}
