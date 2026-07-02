import "server-only";

import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/env";
import { getClientIp, logger } from "@/lib/server/logger";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type GuardContext = {
  requestId: string;
  route: string;
  action?: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function requestOriginFromHost(request: Request) {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;

  const protocol =
    headers.get("x-forwarded-proto") ??
    (new URL(request.url).protocol.replace(":", "") || "https");

  return `${protocol}://${host}`;
}

function allowedOrigins(request: Request) {
  return new Set(
    [requestOriginFromHost(request), getSiteUrl()]
      .filter(Boolean)
      .map((origin) => origin!.replace(/\/$/, "").toLowerCase()),
  );
}

export function getRateLimitKey(request: Request, scope: string, subject = "") {
  const ip = getClientIp(request.headers) ?? "unknown";
  return `${scope}:${ip}:${subject.toLowerCase()}`;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: 0,
  };
}

export function rejectCrossOriginRequest(
  request: Request,
  { requestId, route, action }: GuardContext,
) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const normalizedOrigin = origin.replace(/\/$/, "").toLowerCase();
  if (allowedOrigins(request).has(normalizedOrigin)) return null;

  logger.warn("request_origin_rejected", {
    requestId,
    route,
    action,
    metadata: { origin: normalizedOrigin },
  });

  return NextResponse.json(
    { error: "That request could not be verified. Please refresh and try again.", requestId },
    { status: 403 },
  );
}

export function rejectLimitedRequest(
  request: Request,
  context: GuardContext & {
    scope: string;
    subject?: string;
    limit: number;
    windowMs: number;
  },
) {
  const result = checkRateLimit({
    key: getRateLimitKey(request, context.scope, context.subject),
    limit: context.limit,
    windowMs: context.windowMs,
  });

  if (result.ok) return null;

  logger.warn("request_rate_limited", {
    requestId: context.requestId,
    route: context.route,
    action: context.action,
    metadata: { scope: context.scope, retryAfter: result.retryAfter },
  });

  return NextResponse.json(
    { error: "Too many attempts. Please wait a moment and try again.", requestId: context.requestId },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfter) },
    },
  );
}
