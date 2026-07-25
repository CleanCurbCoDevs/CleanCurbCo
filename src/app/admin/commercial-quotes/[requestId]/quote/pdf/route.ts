import {
  NextResponse,
} from "next/server";

import {
  COMMERCIAL_QUOTE_DOCUMENT_TYPE,
} from "@/lib/customer-file-archive";

import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

import {
  requireAdmin,
} from "@/lib/supabase/auth";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type CommercialQuotePdfRouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function GET(
  request: Request,
  {
    params,
  }: CommercialQuotePdfRouteContext,
) {
  const {
    requestId,
  } = await params;

  const path =
    `/admin/commercial-quotes/${requestId}/quote/pdf`;

  const auth =
    await requireAdmin(path);

  if (
    auth.status !== "ok"
  ) {
    return new Response(
      auth.message,
      {
        status: 503,
      },
    );
  }

  const {
    data: customerFile,
    error,
  } = await getSupabaseAdmin()
    .from("customer_files")
    .select("id")
    .eq(
      "commercial_request_id",
      requestId,
    )
    .eq(
      "document_type",
      COMMERCIAL_QUOTE_DOCUMENT_TYPE,
    )
    .neq(
      "status",
      "void",
    )
    .order(
      "version_number",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    error ||
    !customerFile
  ) {
    return new Response(
      "Generate the exact customer copy before previewing or downloading it.",
      {
        status: 404,
      },
    );
  }

  const url =
    new URL(
      request.url,
    );

  const downloadQuery =
    url.searchParams.get(
      "download",
    ) === "1"
      ? "?download=1"
      : "";

  return NextResponse.redirect(
    new URL(
      `/admin/customer-files/${customerFile.id}${downloadQuery}`,
      request.url,
    ),
  );
}
