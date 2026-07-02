import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { rejectCrossOriginRequest } from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/auth/logout";
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "auth_logout",
  });
  if (originRejection) return originRejection;

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  logger.info("auth_logout", { requestId, route });

  return NextResponse.json({ redirectTo: "/login", requestId });
}
