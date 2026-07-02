import { NextResponse } from "next/server";
import {
  readJsonBody,
  requireAdminOptimoRouteApi,
} from "@/lib/optimoroute/api-auth";
import {
  isValidRouteDayId,
  startOptimoRoutePlanning,
} from "@/lib/optimoroute/route-sync";

type Payload = {
  routeDayId?: unknown;
};

export async function POST(request: Request) {
  const route = "/api/admin/optimoroute/start-planning";
  const auth = await requireAdminOptimoRouteApi(
    request,
    route,
    "optimoroute_start_planning",
  );
  if ("response" in auth) return auth.response;

  const payload = await readJsonBody<Payload>(request);
  if (!payload || !isValidRouteDayId(payload.routeDayId)) {
    return NextResponse.json(
      { error: "A valid route day is required.", requestId: auth.requestId },
      { status: 400 },
    );
  }

  const result = await startOptimoRoutePlanning(
    String(payload.routeDayId),
    auth.context,
  );

  return NextResponse.json(
    { ...result, requestId: auth.requestId },
    { status: result.status },
  );
}
