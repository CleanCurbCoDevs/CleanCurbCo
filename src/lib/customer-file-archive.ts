import "server-only";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  createCommercialQuotePdf,
} from "@/lib/commercial-quote-pdf";

import {
  COMMERCIAL_DEPOSIT_POLICY_SUMMARY,
  COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,
  calculateCommercialRemainingBalanceCents,
  calculateCommercialSchedulingDepositCents,
  resolveCommercialPaymentTerms,
} from "@/lib/commercial-quote-policy";

import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

import type {
  CommercialQuoteRequestRow,
  CommercialQuoteRow,
  CustomerFileRow,
  Database,
} from "@/types/database";

export const CUSTOMER_FILE_BUCKET =
  "customer-files";

export const COMMERCIAL_QUOTE_DOCUMENT_TYPE =
  "commercial_quote";

type AdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type ArchiveCommercialQuoteInput = {
  admin: AdminClient;
  request: CommercialQuoteRequestRow;
  quote: CommercialQuoteRow;
  generatedByUserId: string;
};

type ArchiveCommercialQuoteResult = {
  file: CustomerFileRow;
  reused: boolean;
};

export function buildCommercialQuoteCustomerSnapshot(
  request:
    CommercialQuoteRequestRow,

  quote:
    CommercialQuoteRow,

  lineItems:
    CommercialQuoteLineItemRow[] =
    [],
) {
  const depositBasePriceCents =
    quote.final_initial_price_cents > 0
      ? quote.final_initial_price_cents
      : quote.final_recurring_price_cents ??
        0;

  return {
    schemaVersion: 2,

    customer: {
      businessName:
        request.business_name,

      contactName:
        request.contact_name,

      contactRole:
        request.contact_role,

      email:
        request.email,

      phone:
        request.phone,

      streetAddress:
        request.street_address,

      city:
        request.city,

      state:
        request.state,

      zipCode:
        request.zip_code,

      locationCount:
        request.location_count,
    },

    quote: {
      id:
        quote.id,

      quoteNumber:
        quote.quote_number,

      versionNumber:
        quote.version_number,

      currency:
        quote.currency,

      initialPriceCents:
        quote.final_initial_price_cents,

      recurringPriceCents:
        quote.final_recurring_price_cents,

      recurringFrequency:
        quote.recurring_frequency,

      taxCents:
        quote.tax_cents,

      paymentSchedule: {
        schedulingDepositPercent:
          quote
            .scheduling_deposit_percent,

        totalPreServicePercent:
          quote
            .total_pre_service_percent,

        additionalPreServicePercent:
          quote
            .additional_pre_service_percent,

        completionBalancePercent:
          quote
            .completion_balance_percent,

        schedulingDepositCents:
          quote
            .scheduling_deposit_cents,

        additionalPreServiceCents:
          quote
            .additional_pre_service_cents,

        completionBalanceCents:
          quote
            .completion_balance_cents,

        additionalPreServiceDueBusinessDays:
          quote
            .additional_pre_service_due_business_days,

        fullPaymentAllowed:
          quote
            .full_payment_allowed,

        source:
          quote
            .deposit_tier_source,

        overrideReason:
          quote
            .deposit_override_reason,
      },

      customerPricingLines:
        lineItems
          .filter(
            (item) =>
              item
                .is_customer_visible,
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.sort_order -
              right.sort_order,
          )
          .map(
            (item) => ({
              itemType:
                item.item_type,

              name:
                item.name,

              description:
                item.description,

              quantity:
                item.quantity,

              unitLabel:
                item.unit_label,

              amountCents:
                item.amount_cents,

              isOptional:
                item.is_optional,

              metadata:
                item.metadata,
            }),
          ),

      scopeSummary:
        quote.scope_summary,

      customerNotes:
        quote.customer_notes,

      includedServices:
        quote.included_services,

      assumptions:
        quote.assumptions,

      exclusions:
        quote.exclusions,

      paymentTerms:
        resolveCommercialPaymentTerms(
          quote.payment_terms,
        ),

      validUntil:
        quote.valid_until,
    },

    policy: {
      schedulingDepositPercent:
        COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,

      depositPolicy:
        COMMERCIAL_DEPOSIT_POLICY_SUMMARY,
    },
  };
}

export function getCommercialQuoteSourceSnapshotHash(
  request:
    CommercialQuoteRequestRow,

  quote:
    CommercialQuoteRow,

  lineItems:
    CommercialQuoteLineItemRow[] =
    [],
) {
  return hashJson(
    buildCommercialQuoteCustomerSnapshot(
      request,
      quote,
      lineItems,
    ),
  );
}

export function hashCustomerFileBytes(
  bytes:
    | Uint8Array
    | Buffer
    | ArrayBuffer,
) {
  const buffer =
    bytes instanceof ArrayBuffer
      ? Buffer.from(bytes)
      : Buffer.from(bytes);

  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

export async function archiveCommercialQuoteCustomerCopy({
  admin,
  request,
  quote,
  generatedByUserId,
}: ArchiveCommercialQuoteInput): Promise<ArchiveCommercialQuoteResult> {

    const {
    data:
      quoteLineItems,

    error:
      quoteLineItemsError,
  } = await admin
    .from(
      "commercial_quote_line_items",
    )
    .select("*")
    .eq(
      "quote_id",
      quote.id,
    )
    .eq(
      "is_customer_visible",
      true,
    )
    .order(
      "sort_order",
      {
        ascending:
          true,
      },
    );

  if (quoteLineItemsError) {
    throw quoteLineItemsError;
  }

  const lineItems =
    quoteLineItems ?? [];
  
  const sourceSnapshot =
    buildCommercialQuoteCustomerSnapshot(
      request,
      quote,
      lineItems,
    );

  const sourceSnapshotHash =
    hashJson(sourceSnapshot);

  const {
    data: latestFile,
    error: latestFileError,
  } = await admin
    .from("customer_files")
    .select("*")
    .eq(
      "commercial_quote_id",
      quote.id,
    )
    .eq(
      "document_type",
      COMMERCIAL_QUOTE_DOCUMENT_TYPE,
    )
    .order(
      "version_number",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (latestFileError) {
    throw latestFileError;
  }

  if (
    latestFile &&
    latestFile.source_snapshot_hash ===
      sourceSnapshotHash &&
    [
      "ready",
      "sent",
      "received",
    ].includes(latestFile.status)
  ) {
    return {
      file: latestFile,
      reused: true,
    };
  }

  const nextVersionNumber =
    (latestFile?.version_number ??
      0) + 1;

  const fileId =
    randomUUID();

  const fileName =
    createCommercialQuoteFileName(
      request.business_name,
      quote.quote_number,
      nextVersionNumber,
    );

  const storagePath = [
    "commercial",
    request.id,
    "quotes",
    quote.id,
    fileId,
    fileName,
  ].join("/");

  const pdfBytes =
    await createCommercialQuotePdf({
      request,
      quote,
      lineItems,  
    });

  const fileBuffer =
    Buffer.from(pdfBytes);

  const sha256 =
    hashCustomerFileBytes(
      fileBuffer,
    );

  const {
    error: uploadError,
  } = await admin.storage
    .from(
      CUSTOMER_FILE_BUCKET,
    )
    .upload(
      storagePath,
      fileBuffer,
      {
        contentType:
          "application/pdf",

        cacheControl:
          "3600",

        upsert:
          false,
      },
    );

  if (uploadError) {
    throw uploadError;
  }

  const insertPayload:
    Database["public"]["Tables"]["customer_files"]["Insert"] =
    {
      id:
        fileId,

      commercial_request_id:
        request.id,

      commercial_quote_id:
        quote.id,

      file_kind:
        "document",

      document_type:
        COMMERCIAL_QUOTE_DOCUMENT_TYPE,

      display_name:
        "Commercial Quote",

      original_filename:
        fileName,

      storage_bucket:
        CUSTOMER_FILE_BUCKET,

      storage_path:
        storagePath,

      mime_type:
        "application/pdf",

      size_bytes:
        fileBuffer.byteLength,

      sha256,

      version_number:
        nextVersionNumber,

      status:
        "ready",

      is_customer_visible:
        true,

      is_immutable:
        true,

      source_snapshot_hash:
        sourceSnapshotHash,

      source_snapshot:
        sourceSnapshot,

      generated_by_user_id:
        generatedByUserId,

      finalized_at:
        new Date().toISOString(),

      metadata: {
        businessName:
          request.business_name,

        quoteNumber:
          quote.quote_number,

        exactCustomerCopy:
          true,
      },
    };

  const {
    data: insertedFile,
    error: insertError,
  } = await admin
    .from("customer_files")
    .insert(insertPayload)
    .select("*")
    .single();

  if (
    insertError ||
    !insertedFile
  ) {
    await admin.storage
      .from(
        CUSTOMER_FILE_BUCKET,
      )
      .remove([
        storagePath,
      ]);

    throw (
      insertError ??
      new Error(
        "The archived customer file record was not created.",
      )
    );
  }

  await admin
    .from("customer_files")
    .update({
      status:
        "superseded",

      superseded_at:
        new Date().toISOString(),
    })
    .eq(
      "commercial_quote_id",
      quote.id,
    )
    .eq(
      "document_type",
      COMMERCIAL_QUOTE_DOCUMENT_TYPE,
    )
    .neq(
      "id",
      insertedFile.id,
    )
    .in(
      "status",
      [
        "generated",
        "ready",
      ],
    );

  return {
    file:
      insertedFile,

    reused:
      false,
  };
}

function createCommercialQuoteFileName(
  businessName: string,
  quoteNumber: string | null,
  fileVersion: number,
) {
  const businessSlug =
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
      .slice(0, 55) ||
    "commercial-customer";

  const quoteSlug =
    (
      quoteNumber ??
      "commercial-quote"
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 45);

  return `${businessSlug}-${quoteSlug}-file-v${fileVersion}.pdf`;
}

function hashJson(
  value: unknown,
) {
  return createHash("sha256")
    .update(
      stableStringify(value),
    )
    .digest("hex");
}

function stableStringify(
  value: unknown,
) {
  return JSON.stringify(
    sortJsonValue(value),
  );
}

function sortJsonValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      sortJsonValue,
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(
      value,
    )
      .sort()
      .reduce<
        Record<string, unknown>
      >(
        (
          result,
          key,
        ) => {
          result[key] =
            sortJsonValue(
              (
                value as
                  Record<
                    string,
                    unknown
                  >
              )[key],
            );

          return result;
        },
        {},
      );
  }

  return value;
}
