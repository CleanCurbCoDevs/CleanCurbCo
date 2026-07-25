import {
  hashCustomerFileBytes,
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

type CustomerFileRouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(
  request: Request,
  {
    params,
  }: CustomerFileRouteContext,
) {
  const {
    fileId,
  } = await params;

  const path =
    `/admin/customer-files/${fileId}`;

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

  const {
    data: customerFile,
    error: fileError,
  } = await admin
    .from("customer_files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();

  if (
    fileError ||
    !customerFile
  ) {
    return new Response(
      "The archived customer file could not be found.",
      {
        status: 404,
      },
    );
  }

  const {
    data: storedFile,
    error: downloadError,
  } = await admin.storage
    .from(
      customerFile.storage_bucket,
    )
    .download(
      customerFile.storage_path,
      {},
      {
        cache:
          "no-store",
      },
    );

  if (
    downloadError ||
    !storedFile
  ) {
    return new Response(
      "The archived customer file could not be downloaded.",
      {
        status: 500,
      },
    );
  }

  const bytes =
    Buffer.from(
      await storedFile.arrayBuffer(),
    );

  const actualHash =
    hashCustomerFileBytes(
      bytes,
    );

  if (
    actualHash !==
    customerFile.sha256
  ) {
    return new Response(
      "Integrity verification failed. The archived file does not match its permanent record.",
      {
        status: 409,
      },
    );
  }

  const url =
    new URL(
      request.url,
    );

  const shouldDownload =
    url.searchParams.get(
      "download",
    ) === "1";

  const fileName =
    customerFile.original_filename
      .replace(
        /["\r\n]/g,
        "",
      ) ||
    "customer-file";

  return new Response(
    bytes,
    {
      status: 200,

      headers: {
        "Content-Type":
          customerFile.mime_type,

        "Content-Disposition":
          `${
            shouldDownload
              ? "attachment"
              : "inline"
          }; filename="${fileName}"`,

        "Content-Length":
          String(
            bytes.byteLength,
          ),

        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        "X-Clean-Curb-SHA256":
          actualHash,
      },
    },
  );
}
