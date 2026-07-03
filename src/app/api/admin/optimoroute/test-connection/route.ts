import { NextResponse } from "next/server";
import { requireAdminOptimoRouteApi } from "@/lib/optimoroute/api-auth";
import { testOptimoRouteConnection } from "@/lib/optimoroute/route-sync";

export async function POST(request: Request) {
  const route = "/api/admin/optimoroute/test-connection";
  const auth = await requireAdminOptimoRouteApi(
    request,
    route,
    "optimoroute_test_connection",
  );
  if ("response" in auth) return auth.response;

  const result = await testOptimoRouteConnection(auth.context);

  return NextResponse.json(
    { ...result, requestId: auth.requestId },
    { status: result.status },
  );
}
