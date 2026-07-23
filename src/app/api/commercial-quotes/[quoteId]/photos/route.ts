import { NextResponse } from "next/server";
import {
  COMMERCIAL_QUOTE_MAX_PHOTO_BYTES,
  COMMERCIAL_QUOTE_MAX_PHOTOS,
  COMMERCIAL_QUOTE_PHOTO_BUCKET,
  getCommercialPhotoExtension,
  isAllowedCommercialPhotoType,
} from "@/lib/commercial-photo-config";
import {
  commercialPhotoUploadTokenMatches,
} from "@/lib/server/commercial-photo-token";
import {
  createRequestId,
  logger,
} from "@/lib/server/logger";
import {
  rejectCrossOriginRequest,
  rejectLimitedRequest,
} from "@/lib/server/request-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  cleanString,
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

type IncomingPhotoFile = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

type SignedUploadRequest = {
  uploadToken?: unknown;
  files?: unknown;
};

type CompletedUploadRequest = {
  uploadToken?: unknown;
  paths?: unknown;
};

type ValidatedPhotoFile = {
  name: string;
  type: string;
  size: number;
  extension: string;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const { quoteId: rawQuoteId } =
    await context.params;

  const quoteId = cleanString(
    rawQuoteId,
    80,
  );

  const requestId = createRequestId(
    request.headers,
  );

  const route =
    `/api/commercial-quotes/${quoteId}/photos`;

  const originRejection =
    rejectCrossOriginRequest(request, {
      requestId,
      route,
      action:
        "commercial_quote_photo_sign",
    });

  if (originRejection) {
    return originRejection;
  }

  const limited = rejectLimitedRequest(
    request,
    {
      requestId,
      route,
      action:
        "commercial_quote_photo_sign",
      scope:
        "commercial-quote-photo-sign",
      subject: quoteId,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    },
  );

  if (limited) {
    return limited;
  }

  let body: SignedUploadRequest;

  try {
    body =
      (await request.json()) as SignedUploadRequest;
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid photo upload request.",
        requestId,
      },
      { status: 400 },
    );
  }

  const uploadToken = cleanString(
    body.uploadToken,
    200,
  );

  if (!quoteId || !uploadToken) {
    return NextResponse.json(
      {
        error:
          "The photo upload session is invalid.",
        requestId,
      },
      { status: 400 },
    );
  }

  const rawFiles = Array.isArray(
    body.files,
  )
    ? (body.files as IncomingPhotoFile[])
    : [];

  if (
    rawFiles.length < 1 ||
    rawFiles.length >
      COMMERCIAL_QUOTE_MAX_PHOTOS
  ) {
    return NextResponse.json(
      {
        error: `Select between 1 and ${COMMERCIAL_QUOTE_MAX_PHOTOS} photos.`,
        requestId,
      },
      { status: 400 },
    );
  }

  const files = rawFiles
    .map(validatePhotoFile)
    .filter(
      (
        file,
      ): file is ValidatedPhotoFile =>
        file !== null,
    );

  if (files.length !== rawFiles.length) {
    return NextResponse.json(
      {
        error:
          "One or more photos use an unsupported file type or exceed 10 MB.",
        requestId,
      },
      { status: 400 },
    );
  }

  const access =
    await loadAuthorizedQuote(
      quoteId,
      uploadToken,
    );

  if ("error" in access) {
    return NextResponse.json(
      {
        error: access.error,
        requestId,
      },
      { status: access.status },
    );
  }

  const existingPaths =
    access.quote.photo_paths ?? [];

  if (
    existingPaths.length +
      files.length >
    COMMERCIAL_QUOTE_MAX_PHOTOS
  ) {
    return NextResponse.json(
      {
        error: `This request can have no more than ${COMMERCIAL_QUOTE_MAX_PHOTOS} photos.`,
        requestId,
      },
      { status: 400 },
    );
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const path =
          `${quoteId}/${crypto.randomUUID()}.${file.extension}`;

        const {
          data,
          error,
        } = await access.admin.storage
          .from(
            COMMERCIAL_QUOTE_PHOTO_BUCKET,
          )
          .createSignedUploadUrl(path);

        if (
          error ||
          !data?.token
        ) {
          throw (
            error ??
            new Error(
              "Signed upload could not be created.",
            )
          );
        }

        return {
          path,
          token: data.token,
          name: file.name,
          type: file.type,
          size: file.size,
        };
      }),
    );

    return NextResponse.json({
      uploads,
      requestId,
    });
  } catch (error) {
    logger.error(
      "commercial_quote_photo_sign_failed",
      {
        requestId,
        route,
        error,
        metadata: {
          quoteId,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "Photo upload permissions could not be created.",
        requestId,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const { quoteId: rawQuoteId } =
    await context.params;

  const quoteId = cleanString(
    rawQuoteId,
    80,
  );

  const requestId = createRequestId(
    request.headers,
  );

  const route =
    `/api/commercial-quotes/${quoteId}/photos`;

  const originRejection =
    rejectCrossOriginRequest(request, {
      requestId,
      route,
      action:
        "commercial_quote_photo_complete",
    });

  if (originRejection) {
    return originRejection;
  }

  const limited = rejectLimitedRequest(
    request,
    {
      requestId,
      route,
      action:
        "commercial_quote_photo_complete",
      scope:
        "commercial-quote-photo-complete",
      subject: quoteId,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    },
  );

  if (limited) {
    return limited;
  }

  let body: CompletedUploadRequest;

  try {
    body =
      (await request.json()) as CompletedUploadRequest;
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid photo completion request.",
        requestId,
      },
      { status: 400 },
    );
  }

  const uploadToken = cleanString(
    body.uploadToken,
    200,
  );

  const requestedPaths =
    Array.isArray(body.paths)
      ? Array.from(
          new Set(
            body.paths
              .map((path) =>
                cleanString(path, 500),
              )
              .filter(Boolean),
          ),
        )
      : [];

  if (
    !quoteId ||
    !uploadToken ||
    !requestedPaths.length
  ) {
    return NextResponse.json(
      {
        error:
          "The completed photo upload is invalid.",
        requestId,
      },
      { status: 400 },
    );
  }

  if (
    requestedPaths.length >
    COMMERCIAL_QUOTE_MAX_PHOTOS
  ) {
    return NextResponse.json(
      {
        error:
          "Too many photo paths were submitted.",
        requestId,
      },
      { status: 400 },
    );
  }

  const quotePrefix = `${quoteId}/`;

  if (
    requestedPaths.some(
      (path) =>
        !path.startsWith(quotePrefix) ||
        path.includes(".."),
    )
  ) {
    return NextResponse.json(
      {
        error:
          "One or more photo paths are invalid.",
        requestId,
      },
      { status: 400 },
    );
  }

  const access =
    await loadAuthorizedQuote(
      quoteId,
      uploadToken,
    );

  if ("error" in access) {
    return NextResponse.json(
      {
        error: access.error,
        requestId,
      },
      { status: access.status },
    );
  }

  const {
    data: storedObjects,
    error: storageError,
  } = await access.admin.storage
    .from(
      COMMERCIAL_QUOTE_PHOTO_BUCKET,
    )
    .list(quoteId, {
      limit: 100,
    });

  if (storageError) {
    logger.error(
      "commercial_quote_photo_list_failed",
      {
        requestId,
        route,
        error: storageError,
        metadata: {
          quoteId,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "Uploaded photos could not be verified.",
        requestId,
      },
      { status: 500 },
    );
  }

  const storedPaths = new Set(
    (storedObjects ?? [])
      .filter((item) => item.name)
      .map(
        (item) =>
          `${quoteId}/${item.name}`,
      ),
  );

  if (
    requestedPaths.some(
      (path) =>
        !storedPaths.has(path),
    )
  ) {
    return NextResponse.json(
      {
        error:
          "One or more uploaded photos could not be verified.",
        requestId,
      },
      { status: 400 },
    );
  }

  const mergedPaths = Array.from(
    new Set([
      ...(access.quote.photo_paths ?? []),
      ...requestedPaths,
    ]),
  );

  if (
    mergedPaths.length >
    COMMERCIAL_QUOTE_MAX_PHOTOS
  ) {
    return NextResponse.json(
      {
        error: `This request can have no more than ${COMMERCIAL_QUOTE_MAX_PHOTOS} photos.`,
        requestId,
      },
      { status: 400 },
    );
  }

  const {
    data: updatedQuote,
    error: updateError,
  } = await access.admin
    .from(
      "commercial_quote_requests",
    )
    .update({
      photo_paths: mergedPaths,
    })
    .eq("id", quoteId)
    .select(
      "id, photo_paths",
    )
    .single();

  if (
    updateError ||
    !updatedQuote
  ) {
    logger.error(
      "commercial_quote_photo_paths_update_failed",
      {
        requestId,
        route,
        error: updateError,
        metadata: {
          quoteId,
        },
      },
    );

    return NextResponse.json(
      {
        error:
          "The uploaded photos could not be attached to the request.",
        requestId,
      },
      { status: 500 },
    );
  }

  logger.info(
    "commercial_quote_photos_completed",
    {
      requestId,
      route,
      metadata: {
        quoteId,
        photoCount:
          updatedQuote.photo_paths.length,
      },
    },
  );

  return NextResponse.json({
    photoPaths:
      updatedQuote.photo_paths,
    requestId,
  });
}

function validatePhotoFile(
  rawFile: IncomingPhotoFile,
): ValidatedPhotoFile | null {
  if (
    !rawFile ||
    typeof rawFile !== "object"
  ) {
    return null;
  }

  const name = cleanString(
    rawFile.name,
    220,
  );

  const type = cleanString(
    rawFile.type,
    100,
  ).toLowerCase();

  const size =
    typeof rawFile.size === "number"
      ? rawFile.size
      : Number(rawFile.size);

  const extension =
    getCommercialPhotoExtension(
      name,
      type,
    );

  if (
    !name ||
    !isAllowedCommercialPhotoType(
      type,
    ) ||
    !Number.isFinite(size) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size >
      COMMERCIAL_QUOTE_MAX_PHOTO_BYTES ||
    !extension
  ) {
    return null;
  }

  return {
    name,
    type,
    size,
    extension,
  };
}

async function loadAuthorizedQuote(
  quoteId: string,
  uploadToken: string,
) {
  const admin = getSupabaseAdmin();

  const {
    data: quote,
    error,
  } = await admin
    .from(
      "commercial_quote_requests",
    )
    .select(
      `
        id,
        photo_paths,
        photo_upload_token_hash,
        photo_upload_expires_at
      `,
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (error || !quote) {
    return {
      error:
        "The commercial quote request was not found.",
      status: 404,
    } as const;
  }

  if (
    !quote.photo_upload_token_hash ||
    !quote.photo_upload_expires_at
  ) {
    return {
      error:
        "Photo uploads are not available for this request.",
      status: 403,
    } as const;
  }

  if (
    new Date(
      quote.photo_upload_expires_at,
    ).getTime() <= Date.now()
  ) {
    return {
      error:
        "This photo upload session has expired.",
      status: 410,
    } as const;
  }

  if (
    !commercialPhotoUploadTokenMatches(
      uploadToken,
      quote.photo_upload_token_hash,
    )
  ) {
    return {
      error:
        "The photo upload session is invalid.",
      status: 403,
    } as const;
  }

  return {
    admin,
    quote,
  } as const;
}
