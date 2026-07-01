import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/types/database";

function baseCode(profile: Pick<ProfileRow, "first_name" | "last_name" | "email" | "id">) {
  const nameSeed =
    [profile.first_name, profile.last_name].filter(Boolean).join("") ||
    profile.email?.split("@")[0] ||
    profile.id.slice(0, 8);

  return nameSeed
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();
}

export async function ensureReferralCode(profile: ProfileRow) {
  if (profile.referral_code) return profile.referral_code;

  const admin = getSupabaseAdmin();
  const seed = baseCode(profile) || "CURB";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = profile.id.replace(/-/g, "").slice(attempt * 3, attempt * 3 + 4).toUpperCase();
    const code = `${seed}${suffix}`.slice(0, 14);
    const { data, error } = await admin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", profile.id)
      .select("referral_code")
      .single();

    if (!error && data?.referral_code) return data.referral_code;
  }

  const fallback = `CURB${profile.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  await admin.from("profiles").update({ referral_code: fallback }).eq("id", profile.id);
  return fallback;
}

export async function findReferrerByCode(code: string) {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("referral_code", cleanCode)
    .maybeSingle();

  return data ?? null;
}
