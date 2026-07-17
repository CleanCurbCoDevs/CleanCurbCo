"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { formatBookingAddress } from "@/lib/booking-utils";
import {
  sendFieldPaymentLinkEmail,
  sendOnTheWayEmail,
  sendServiceCompletedEmail,
} from "@/lib/email/sendFieldNotifications";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAdminNotification } from "@/lib/server/admin-notifications";
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
const validFieldPaymentMethods = [
  "cash",
  "venmo_business",
  "zelle",
  "other",
] as const;

const PHOTO_UPLOAD_EXCEPTION_PREFIX = "[Photo upload exception]";
const BEFORE_PHOTO_EXCEPTION_FLAG = "before_photo_exception";
const AFTER_PHOTO_EXCEPTION_FLAG = "after_photo_exception";

type FieldPaymentMethod = (typeof validFieldPaymentMethods)[number];

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
const fieldFollowUpReasons = [
  "payment_not_confirmed",
  "access_issue",
  "customer_issue",
  "equipment_issue",
  "safety_concern",
  "weather_delay",
  "vehicle_issue",
  "other",
] as const;
const followUpReasonsRequiringNotes: readonly FieldFollowUpReason[] = [
  "access_issue",
  "customer_issue",
  "equipment_issue",
  "safety_concern",
  "weather_delay",
  "vehicle_issue",
  "other",
];

type FieldFollowUpReason = (typeof fieldFollowUpReasons)[number];

function cleanId(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function cleanText(formData: FormData, key: string, max = 1200) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function removePhotoUploadExceptionNote(
  notes: string | null | undefined,
) {
  return (notes ?? "")
    .split("\n")
    .filter(
      (line) =>
        !line.trim().startsWith(PHOTO_UPLOAD_EXCEPTION_PREFIX),
    )
    .join("\n")
    .trim();
}

function hasPhotoUploadExceptionNote(
  notes: string | null | undefined,
) {
  return (notes ?? "")
    .split("\n")
    .some((line) =>
      line.trim().startsWith(PHOTO_UPLOAD_EXCEPTION_PREFIX),
    );
}

function cleanMoney(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "")
    .replace(/[$,\s]/g, "")
    .trim();

  if (!raw) return null;

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}
function cleanDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
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

export async function updateStopStatusAction(
  formData: FormData,
): Promise<ActionResult> {
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

  if (!visitId || !validStatuses.includes(status)) {
    return actionFailure("Choose a valid stop status.");
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop) return actionFailure("This stop could not be loaded.");

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
  return actionSuccess(statusSuccessMessage(status));
}

export async function markStopFollowUpAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const requestedReason = cleanId(formData, "reason") as FieldFollowUpReason;
  const reason = fieldFollowUpReasons.includes(requestedReason)
    ? requestedReason
    : "other";
  const notes = cleanText(formData, "notes", 900);

  if (followUpReasonsRequiringNotes.includes(reason) && !notes) {
    return actionFailure(
      `${humanizeFollowUpReason(reason)} requires a note so admin knows what happened.`,
    );
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop) return actionFailure("This stop could not be loaded.");

  const now = new Date().toISOString();
  const followUpNote = [
    `Follow-up reason: ${humanizeFollowUpReason(reason)}.`,
    notes ? `Notes: ${notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const technicianNotes = [stop.technician_notes, followUpNote]
    .filter(Boolean)
    .join("\n\n");
  const issueFlags = Array.from(
    new Set([...stop.issue_flags, "needs_follow_up", reason]),
  );

  await Promise.all([
    admin
      .from("route_stops")
      .update({
        status: "needs_follow_up",
        completed_at: now,
        technician_notes: technicianNotes,
        issue_flags: issueFlags,
      })
      .eq("id", stop.id),
    admin
      .from("service_visits")
      .update({
        status: "needs_follow_up",
        technician_notes: technicianNotes,
      })
      .eq("id", visit.id),
    booking
      ? admin
          .from("bookings")
          .update({
            status: "needs_follow_up",
            last_customer_change_request_at: now,
          })
          .eq("id", booking.id)
      : Promise.resolve(),
  ]);

  await Promise.allSettled([
    recordServiceEvent({
      actorId: auth.userId,
      booking,
      visit,
      stop,
      eventType: "stop_follow_up_required",
      message: `Stop marked for follow-up: ${humanizeFollowUpReason(reason)}.`,
      metadata: { reason, notes },
    }),
    booking
      ? createAdminNotification({
          type: "field_follow_up_required",
          title: "Field follow-up required",
          message: `${booking.first_name} ${booking.last_name}: ${humanizeFollowUpReason(reason)}.`,
          href: `/admin/routes`,
          customer_id: booking.customer_id,
          booking_id: booking.id,
          severity: reason === "safety_concern" ? "urgent" : "warning",
          metadata: { reason, visitId: visit.id, routeStopId: stop.id },
        })
      : Promise.resolve(),
  ]);

  revalidateField(visit.id);
  return actionSuccess("Stop marked for follow-up.");
}

export async function requestFieldRescheduleAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const requestedRouteDay = cleanDate(formData, "requestedRouteDay") || null;
  const notes = cleanText(formData, "notes", 900);

  if (!requestedRouteDay && !notes) {
    return actionFailure("Add a requested date or note for admin.");
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }

  const { data: request } = await admin
    .from("customer_requests")
    .insert({
      customer_id: booking.customer_id,
      booking_id: booking.id,
      request_type: "reschedule_service",
      status: "new",
      policy_window: "standard",
      policy_acknowledged: false,
      requested_route_day: requestedRouteDay,
      message:
        notes ||
        `Field tech requested reschedule from stop ${stop.stop_order}.`,
      metadata_json: {
        source: "field_app",
        visitId: visit.id,
        routeStopId: stop.id,
        routeDayId: stop.route_day_id,
      },
    })
    .select("*")
    .single();

  await Promise.all([
    admin
      .from("route_stops")
      .update({
        status: "rescheduled",
        technician_notes: [stop.technician_notes, notes]
          .filter(Boolean)
          .join("\n\n"),
        issue_flags: Array.from(new Set([...stop.issue_flags, "reschedule_requested"])),
      })
      .eq("id", stop.id),
    admin
      .from("service_visits")
      .update({ status: "rescheduled", technician_notes: notes || visit.technician_notes })
      .eq("id", visit.id),
    admin
      .from("bookings")
      .update({
        status: "needs_follow_up",
        last_customer_change_request_at: new Date().toISOString(),
      })
      .eq("id", booking.id),
  ]);

  await Promise.allSettled([
    recordServiceEvent({
      actorId: auth.userId,
      booking,
      visit,
      stop,
      eventType: "field_reschedule_requested",
      message: "Field tech requested reschedule review.",
      metadata: { requestedRouteDay, notes, requestId: request?.id ?? null },
    }),
    createAdminNotification({
      type: "field_reschedule_requested",
      title: "Field reschedule request",
      message: `${booking.first_name} ${booking.last_name} needs admin reschedule review.`,
      href: request?.id ? `/admin/requests?q=${request.id}` : "/admin/requests",
      customer_id: booking.customer_id,
      booking_id: booking.id,
      customer_request_id: request?.id ?? null,
      severity: "warning",
      metadata: { requestedRouteDay, visitId: visit.id, routeStopId: stop.id },
    }),
  ]);

  revalidateField(visit.id);
  return actionSuccess("Reschedule request sent to admin.");
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
  const submittedTechnicianNotes = cleanText(
    formData,
    "technicianNotes",
    1800,
  );

  const issueFlags = formData
    .getAll("issueFlags")
    .map((value) => String(value))
    .filter(Boolean);

  const { admin, stop, visit, booking } =
    await getStopBundle(visitId);

  if (!visit || !stop) return;

  const preservedPhotoFlags = stop.issue_flags.filter(
    (flag) =>
      flag === BEFORE_PHOTO_EXCEPTION_FLAG ||
      flag === AFTER_PHOTO_EXCEPTION_FLAG,
  );

  const nextIssueFlags = Array.from(
    new Set([...issueFlags, ...preservedPhotoFlags]),
  );

  const currentNotes =
    stop.technician_notes ??
    visit.technician_notes ??
    "";

  const existingExceptionLine =
    currentNotes
      .split("\n")
      .find((line) =>
        line
          .trim()
          .startsWith(PHOTO_UPLOAD_EXCEPTION_PREFIX),
      )
      ?.trim() ?? "";

  const technicianNotes = [
    removePhotoUploadExceptionNote(
      submittedTechnicianNotes,
    ),
    existingExceptionLine,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  await Promise.all([
    admin
      .from("route_stops")
      .update({
        technician_notes: technicianNotes,
        issue_flags: nextIssueFlags,
      })
      .eq("id", stop.id),

    admin
      .from("service_visits")
      .update({
        technician_notes: technicianNotes,
      })
      .eq("id", visit.id),
  ]);

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType: "technician_notes_saved",
    message:
      "Technician notes and issue flags were saved.",
    metadata: {
      issueFlags: nextIssueFlags,
    },
  });

  revalidateField(visit.id);
}

export async function savePhotoUploadExceptionAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");

  const beforeException =
    formData.get("beforePhotoException") === "on";

  const afterException =
    formData.get("afterPhotoException") === "on";

  const reason = cleanText(
    formData,
    "photoExceptionNote",
    600,
  )
    .replace(/\s+/g, " ")
    .trim();

  const { admin, stop, visit, booking } =
    await getStopBundle(visitId);

  if (!visit || !stop) {
    return actionFailure("This stop could not be loaded.");
  }

  if ((beforeException || afterException) && reason.length < 8) {
    return actionFailure(
      "Add a short explanation before using a photo exception.",
    );
  }

  const nextFlags = stop.issue_flags.filter(
    (flag) =>
      flag !== BEFORE_PHOTO_EXCEPTION_FLAG &&
      flag !== AFTER_PHOTO_EXCEPTION_FLAG,
  );

  if (beforeException) {
    nextFlags.push(BEFORE_PHOTO_EXCEPTION_FLAG);
  }

  if (afterException) {
    nextFlags.push(AFTER_PHOTO_EXCEPTION_FLAG);
  }

  const existingNotes = removePhotoUploadExceptionNote(
    stop.technician_notes ?? visit.technician_notes,
  );

  const exceptionNote =
    beforeException || afterException
      ? `${PHOTO_UPLOAD_EXCEPTION_PREFIX} ${reason}`
      : "";

  const technicianNotes = [
    existingNotes,
    exceptionNote,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const [stopResult, visitResult] = await Promise.all([
    admin
      .from("route_stops")
      .update({
        issue_flags: Array.from(new Set(nextFlags)),
        technician_notes: technicianNotes,
      })
      .eq("id", stop.id),

    admin
      .from("service_visits")
      .update({
        technician_notes: technicianNotes,
      })
      .eq("id", visit.id),
  ]);

  if (stopResult.error || visitResult.error) {
    return actionFailure(
      stopResult.error?.message ??
        visitResult.error?.message ??
        "The photo exception could not be saved.",
    );
  }

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType:
      beforeException || afterException
        ? "photo_upload_exception_saved"
        : "photo_upload_exception_cleared",
    message:
      beforeException || afterException
        ? "A documented photo-upload exception was saved."
        : "The photo-upload exception was cleared.",
    metadata: {
      beforeException,
      afterException,
      reason: reason || null,
    },
  });

  revalidateField(visit.id);

  return actionSuccess(
    beforeException || afterException
      ? "Photo exception documented."
      : "Photo exception cleared.",
  );
}

type ServicePhotoUploadTicket = {
  bucket: string;
  path: string;
  token: string;
  contentType: string;
};

type PrepareServicePhotoUploadInput = {
  visitId: string;
  photoType: PhotoType;
  fileName: string;
  contentType: string;
  size: number;
};

type FinalizeServicePhotoUploadInput = {
  visitId: string;
  photoType: PhotoType;
  storageBucket: string;
  storagePath: string;
};

const SERVICE_PHOTO_BUCKET = "service-photos";
const MAX_SERVICE_PHOTO_BYTES = 20 * 1024 * 1024;
const validServicePhotoTypes: readonly PhotoType[] = [
  "before",
  "after",
  "issue",
  "other",
];
const validServicePhotoContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function prepareServicePhotoUploadAction(
  input: PrepareServicePhotoUploadInput,
): Promise<ActionResult<ServicePhotoUploadTicket>> {
  await requireFieldUser();

  const visitId = String(input?.visitId ?? "").trim();
  const photoType = String(input?.photoType ?? "").trim() as PhotoType;
  const contentType = String(input?.contentType ?? "").trim().toLowerCase();
  const size = Number(input?.size ?? 0);

  if (!visitId || !validServicePhotoTypes.includes(photoType)) {
    return actionFailure("Choose a valid service stop and photo type.");
  }

  if (!validServicePhotoContentTypes.has(contentType)) {
    return actionFailure(
      "Use a JPG, PNG, WEBP, HEIC, or HEIF image.",
    );
  }

  if (!Number.isFinite(size) || size <= 0) {
    return actionFailure("The selected photo is empty.");
  }

  if (size > MAX_SERVICE_PHOTO_BYTES) {
    return actionFailure("Each photo must be 20 MB or smaller.");
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);

  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }

  const extension = extensionForServicePhoto(contentType);
  const storagePath =
    `${visit.id}/${photoType}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { data, error } = await admin.storage
    .from(SERVICE_PHOTO_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.token) {
    return actionFailure(
      error?.message
        ? `Could not prepare the photo upload: ${error.message}`
        : "Could not prepare the photo upload.",
    );
  }

  return actionSuccess("Photo upload prepared.", {
    bucket: SERVICE_PHOTO_BUCKET,
    path: storagePath,
    token: data.token,
    contentType,
  });
}

export async function finalizeServicePhotoUploadAction(
  input: FinalizeServicePhotoUploadInput,
): Promise<ActionResult<{ photoId: string }>> {
  const auth = await requireFieldUser();

  const visitId = String(input?.visitId ?? "").trim();
  const photoType = String(input?.photoType ?? "").trim() as PhotoType;
  const storageBucket = String(input?.storageBucket ?? "").trim();
  const storagePath = String(input?.storagePath ?? "").trim();

  if (!visitId || !validServicePhotoTypes.includes(photoType)) {
    return actionFailure("Choose a valid service stop and photo type.");
  }

  if (storageBucket !== SERVICE_PHOTO_BUCKET) {
    return actionFailure("The photo was uploaded to an invalid storage bucket.");
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);

  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }

  const requiredPrefix = `${visit.id}/${photoType}/`;

  if (
    !storagePath.startsWith(requiredPrefix) ||
    storagePath.includes("..")
  ) {
    return actionFailure("The uploaded photo path is invalid.");
  }

  const slashIndex = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, slashIndex);
  const fileName = storagePath.slice(slashIndex + 1);

  const { data: storedObjects, error: listError } = await admin.storage
    .from(SERVICE_PHOTO_BUCKET)
    .list(folder, {
      limit: 100,
      search: fileName,
    });

  if (
    listError ||
    !storedObjects?.some((object) => object.name === fileName)
  ) {
    return actionFailure(
      "Supabase has not confirmed this photo yet. Try the upload again.",
    );
  }

  const { data: existingPhoto } = await admin
    .from("service_photos")
    .select("id")
    .eq("storage_bucket", SERVICE_PHOTO_BUCKET)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (existingPhoto?.id) {
    return actionSuccess("Photo already attached to this stop.", {
      photoId: existingPhoto.id,
    });
  }

  const { data: photo, error: insertError } = await admin
    .from("service_photos")
    .insert({
      service_visit_id: visit.id,
      route_stop_id: stop.id,
      booking_id: booking.id,
      customer_id: booking.customer_id,
      photo_type: photoType,
      storage_bucket: SERVICE_PHOTO_BUCKET,
      storage_path: storagePath,
      uploaded_by: auth.userId,
      is_customer_visible:
        photoType === "before" || photoType === "after",
    })
    .select("id")
    .single();

  if (insertError || !photo?.id) {
    await admin.storage
      .from(SERVICE_PHOTO_BUCKET)
      .remove([storagePath]);

    return actionFailure(
      insertError?.message
        ? `Photo reached storage, but the service record failed: ${insertError.message}`
        : "Photo reached storage, but it could not be attached to the stop.",
    );
  }

  const sideEffects: Array<PromiseLike<unknown>> = [
    recordServiceEvent({
      actorId: auth.userId,
      booking,
      visit,
      stop,
      eventType: `${photoType}_photo_uploaded`,
      message: `1 ${photoType} photo uploaded and confirmed.`,
      metadata: { path: storagePath, directUpload: true },
    }),
  ];

  if (photoType === "before") {
    sideEffects.push(
      admin
        .from("service_visits")
        .update({
          before_photo_urls: Array.from(
            new Set([...(visit.before_photo_urls ?? []), storagePath]),
          ),
        })
        .eq("id", visit.id),
    );
  }

  if (photoType === "after") {
    sideEffects.push(
      admin
        .from("service_visits")
        .update({
          after_photo_urls: Array.from(
            new Set([...(visit.after_photo_urls ?? []), storagePath]),
          ),
        })
        .eq("id", visit.id),
    );
  }

  await Promise.allSettled(sideEffects);

  revalidateField(visit.id);

  return actionSuccess("Photo confirmed and attached to this stop.", {
    photoId: photo.id,
  });
}

function extensionForServicePhoto(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
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

export async function completeStopAction(
    formData: FormData,
  ): Promise<ActionResult> {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const { admin, stop, visit, booking } = await getStopBundle(visitId);
  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }
  
  if (
    booking.payment_due_at_service &&
    booking.payment_status !== "paid"
  ) {
    return actionFailure(
      "Collect and record the in-person payment before completing this stop.",
    );
  }

  const completedAt = new Date().toISOString();
  const { data: photos } = await admin
    .from("service_photos")
    .select("*")
    .eq("route_stop_id", stop.id);
  const beforeCount = photos?.filter((photo) => photo.photo_type === "before").length ?? 0;
  const afterCount = photos?.filter((photo) => photo.photo_type === "after").length ?? 0;

  const beforeCount =
    photos?.filter(
      (photo) => photo.photo_type === "before",
    ).length ?? 0;
  
  const afterCount =
    photos?.filter(
      (photo) => photo.photo_type === "after",
    ).length ?? 0;
  
  const photoExceptionRecorded =
    hasPhotoUploadExceptionNote(
      stop.technician_notes ??
        visit.technician_notes,
    );
  
  const beforePhotoException =
    photoExceptionRecorded &&
    stop.issue_flags.includes(
      BEFORE_PHOTO_EXCEPTION_FLAG,
    );
  
  const afterPhotoException =
    photoExceptionRecorded &&
    stop.issue_flags.includes(
      AFTER_PHOTO_EXCEPTION_FLAG,
    );
  
  const { data: checklist } = await admin
    .from("service_checklists")
    .select("*")
    .eq("route_stop_id", stop.id)
    .limit(1)
    .maybeSingle();
  
  if (beforeCount < 1 && !beforePhotoException) {
    return actionFailure(
      "Upload at least one before photo or document a before-photo exception.",
    );
  }
  
  if (!checklist || checklist.status !== "submitted") {
    return actionFailure(
      "Finish and submit the cleaning checklist before completing this stop.",
    );
  }
  
  if (afterCount < 1 && !afterPhotoException) {
    return actionFailure(
      "Upload at least one after photo or document an after-photo exception.",
    );
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
    metadata: {
      beforeCount,
      afterCount,
      beforePhotoException,
      afterPhotoException,
    },
  });

  revalidateField(visit.id);
  return actionSuccess("Stop completed.");
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

export async function markManualPaidAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireFieldUser();

  const visitId = cleanId(formData, "visitId");
  const requestedMethod = cleanId(formData, "paymentMethod");
  const method = validFieldPaymentMethods.find(
    (value) => value === requestedMethod,
  );

  const serviceAmount = cleanMoney(formData, "serviceAmount");
  const enteredTipAmount = cleanMoney(formData, "tipAmount");
  const tipAmount = enteredTipAmount ?? 0;
  const notes = cleanText(formData, "paymentNotes", 500);

  if (!visitId) {
    return actionFailure("The service visit could not be identified.");
  }

  if (!method) {
    return actionFailure("Choose a valid payment method.");
  }

  if (serviceAmount === null || serviceAmount <= 0) {
    return actionFailure("Enter a valid service amount.");
  }

  if (tipAmount < 0) {
    return actionFailure("The tip amount cannot be negative.");
  }

  if (serviceAmount > 5000 || tipAmount > 5000) {
    return actionFailure("Review the amounts before recording this payment.");
  }

  if (method === "other" && !notes) {
    return actionFailure(
      "Add a payment note when recording another payment method.",
    );
  }

  const { admin, stop, visit, booking } = await getStopBundle(visitId);

  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }

  const expectedAtStop =
    booking.payment_preference === "cash_in_person" &&
    booking.payment_due_at_service;

  if (!expectedAtStop && !isAdminRole(auth.profile.role)) {
    return actionFailure(
      "Only an admin or owner may override the scheduled payment method.",
    );
  }

  if (booking.payment_status === "paid") {
    return actionFailure("This booking is already marked paid.");
  }

  const paidAt = new Date().toISOString();
  const totalAmount =
    Math.round((serviceAmount + tipAmount) * 100) / 100;

  const provider =
    method === "cash"
      ? "cash"
      : method === "venmo_business"
        ? "venmo"
        : method === "zelle"
          ? "zelle"
          : "manual";

  const paymentPreference =
    method === "cash"
      ? "cash_in_person"
      : method === "venmo_business"
        ? "venmo_business"
        : method === "zelle"
          ? "zelle"
          : "manual_other";

  const paymentMethodLabel =
    method === "cash"
      ? "Cash"
      : method === "venmo_business"
        ? "Venmo Business"
        : method === "zelle"
          ? "Zelle"
          : "Other";

  const verificationStatus =
    method === "cash" ? "not_required" : "verified";

  const paymentReference =
    `field:${method}:${stop.id}:${paidAt}`;

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      customer_id: booking.customer_id,
      booking_id: booking.id,
      service_visit_id: visit.id,
      amount: totalAmount,
      service_amount: serviceAmount,
      tip_amount: tipAmount,
      total_amount: totalAmount,
      tip_source: tipAmount > 0 ? "in_person" : null,
      received_at: paidAt,
      recorded_by_user_id: auth.userId,
      currency: "usd",
      status: "paid",
      provider,
      description:
        `${paymentMethodLabel} collected during service visit`,
      payment_type: "service_payment",
      metadata: {
        source: "field_app",
        route_stop_id: stop.id,
        service_visit_id: visit.id,
        payment_method: method,
        service_amount: serviceAmount,
        tip_amount: tipAmount,
        total_amount: totalAmount,
        notes,
        collected_by: auth.userId,
        collected_at: paidAt,
      },
    })
    .select("*")
    .single();

  if (paymentError || !payment) {
    return actionFailure(
      "The payment record could not be saved. Nothing was marked paid.",
    );
  }

  await Promise.all([
    admin
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_preference: paymentPreference,
        payment_due_at_service: false,
        payment_verification_status: verificationStatus,
        payment_verified_at:
          verificationStatus === "verified" ? paidAt : null,
        payment_verified_by_user_id:
          verificationStatus === "verified" ? auth.userId : null,
        payment_method: paymentMethodLabel,
        payment_provider: provider,
        payment_reference: paymentReference,
        paid_at: paidAt,
        payment_failed_at: null,
        payment_failure_code: null,
        payment_failure_message: null,
      })
      .eq("id", booking.id),

    admin
      .from("route_stops")
      .update({
        payment_collection_required: false,
        payment_collection_status: "collected",
        payment_collected_at: paidAt,
        payment_collected_by_user_id: auth.userId,
        payment_collected_amount: serviceAmount,
        payment_collected_method: method,
        payment_collection_notes: notes || null,
        tip_collected_amount: tipAmount,
      })
      .eq("id", stop.id),
  ]);

  await Promise.allSettled([
    recordServiceEvent({
      actorId: auth.userId,
      booking,
      visit,
      stop,
      eventType: "field_payment_collected",
      message:
        `${paymentMethodLabel} payment of $${totalAmount.toFixed(2)} collected in the field.`,
      metadata: {
        paymentId: payment.id,
        method,
        serviceAmount,
        tipAmount,
        totalAmount,
        notes,
      },
    }),

    createAdminNotification({
      type: "field_payment_collected",
      title: "Field payment collected",
      message:
        `${booking.first_name} ${booking.last_name}: ` +
        `$${serviceAmount.toFixed(2)} service` +
        `${tipAmount > 0 ? ` + $${tipAmount.toFixed(2)} tip` : ""}.`,
      href: `/admin/bookings?q=${booking.id}`,
      customer_id: booking.customer_id,
      booking_id: booking.id,
      severity: "info",
      metadata: {
        paymentId: payment.id,
        visitId: visit.id,
        routeStopId: stop.id,
        method,
        serviceAmount,
        tipAmount,
        totalAmount,
      },
    }),
  ]);

  revalidateField(visit.id);

  return actionSuccess(
    tipAmount > 0
      ? `Payment recorded: $${serviceAmount.toFixed(2)} service and $${tipAmount.toFixed(2)} tip.`
      : `Payment recorded: $${serviceAmount.toFixed(2)}.`,
  );
}

export async function sendPaymentLinkFromFieldAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireFieldUser();
  const bookingId = cleanId(formData, "bookingId");
  const visitId = cleanId(formData, "visitId");
  const routeStopId = cleanId(formData, "routeStopId");
  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return actionFailure("Booking was not found.");
  if (!booking.payment_link) {
    return actionFailure(
      "Create a Stripe payment link before sending the payment email.",
    );
  }

  const result = await sendFieldPaymentLinkEmail(booking, {
    bookingId,
    visitId,
    routeStopId,
  });
  if (result.status === "failed") {
    return actionFailure("Payment email failed. Use the admin billing page or try again.");
  }
  if (result.status === "skipped") {
    return actionFailure(
      "Payment email is not configured yet. Use admin billing/payment page to send a payment link.",
    );
  }

  await Promise.all([
    admin
      .from("bookings")
      .update({ payment_status: "pending", payment_provider: "stripe" })
      .eq("id", booking.id),
    admin
      .from("payments")
      .update({
        status: "pending",
        metadata: {
          field_payment_email_sent_at: new Date().toISOString(),
          route_stop_id: routeStopId,
          service_visit_id: visitId,
        },
      })
      .eq("booking_id", booking.id),
    recordServiceEvent({
      actorId: auth.userId,
      booking,
      eventType: "field_payment_email_sent",
      message: "Payment email sent from the field app.",
      metadata: { visitId, routeStopId },
    }),
  ]);

  revalidateField(visitId);
  return actionSuccess("Payment email sent.");
}

function statusSuccessMessage(status: FieldStopStatus) {
  if (status === "on_the_way") return "Marked On The Way.";
  if (status === "arrived") return "Marked Arrived.";
  if (status === "in_progress") return "Service started.";
  if (status === "completed") return "Stop completed.";
  if (status === "needs_follow_up") return "Stop marked for follow-up.";
  if (status === "rescheduled") return "Reschedule request sent to admin.";
  return `Stop marked ${status.replaceAll("_", " ")}.`;
}

function humanizeFollowUpReason(reason: string) {
  if (reason === "payment_not_confirmed") return "Payment not confirmed";
  if (reason === "access_issue") return "Access issue";
  if (reason === "customer_issue") return "Customer issue";
  if (reason === "equipment_issue") return "Equipment issue";
  if (reason === "safety_concern") return "Safety concern";
  if (reason === "weather_delay") return "Weather delay";
  if (reason === "vehicle_issue") return "Vehicle issue";
  return "Other";
}
