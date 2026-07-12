import { NextResponse } from "next/server";
import { evaluateServiceArea } from "@/lib/server/service-area";
import { createRequestId, logger } from "@/lib/server/logger";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { cleanString } from "@/lib/validation";

type IncomingServiceAreaRequest = {
  streetAddress?: unknown;
  city?: unknown;
  state?: unknown;
  zipCode?: unknown;
};

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers);
  const route = "/api/service-area";

  const originRejection = rejectCrossOriginRequest(request, {
    requestId,
    route,
    action: "service_area_check",
  });

  if (originRejection) {
    return originRejection;
  }

  const limited = rejectLimitedRequest(request, {
    requestId,
    route,
    action: "service_area_check",
    scope: "service-area-check",
    subject: request.headers.get("x-forwarded-for") ?? "anonymous",
    limit: 15,
    windowMs: 15 * 60 * 1000,
  });

  if (limited) {
    return limited;
  }

  let body: IncomingServiceAreaRequest;

  try {
    body = (await request.json()) as IncomingServiceAreaRequest;
  } catch (error) {
    logger.warn("service_area_invalid_json", {
      requestId,
      route,
      error,
    });

    return NextResponse.json(
      {
        error: "Invalid address request.",
        requestId,
      },
      { status: 400 },
    );
  }

  const streetAddress = cleanString(body.streetAddress, 180);
  const city = cleanString(body.city, 80);
  const state = cleanString(body.state, 20);
  const zipCode = cleanString(body.zipCode, 20);

 if (!streetAddress || !city || !state || !zipCode) {
    return NextResponse.json(
      {
        error:
          "Please enter the complete street address, city, state, and ZIP code before checking the service area.",
        requestId,
      },
      { status: 400 },
    );
  }

  const result = await evaluateServiceArea({
    streetAddress,
    city,
    state,
    zipCode,
  });

  logger.info("service_area_checked", {
    requestId,
    route,
    metadata: {
      status: result.status,
      distanceMiles: result.distanceMiles ?? null,
      maxRadiusMiles: result.maxRadiusMiles,
      city,
      state,
      zipCode: zipCode || null,
    },
  });

  return NextResponse.json(
    {
      ...result,
      requestId,
    },
    { status: 200 },
  );
}
