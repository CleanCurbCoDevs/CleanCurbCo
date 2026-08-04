"use server";

import { revalidatePath } from "next/cache";

import {
  actionFailure,
  actionSuccess,
  type ActionResult,
} from "@/lib/action-result";
import { recordBookingEvent } from "@/lib/server/booking-events";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import {
  createRequestId,
  logger,
  maskEmail,
} from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";
import {
  cleanLongText,
  cleanString,
} from "@/lib/validation";
import type {
  BookingExceptionRow,
  BookingExceptionStatus,
  ProfileRow,
} from "@/types/database";

type BookingExceptionAction =
  | "acknowledge"
  | "assign"
  | "resolve"
  | "dismiss"
  | "reopen";

const validActions:
  readonly BookingExceptionAction[] = [
    "acknowledge",
    "assign",
    "resolve",
    "dismiss",
    "reopen",
  ];

type ActionDetails = {
  update:
    Partial<BookingExceptionRow>;
  message: string;
  eventType: string;
  eventMessage: string;
  eventOutcome:
    | "info"
    | "success"
    | "warning"
    | "failure";
  assignee:
    ProfileRow | null;
};

export async function updateBookingExceptionAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin(
    "/admin/exceptions",
  );

  if (auth.status !== "ok") {
    return actionFailure(
      auth.message,
    );
  }

  const requestId =
    createRequestId();

  const exceptionId = cleanString(
    formData.get("exceptionId"),
    80,
  );

  const rawAction = cleanString(
    formData.get("action"),
    40,
  );

  if (!exceptionId) {
    return actionFailure(
      "The exception ID is missing.",
    );
  }

  if (
    !validActions.includes(
      rawAction as BookingExceptionAction,
    )
  ) {
    return actionFailure(
      "That exception action is not valid.",
    );
  }

  const action =
    rawAction as BookingExceptionAction;

  const admin = getSupabaseAdmin();

  const {
    data: current,
    error: currentError,
  } = await admin
    .from("booking_exceptions")
    .select("*")
    .eq("id", exceptionId)
    .maybeSingle();

  if (currentError) {
    logger.error(
      "admin_booking_exception_lookup_failed",
      {
        requestId,
        action:
          `booking_exception_${action}`,
        userId: auth.userId,
        role: auth.profile.role,
        error: currentError,
        metadata: {
          exceptionId,
        },
      },
    );

    return actionFailure(
      "The exception could not be loaded.",
    );
  }

  if (!current) {
    return actionFailure(
      "That exception no longer exists.",
    );
  }

  const details =
    await buildActionDetails({
      action,
      formData,
      current,
      actorUserId:
        auth.userId,
    });

  if ("error" in details) {
    return actionFailure(
      details.error,
    );
  }

  const {
    data: updated,
    error: updateError,
  } = await admin
    .from("booking_exceptions")
    .update(details.update)
    .eq("id", current.id)

    /*
     * Prevent one browser or administrator from silently
     * overwriting a newer exception decision.
     */
    .eq(
      "updated_at",
      current.updated_at,
    )
    .select("*")
    .maybeSingle();

  if (updateError) {
    logger.error(
      "admin_booking_exception_update_failed",
      {
        requestId,
        action:
          `booking_exception_${action}`,
        userId: auth.userId,
        role: auth.profile.role,
        customerId:
          current.customer_id,
        bookingId:
          current.booking_id,
        error: updateError,
        metadata: {
          exceptionId:
            current.id,
          previousStatus:
            current.status,
        },
      },
    );

    return actionFailure(
      "The exception could not be updated.",
    );
  }

  if (!updated) {
    return actionFailure(
      "This exception changed in another session. Refresh and try again.",
    );
  }

  await Promise.allSettled([
    recordBookingEvent({
      bookingId:
        updated.booking_id,
      customerId:
        updated.customer_id,
      actorProfileId:
        auth.userId,
      requestId,
      route:
        "/admin/exceptions",
      source: "admin",
      eventType:
        details.eventType,
      outcome:
        details.eventOutcome,
      message:
        details.eventMessage,
      idempotencyKey:
        `booking:${updated.booking_id}:exception:${updated.id}:${action}:${requestId}`,
      metadata: {
        exceptionId:
          updated.id,
        exceptionType:
          updated.exception_type,
        previousStatus:
          current.status,
        status:
          updated.status,
        previousAssigneeId:
          current.assigned_to_profile_id,
        assignedToProfileId:
          updated.assigned_to_profile_id,
        occurrenceCount:
          updated.occurrence_count,
        resolutionNote:
          updated.resolution_note,
      },
    }),

    writeAdminAuditLog({
      action:
        `booking_exception_${action}`,
      actor_user_id:
        auth.userId,
      actor_email:
        maskEmail(auth.email),
      actor_role:
        auth.profile.role,
      target_type:
        "booking_exception",
      target_id:
        updated.id,
      customer_id:
        updated.customer_id,
      booking_id:
        updated.booking_id,
      before_summary: {
        status:
          current.status,
        severity:
          current.severity,
        assignedToProfileId:
          current.assigned_to_profile_id,
        acknowledgedAt:
          current.acknowledged_at,
        resolvedAt:
          current.resolved_at,
        resolutionNote:
          current.resolution_note,
      },
      after_summary: {
        status:
          updated.status,
        severity:
          updated.severity,
        assignedToProfileId:
          updated.assigned_to_profile_id,
        acknowledgedAt:
          updated.acknowledged_at,
        resolvedAt:
          updated.resolved_at,
        resolutionNote:
          updated.resolution_note,
      },
      request_id:
        requestId,
      status: "success",
    }),
  ]);

  logger.info(
    "admin_booking_exception_updated",
    {
      requestId,
      action:
        `booking_exception_${action}`,
      userId: auth.userId,
      role: auth.profile.role,
      customerId:
        updated.customer_id,
      bookingId:
        updated.booking_id,
      metadata: {
        exceptionId:
          updated.id,
        exceptionType:
          updated.exception_type,
        previousStatus:
          current.status,
        status:
          updated.status,
        assignedToProfileId:
          updated.assigned_to_profile_id,
      },
    },
  );

  revalidatePath("/admin");
  revalidatePath(
    "/admin/exceptions",
  );
  revalidatePath(
    "/admin/bookings",
  );
  revalidatePath(
    "/admin/payments",
  );

  return actionSuccess(
    details.message,
  );
}

async function buildActionDetails(input: {
  action: BookingExceptionAction;
  formData: FormData;
  current: BookingExceptionRow;
  actorUserId: string;
}): Promise<
  | ActionDetails
  | { error: string }
> {
  const now =
    new Date().toISOString();

  switch (input.action) {
    case "acknowledge": {
      if (
        isClosedStatus(
          input.current.status,
        )
      ) {
        return {
          error:
            "Closed exceptions must be reopened before acknowledgment.",
        };
      }

      if (
        input.current.status ===
        "acknowledged"
      ) {
        return {
          error:
            "This exception is already acknowledged.",
        };
      }

      return {
        update: {
          status:
            "acknowledged",
          acknowledged_at:
            now,
          acknowledged_by_profile_id:
            input.actorUserId,
        },
        message:
          "Exception acknowledged.",
        eventType:
          "BOOKING_EXCEPTION_ACKNOWLEDGED",
        eventMessage:
          "The operational exception was acknowledged by an administrator.",
        eventOutcome:
          "info",
        assignee: null,
      };
    }

    case "assign": {
      if (
        isClosedStatus(
          input.current.status,
        )
      ) {
        return {
          error:
            "Closed exceptions must be reopened before assignment.",
        };
      }

      const assigneeId =
        cleanString(
          input.formData.get(
            "assigneeId",
          ),
          80,
        ) || null;

      let assignee:
        ProfileRow | null = null;

      if (assigneeId) {
        const {
          data,
          error,
        } = await getSupabaseAdmin()
          .from("profiles")
          .select("*")
          .eq("id", assigneeId)
          .maybeSingle();

        if (
          error ||
          !data ||
          ![
            "owner",
            "admin",
          ].includes(data.role)
        ) {
          return {
            error:
              "Exceptions may only be assigned to an owner or administrator.",
          };
        }

        assignee = data;
      }

      /*
       * Do not create false timeline and audit entries when
       * the requested assignment is already the current one.
       */
      if (
        assigneeId ===
        input.current
          .assigned_to_profile_id
      ) {
        return {
          error: assigneeId
            ? "This exception is already assigned to that administrator."
            : "This exception is already unassigned.",
        };
      }

      const assigneeName =
        assignee
          ? profileName(assignee)
          : null;

      return {
        update: {
          assigned_to_profile_id:
            assigneeId,
        },
        message: assigneeName
          ? `Exception assigned to ${assigneeName}.`
          : "Exception assignment cleared.",
        eventType:
          assignee
            ? "BOOKING_EXCEPTION_ASSIGNED"
            : "BOOKING_EXCEPTION_UNASSIGNED",
        eventMessage:
          assigneeName
            ? `The operational exception was assigned to ${assigneeName}.`
            : "The operational exception assignment was cleared.",
        eventOutcome:
          "info",
        assignee,
      };
    }

    case "resolve":
    case "dismiss": {
      if (
        isClosedStatus(
          input.current.status,
        )
      ) {
        return {
          error:
            "This exception is already closed.",
        };
      }

      const resolutionNote =
        cleanLongText(
          input.formData.get(
            "resolutionNote",
          ),
          2000,
        );

      if (
        !resolutionNote ||
        resolutionNote.length < 3
      ) {
        return {
          error:
            "Add a brief resolution or dismissal note.",
        };
      }

      const nextStatus:
        BookingExceptionStatus =
          input.action === "resolve"
            ? "resolved"
            : "dismissed";

      return {
        update: {
          status:
            nextStatus,
          acknowledged_at:
            input.current
              .acknowledged_at ??
            now,
          acknowledged_by_profile_id:
            input.current
              .acknowledged_by_profile_id ??
            input.actorUserId,
          resolved_at:
            now,
          resolved_by_profile_id:
            input.actorUserId,
          resolution_note:
            resolutionNote,
        },
        message:
          input.action === "resolve"
            ? "Exception resolved."
            : "Exception dismissed.",
        eventType:
          input.action === "resolve"
            ? "BOOKING_EXCEPTION_RESOLVED"
            : "BOOKING_EXCEPTION_DISMISSED",
        eventMessage:
          input.action === "resolve"
            ? "The operational exception was resolved by an administrator."
            : "The operational exception was dismissed by an administrator.",
        eventOutcome:
          input.action === "resolve"
            ? "success"
            : "warning",
        assignee: null,
      };
    }

    case "reopen": {
      if (
        !isClosedStatus(
          input.current.status,
        )
      ) {
        return {
          error:
            "This exception is already active.",
        };
      }

      return {
        update: {
          status: "open",
          acknowledged_at:
            null,
          acknowledged_by_profile_id:
            null,
          resolved_at:
            null,
          resolved_by_profile_id:
            null,
          resolution_note:
            null,
        },
        message:
          "Exception reopened.",
        eventType:
          "BOOKING_EXCEPTION_REOPENED",
        eventMessage:
          "The operational exception was reopened by an administrator.",
        eventOutcome:
          "warning",
        assignee: null,
      };
    }
  }
}

function isClosedStatus(
  status: BookingExceptionStatus,
) {
  return (
    status === "resolved" ||
    status === "dismissed"
  );
}

function profileName(
  profile: ProfileRow,
) {
  const fullName = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    fullName ||
    profile.email ||
    "administrator"
  );
}
