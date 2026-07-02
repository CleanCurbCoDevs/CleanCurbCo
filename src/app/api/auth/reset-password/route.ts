import { NextResponse } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { createRequestId, logger } from "@/lib/server/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString, isValidEmail } from "@/lib/validation";

type ResetPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/auth/reset-password";

  if (!isSupabaseConfigured()) {
    logger.warn("auth_reset_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Password reset is being connected. Please contact us directly.", requestId },
      { status: 503 },
    );
  }

  const body = (await request.json()) as ResetPayload;
  const email = cleanString(body.email, 120).toLowerCase();

  if (!isValidEmail(email)) {
    logger.warn("auth_reset_invalid_email", { requestId, route });
    return NextResponse.json(
      { error: "Please enter a valid email address.", requestId },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/reset-password`,
  });

  if (error) {
    logger.warn("auth_reset_email_send_failed", {
      requestId,
      route,
      error,
    });
  }

  return NextResponse.json({
    message:
      "If an account exists for that email, a password reset link is on the way.",
    requestId,
  });
}
