"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import {
  getAuthorizedFieldRouteDay,
  getAuthorizedFieldStopBundle,
  type AuthorizedFieldAuth,
} from "@/lib/server/field-access";
import { formatBookingAddress } from "@/lib/booking-utils";
import {
  createRequestId,
  logger,
} from "@/lib/server/logger";
import {
  markFieldPaymentEmailSent,
  recordManualFieldPayment,
} from "@/lib/server/payment-operations";
import {
  sendFieldPaymentLinkEmail,
  sendOnTheWayEmail,
  sendServiceCompletedEmail,
} from "@/lib/email/sendFieldNotifications";
import {
  attachFieldServicePhoto,
  deleteFieldServicePhoto,
  setFieldPhotoException,
} from "@/lib/server/field-proof";
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
import {
  completeFieldStop,
  endBreakAndPrepareNextFieldStop,
  markFieldStopFollowUp,
  prepareNextFieldStop,
  requestFieldStopReschedule,
  transitionFieldStop,
} from "@/lib/server/field-lifecycle";


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

type FieldRedirectData = {
  redirectTo: string;
};

function fieldMutationFailure(
  action: string,
  message: string,
  error?: unknown,
  metadata?: Record<string, unknown>,
): ActionResult<never> {
  const requestId =
    createRequestId();

  logger.error(
    "field_mutation_failed",
    {
      requestId,
      action,
      error,
      metadata,
    },
  );

  return actionFailure(
    `${message} Reference: ${requestId}`,
  );
}

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

type FieldStopBundle = {
  admin: ReturnType<
    typeof getSupabaseAdmin
  >;
  stop: RouteStopRow | null;
  visit: ServiceVisitRow | null;
  booking: BookingRow | null;
  accessError: string | null;
};

async function getStopBundle(
  visitId: string,
  auth: AuthorizedFieldAuth,
): Promise<FieldStopBundle> {
  const access =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        visitId,
      },
    );

  if (!access.ok) {
    logger.warn(
      "field_stop_access_denied",
      {
        action:
          "field_stop_access",
        userId: auth.userId,
        role:
          auth.profile.role,
        metadata: {
          visitId,
          status:
            access.status,
          reason:
            access.message,
        },
      },
    );

    return {
      admin:
        getSupabaseAdmin(),
      stop: null,
      visit: null,
      booking: null,
      accessError:
        access.message,
    };
  }

  return {
    admin: access.admin,
    stop: access.stop,
    visit: access.visit,
    booking:
      access.booking,
    accessError: null,
  };
}

async function recordServiceEvent(
  input: {
    actorId: string;
    booking?: BookingRow | null;
    visit?: ServiceVisitRow | null;
    stop?: RouteStopRow | null;
    eventType: string;
    message: string;
    metadata?: Record<
      string,
      unknown
    >;
  },
) {
  const admin =
    getSupabaseAdmin();

  const { error } = await admin
    .from("service_events")
    .insert({
      actor_profile_id:
        input.actorId,
      booking_id:
        input.booking?.id ?? null,
      service_visit_id:
        input.visit?.id ?? null,
      route_stop_id:
        input.stop?.id ?? null,
      event_type:
        input.eventType,
      message: input.message,
      metadata:
        input.metadata ?? {},
    });

  if (error) {
    logger.warn(
      "field_service_event_failed",
      {
        action:
          "record_service_event",
        userId: input.actorId,
        bookingId:
          input.booking?.id ??
          null,
        error,
        metadata: {
          eventType:
            input.eventType,
          visitId:
            input.visit?.id ??
            null,
          routeStopId:
            input.stop?.id ??
            null,
        },
      },
    );
  }
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
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(formData, "visitId");

  const status =
    cleanId(
      formData,
      "status",
    ) as FieldStopStatus;

  const progressionStatuses:
    FieldStopStatus[] = [
      "on_the_way",
      "arrived",
      "in_progress",
    ];

  if (
    !visitId ||
    !progressionStatuses.includes(
      status,
    )
  ) {
    return actionFailure(
      "Choose the next valid stop status.",
    );
  }

  const {
    admin,
    stop,
    visit,
    booking,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !stop ||
    !visit
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const transition =
    await transitionFieldStop(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        nextStatus:
          status,
      },
    );

  if (!transition.ok) {
    return actionFailure(
      transition.message,
    );
  }

  let emailWarning = "";

  if (
    booking &&
    status === "on_the_way" &&
    transition.data.changed
  ) {
    try {
      const emailResult =
        await sendOnTheWayEmail(
          booking,
          {
            bookingId:
              booking.id,
            visitId:
              visit.id,
            routeStopId:
              stop.id,
          },
        );

      if (
        emailResult.status !==
        "sent"
      ) {
        emailWarning =
          " The stop updated, but the customer email was not sent.";
      }
    } catch (error) {
      logger.warn(
        "field_on_the_way_email_failed",
        {
          action:
            "update_stop_status",
          userId:
            auth.userId,
          customerId:
            booking.customer_id,
          bookingId:
            booking.id,
          error,
          metadata: {
            visitId:
              visit.id,
            routeStopId:
              stop.id,
          },
        },
      );

      emailWarning =
        " The stop updated, but the customer email was not sent.";
    }
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    transition.data.changed
      ? `${statusSuccessMessage(
          status,
        )}${emailWarning}`
      : `This stop is already marked ${status.replaceAll(
          "_",
          " ",
        )}.`,
  );
}

export async function markStopFollowUpAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const requestedReason =
    cleanId(
      formData,
      "reason",
    ) as FieldFollowUpReason;

  const reason =
    fieldFollowUpReasons.includes(
      requestedReason,
    )
      ? requestedReason
      : "other";

  const notes =
    cleanText(
      formData,
      "notes",
      900,
    );

  if (
    followUpReasonsRequiringNotes.includes(
      reason,
    ) &&
    !notes
  ) {
    return actionFailure(
      `${humanizeFollowUpReason(
        reason,
      )} requires a note so admin knows what happened.`,
    );
  }

  const {
    admin,
    stop,
    visit,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !visit ||
    !stop
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const result =
    await markFieldStopFollowUp(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        reason,
        notes:
          notes || null,
      },
    );

  if (!result.ok) {
    return actionFailure(
      result.message,
    );
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    result.data.changed
      ? "Stop marked for follow-up."
      : "This stop is already marked for follow-up.",
  );
}

export async function requestFieldRescheduleAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const requestedRouteDay =
    cleanDate(
      formData,
      "requestedRouteDay",
    ) || null;

  const notes =
    cleanText(
      formData,
      "notes",
      900,
    );

  if (
    !requestedRouteDay &&
    !notes
  ) {
    return actionFailure(
      "Add a requested date or note for admin.",
    );
  }

  const {
    admin,
    stop,
    visit,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !visit ||
    !stop
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const result =
    await requestFieldStopReschedule(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        requestedRouteDay,
        notes:
          notes || null,
      },
    );

  if (!result.ok) {
    return actionFailure(
      result.message,
    );
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    result.data.changed
      ? "Reschedule request sent to admin."
      : "A reschedule request already exists for this stop.",
  );
}

export async function saveChecklistAction(formData: FormData) {
  const auth = await requireFieldUser();
  const visitId = cleanId(formData, "visitId");
  const { admin, stop, visit, booking } = await getStopBundle(
    visitId,
    auth,
  );
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

export async function saveTechnicianNotesAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(formData, "visitId");

  const submittedTechnicianNotes =
    cleanText(
      formData,
      "technicianNotes",
      1800,
    );

  const issueFlags = formData
    .getAll("issueFlags")
    .map((value) =>
      String(value),
    )
    .filter(Boolean);

  const {
    admin,
    stop,
    visit,
    booking,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (!visit || !stop) {
    return actionFailure(
      "This stop could not be loaded.",
    );
  }

  const preservedPhotoFlags =
    stop.issue_flags.filter(
      (flag) =>
        flag ===
          BEFORE_PHOTO_EXCEPTION_FLAG ||
        flag ===
          AFTER_PHOTO_EXCEPTION_FLAG,
    );

  const nextIssueFlags =
    Array.from(
      new Set([
        ...issueFlags,
        ...preservedPhotoFlags,
      ]),
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
          .startsWith(
            PHOTO_UPLOAD_EXCEPTION_PREFIX,
          ),
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

  const [
    stopResult,
    visitResult,
  ] = await Promise.all([
    admin
      .from("route_stops")
      .update({
        technician_notes:
          technicianNotes,
        issue_flags:
          nextIssueFlags,
      })
      .eq("id", stop.id),

    admin
      .from("service_visits")
      .update({
        technician_notes:
          technicianNotes,
      })
      .eq("id", visit.id),
  ]);

  const saveError =
    stopResult.error ??
    visitResult.error;

  if (saveError) {
    return fieldMutationFailure(
      "save_technician_notes",
      "The technician notes could not be saved.",
      saveError,
      {
        visitId,
        routeStopId: stop.id,
      },
    );
  }

  await recordServiceEvent({
    actorId: auth.userId,
    booking,
    visit,
    stop,
    eventType:
      "technician_notes_saved",
    message:
      "Technician notes and issue flags were saved.",
    metadata: {
      issueFlags:
        nextIssueFlags,
    },
  });

  revalidateField(visit.id);

  return actionSuccess(
    "Technician notes saved.",
  );
}

export async function savePhotoUploadExceptionAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const beforeException =
    formData.get(
      "beforePhotoException",
    ) === "on";

  const afterException =
    formData.get(
      "afterPhotoException",
    ) === "on";

  const reason =
    cleanText(
      formData,
      "photoExceptionNote",
      1200,
    )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  const {
    admin,
    stop,
    visit,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !visit ||
    !stop
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const result =
    await setFieldPhotoException(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        beforeException,
        afterException,
        reason:
          reason || null,
      },
    );

  if (!result.ok) {
    return actionFailure(
      result.message,
    );
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    beforeException ||
    afterException
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
  contentType: string;
  size: number;
};

type DiscardServicePhotoUploadInput = {
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
  const auth =
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

  const { admin, stop, visit, booking } = await getStopBundle(
    visitId,
    auth,
  );

  if (!visit || !stop || !booking) {
    return actionFailure("This stop could not be loaded.");
  }

  if (
    !photoUploadStageAllowed(
      stop.status,
      photoType,
    )
  ) {
    return actionFailure(
      "This type of photo cannot be uploaded at the stop’s current stage.",
    );
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

function photoUploadStageAllowed(
  status: FieldStopStatus,
  photoType: PhotoType,
) {
  if (
    photoType === "before"
  ) {
    return (
      status === "arrived" ||
      status === "in_progress"
    );
  }

  if (
    photoType === "after"
  ) {
    return (
      status === "in_progress"
    );
  }

  return (
    status === "on_the_way" ||
    status === "arrived" ||
    status === "in_progress"
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
): Promise<
  ActionResult<{
    photoId: string;
  }>
> {
  const auth =
    await requireFieldUser();

  const visitId =
    String(
      input?.visitId ??
      "",
    ).trim();

  const photoType =
    String(
      input?.photoType ??
      "",
    ).trim() as PhotoType;

  const storageBucket =
    String(
      input?.storageBucket ??
      "",
    ).trim();

  const storagePath =
    String(
      input?.storagePath ??
      "",
    ).trim();

  const contentType =
    String(
      input?.contentType ??
      "",
    )
      .trim()
      .toLowerCase();

  const size =
    Number(
      input?.size ??
      0,
    );

  if (
    !visitId ||
    !validServicePhotoTypes.includes(
      photoType,
    )
  ) {
    return actionFailure(
      "Choose a valid service stop and photo type.",
    );
  }

  if (
    storageBucket !==
    SERVICE_PHOTO_BUCKET
  ) {
    return actionFailure(
      "The photo was uploaded to an invalid storage bucket.",
    );
  }

  if (
    !validServicePhotoContentTypes.has(
      contentType,
    )
  ) {
    return actionFailure(
      "Use a JPG, PNG, WEBP, HEIC, or HEIF image.",
    );
  }

  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    size >
      MAX_SERVICE_PHOTO_BYTES
  ) {
    return actionFailure(
      "Each photo must be 20 MB or smaller.",
    );
  }

  const {
    admin,
    stop,
    visit,
    booking,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !visit ||
    !stop ||
    !booking
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const requiredPrefix =
    `${visit.id}/${photoType}/`;

  if (
    !storagePath.startsWith(
      requiredPrefix,
    ) ||
    storagePath.includes(
      "..",
    )
  ) {
    return actionFailure(
      "The uploaded photo path is invalid.",
    );
  }

  const slashIndex =
    storagePath.lastIndexOf(
      "/",
    );

  const folder =
    storagePath.slice(
      0,
      slashIndex,
    );

  const fileName =
    storagePath.slice(
      slashIndex + 1,
    );

  const {
    data: storedObjects,
    error: listError,
  } = await admin.storage
    .from(
      SERVICE_PHOTO_BUCKET,
    )
    .list(
      folder,
      {
        limit: 100,
        search: fileName,
      },
    );

  if (
    listError ||
    !storedObjects?.some(
      (object) =>
        object.name ===
        fileName,
    )
  ) {
    await admin.storage
      .from(
        SERVICE_PHOTO_BUCKET,
      )
      .remove([
        storagePath,
      ]);

    return actionFailure(
      "Supabase has not confirmed this photo yet. Select it and try the upload again.",
    );
  }

  const result =
    await attachFieldServicePhoto(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        photoType,
        storageBucket,
        storagePath,
        contentType,
        fileSize:
          size,
      },
    );

  if (!result.ok) {
    await admin.storage
      .from(
        SERVICE_PHOTO_BUCKET,
      )
      .remove([
        storagePath,
      ]);

    return actionFailure(
      result.message,
    );
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    result.data
      .alreadyAttached
      ? "Photo was already attached to this stop."
      : "Photo confirmed and attached to this stop.",
    {
      photoId:
        result.data.photoId,
    },
  );
}

export async function discardPreparedServicePhotoUploadAction(
  input: DiscardServicePhotoUploadInput,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    String(
      input?.visitId ??
      "",
    ).trim();

  const photoType =
    String(
      input?.photoType ??
      "",
    ).trim() as PhotoType;

  const storageBucket =
    String(
      input?.storageBucket ??
      "",
    ).trim();

  const storagePath =
    String(
      input?.storagePath ??
      "",
    ).trim();

  if (
    !visitId ||
    !validServicePhotoTypes.includes(
      photoType,
    ) ||
    storageBucket !==
      SERVICE_PHOTO_BUCKET
  ) {
    return actionFailure(
      "The unfinished photo upload could not be identified.",
    );
  }

  const {
    admin,
    visit,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (!visit) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const requiredPrefix =
    `${visit.id}/${photoType}/`;

  if (
    !storagePath.startsWith(
      requiredPrefix,
    ) ||
    storagePath.includes(
      "..",
    )
  ) {
    return actionFailure(
      "The unfinished upload path is invalid.",
    );
  }

  const {
    data: attachedPhoto,
  } = await admin
    .from(
      "service_photos",
    )
    .select("id")
    .eq(
      "storage_bucket",
      storageBucket,
    )
    .eq(
      "storage_path",
      storagePath,
    )
    .maybeSingle();

  if (attachedPhoto?.id) {
    return actionSuccess(
      "The photo was already attached and was not discarded.",
    );
  }

  const {
    error,
  } = await admin.storage
    .from(
      storageBucket,
    )
    .remove([
      storagePath,
    ]);

  if (error) {
    return actionFailure(
      "The unfinished upload could not be cleaned up automatically.",
    );
  }

  return actionSuccess(
    "Unfinished photo upload discarded.",
  );
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

export async function deleteServicePhotoAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const photoId =
    cleanId(
      formData,
      "photoId",
    );

  const submittedVisitId =
    cleanId(
      formData,
      "visitId",
    );

  if (!photoId) {
    return actionFailure(
      "The photo could not be identified.",
    );
  }

  const admin =
    getSupabaseAdmin();

  const result =
    await deleteFieldServicePhoto(
      admin,
      {
        photoId,
        actorProfileId:
          auth.userId,
      },
    );

  if (!result.ok) {
    return actionFailure(
      result.message,
    );
  }

  if (
    result.data
      .alreadyDeleted
  ) {
    revalidateField(
      submittedVisitId ||
        undefined,
    );

    return actionSuccess(
      "This photo was already deleted.",
    );
  }

  let storageWarning = "";

  if (
    result.data
      .storageBucket &&
    result.data
      .storagePath
  ) {
    const {
      error: storageError,
    } = await admin.storage
      .from(
        result.data
          .storageBucket,
      )
      .remove([
        result.data
          .storagePath,
      ]);

    if (storageError) {
      const requestId =
        createRequestId();

      logger.warn(
        "field_photo_storage_cleanup_failed",
        {
          requestId,
          action:
            "delete_service_photo",
          userId:
            auth.userId,
          error:
            storageError,
          metadata: {
            photoId,
            storageBucket:
              result.data
                .storageBucket,
            storagePath:
              result.data
                .storagePath,
          },
        },
      );

      storageWarning =
        ` The proof record was removed, but storage cleanup needs review. Reference: ${requestId}`;
    }
  }

  revalidateField(
    (
      result.data.visitId ??
      submittedVisitId
    ) || undefined,
  );

  return actionSuccess(
    `Photo deleted.${storageWarning}`,
  );
}

export async function completeStopAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const {
    admin,
    stop,
    visit,
    booking,
    accessError,
  } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !stop ||
    !visit ||
    !booking
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const beforePhotoException =
    Boolean(
      stop
        .before_photo_exception_reason
        ?.trim(),
    ) &&
    stop.issue_flags.includes(
      BEFORE_PHOTO_EXCEPTION_FLAG,
    );

  const afterPhotoException =
    Boolean(
      stop
        .after_photo_exception_reason
        ?.trim(),
    ) &&
    stop.issue_flags.includes(
      AFTER_PHOTO_EXCEPTION_FLAG,
    );

  const completion =
    await completeFieldStop(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
        beforeExceptionAllowed:
          beforePhotoException,
        afterExceptionAllowed:
          afterPhotoException,
      },
    );

  if (!completion.ok) {
    return actionFailure(
      completion.message,
    );
  }

  if (
    completion.data
      .alreadyCompleted
  ) {
    revalidateField(
      visit.id,
    );

    return actionSuccess(
      "This stop was already completed.",
    );
  }

  let emailWarning = "";

  try {
    const emailResult =
      await sendServiceCompletedEmail(
        booking,
        {
          bookingId:
            booking.id,
          visitId:
            visit.id,
          routeStopId:
            stop.id,
          paymentLink:
            booking.payment_status ===
            "paid"
              ? null
              : booking.payment_link,
        },
      );

    if (
      emailResult.status !==
      "sent"
    ) {
      emailWarning =
        " Service was completed, but the customer email was not sent.";
    }
  } catch (error) {
    logger.warn(
      "field_completion_email_failed",
      {
        action:
          "complete_stop",
        userId:
          auth.userId,
        customerId:
          booking.customer_id,
        bookingId:
          booking.id,
        error,
        metadata: {
          visitId:
            visit.id,
          routeStopId:
            stop.id,
        },
      },
    );

    emailWarning =
      " Service was completed, but the customer email was not sent.";
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    `Stop completed.${emailWarning}`,
  );
}

export async function readyForNextStopAction(
  formData: FormData,
): Promise<
  ActionResult<FieldRedirectData>
> {
  const auth =
    await requireFieldUser();

  const currentStopId =
    cleanId(
      formData,
      "routeStopId",
    );

  if (!currentStopId) {
    return actionFailure(
      "The current stop could not be identified.",
    );
  }

  const currentAccess =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        routeStopId:
          currentStopId,
      },
    );

  if (!currentAccess.ok) {
    return actionFailure(
      currentAccess.message,
    );
  }

  const nextResult =
    await prepareNextFieldStop(
      currentAccess.admin,
      {
        currentRouteStopId:
          currentAccess.stop.id,
        actorProfileId:
          auth.userId,
      },
    );

  if (!nextResult.ok) {
    return actionFailure(
      nextResult.message,
    );
  }

  if (
    nextResult.data
      .routeComplete
  ) {
    revalidateField();

    return actionSuccess(
      "Route complete. No additional stops remain.",
      {
        redirectTo:
          "/field/today",
      },
    );
  }

  const {
    nextStopId,
    nextVisitId,
  } = nextResult.data;

  if (
    !nextStopId ||
    !nextVisitId
  ) {
    return actionFailure(
      "The next stop did not return a valid service visit.",
    );
  }

  const nextAccess =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        routeStopId:
          nextStopId,
        visitId:
          nextVisitId,
      },
    );

  if (!nextAccess.ok) {
    return actionFailure(
      nextAccess.message,
    );
  }

  let emailWarning = "";

  if (
    nextResult.data.changed
  ) {
    try {
      const emailResult =
        await sendOnTheWayEmail(
          nextAccess.booking,
          {
            bookingId:
              nextAccess.booking.id,
            visitId:
              nextAccess.visit.id,
            routeStopId:
              nextAccess.stop.id,
          },
        );

      if (
        emailResult.status !==
        "sent"
      ) {
        emailWarning =
          " The customer email was not sent.";
      }
    } catch (error) {
      logger.warn(
        "next_stop_email_failed",
        {
          action:
            "ready_for_next_stop",
          userId:
            auth.userId,
          customerId:
            nextAccess.booking
              .customer_id,
          bookingId:
            nextAccess.booking.id,
          error,
          metadata: {
            visitId:
              nextAccess.visit.id,
            routeStopId:
              nextAccess.stop.id,
          },
        },
      );

      emailWarning =
        " The customer email was not sent.";
    }
  }

  revalidateField(
    nextAccess.visit.id,
  );

  return actionSuccess(
    nextResult.data.changed
      ? `Next stop marked on the way.${emailWarning}`
      : "Opening the existing on-the-way stop.",
    {
      redirectTo:
        `/field/stops/${nextAccess.visit.id}`,
    },
  );
}

export async function startBreakAction(
  formData: FormData,
): Promise<
  ActionResult<FieldRedirectData>
> {
  const auth =
    await requireFieldUser();

  const routeDayId =
    cleanId(
      formData,
      "routeDayId",
    );

  const routeStopId =
    cleanId(
      formData,
      "routeStopId",
    );

  const requestedReason =
    cleanId(
      formData,
      "reason",
    ) as BreakReason;

  const notes =
    cleanText(
      formData,
      "notes",
      600,
    );

  if (
    !validBreakReasons.includes(
      requestedReason,
    )
  ) {
    return actionFailure(
      "Choose a valid break reason.",
    );
  }

  const reason =
    requestedReason;

  if (
    breakReasonsRequiringNotes.includes(
      reason,
    ) &&
    !notes
  ) {
    return actionFailure(
      `${reason.replaceAll(
        "_",
        " ",
      )} requires a note so admin knows what happened.`,
    );
  }

  const admin =
    getSupabaseAdmin();
  
  if (routeDayId) {
    const routeAccess =
      await getAuthorizedFieldRouteDay(
        {
          auth,
          routeDayId,
        },
      );
  
    if (!routeAccess.ok) {
      return actionFailure(
        routeAccess.message,
      );
    }
  }
  
  const {
    data: activeBreak,
    error: activeBreakError,
  } = await admin
    .from("route_breaks")
    .select("id, reason")
    .eq(
      "technician_id",
      auth.userId,
    )
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();

  if (activeBreakError) {
    return fieldMutationFailure(
      "check_active_break",
      "The app could not verify your current break status.",
      activeBreakError,
      {
        technicianId:
          auth.userId,
      },
    );
  }

  if (activeBreak) {
    return actionFailure(
      "You already have an active break. End it before starting another one.",
    );
  }

  const {
    data: createdBreak,
    error: insertError,
  } = await admin
    .from("route_breaks")
    .insert({
      route_day_id:
        routeDayId || null,
      technician_id:
        auth.userId,
      reason,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (
    insertError ||
    !createdBreak
  ) {
    if (
      insertError?.code ===
      "23505"
    ) {
      return actionFailure(
        "You already have an active break. Refresh the page to view it.",
      );
    }

    return fieldMutationFailure(
      "start_break",
      "The break could not be started.",
      insertError,
      {
        technicianId:
          auth.userId,
        routeDayId:
          routeDayId || null,
        routeStopId:
          routeStopId || null,
        reason,
      },
    );
  }

  revalidateField();

  const redirectTo =
    routeStopId
      ? `/field/breaks?routeStopId=${encodeURIComponent(
          routeStopId,
        )}`
      : "/field/breaks";

  return actionSuccess(
    "Break started.",
    {
      redirectTo,
    },
  );
}

export async function endBreakAction(
  formData: FormData,
): Promise<
  ActionResult<FieldRedirectData>
> {
  const auth =
    await requireFieldUser();

  const breakId =
    cleanId(
      formData,
      "breakId",
    );

  const readyForNext =
    formData.get(
      "readyForNext",
    ) === "on";

  const routeStopId =
    cleanId(
      formData,
      "routeStopId",
    );

  if (!breakId) {
    return actionFailure(
      "The active break could not be identified.",
    );
  }

  const admin =
    getSupabaseAdmin();

  if (
    readyForNext &&
    routeStopId
  ) {
    const result =
      await endBreakAndPrepareNextFieldStop(
        admin,
        {
          breakId,
          currentRouteStopId:
            routeStopId,
          actorProfileId:
            auth.userId,
        },
      );

    if (!result.ok) {
      return actionFailure(
        result.message,
      );
    }

    if (
      result.data
        .routeComplete
    ) {
      revalidateField();

      return actionSuccess(
        "Break ended. The route is complete.",
        {
          redirectTo:
            "/field/today",
        },
      );
    }

    const {
      nextStopId,
      nextVisitId,
    } = result.data;

    if (
      !nextStopId ||
      !nextVisitId
    ) {
      return actionFailure(
        "The break could not be ended with a valid next stop.",
      );
    }

    const nextAccess =
      await getAuthorizedFieldStopBundle(
        {
          auth,
          routeStopId:
            nextStopId,
          visitId:
            nextVisitId,
        },
      );

    if (!nextAccess.ok) {
      return actionFailure(
        nextAccess.message,
      );
    }

    let emailWarning = "";

    if (result.data.changed) {
      try {
        const emailResult =
          await sendOnTheWayEmail(
            nextAccess.booking,
            {
              bookingId:
                nextAccess.booking.id,
              visitId:
                nextAccess.visit.id,
              routeStopId:
                nextAccess.stop.id,
            },
          );

        if (
          emailResult.status !==
          "sent"
        ) {
          emailWarning =
            " The customer email was not sent.";
        }
      } catch (error) {
        logger.warn(
          "break_resume_email_failed",
          {
            action:
              "end_break",
            userId:
              auth.userId,
            customerId:
              nextAccess.booking
                .customer_id,
            bookingId:
              nextAccess.booking.id,
            error,
            metadata: {
              visitId:
                nextAccess.visit.id,
              routeStopId:
                nextAccess.stop.id,
            },
          },
        );

        emailWarning =
          " The customer email was not sent.";
      }
    }

    revalidateField(
      nextAccess.visit.id,
    );

    return actionSuccess(
      `Break ended. Opening the next stop.${emailWarning}`,
      {
        redirectTo:
          `/field/stops/${nextAccess.visit.id}`,
      },
    );
  }

  const {
    data: endedBreak,
    error: endError,
  } = await admin
    .from("route_breaks")
    .update({
      ended_at:
        new Date().toISOString(),
    })
    .eq("id", breakId)
    .eq(
      "technician_id",
      auth.userId,
    )
    .is("ended_at", null)
    .select("id")
    .maybeSingle();

  if (endError) {
    return fieldMutationFailure(
      "end_break",
      "The break could not be ended.",
      endError,
      {
        breakId,
        technicianId:
          auth.userId,
      },
    );
  }

  if (!endedBreak) {
    return actionFailure(
      "This break is already ended or does not belong to your account.",
    );
  }

  revalidateField();

  return actionSuccess(
    "Break ended.",
    {
      redirectTo:
        "/field/breaks",
    },
  );
}

export async function markManualPaidAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const requestedMethod =
    cleanId(
      formData,
      "paymentMethod",
    );

  const method =
    validFieldPaymentMethods.find(
      (value) =>
        value ===
        requestedMethod,
    );

  const serviceAmount =
    cleanMoney(
      formData,
      "serviceAmount",
    );

  const enteredTipAmount =
    cleanMoney(
      formData,
      "tipAmount",
    );

  const tipAmount =
    enteredTipAmount ?? 0;

  const notes =
    cleanText(
      formData,
      "paymentNotes",
      500,
    );

  if (!visitId) {
    return actionFailure(
      "The service visit could not be identified.",
    );
  }

  if (!method) {
    return actionFailure(
      "Choose a valid payment method.",
    );
  }

  if (
    serviceAmount === null ||
    serviceAmount <= 0
  ) {
    return actionFailure(
      "Enter a valid service amount.",
    );
  }

  if (tipAmount < 0) {
    return actionFailure(
      "The tip amount cannot be negative.",
    );
  }

  if (
    serviceAmount > 5000 ||
    tipAmount > 5000
  ) {
    return actionFailure(
      "Review the amounts before recording this payment.",
    );
  }

  if (
    method === "other" &&
    !notes
  ) {
    return actionFailure(
      "Add a payment note when recording another payment method.",
    );
  }

    const {
      admin,
      stop,
      visit,
      booking,
      accessError,
    } =
    await getStopBundle(
      visitId,
      auth,
    );

  if (
    !visit ||
    !stop ||
    !booking
  ) {
    return actionFailure(
      accessError ??
        "This stop could not be loaded.",
    );
  }

  const authoritativeServiceCents =
    Math.round(
      Number(
        booking.estimated_price,
      ) * 100,
    );

  const enteredServiceCents =
    Math.round(
      serviceAmount * 100,
    );

  if (
    !Number.isFinite(
      authoritativeServiceCents,
    ) ||
    authoritativeServiceCents <= 0
  ) {
    return actionFailure(
      "The booking does not have a valid service amount. Admin review is required.",
    );
  }

  if (
    !isAdminRole(
      auth.profile.role,
    ) &&
    enteredServiceCents !==
      authoritativeServiceCents
  ) {
    return actionFailure(
      `The service amount must match the booking total of $${(
        authoritativeServiceCents /
        100
      ).toFixed(2)}. Only an admin or owner may override it.`,
    );
  }

  const recordedServiceAmount =
    isAdminRole(
      auth.profile.role,
    )
      ? serviceAmount
      : authoritativeServiceCents /
        100;
  
  const result =
    await recordManualFieldPayment(
      admin,
      {
        routeStopId:
          stop.id,
        actorProfileId:
          auth.userId,
       serviceAmount:
          recordedServiceAmount,
        tipAmount,
        method,
        notes:
          notes || null,
      },
    );

  if (!result.ok) {
    return actionFailure(
      result.message,
    );
  }

  revalidateField(
    visit.id,
  );

  if (
    result.data.alreadyPaid
  ) {
    return actionSuccess(
      "This booking was already marked paid. No duplicate payment was created.",
    );
  }

  return actionSuccess(
    result.data.tipAmount > 0
      ? `Payment recorded: $${result.data.serviceAmount.toFixed(
          2,
        )} service and $${result.data.tipAmount.toFixed(
          2,
        )} tip.`
      : `Payment recorded: $${result.data.serviceAmount.toFixed(
          2,
        )}.`,
  );
}

export async function sendPaymentLinkFromFieldAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth =
    await requireFieldUser();

  const bookingId =
    cleanId(
      formData,
      "bookingId",
    );

  const visitId =
    cleanId(
      formData,
      "visitId",
    );

  const routeStopId =
    cleanId(
      formData,
      "routeStopId",
    );

  const access =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        routeStopId,
        visitId,
        bookingId,
      },
    );

  if (!access.ok) {
    return actionFailure(
      access.message,
    );
  }

  const {
    admin,
    booking,
    visit,
    stop,
  } = access;

  if (!booking.payment_link) {
    return actionFailure(
      "Create a Stripe payment link before sending the payment email.",
    );
  }

  const {
    data: payment,
    error: paymentError,
  } = await admin
    .from("payments")
    .select("*")
    .eq(
      "booking_id",
      booking.id,
    )
    .eq(
      "provider",
      "stripe",
    )
    .eq(
      "checkout_url",
      booking.payment_link,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    paymentError ||
    !payment
  ) {
    return actionFailure(
      "The saved Stripe link is not attached to a current payment record. Create a fresh link before emailing it.",
    );
  }

  const result =
    await sendFieldPaymentLinkEmail(
      booking,
      {
        bookingId:
          booking.id,
        visitId:
          visit.id,
        routeStopId:
          stop.id,
      },
    );

  if (
    result.status ===
    "failed"
  ) {
    return actionFailure(
      "Payment email failed. Use the admin billing page or try again.",
    );
  }

  if (
    result.status ===
    "skipped"
  ) {
    return actionFailure(
      "Payment email is not configured yet. Use the admin billing page to send the payment link.",
    );
  }

  const tracking =
    await markFieldPaymentEmailSent(
      admin,
      {
        paymentId:
          payment.id,
        routeStopId:
          stop.id,
        serviceVisitId:
          visit.id,
        actorProfileId:
          auth.userId,
      },
    );

  let trackingWarning = "";

  if (!tracking.ok) {
    const requestId =
      createRequestId();

    logger.error(
      "field_payment_email_tracking_failed",
      {
        requestId,
        action:
          "send_payment_link_from_field",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        customerId:
          booking.customer_id,
        bookingId:
          booking.id,
        error:
          tracking.error,
        metadata: {
          paymentId:
            payment.id,
          visitId:
            visit.id,
          routeStopId:
            stop.id,
        },
      },
    );

    trackingWarning =
      ` The email was sent, but internal tracking needs review. Reference: ${requestId}`;
  }

  revalidateField(
    visit.id,
  );

  return actionSuccess(
    `Payment email sent.${trackingWarning}`,
  );
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
