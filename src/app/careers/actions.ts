"use server";

import { redirect } from "next/navigation";
import { sendCareerApplicationEmails } from "@/lib/email/sendCareerApplicationEmail";
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
  const firstName = cleanString(formData.get("first_name"), 80);
  const lastName = cleanString(formData.get("last_name"), 80);
  const email = cleanString(formData.get("email"), 160).toLowerCase();
  const understands = formData.get("understands") === "on";
  const consent = formData.get("consent") === "on";

  if (!firstName || !lastName || !isValidEmail(email) || !understands || !consent) {
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
    redirect("/careers?error=submit");
  }

  await sendCareerApplicationEmails(application);
  redirect("/careers?submitted=1");
}
