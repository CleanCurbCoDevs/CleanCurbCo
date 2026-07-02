import { forbidden, redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminRole, isFieldRole } from "@/lib/supabase/roles";
import type { ProfileRow } from "@/types/database";

type AuthUnavailable = {
  status: "unconfigured";
  message: string;
};

type AuthForbidden = {
  status: "forbidden";
  message: string;
};

type AuthOk = {
  status: "ok";
  userId: string;
  email: string | null;
  profile: ProfileRow;
};

export type AuthResult = AuthUnavailable | AuthForbidden | AuthOk;

export async function getCurrentProfile(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "unconfigured",
      message:
        "Account features are temporarily unavailable while service credentials are configured.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "forbidden",
      message: "Please log in to continue.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    if (
      profile.role === "customer" &&
      (profile.portal_access_enabled === false ||
        profile.account_status === "portal_disabled" ||
        profile.account_status === "deleted")
    ) {
      return {
        status: "forbidden",
        message:
          "This customer portal account is disabled. Please contact Clean Curb Co. for help.",
      };
    }

    return {
      status: "ok",
      userId: user.id,
      email: user.email ?? null,
      profile,
    };
  }

  const [firstName, ...lastNameParts] =
    user.user_metadata?.first_name || user.user_metadata?.name
      ? String(user.user_metadata.first_name ?? user.user_metadata.name).split(" ")
      : [null];

  const admin = getSupabaseAdmin();
  const { data: createdProfile, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        first_name: firstName,
        last_name: lastNameParts.join(" ") || null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error || !createdProfile) {
    return {
      status: "forbidden",
      message:
        "We could not load your account profile. Please contact Clean Curb Co.",
    };
  }

  return {
    status: "ok",
    userId: user.id,
    email: user.email ?? null,
    profile: createdProfile,
  };
}

export async function requireAuth(nextPath = "/portal"): Promise<AuthResult> {
  const auth = await getCurrentProfile();

  if (auth.status === "forbidden") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return auth;
}

export async function requireAdmin(nextPath = "/admin"): Promise<AuthResult> {
  const auth = await getCurrentProfile();

  if (auth.status === "forbidden") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (auth.status === "ok" && !isAdminRole(auth.profile.role)) {
    logger.warn("admin_route_forbidden", {
      action: "admin_route_access",
      userId: auth.userId,
      role: auth.profile.role,
      metadata: { nextPath },
    });
    forbidden();
  }

  return auth;
}

export const requireOwnerOrAdmin = requireAdmin;

export async function requireField(nextPath = "/field/today"): Promise<AuthResult> {
  const auth = await getCurrentProfile();

  if (auth.status === "forbidden") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (auth.status === "ok" && !isFieldRole(auth.profile.role)) {
    logger.warn("field_route_forbidden", {
      action: "field_route_access",
      userId: auth.userId,
      role: auth.profile.role,
      metadata: { nextPath },
    });
    forbidden();
  }

  return auth;
}
