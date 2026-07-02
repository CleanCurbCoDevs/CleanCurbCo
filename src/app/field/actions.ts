"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatBookingAddress } from "@/lib/booking-utils";
import {
  sendFieldPaymentLinkEmail,
  sendOnTheWayEmail,
  sendServiceCompletedEmail,
} from "@/lib/email/sendFieldNotifications";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireField } from "@/lib/supabase/auth";
import { isAdminRole } from "@/lib/supabase/roles";
import type {
  BookingRow,
  BreakReason,
  FieldStopStatus,
  PhotoType,
  RouteStopRow,
  ServiceChecklistRow,
  ServiceVisitRow,
} from "@/types/database";

const checklistFields: Array<keyof Omit<
  ServiceChecklistRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "service_visit_id"
  | "route_stop_id"
  | "completed_by"
  | "completed_at"
>> = [
  "arrived_at_property",
  "bins_located",
  "before_photos_taken",
  "loose_debris_removed",
  "cleaner_applied",
  "bins_pressure_washed",
  "scrubbed_if_needed",
  "sanitized",
  "deodorized",
  "trash_pad_cleaned",
  "add_ons_completed",
  "after_photos_taken",
  "bins_returned_neatly",
  "work_area_checked",
  "service_completed",
];
type ChecklistField = (typeof checklistFields)[number];
type ChecklistValues = Pick<ServiceChecklistRow, ChecklistField>;
const validBreakReasons: readonly BreakReason[] = [
  "lunch",
  "bathroom",
  "tank_empty",
  "tank_refill",
  "equipment_issue",
  "vehicle_issue",
  "access_issue",
  "safety_concern",
  "customer_issue",
  "fuel_stop",
  "hydration_rest",
  "weather_pause",
  "customer_delay",
  "scheduled_break",
  "other",
];
const breakReasonsRequiringNotes: readonly BreakReason[] = [
  "equipment_issue",
  "vehicle_issue",
  "access_issue",
  "safety_concern",
  "customer_issue",
  "weather_pause",
  "customer_delay",
  "other",
];

function cleanId(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function cleanText(formData: FormData, key: string, max = 1200) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

async function requireFieldUser() {
  const auth = await requireField("/field/today");
  if (auth.status !== "ok") {
    throw new Error(auth.message);
  }
  return auth;
}

async function getStopBundle(visitId: string) {
  const admin = getSupabaseAdmin();
  const { data: stop } = await admin
    .from("route_stops")
    .select("*")
    .eq("service_visit_id", visitId)
    .maybeSingle();

  const routeStop = stop ?? null;
  const { data: visit } = await admin
    .from("service_visits")
    .select("*")
    .eq("id", routeStop?.service_visit_id ?? visitId)
    .maybeSingle();

  const { data: booking } = visit?.booking_id
    ? await admin.from("bookings").select("*").eq("id", visit.booking_id).maybeSingle()
    : { data: null };

  return { admin, stop: routeStop, visit: visit ?? null, booking: booking ?? null };
}

async function recordServiceEvent(input: {
  actorId: string;
  booking?: BookingRow | null;
  visit?: ServiceVisitRow | null;
  stop?: RouteStopRow | null;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdmin();
  await admin.from("service_events").insert({
    actor_profile_id: input.actorId,
    booking_id: input.booking?.id ?? null,
    service_visit_id: input.visit?.id ?? null,
    route_stop_id: input.stop?.id ?? null,
    event_type: input.eventType,
    message: input.message,
    metadata: input.metadata ?? {},
  });
}

function revalidateField(visitId?: string | null) {
  revalidatePath("/field/today");
  revalidatePath("/field/routes");
  revalidatePath("/field/breaks");
  revalidatePath("/field/history");
  revalidatePath("/admin/routes");
  revalidatePath("/admin/bookings");
  if (visitId) revalidatePath(`/field/stops/${visitId}`);
}

export async function updateStopStatusAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const status = cleanId(formData, "status") as FieldStopStatus;
  const validStatuses: FieldStopStatus[] = [
    "scheduled",
    "on_the_way",
    "arrived",
    "in_progress",
    "completed",
    "skipped",
    "needs_follow_up",
    "rescheduled",
    "cancelled",
  ];

  if (!visitId || !validStatuses.includes(status)) return;

  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop) return;

  const timestamp = new Date().toISOString();
  const stopUpdate: Partial<RouteStopRow> = { status };
  if (status === "in_progress" && !stop.started_at) stopUpdate.started_at = timestamp;
  if (["completed", "skipped", "needs_follow_up"].includes(status)) {
    stopUpdate.completed_at = timestamp;
  }

  await Promise.all([
    admin.from("route_stops").update(stopUpdate).eq("id", stop.id),
    admin.from("service_visits").update({ status }).eq("id", visit.id),
  ]);

  if (booking && status === "on_the_way") {
    await sendOnTheWayEmail(booking, {
      bookingId: booking.id,
      visitId: visit.id,
      routeStopId: stop.id,
    });
  }

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType: `stop_${status}`,
    message:
      status === "arrived"
        ? "Technician marked arrived internally. No customer arrival notification was sent."
        : `Field stop marked ${status.replaceAll("_", " ")}.`,
  });

  revalidateField(visit.id);
}

export async function saveChecklistAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop) return;

  const checklist = checklistFields.reduce<Partial<ChecklistValues>>(
    (values, field) => ({
      ...values,
      [field]: formData.get(field) === "on",
    }),
    {},
  );

  const { data: existing } = await admin
    .from("service_checklists")
    .select("*")
    .eq("route_stop_id", stop.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
      await admin
        .from("service_checklists")
        .update({
          ...checklist,
          booking_id: booking?.id ?? null,
          customer_id: booking?.customer_id ?? null,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("service_checklists").insert({
        service_visit_id: visit.id,
        route_stop_id: stop.id,
        booking_id: booking?.id ?? null,
        customer_id: booking?.customer_id ?? null,
        ...checklist,
      });
  }

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType: "checklist_saved",
    message: "Technician saved the service checklist.",
  });

  revalidateField(visit.id);
}

export async function saveTechnicianNotesAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const technicianNotes = cleanText(formData, "technicianNotes", 1800);
  const issueFlags = formData
    .getAll("issueFlags")
    .map((value) => String(value))
    .filter(Boolean);

  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop) return;

  await Promise.all([
    admin
      .from("route_stops")
      .update({ technician_notes: technicianNotes, issue_flags: issueFlags })
      .eq("id", stop.id),
    admin
      .from("service_visits")
      .update({ technician_notes: technicianNotes })
      .eq("id", visit.id),
  ]);

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType: "technician_notes_saved",
    message: "Technician notes and issue flags were saved.",
    metadata: { issueFlags },
  });

  revalidateField(visit.id);
}

export async function uploadServicePhotosAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const photoType = cleanId(formData, "photoType") as PhotoType;
  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop || !booking || !["before", "after", "issue", "other"].includes(photoType)) {
    return;
  }

  const files = formData
    .getAll("photos")
    .filter((file): file is File => file instanceof File && file.size > 0);

  const uploadedPaths: string[] = [];
  for (const file of files) {
    const extension = file.type === "image/png" ? "png" : "jpg";
    const storagePath = `${visit.id}/${photoType}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from("service-photos")
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) continue;

    uploadedPaths.push(storagePath);
    await admin.from("service_photos").insert({
      service_visit_id: visit.id,
      route_stop_id: stop.id,
      booking_id: booking.id,
      customer_id: booking.customer_id,
      photo_type: photoType,
      storage_bucket: "service-photos",
      storage_path: storagePath,
      uploaded_by: auth.userId,
      is_customer_visible: photoType === "before" || photoType === "after",
    });
  }

  if (uploadedPaths.length && (photoType === "before" || photoType === "after")) {
    if (photoType === "before") {
      await admin
        .from("service_visits")
        .update({ before_photo_urls: [...(visit.before_photo_urls ?? []), ...uploadedPaths] })
        .eq("id", visit.id);
    } else {
      await admin
        .from("service_visits")
        .update({ after_photo_urls: [...(visit.after_photo_urls ?? []), ...uploadedPaths] })
        .eq("id", visit.id);
    }
  }

  if (uploadedPaths.length) {
    await recordServiceEvent({
      actorId: auth.userId,
      booking,
      visit,
      stop,
      eventType: `${photoType}_photos_uploaded`,
      message: `${uploadedPaths.length} ${photoType} photo(s) uploaded.`,
      metadata: { paths: uploadedPaths },
    });
  }

  revalidateField(visit.id);
}

export async function deleteServicePhotoAction(formData: FormData) {
  const auth = await requireFieldUser();
  const photoId = cleanId(formData, "photoId");
  const visitId = cleanId(formData, "visitId");
  const admin = getSupabaseAdmin();

  const { data: photo } = await admin
    .from("service_photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return;

  await admin.storage.from(photo.storage_bucket).remove([photo.storage_path]);
  await admin.from("service_photos").delete().eq("id", photo.id);
  await recordServiceEvent({
    actorId: auth.userId,
    eventType: "photo_deleted",
    message: "A service photo was deleted before completion.",
    metadata: { photoId },
  });

  revalidateField(visitId || photo.service_visit_id);
}

export async function completeStopAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop || !booking) return;

  const completedAt = new Date().toISOString();
  const { data: photos } = await admin
    .from("service_photos")
    .select("*")
    .eq("route_stop_id", stop.id);
  const beforeCount = photos?.filter((photo) => photo.photo_type === "before").length ?? 0;
  const afterCount = photos?.filter((photo) => photo.photo_type === "after").length ?? 0;

  const { data: checklist } = await admin
    .from("service_checklists")
    .select("*")
    .eq("route_stop_id", stop.id)
    .limit(1)
    .maybeSingle();

  const checklistUpdate = {
    before_photos_taken: beforeCount > 0,
    after_photos_taken: afterCount > 0,
    service_completed: true,
    completed_by: auth.userId,
    completed_at: completedAt,
  };

  if (checklist) {
      await admin
        .from("service_checklists")
        .update({
          ...checklistUpdate,
          booking_id: booking.id,
          customer_id: booking.customer_id,
        })
        .eq("id", checklist.id);
    } else {
      await admin.from("service_checklists").insert({
        service_visit_id: visit.id,
        route_stop_id: stop.id,
        booking_id: booking.id,
        customer_id: booking.customer_id,
        ...checklistUpdate,
      });
  }

  await Promise.all([
    admin
      .from("route_stops")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", stop.id),
    admin
      .from("service_visits")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", visit.id),
    admin
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id),
  ]);

  await sendServiceCompletedEmail(booking, {
    bookingId: booking.id,
    visitId: visit.id,
    routeStopId: stop.id,
    paymentLink: booking.payment_status === "paid" ? null : booking.payment_link,
  });

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType: "stop_completed",
    message: `Stop completed at ${formatBookingAddress(booking)}.`,
    metadata: { beforeCount, afterCount },
  });

  revalidateField(visit.id);
}

export async function readyForNextStopAction(formData: FormData) {
  const auth = await requireFieldUser();
  const currentStopId = cleanId(formData, "routeStopId");
  const admin = getSupabaseAdmin();

  const { data: currentStop } = await admin
    .from("route_stops")
    .select("*")
    .eq("id", currentStopId)
    .maybeSingle();

  if (!currentStop?.route_day_id) {
    redirect("/field/today");
  }

  const { data: nextStop } = await admin
    .from("route_stops")
    .select("*")
    .eq("route_day_id", currentStop.route_day_id)
    .gt("stop_order", currentStop.stop_order)
    .not("status", "in", "(completed,skipped,cancelled,rescheduled)")
    .order("stop_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextStop?.service_visit_id) {
    redirect("/field/today");
  }

  const { data: visit } = await admin
    .from("service_visits")
    .select("*")
    .eq("id", nextStop.service_visit_id)
    .maybeSingle();
  const { data: booking } = visit?.booking_id
    ? await admin.from("bookings").select("*").eq("id", visit.booking_id).maybeSingle()
    : { data: null };

  await Promise.all([
    admin.from("route_stops").update({ status: "on_the_way" }).eq("id", nextStop.id),
    visit
      ? admin.from("service_visits").update({ status: "on_the_way" }).eq("id", visit.id)
      : Promise.resolve(),
  ]);

  if (booking && visit) {
    await sendOnTheWayEmail(booking, {
      bookingId: booking.id,
      visitId: visit.id,
      routeStopId: nextStop.id,
    });
  }

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop: nextStop,
    eventType: "next_stop_on_the_way",
    message: "Technician moved to the next stop and on-the-way email was triggered.",
  });

  redirect(`/field/stops/${nextStop.service_visit_id}`);
}

export async function startBreakAction(formData: FormData) {
  const routeDayId = cleanId(formData, "routeDayId");
  const routeStopId = cleanId(formData, "routeStopId");
  const requestedReason = cleanId(formData, "reason") as BreakReason;
  const reason = validBreakReasons.includes(requestedReason)
    ? requestedReason
    : "other";
  const notes = cleanText(formData, "notes", 600);
  const auth = await requireFieldUser();
  const admin = getSupabaseAdmin();

  if (breakReasonsRequiringNotes.includes(reason) && !notes) {
    const params = new URLSearchParams({
      break_error: "notes_required",
      reason,
    });
    if (routeStopId) params.set("routeStopId", routeStopId);
    redirect(`/field/breaks?${params.toString()}`);
  }

  await admin.from("route_breaks").insert({
    route_day_id: routeDayId || null,
    technician_id: auth.userId,
    reason,
    notes,
  });

  revalidateField();
}

export async function endBreakAction(formData: FormData) {
  await requireFieldUser();
  const breakId = cleanId(formData, "breakId");
  const readyForNext = formData.get("readyForNext") === "on";
  const routeStopId = cleanId(formData, "routeStopId");
  const admin = getSupabaseAdmin();

  await admin
    .from("route_breaks")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", breakId);

  revalidateField();

  if (readyForNext && routeStopId) {
    const nextForm = new FormData();
    nextForm.set("routeStopId", routeStopId);
    await readyForNextStopAction(nextForm);
  }
}

export async function markManualPaidAction(formData: FormData) {
  const auth = await requireFieldUser();
  if (!isAdminRole(auth.profile.role)) return;

  const bookingId = cleanId(formData, "bookingId");
  const visitId = cleanId(formData, "visitId");
  const method = cleanText(formData, "manualPaymentMethod", 80) || "manual";
  const notes = cleanText(formData, "manualPaymentNotes", 500);
  const admin = getSupabaseAdmin();
  const paidAt = new Date().toISOString();

  await Promise.all([
    admin
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_method: method,
        payment_provider: "manual",
        payment_reference: `manual:${auth.userId}:${paidAt}`,
      })
      .eq("id", bookingId),
    admin
      .from("payments")
      .update({
        status: "paid",
        provider: "manual",
        metadata: {
          marked_paid_by: auth.userId,
          marked_paid_at: paidAt,
          method,
          notes,
        },
      })
      .eq("booking_id", bookingId),
  ]);

  await recordServiceEvent({
    actorId: auth.userId,
    eventType: "manual_payment_marked_paid",
    message: `Manual payment marked paid by ${auth.email ?? "admin/owner"}.`,
    metadata: { bookingId, method, notes, paidAt },
  });

  revalidateField(visitId);
}

export async function sendPaymentLinkFromFieldAction(formData: FormData) {
  await requireFieldUser();
  const bookingId = cleanId(formData, "bookingId");
  const visitId = cleanId(formData, "visitId");
  const routeStopId = cleanId(formData, "routeStopId");
  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return;

  await sendFieldPaymentLinkEmail(booking, {
    bookingId,
    visitId,
    routeStopId,
  });

  revalidateField(visitId);
}
