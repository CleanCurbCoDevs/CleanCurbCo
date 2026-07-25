"use server";

import {
  randomUUID,
} from "node:crypto";

import {
  revalidatePath,
} from "next/cache";

import {
  actionFailure,
  actionSuccess,
  type ActionResult,
} from "@/lib/action-result";

import {
  COMMERCIAL_QUOTE_DOCUMENT_TYPE,
  getCommercialQuoteSourceSnapshotHash,
  hashCustomerFileBytes,
} from "@/lib/customer-file-archive";

import {
  sendTransactionalEmail,
} from "@/lib/email/resend";

import {
  commercialQuoteDeliveryTemplate,
} from "@/lib/email/templates";

import {
  writeAdminAuditLog,
} from "@/lib/server/admin-audit";

import {
  createRequestId,
  logger,
  maskEmail,
} from "@/lib/server/logger";

import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

import {
  requireAdmin,
} from "@/lib/supabase/auth";

import {
  cleanString,
  isValidEmail,
} from "@/lib/validation";

import type {
  Database,
} from "@/types/database";

export async function sendCommercialQuoteCustomerCopyAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireAdmin(
      "/admin/commercial-quotes",
    );

  if (
    auth.status !== "ok"
  ) {
    return actionFailure(
      "Admin access is required.",
    );
  }

  const auditRequestId =
    createRequestId();

  const commercialRequestId =
    cleanString(
      formData.get(
        "commercialRequestId",
      ),
      80,
    );

  const customerFileId =
    cleanString(
      formData.get(
        "customerFileId",
      ),
      80,
    );

  if (
    !commercialRequestId ||
    !customerFileId
  ) {
    return actionFailure(
      "The commercial request or archived file ID is missing.",
    );
  }

  const admin =
    getSupabaseAdmin();

  const {
    data:
      customerFile,

    error:
      customerFileError,
  } = await admin
    .from(
      "customer_files",
    )
    .select("*")
    .eq(
      "id",
      customerFileId,
    )
    .eq(
      "commercial_request_id",
      commercialRequestId,
    )
    .maybeSingle();

  if (
    customerFileError ||
    !customerFile
  ) {
    return actionFailure(
      "The archived customer copy could not be found.",
    );
  }

  if (
    customerFile.document_type !==
      COMMERCIAL_QUOTE_DOCUMENT_TYPE ||
    !customerFile
      .commercial_quote_id ||
    !customerFile
      .is_customer_visible ||
    !customerFile
      .is_immutable ||
    ![
      "ready",
      "sent",
      "received",
    ].includes(
      customerFile.status,
    )
  ) {
    return actionFailure(
      "This file is not an eligible commercial quote customer copy.",
    );
  }

  const commercialQuoteId =
    customerFile
      .commercial_quote_id;

  const [
    commercialRequestResult,
    commercialQuoteResult,
    lineItemsResult,
    latestFileResult,
  ] = await Promise.all([
    admin
      .from(
        "commercial_quote_requests",
      )
      .select("*")
      .eq(
        "id",
        commercialRequestId,
      )
      .maybeSingle(),

    admin
      .from(
        "commercial_quotes",
      )
      .select("*")
      .eq(
        "id",
        commercialQuoteId,
      )
      .eq(
        "request_id",
        commercialRequestId,
      )
      .maybeSingle(),

    admin
      .from(
        "commercial_quote_line_items",
      )
      .select("*")
      .eq(
        "quote_id",
        commercialQuoteId,
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
      ),

    admin
      .from(
        "customer_files",
      )
      .select("*")
      .eq(
        "commercial_quote_id",
        commercialQuoteId,
      )
      .eq(
        "document_type",
        COMMERCIAL_QUOTE_DOCUMENT_TYPE,
      )
      .in(
        "status",
        [
          "ready",
          "sent",
          "received",
        ],
      )
      .order(
        "version_number",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle(),
  ]);

  const commercialRequest =
    commercialRequestResult.data;

  const commercialQuote =
    commercialQuoteResult.data;

  const lineItems =
    lineItemsResult.data ??
    [];

  const latestFile =
    latestFileResult.data;

  if (
    commercialRequestResult.error ||
    !commercialRequest ||
    commercialQuoteResult.error ||
    !commercialQuote ||
    lineItemsResult.error
  ) {
    return actionFailure(
      "The commercial request or saved quote could not be loaded.",
    );
  }

  if (
    latestFileResult.error ||
    !latestFile ||
    latestFile.id !==
      customerFile.id
  ) {
    return actionFailure(
      "Only the latest archived customer copy can be emailed.",
    );
  }

  if (
    !isValidEmail(
      commercialRequest.email,
    )
  ) {
    return actionFailure(
      "The commercial request does not have a valid customer email address.",
    );
  }

  const currentSourceHash =
    getCommercialQuoteSourceSnapshotHash(
      commercialRequest,
      commercialQuote,
      lineItems,
    );

  if (
    customerFile
      .source_snapshot_hash !==
    currentSourceHash
  ) {
    return actionFailure(
      "This customer copy is stale. Save the quote and regenerate the customer copy before sending it.",
    );
  }

  const {
    data:
      storedFile,

    error:
      downloadError,
  } = await admin.storage
    .from(
      customerFile
        .storage_bucket,
    )
    .download(
      customerFile
        .storage_path,
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
    return actionFailure(
      "The archived PDF could not be downloaded for delivery.",
    );
  }

  const fileBytes =
    Buffer.from(
      await storedFile
        .arrayBuffer(),
    );

  const actualHash =
    hashCustomerFileBytes(
      fileBytes,
    );

  if (
    actualHash !==
      customerFile.sha256 ||
    fileBytes.byteLength !==
      customerFile.size_bytes
  ) {
    logger.error(
      "admin_commercial_quote_delivery_integrity_failed",
      {
        requestId:
          auditRequestId,

        action:
          "commercial_quote_email_send",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        metadata: {
          commercialRequestId,
          commercialQuoteId,
          customerFileId,
          expectedHash:
            customerFile.sha256,
          actualHash,
          expectedSize:
            customerFile.size_bytes,
          actualSize:
            fileBytes.byteLength,
        },
      },
    );

    return actionFailure(
      "Integrity verification failed. The stored PDF does not match its permanent archive record.",
    );
  }

  const attachmentContent =
    fileBytes.toString(
      "base64",
    );

  const attachmentSizeAfterEncoding =
    Buffer.byteLength(
      attachmentContent,
      "utf8",
    );

  if (
    attachmentSizeAfterEncoding >
    40 * 1024 * 1024
  ) {
    return actionFailure(
      "The archived PDF is too large to send as an email attachment.",
    );
  }

  const template =
    commercialQuoteDeliveryTemplate(
      commercialRequest,
      commercialQuote,
      customerFile,
    );

  const deliveryId =
    randomUUID();

  const deliveryPayload:
    Database["public"]["Tables"]["customer_deliveries"]["Insert"] =
    {
      id:
        deliveryId,

      commercial_request_id:
        commercialRequest.id,

      commercial_quote_id:
        commercialQuote.id,

      channel:
        "email",

      status:
        "queued",

      recipient_name:
        commercialRequest
          .contact_name,

      recipient_email:
        commercialRequest.email,

      subject:
        template.subject,

      message_text:
        template.text,

      provider:
        "resend",

      created_by_user_id:
        auth.userId,

      metadata: {
        customerFileId:
          customerFile.id,

        fileVersion:
          customerFile
            .version_number,

        sha256:
          customerFile.sha256,

        quoteNumber:
          commercialQuote
            .quote_number,

        exactCustomerCopy:
          true,
      },
    };

  const {
    error:
      deliveryInsertError,
  } = await admin
    .from(
      "customer_deliveries",
    )
    .insert(
      deliveryPayload,
    );

  if (
    deliveryInsertError
  ) {
    logger.error(
      "admin_commercial_quote_delivery_record_create_failed",
      {
        requestId:
          auditRequestId,

        action:
          "commercial_quote_email_send",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        metadata: {
          commercialRequestId,
          commercialQuoteId,
          customerFileId,
          deliveryId,
        },

        error:
          deliveryInsertError,
      },
    );

    return actionFailure(
      "The delivery record could not be created, so the quote was not emailed.",
    );
  }

  const {
    error:
      deliveryFileLinkError,
  } = await admin
    .from(
      "customer_delivery_files",
    )
    .insert({
      delivery_id:
        deliveryId,

      customer_file_id:
        customerFile.id,

      sort_order:
        10,
    });

  if (
    deliveryFileLinkError
  ) {
    const failedAt =
      new Date()
        .toISOString();

    await admin
      .from(
        "customer_deliveries",
      )
      .update({
        status:
          "failed",

        failed_at:
          failedAt,

        error_message:
          "The archived file could not be linked to the delivery record.",
      })
      .eq(
        "id",
        deliveryId,
      );

    return actionFailure(
      "The archived file could not be linked to the delivery record, so the email was not sent.",
    );
  }

  const emailResult =
    await sendTransactionalEmail({
      to:
        commercialRequest.email,

      ...template,

      templateKey:
        "commercial_quote_delivery",

      idempotencyKey:
        `commercial-quote-delivery-${deliveryId}`,

      attachments: [
        {
          filename:
            customerFile
              .original_filename,

          content:
            attachmentContent,
        },
      ],
    });

  if (
    emailResult.status !==
    "sent"
  ) {
    const failedAt =
      new Date()
        .toISOString();

    const errorMessage =
      emailResult.status ===
      "skipped"
        ? emailResult.reason
        : getErrorMessage(
            emailResult.error,
          );

    await admin
      .from(
        "customer_deliveries",
      )
      .update({
        status:
          "failed",

        failed_at:
          failedAt,

        error_message:
          errorMessage,
      })
      .eq(
        "id",
        deliveryId,
      );

    await writeAdminAuditLog({
      action:
        "commercial_quote_email_failed",

      actor_user_id:
        auth.userId,

      actor_email:
        maskEmail(
          auth.email,
        ),

      actor_role:
        auth.profile.role,

      target_type:
        "customer_delivery",

      target_id:
        deliveryId,

      customer_id:
        null,

      booking_id:
        null,

      before_summary: {
        fileStatus:
          customerFile.status,

        quoteStatus:
          commercialQuote.status,
      },

      after_summary: {
        deliveryStatus:
          "failed",
      },

      note:
        null,

      request_id:
        auditRequestId,

      status:
        "failure",

      metadata: {
        commercialRequestId,
        commercialQuoteId,
        customerFileId,
        recipientEmail:
          maskEmail(
            commercialRequest.email,
          ),
        errorMessage,
      },
    });

    logger.error(
      "admin_commercial_quote_email_failed",
      {
        requestId:
          auditRequestId,

        action:
          "commercial_quote_email_send",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        metadata: {
          commercialRequestId,
          commercialQuoteId,
          customerFileId,
          deliveryId,
          recipientEmail:
            maskEmail(
              commercialRequest.email,
            ),
          errorMessage,
        },

        error:
          emailResult.status ===
          "failed"
            ? emailResult.error
            : emailResult.reason,
      },
    );

    return actionFailure(
      "The quote email was not sent. The failed attempt was recorded.",
    );
  }

  const sentAt =
    new Date()
      .toISOString();

  const [
    deliveryUpdateResult,
    fileUpdateResult,
    quoteUpdateResult,
    requestUpdateResult,
  ] = await Promise.all([
    admin
      .from(
        "customer_deliveries",
      )
      .update({
        status:
          "sent",

        provider_message_id:
          emailResult.id,

        sent_at:
          sentAt,

        failed_at:
          null,

        error_message:
          null,
      })
      .eq(
        "id",
        deliveryId,
      ),

    admin
      .from(
        "customer_files",
      )
      .update({
        status:
          customerFile.status ===
          "received"
            ? "received"
            : "sent",

        sent_at:
          customerFile.sent_at ??
          sentAt,
      })
      .eq(
        "id",
        customerFile.id,
      ),

    admin
      .from(
        "commercial_quotes",
      )
      .update({
        status:
          "sent",

        sent_at:
          commercialQuote.sent_at ??
          sentAt,

        sent_version_snapshot:
          customerFile
            .source_snapshot,

        updated_by_user_id:
          auth.userId,
      })
      .eq(
        "id",
        commercialQuote.id,
      ),

    admin
      .from(
        "commercial_quote_requests",
      )
      .update({
        status:
          "quoted",
      })
      .eq(
        "id",
        commercialRequest.id,
      )
      .in(
        "status",
        [
          "new",
          "reviewing",
          "site_visit_needed",
          "quoted",
        ],
      ),
  ]);

  const trackingErrors = [
    deliveryUpdateResult.error
      ? "delivery record"
      : null,

    fileUpdateResult.error
      ? "customer file"
      : null,

    quoteUpdateResult.error
      ? "quote status"
      : null,

    requestUpdateResult.error
      ? "request status"
      : null,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  await writeAdminAuditLog({
    action:
      "commercial_quote_email_sent",

    actor_user_id:
      auth.userId,

    actor_email:
      maskEmail(
        auth.email,
      ),

    actor_role:
      auth.profile.role,

    target_type:
      "customer_delivery",

    target_id:
      deliveryId,

    customer_id:
      null,

    booking_id:
      null,

    before_summary: {
      fileStatus:
        customerFile.status,

      quoteStatus:
        commercialQuote.status,
    },

    after_summary: {
      deliveryStatus:
        "sent",

      fileStatus:
        customerFile.status ===
        "received"
          ? "received"
          : "sent",

      quoteStatus:
        "sent",

      providerMessageId:
        emailResult.id,
    },

    note:
      null,

    request_id:
      auditRequestId,

    status:
      "success",

    metadata: {
      commercialRequestId,
      commercialQuoteId,
      customerFileId,
      fileVersion:
        customerFile
          .version_number,
      sha256:
        customerFile.sha256,
      recipientEmail:
        maskEmail(
          commercialRequest.email,
        ),
      trackingErrors,
    },
  });

  logger.info(
    "admin_commercial_quote_email_sent",
    {
      requestId:
        auditRequestId,

      action:
        "commercial_quote_email_send",

      userId:
        auth.userId,

      role:
        auth.profile.role,

      status:
        "sent",

      metadata: {
        commercialRequestId,
        commercialQuoteId,
        customerFileId,
        deliveryId,
        fileVersion:
          customerFile
            .version_number,
        providerMessageId:
          emailResult.id,
        recipientEmail:
          maskEmail(
            commercialRequest.email,
          ),
        trackingErrors,
      },
    },
  );

  revalidatePath(
    `/admin/commercial-quotes/${commercialRequestId}/quote`,
  );

  revalidatePath(
    "/admin/commercial-quotes",
  );

  if (
    trackingErrors.length
  ) {
    logger.warn(
      "admin_commercial_quote_email_tracking_incomplete",
      {
        requestId:
          auditRequestId,

        action:
          "commercial_quote_email_send",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        metadata: {
          deliveryId,
          trackingErrors,
        },
      },
    );

    return actionSuccess(
      "The quote email was sent, but one or more tracking records need review. Check the admin logs before resending.",
    );
  }

  return actionSuccess(
    `Commercial quote file v${customerFile.version_number} was emailed to ${commercialRequest.email}.`,
  );
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  try {
    return JSON.stringify(
      error,
    );
  } catch {
    return "Unknown email delivery error.";
  }
}
