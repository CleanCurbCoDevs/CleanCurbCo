import { NextResponse } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString, isValidEmail } from "@/lib/validation";

type ResetPayload = {
  email?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/auth/reset-password";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "auth_reset_password",
  });
  if (originRejection) return originRejection;

  if (!isSupabaseConfigured()) {
    logger.warn("auth_reset_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Password reset is being connected. Please contact us directly.", requestId },
      { status: 503 },
    );
  }

  let body: ResetPayload;
  try {
    body = (await request.json()) as ResetPayload;
  } catch {
    logger.warn("auth_reset_invalid_json", { requestId, route });
    return NextResponse.json(
      {
        message:
          "If an account exists for that email, a password reset link is on the way.",
        requestId,
      },
      { status: 200 },
    );
  }

  const email = cleanString(body.email, 120).toLowerCase();
  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "auth_reset_password",
    scope: "auth-reset",
    subject: email,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  if (!isValidEmail(email)) {
    logger.warn("auth_reset_invalid_email", { requestId, route });
    return NextResponse.json(
      {
        message:
          "If an account exists for that email, a password reset link is on the way.",
        requestId,
      },
      { status: 200 },
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
