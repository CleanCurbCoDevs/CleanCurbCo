import { NextResponse } from "next/server";
import {
  readJsonBody,
  requireAdminOptimoRouteApi,
} from "@/lib/optimoroute/api-auth";
import {
  isValidRouteDayId,
  syncRouteDayToOptimoRoute,
} from "@/lib/optimoroute/route-sync";

type Payload = {
  routeDayId?: unknown;
  includePaymentBlocked?: unknown;
  includeNotApproved?: unknown;
};

export async function POST(request: Request) {
  const route = "/api/admin/optimoroute/sync";
  const auth = await requireAdminOptimoRouteApi(
    request,
    route,
    "optimoroute_sync_stops",
  );
  if ("response" in auth) return auth.response;

  const payload = await readJsonBody<Payload>(request);
  if (!payload || !isValidRouteDayId(payload.routeDayId)) {
    return NextResponse.json(
      { error: "A valid route day is required.", requestId: auth.requestId },
      { status: 400 },
    );
  }

  const result = await syncRouteDayToOptimoRoute(
    String(payload.routeDayId),
    {
      includePaymentBlocked: payload.includePaymentBlocked === true,
      includeNotApproved: payload.includeNotApproved === true,
    },
    auth.context,
  );

  return NextResponse.json(
    { ...result, requestId: auth.requestId },
    { status: result.status },
  );
}
