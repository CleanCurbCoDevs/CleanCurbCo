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
  resolveBookingException,
} from "@/lib/server/booking-exceptions";
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

export async function repairServiceAddressExceptionAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin(
    "/admin/exceptions",
  );

  if (auth.status !== "ok") {
    return actionFailure(
      "Admin access is required.",
    );
  }

  const requestId =
    createRequestId();

  const exceptionId =
    cleanString(
      formData.get(
        "exceptionId",
      ),
      80,
    );

  if (!exceptionId) {
    return actionFailure(
      "The exception ID is missing.",
    );
  }

  const admin =
    getSupabaseAdmin();

  const {
    data: current,
    error: currentError,
  } = await admin
    .from("booking_exceptions")
    .select("*")
    .eq(
      "id",
      exceptionId,
    )
    .maybeSingle();

  if (currentError) {
    logger.error(
      "admin_service_address_exception_lookup_failed",
      {
        requestId,
        action:
          "service_address_exception_repair",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        error:
          currentError,
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

  if (
    current.exception_type !==
    "service_address_link_failed"
  ) {
    return actionFailure(
      "This repair only applies to saved-address link exceptions.",
    );
  }

  if (
    isClosedStatus(
      current.status,
    )
  ) {
    return actionFailure(
      "This exception is already closed.",
    );
  }

  const {
    data: booking,
    error: bookingError,
  } = await admin
    .from("bookings")
    .select("*")
    .eq(
      "id",
      current.booking_id,
    )
    .maybeSingle();

  if (
    bookingError ||
    !booking
  ) {
    logger.error(
      "admin_service_address_repair_booking_lookup_failed",
      {
        requestId,
        action:
          "service_address_exception_repair",
        userId:
          auth.userId,
        role:
          auth.profile.role,
        bookingId:
          current.booking_id,
        error:
          bookingError,
        metadata: {
          exceptionId:
            current.id,
        },
      },
    );

    return actionFailure(
      "The related booking could not be loaded.",
    );
  }

  if (!booking.customer_id) {
    return actionFailure(
      "Link this booking to a customer account before creating a saved service address.",
    );
  }

  let serviceAddressId =
    booking.service_address_id;

  let addressCreated =
    false;

  if (!serviceAddressId) {
    let addressQuery = admin
      .from(
        "service_addresses",
      )
      .select("id")
      .eq(
        "customer_id",
        booking.customer_id,
      )
      .eq(
        "street_address",
        booking.street_address,
      )
      .eq(
        "city",
        booking.city,
      )
      .eq(
        "state",
        booking.state,
      );

    addressQuery =
      booking.zip_code
        ? addressQuery.eq(
            "zip_code",
            booking.zip_code,
          )
        : addressQuery.is(
            "zip_code",
            null,
          );

    const {
      data: existingAddress,
      error: addressLookupError,
    } = await addressQuery
      .order(
        "is_primary",
        {
          ascending:
            false,
        },
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        },
      )
      .limit(1)
      .maybeSingle();

    if (addressLookupError) {
      logger.error(
        "admin_service_address_repair_lookup_failed",
        {
          requestId,
          action:
            "service_address_exception_repair",
          userId:
            auth.userId,
          role:
            auth.profile.role,
          customerId:
            booking.customer_id,
          bookingId:
            booking.id,
          error:
            addressLookupError,
          metadata: {
            exceptionId:
              current.id,
          },
        },
      );

      return actionFailure(
        "Existing saved addresses could not be checked.",
      );
    }

    if (existingAddress?.id) {
      serviceAddressId =
        existingAddress.id;
    } else {
      const {
        count:
          savedAddressCount,
        error:
          addressCountError,
      } = await admin
        .from(
          "service_addresses",
        )
        .select("id", {
          count:
            "exact",
          head:
            true,
        })
        .eq(
          "customer_id",
          booking.customer_id,
        );

      if (addressCountError) {
        logger.warn(
          "admin_service_address_repair_count_failed",
          {
            requestId,
            action:
              "service_address_exception_repair",
            userId:
              auth.userId,
            role:
              auth.profile.role,
            customerId:
              booking.customer_id,
            bookingId:
              booking.id,
            error:
              addressCountError,
          },
        );
      }

      const {
        data: createdAddress,
        error:
          addressCreateError,
      } = await admin
        .from(
          "service_addresses",
        )
        .insert({
          customer_id:
            booking.customer_id,
          label:
            "Home",
          street_address:
            booking.street_address,
          city:
            booking.city,
          state:
            booking.state,
          zip_code:
            booking.zip_code,
          neighborhood:
            booking.neighborhood,
          collection_day:
            booking.collection_day,
          collection_time_window:
            booking
              .collection_time_window,
          same_day_preference:
            booking
              .same_day_preference,
          latitude:
            booking
              .service_latitude,
          longitude:
            booking
              .service_longitude,
          distance_from_hub_miles:
            booking
              .service_distance_miles,
          gate_code:
            null,
          notes:
            booking.customer_notes,
          is_primary:
            !addressCountError &&
            (savedAddressCount ??
              0) === 0,
        })
        .select("id")
        .single();

      if (
        addressCreateError ||
        !createdAddress
      ) {
        logger.error(
          "admin_service_address_repair_create_failed",
          {
            requestId,
            action:
              "service_address_exception_repair",
            userId:
              auth.userId,
            role:
              auth.profile.role,
            customerId:
              booking.customer_id,
            bookingId:
              booking.id,
            error:
              addressCreateError,
            metadata: {
              exceptionId:
                current.id,
            },
          },
        );

        return actionFailure(
          "The saved service address could not be created.",
        );
      }

      serviceAddressId =
        createdAddress.id;

      addressCreated =
        true;
    }

    const {
      data: linkedBooking,
      error: linkError,
    } = await admin
      .from("bookings")
      .update({
        service_address_id:
          serviceAddressId,
      })
      .eq(
        "id",
        booking.id,
      )
      .eq(
        "customer_id",
        booking.customer_id,
      )
      .is(
        "service_address_id",
        null,
      )
      .select("*")
      .maybeSingle();

    if (linkError) {
      logger.error(
        "admin_service_address_repair_link_failed",
        {
          requestId,
          action:
            "service_address_exception_repair",
          userId:
            auth.userId,
          role:
            auth.profile.role,
          customerId:
            booking.customer_id,
          bookingId:
            booking.id,
          error:
            linkError,
          metadata: {
            exceptionId:
              current.id,
            serviceAddressId,
          },
        },
      );

      return actionFailure(
        "The address was saved, but the booking could not be linked to it.",
      );
    }

    if (linkedBooking) {
      serviceAddressId =
        linkedBooking
          .service_address_id;
    } else {
      /*
       * Another request may have linked the booking after
       * this action loaded it. Accept that concurrent repair
       * rather than overwriting the newer address decision.
       */
      const {
        data:
          refreshedBooking,
        error:
          refreshError,
      } = await admin
        .from("bookings")
        .select(
          "service_address_id",
        )
        .eq(
          "id",
          booking.id,
        )
        .maybeSingle();

      if (
        refreshError ||
        !refreshedBooking
          ?.service_address_id
      ) {
        logger.error(
          "admin_service_address_repair_concurrent_link_missing",
          {
            requestId,
            action:
              "service_address_exception_repair",
            userId:
              auth.userId,
            role:
              auth.profile.role,
            customerId:
              booking.customer_id,
            bookingId:
              booking.id,
            error:
              refreshError,
            metadata: {
              exceptionId:
                current.id,
              attemptedServiceAddressId:
                serviceAddressId,
            },
          },
        );

        return actionFailure(
          "The booking changed during repair. Refresh and try again.",
        );
      }

      serviceAddressId =
        refreshedBooking
          .service_address_id;
    }
  }

  if (!serviceAddressId) {
    return actionFailure(
      "The booking still does not have a saved service address.",
    );
  }

  const resolutionNote =
    booking.service_address_id
      ? "The booking already had a valid saved service-address link."
      : addressCreated
        ? "An administrator created and linked the booking's saved service address."
        : "An administrator linked the booking to its existing saved service address.";

  await Promise.allSettled([
    recordBookingEvent({
      bookingId:
        booking.id,
      customerId:
        booking.customer_id,
      actorProfileId:
        auth.userId,
      requestId,
      route:
        "/admin/exceptions",
      source:
        "admin",
      eventType:
        "SERVICE_ADDRESS_LINK_REPAIRED",
      outcome:
        "success",
      message:
        "The booking was connected to a saved service address.",
      idempotencyKey:
        `booking:${booking.id}:service_address_link_repaired:${requestId}`,
      metadata: {
        exceptionId:
          current.id,
        previousServiceAddressId:
          booking.service_address_id,
        serviceAddressId,
        addressCreated,
      },
    }),

    writeAdminAuditLog({
      action:
        "booking_service_address_link_repaired",
      actor_user_id:
        auth.userId,
      actor_email:
        maskEmail(
          auth.email,
        ),
      actor_role:
        auth.profile.role,
      target_type:
        "booking",
      target_id:
        booking.id,
      customer_id:
        booking.customer_id,
      booking_id:
        booking.id,
      before_summary: {
        serviceAddressId:
          booking.service_address_id,
      },
      after_summary: {
        serviceAddressId,
        addressCreated,
      },
      request_id:
        requestId,
      status:
        "success",
      metadata: {
        exceptionId:
          current.id,
        exceptionType:
          current.exception_type,
      },
    }),
  ]);

  await resolveBookingException({
    bookingId:
      booking.id,
    dedupeKey:
      current.dedupe_key,
    resolutionNote,
    resolvedByProfileId:
      auth.userId,
    requestId,
    route:
      "/admin/exceptions",
  });

  logger.info(
    "admin_service_address_exception_repaired",
    {
      requestId,
      action:
        "service_address_exception_repair",
      userId:
        auth.userId,
      role:
        auth.profile.role,
      customerId:
        booking.customer_id,
      bookingId:
        booking.id,
      metadata: {
        exceptionId:
          current.id,
        serviceAddressId,
        addressCreated,
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
    "/admin/customers",
  );
  revalidatePath(
    `/admin/customers/${booking.customer_id}`,
  );

  return actionSuccess(
    addressCreated
      ? "Saved service address created and linked."
      : "Saved service address linked successfully.",
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
