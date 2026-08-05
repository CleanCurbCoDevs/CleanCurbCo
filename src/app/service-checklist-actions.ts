"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checklistStatuses,
  ensureServiceChecklistBundle,
  generateChecklistPdf,
  type ServiceChecklistBundle,
} from "@/lib/service-checklists";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { createRequestId, logger, maskEmail } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getAuthorizedFieldStopBundle,
} from "@/lib/server/field-access";
import {
  failChecklistSubmission,
  finalizeChecklistSubmission,
  saveChecklistWork,
} from "@/lib/server/checklist-submission";
import { requireAdmin, requireField } from "@/lib/supabase/auth";
import { cleanLongText, cleanString, pickEnum } from "@/lib/validation";
import type { ChecklistItemStatus, Database } from "@/types/database";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

function returnToFrom(formData: FormData, fallback: string) {
  return cleanString(formData.get("returnTo"), 300) || fallback;
}

function redirectWithStatus(returnTo: string, status: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}checklist=${status}`);
}

async function logServiceEvent(
  admin: AdminClient,
  input: Database["public"]["Tables"]["service_events"]["Insert"],
) {
  try {
    await admin.from("service_events").insert(input);
  } catch {
    // Service events are helpful proof, but should not block checklist work.
  }
}

type ChecklistFormItem = {
  id: string;
  status:
    ChecklistItemStatus;
  notes:
    string | null;
};

function checklistItemsFromForm(
  formData: FormData,
  bundle:
    ServiceChecklistBundle,
): ChecklistFormItem[] | null {
  const itemIds =
    validatedChecklistItemIds(
      formData,
      new Set(
        bundle.items.map(
          (item) =>
            item.id,
        ),
      ),
    );

  if (
    !itemIds ||
    itemIds.length !==
      bundle.items.length
  ) {
    return null;
  }

  return itemIds.map(
    (itemId) => ({
      id:
        itemId,

      status:
        pickEnum<
          ChecklistItemStatus
        >(
          formData.get(
            `status-${itemId}`,
          ),
          checklistStatuses,
          "pending",
        ),

      notes:
        cleanLongText(
          formData.get(
            `notes-${itemId}`,
          ),
          1500,
        ) || null,
    }),
  );
}

function validatedChecklistItemIds(
  formData: FormData,
  allowedItemIds: Set<string>,
) {
  const itemIds = formData
    .getAll("itemId")
    .map((value) =>
      cleanString(value, 80),
    )
    .filter(Boolean);

  if (
    itemIds.some(
      (itemId) =>
        !allowedItemIds.has(
          itemId,
        ),
    )
  ) {
    return null;
  }

  return Array.from(
    new Set(itemIds),
  );
}

export async function saveServiceChecklistDraftAction(
  formData: FormData,
) {
  const visitId =
    cleanString(
      formData.get(
        "visitId",
      ),
      80,
    );

  const returnTo =
    returnToFrom(
      formData,
      visitId
        ? `/field/stops/${visitId}`
        : "/field/today",
    );

  const auth =
    await requireField(
      returnTo,
    );

  if (
    auth.status !==
      "ok" ||
    !visitId
  ) {
    return;
  }

  const access =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        visitId,
      },
    );

  if (!access.ok) {
    redirectWithStatus(
      returnTo,
      access.status ===
        403
        ? "forbidden"
        : "missing",
    );
  }

  const admin =
    access.admin;

  const bundle =
    await ensureServiceChecklistBundle(
      admin,
      visitId,
    );

  if (!bundle) {
    redirectWithStatus(
      returnTo,
      "missing",
    );
  }

  if (
    bundle.checklist
      .status ===
    "submitted"
  ) {
    redirectWithStatus(
      returnTo,
      "locked",
    );
  }

  const items =
    checklistItemsFromForm(
      formData,
      bundle,
    );

  if (!items) {
    redirectWithStatus(
      returnTo,
      "invalid_items",
    );
  }

  const result =
    await saveChecklistWork(
      admin,
      {
        routeStopId:
          access.stop.id,

        actorProfileId:
          auth.userId,

        items,

        overallNotes:
          cleanLongText(
            formData.get(
              "overallNotes",
            ),
            3000,
          ) || null,

        prepareSubmission:
          false,
      },
    );

  if (!result.ok) {
    logger.error(
      "service_checklist_draft_save_failed",
      {
        action:
          "checklist_draft_save",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          bundle.booking
            .customer_id,
        bookingId:
          bundle.booking.id,
        error:
          result.error,
        metadata: {
          visitId,
          checklistId:
            bundle.checklist.id,
          code:
            result.code,
        },
      },
    );

    redirectWithStatus(
      returnTo,
      "save_failed",
    );
  }

  if (
    result.data
      .alreadySubmitted
  ) {
    redirectWithStatus(
      returnTo,
      "locked",
    );
  }

  if (
    result.data
      .inProgress
  ) {
    redirectWithStatus(
      returnTo,
      "creating",
    );
  }

  revalidateChecklistPaths(
    bundle.visit.id,
    bundle.booking
      .customer_id,
  );

  redirectWithStatus(
    returnTo,
    "saved",
  );
}

export async function submitServiceChecklistAction(
  formData: FormData,
) {
  const requestId =
    createRequestId();

  const visitId =
    cleanString(
      formData.get(
        "visitId",
      ),
      80,
    );

  const returnTo =
    returnToFrom(
      formData,
      visitId
        ? `/field/stops/${visitId}`
        : "/field/today",
    );

  const auth =
    await requireField(
      returnTo,
    );

  if (
    auth.status !==
      "ok" ||
    !visitId
  ) {
    return;
  }

  const access =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        visitId,
      },
    );

  if (!access.ok) {
    redirectWithStatus(
      returnTo,
      access.status ===
        403
        ? "forbidden"
        : "missing",
    );
  }

  if (
    formData.get(
      "finalizeAck",
    ) !== "on"
  ) {
    redirectWithStatus(
      returnTo,
      "ack_required",
    );
  }

  const admin =
    access.admin;

  const initialBundle =
    await ensureServiceChecklistBundle(
      admin,
      visitId,
    );

  if (!initialBundle) {
    redirectWithStatus(
      returnTo,
      "missing",
    );
  }

  const items =
    checklistItemsFromForm(
      formData,
      initialBundle,
    );

  if (!items) {
    redirectWithStatus(
      returnTo,
      "invalid_items",
    );
  }

  const preparation =
    await saveChecklistWork(
      admin,
      {
        routeStopId:
          access.stop.id,

        actorProfileId:
          auth.userId,

        items,

        overallNotes:
          cleanLongText(
            formData.get(
              "overallNotes",
            ),
            3000,
          ) || null,

        prepareSubmission:
          true,
      },
    );

  if (!preparation.ok) {
    logger.error(
      "service_checklist_submission_prepare_failed",
      {
        requestId,
        action:
          "checklist_submission_prepare",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          initialBundle.booking
            .customer_id,
        bookingId:
          initialBundle.booking.id,
        error:
          preparation.error,
        metadata: {
          visitId,
          checklistId:
            initialBundle
              .checklist.id,
          code:
            preparation.code,
        },
      },
    );

    redirectWithStatus(
      returnTo,
      "submit_failed",
    );
  }

  if (
    preparation.data
      .alreadySubmitted
  ) {
    revalidateChecklistPaths(
      initialBundle
        .visit.id,
      initialBundle
        .booking
        .customer_id,
    );

    redirectWithStatus(
      returnTo,
      "submitted",
    );
  }

  if (
    preparation.data
      .inProgress
  ) {
    redirectWithStatus(
      returnTo,
      "creating",
    );
  }

  if (
    preparation.data
      .unresolvedCount > 0
  ) {
    redirectWithStatus(
      returnTo,
      "unresolved",
    );
  }

  const bundle =
    await ensureServiceChecklistBundle(
      admin,
      visitId,
    );

  if (!bundle) {
    await failChecklistSubmission(
      admin,
      {
        checklistId:
          preparation.data
            .checklistId,

        actorProfileId:
          auth.userId,

        generation:
          preparation.data
            .generation,

        error:
          "Checklist bundle could not be reloaded after submission preparation.",
      },
    );

    redirectWithStatus(
      returnTo,
      "missing",
    );
  }

  const preparedAt =
    preparation.data
      .preparedAt ??
    new Date().toISOString();

  const storageBucket =
    "service-documents";

  const storagePath =
    `checklists/${bundle.visit.id}/${bundle.checklist.id}-${preparation.data.generation}.pdf`;

  let pdfBuffer:
    Buffer;

  try {
    pdfBuffer =
      await generateChecklistPdf(
        {
          checklist: {
            ...bundle.checklist,

            submitted_at:
              preparedAt,

            submitted_by:
              auth.userId,
          },

          items:
            bundle.items,

          booking:
            bundle.booking,

          visit:
            bundle.visit,

          submittedBy:
            auth.profile,
        },
      );
  } catch (error) {
    await failChecklistSubmission(
      admin,
      {
        checklistId:
          bundle.checklist.id,

        actorProfileId:
          auth.userId,

        generation:
          preparation.data
            .generation,

        error:
          error instanceof
          Error
            ? error.message
            : "Checklist PDF generation failed.",
      },
    );

    logger.error(
      "checklist_pdf_generation_failed",
      {
        requestId,
        action:
          "checklist_submitted",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          bundle.booking
            .customer_id,
        bookingId:
          bundle.booking.id,
        error,
        metadata: {
          visitId:
            bundle.visit.id,
          checklistId:
            bundle.checklist.id,
          generation:
            preparation.data
              .generation,
        },
      },
    );

    redirectWithStatus(
      returnTo,
      "pdf_failed",
    );
  }

  const {
    error: uploadError,
  } = await admin.storage
    .from(
      storageBucket,
    )
    .upload(
      storagePath,
      pdfBuffer,
      {
        contentType:
          "application/pdf",

        upsert:
          false,
      },
    );

  if (uploadError) {
    await admin.storage
      .from(
        storageBucket,
      )
      .remove([
        storagePath,
      ]);

    await failChecklistSubmission(
      admin,
      {
        checklistId:
          bundle.checklist.id,

        actorProfileId:
          auth.userId,

        generation:
          preparation.data
            .generation,

        error:
          uploadError.message,
      },
    );

    logger.error(
      "checklist_pdf_upload_failed",
      {
        requestId,
        action:
          "checklist_submitted",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          bundle.booking
            .customer_id,
        bookingId:
          bundle.booking.id,
        error:
          uploadError,
        metadata: {
          visitId:
            bundle.visit.id,
          checklistId:
            bundle.checklist.id,
          storagePath,
          generation:
            preparation.data
              .generation,
        },
      },
    );

    redirectWithStatus(
      returnTo,
      "pdf_failed",
    );
  }

  const finalization =
    await finalizeChecklistSubmission(
      admin,
      {
        checklistId:
          bundle.checklist.id,

        actorProfileId:
          auth.userId,

        generation:
          preparation.data
            .generation,

        storageBucket,
        storagePath,
      },
    );

  if (!finalization.ok) {
    await failChecklistSubmission(
      admin,
      {
        checklistId:
          bundle.checklist.id,

        actorProfileId:
          auth.userId,

        generation:
          preparation.data
            .generation,

        error:
          finalization.message,
      },
    );

    logger.error(
      "checklist_pdf_archive_finalization_failed",
      {
        requestId,
        action:
          "checklist_submitted",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          bundle.booking
            .customer_id,
        bookingId:
          bundle.booking.id,
        error:
          finalization.error,
        metadata: {
          visitId:
            bundle.visit.id,
          checklistId:
            bundle.checklist.id,
          storagePath,
          generation:
            preparation.data
              .generation,
          code:
            finalization.code,
        },
      },
    );

    redirectWithStatus(
      returnTo,
      "archive_failed",
    );
  }

  try {
    await writeAdminAuditLog({
      action:
        "checklist_submitted",

      actor_user_id:
        auth.userId,

      actor_email:
        maskEmail(
          auth.email,
        ),

      actor_role:
        auth.profile.role,

      target_type:
        "service_checklist",

      target_id:
        bundle.checklist.id,

      customer_id:
        bundle.booking
          .customer_id,

      booking_id:
        bundle.booking.id,

      before_summary: {
        status:
          bundle.checklist
            .status,
      },

      after_summary: {
        status:
          "submitted",

        serviceVisitId:
          bundle.visit.id,

        documentType:
          "checklist_pdf",

        submissionGeneration:
          preparation.data
            .generation,
      },

      request_id:
        requestId,

      status:
        "success",
    });
  } catch (error) {
    logger.warn(
      "checklist_submission_audit_log_failed",
      {
        requestId,
        action:
          "checklist_submitted",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          bundle.booking
            .customer_id,
        bookingId:
          bundle.booking.id,
        error,
        metadata: {
          checklistId:
            bundle.checklist.id,
          visitId:
            bundle.visit.id,
        },
      },
    );
  }

  logger.info(
    "service_checklist_submitted",
    {
      requestId,
      action:
        "checklist_submitted",
      userId:
        auth.userId,
      role:
        auth.profile.role,
      customerId:
        bundle.booking
          .customer_id,
      bookingId:
        bundle.booking.id,
      metadata: {
        checklistId:
          bundle.checklist.id,
        visitId:
          bundle.visit.id,
        generation:
          preparation.data
            .generation,
        storagePath:
          finalization.data
            .storagePath,
      },
    },
  );

  revalidateChecklistPaths(
    bundle.visit.id,
    bundle.booking
      .customer_id,
  );

  redirectWithStatus(
    returnTo,
    "submitted",
  );
}

export async function addChecklistCorrectionAction(formData: FormData) {
  const checklistId = cleanString(formData.get("checklistId"), 80);
  const visitId = cleanString(formData.get("visitId"), 80);
  const returnTo = returnToFrom(
    formData,
    visitId ? `/admin/checklists/${visitId}` : "/admin/checklists",
  );
  const auth = await requireAdmin(returnTo);

  if (auth.status !== "ok" || !checklistId) return;

  const note = cleanLongText(formData.get("correctionNote"), 3000);
  if (!note) redirectWithStatus(returnTo, "correction_empty");

  const admin = getSupabaseAdmin();
  const { data: checklist } = await admin
    .from("service_checklists")
    .select("*")
    .eq("id", checklistId)
    .maybeSingle();

  if (!checklist) redirectWithStatus(returnTo, "missing");

  const stampedNote = `[${new Date().toISOString()}] ${auth.email ?? "admin"}: ${note}`;
  const correctionNotes = [checklist.correction_notes, stampedNote]
    .filter(Boolean)
    .join("\n\n");

  await admin
    .from("service_checklists")
    .update({ correction_notes: correctionNotes })
    .eq("id", checklist.id);

  await logServiceEvent(admin, {
    actor_profile_id: auth.userId,
    booking_id: checklist.booking_id,
    service_visit_id: checklist.service_visit_id,
    route_stop_id: checklist.route_stop_id,
    event_type: "service_checklist_correction_added",
    message: "Admin correction note added to submitted checklist.",
  });

  revalidateChecklistPaths(checklist.service_visit_id, checklist.customer_id);
  redirectWithStatus(returnTo, "correction_added");
}

function revalidateChecklistPaths(visitId: string | null, customerId?: string | null) {
  revalidatePath("/admin/checklists");
  if (visitId) {
    revalidatePath(`/admin/checklists/${visitId}`);
    revalidatePath(`/field/stops/${visitId}`);
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/portal/bookings");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}
