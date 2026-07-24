import {
  createCommercialQuotePdf,
} from "@/lib/commercial-quote-pdf";

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
  httpRequest: Request,
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

  const admin =
    getSupabaseAdmin();

  const [
    requestResult,
    quoteResult,
  ] = await Promise.all([
    admin
      .from(
        "commercial_quote_requests",
      )
      .select("*")
      .eq("id", requestId)
      .maybeSingle(),

    admin
      .from(
        "commercial_quotes",
      )
      .select("*")
      .eq(
        "request_id",
        requestId,
      )
      .eq(
        "status",
        "draft",
      )
      .order(
        "version_number",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    requestResult.error ||
    quoteResult.error
  ) {
    return new Response(
      "The commercial quote PDF could not be loaded.",
      {
        status: 500,
      },
    );
  }

  const commercialRequest =
    requestResult.data;

  const quote =
    quoteResult.data;

  if (!commercialRequest) {
    return new Response(
      "The commercial quote request was not found.",
      {
        status: 404,
      },
    );
  }

  if (!quote) {
    return new Response(
      "Save the commercial quote draft before previewing its PDF.",
      {
        status: 404,
      },
    );
  }

  const pdfBytes =
    await createCommercialQuotePdf(
      {
        request:
          commercialRequest,

        quote,
      },
    );

  const url =
    new URL(
      httpRequest.url,
    );

  const shouldDownload =
    url.searchParams.get(
      "download",
    ) === "1";

  const fileName =
    createQuoteFileName(
      commercialRequest
        .business_name,

      quote.quote_number ??
        `draft-v${quote.version_number}`,
    );

  return new Response(
    Buffer.from(
      pdfBytes,
    ),
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `${
            shouldDownload
              ? "attachment"
              : "inline"
          }; filename="${fileName}"`,

        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function createQuoteFileName(
  businessName: string,
  quoteReference: string,
) {
  const safeBusinessName =
    businessName
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 60) ||
    "commercial-customer";

  const safeReference =
    quoteReference
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 40) ||
    "quote";

  return `${safeBusinessName}-${safeReference}.pdf`;
}
