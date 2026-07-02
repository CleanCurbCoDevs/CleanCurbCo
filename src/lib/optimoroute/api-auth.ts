import "server-only";

import { NextResponse } from "next/server";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { createRequestId, logger } from "@/lib/server/logger";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { isAdminRole } from "@/lib/supabase/roles";

export type AdminOptimoRouteApiContext = {
  requestId: string;
  route: string;
  action: string;
  actor: {
    userId: string;
    email: string | null;
    role: "admin" | "owner";
  };
};

export async function requireAdminOptimoRouteApi(
  request: Request,
  route: string,
  action: string,
) {
  const requestId = createRequestId(request.headers);
  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action,
  });
  if (originRejection) return { response: originRejection, requestId };

  const auth = await getCurrentProfile();
  if (auth.status !== "ok") {
    logger.warn("optimoroute_api_unauthenticated", {
      requestId,
      route,
      action,
    });
    return {
      requestId,
      response: NextResponse.json(
        { error: "Please log in to continue.", requestId },
        { status: 401 },
      ),
    };
  }

  if (!isAdminRole(auth.profile.role)) {
    logger.warn("optimoroute_api_forbidden", {
      requestId,
      route,
      action,
      userId: auth.userId,
      role: auth.profile.role,
    });
    return {
      requestId,
      response: NextResponse.json(
        { error: "You do not have access to OptimoRoute controls.", requestId },
        { status: 403 },
      ),
    };
  }

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action,
    scope: "optimoroute-admin",
    subject: auth.userId,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return { requestId, response: limited };

  return {
    requestId,
    context: {
      requestId,
      route,
      action,
      actor: {
        userId: auth.userId,
        email: auth.email,
        role: auth.profile.role as "admin" | "owner",
      },
    } satisfies AdminOptimoRouteApiContext,
  };
}

export async function readJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
