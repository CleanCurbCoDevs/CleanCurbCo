"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checklistStatuses,
  ensureServiceChecklistBundle,
  generateChecklistPdf,
  unresolvedChecklistItems,
} from "@/lib/service-checklists";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

async function saveChecklistItemsFromForm(input: {
  admin: AdminClient;
  formData: FormData;
  itemIds: string[];
  actorId: string;
}) {
  const resolvedAt = new Date().toISOString();

  await Promise.all(
    input.itemIds.map((itemId) => {
      const status = pickEnum<ChecklistItemStatus>(
        input.formData.get(`status-${itemId}`),
        checklistStatuses,
        "pending",
      );
      const notes =
        cleanLongText(input.formData.get(`notes-${itemId}`), 1500) || null;

      return input.admin
        .from("service_checklist_items")
        .update({
          status,
          notes,
          resolved_at: status === "pending" ? null : resolvedAt,
          resolved_by: status === "pending" ? null : input.actorId,
        })
        .eq("id", itemId);
    }),
  );
}

export async function saveServiceChecklistDraftAction(formData: FormData) {
  const visitId = cleanString(formData.get("visitId"), 80);
  const returnTo = returnToFrom(formData, visitId ? `/field/stops/${visitId}` : "/field/today");
  const auth = await requireField(returnTo);

  if (auth.status !== "ok" || !visitId) return;

  const admin = getSupabaseAdmin();
  const bundle = await ensureServiceChecklistBundle(admin, visitId);
  if (!bundle) redirectWithStatus(returnTo, "missing");
  if (bundle.checklist.status === "submitted") redirectWithStatus(returnTo, "locked");

  const itemIds = formData
    .getAll("itemId")
    .map((value) => cleanString(value, 80))
    .filter(Boolean);

  await saveChecklistItemsFromForm({
    admin,
    formData,
    itemIds,
    actorId: auth.userId,
  });

  await admin
    .from("service_checklists")
    .update({
      status: "draft",
      overall_notes: cleanLongText(formData.get("overallNotes"), 3000) || null,
      booking_id: bundle.booking.id,
      customer_id: bundle.booking.customer_id,
      route_stop_id: bundle.stop?.id ?? bundle.checklist.route_stop_id,
    })
    .eq("id", bundle.checklist.id);

  await logServiceEvent(admin, {
    actor_profile_id: auth.userId,
    booking_id: bundle.booking.id,
    service_visit_id: bundle.visit.id,
    route_stop_id: bundle.stop?.id ?? null,
    event_type: "service_checklist_saved",
    message: "Service checklist draft saved.",
  });

  revalidateChecklistPaths(bundle.visit.id, bundle.booking.customer_id);
  redirectWithStatus(returnTo, "saved");
}

export async function submitServiceChecklistAction(formData: FormData) {
  const visitId = cleanString(formData.get("visitId"), 80);
  const returnTo = returnToFrom(formData, visitId ? `/field/stops/${visitId}` : "/field/today");
  const auth = await requireField(returnTo);

  if (auth.status !== "ok" || !visitId) return;

  if (formData.get("finalizeAck") !== "on") {
    redirectWithStatus(returnTo, "ack_required");
  }

  const admin = getSupabaseAdmin();
  const initialBundle = await ensureServiceChecklistBundle(admin, visitId);
  if (!initialBundle) redirectWithStatus(returnTo, "missing");
  if (initialBundle.checklist.status === "submitted") {
    redirectWithStatus(returnTo, "locked");
  }

  const itemIds = formData
    .getAll("itemId")
    .map((value) => cleanString(value, 80))
    .filter(Boolean);

  await saveChecklistItemsFromForm({
    admin,
    formData,
    itemIds,
    actorId: auth.userId,
  });

  const submittedAt = new Date().toISOString();
  await admin
    .from("service_checklists")
    .update({
      overall_notes: cleanLongText(formData.get("overallNotes"), 3000) || null,
      booking_id: initialBundle.booking.id,
      customer_id: initialBundle.booking.customer_id,
      route_stop_id: initialBundle.stop?.id ?? initialBundle.checklist.route_stop_id,
    })
    .eq("id", initialBundle.checklist.id);

  const bundle = await ensureServiceChecklistBundle(admin, visitId);
  if (!bundle) redirectWithStatus(returnTo, "missing");

  if (unresolvedChecklistItems(bundle.items).length) {
    redirectWithStatus(returnTo, "unresolved");
  }

  try {
    const pdfBuffer = await generateChecklistPdf({
      checklist: {
        ...bundle.checklist,
        submitted_at: submittedAt,
        submitted_by: auth.userId,
      },
      items: bundle.items,
      booking: bundle.booking,
      visit: bundle.visit,
      submittedBy: auth.profile,
    });
    const storagePath = `checklists/${bundle.visit.id}/${bundle.checklist.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("service-documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    await admin
      .from("service_checklists")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
        submitted_by: auth.userId,
        pdf_storage_bucket: "service-documents",
        pdf_storage_path: storagePath,
        pdf_generated_at: submittedAt,
        service_completed: true,
        completed_by: auth.userId,
        completed_at: submittedAt,
      })
      .eq("id", bundle.checklist.id);

    await admin.from("service_checklist_documents").insert({
      checklist_id: bundle.checklist.id,
      service_visit_id: bundle.visit.id,
      booking_id: bundle.booking.id,
      customer_id: bundle.booking.customer_id,
      document_type: "checklist_pdf",
      storage_bucket: "service-documents",
      storage_path: storagePath,
      is_customer_visible: true,
      generated_by: auth.userId,
      generated_at: submittedAt,
      notes: "Final service checklist report.",
    });

    await logServiceEvent(admin, {
      actor_profile_id: auth.userId,
      booking_id: bundle.booking.id,
      service_visit_id: bundle.visit.id,
      route_stop_id: bundle.stop?.id ?? null,
      event_type: "service_checklist_submitted",
      message: "Service checklist submitted and PDF generated.",
      metadata: { storagePath },
    });

    revalidateChecklistPaths(bundle.visit.id, bundle.booking.customer_id);
    redirectWithStatus(returnTo, "submitted");
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "service_checklist_pdf",
        message: "checklist_pdf_generation_or_upload_failed",
        visitId: bundle.visit.id,
        checklistId: bundle.checklist.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    redirectWithStatus(returnTo, "pdf_failed");
  }
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
