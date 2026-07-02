import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString } from "@/lib/validation";

type UpdatePayload = {
  code?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/auth/update-password";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "auth_update_password",
  });
  if (originRejection) return originRejection;

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "auth_update_password",
    scope: "auth-update-password",
    limit: 6,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  if (!isSupabaseConfigured()) {
    logger.warn("auth_update_password_unconfigured", { requestId, route });
    return NextResponse.json(
      { error: "Password reset is being connected. Please contact us directly.", requestId },
      { status: 503 },
    );
  }

  let body: UpdatePayload;
  try {
    body = (await request.json()) as UpdatePayload;
  } catch {
    logger.warn("auth_update_password_invalid_json", { requestId, route });
    return NextResponse.json(
      {
        error: "Please use a valid reset link and an 8+ character password.",
        requestId,
      },
      { status: 400 },
    );
  }
  const code = cleanString(body.code, 300);
  const password = typeof body.password === "string" ? body.password : "";

  if (!code || password.length < 8) {
    logger.warn("auth_update_password_invalid_payload", { requestId, route });
    return NextResponse.json(
      {
        error: "Please use a valid reset link and an 8+ character password.",
        requestId,
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logger.warn("auth_update_password_code_exchange_failed", {
      requestId,
      route,
      error: exchangeError,
    });
    return NextResponse.json(
      { error: "That reset link is expired or invalid.", requestId },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    logger.error("auth_update_password_failed", {
      requestId,
      route,
      error: updateError,
    });
    return NextResponse.json(
      { error: "We could not update that password. Please try again.", requestId },
      { status: 500 },
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ redirectTo: "/login?reset=complete", requestId });
}
