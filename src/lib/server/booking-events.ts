import "server-only";

import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingEventOutcome } from "@/types/database";

export type BookingEventSource =
  | "booking_api"
  | "stripe"
  | "customer_portal"
  | "admin"
  | "automation"
  | "system";

type RecordBookingEventInput = {
  bookingId: string;
  customerId?: string | null;
  actorProfileId?: string | null;
  requestId?: string | null;
  route?: string;
  source?: BookingEventSource;
  eventType: string;
  outcome?: BookingEventOutcome;
  message: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordBookingEventResult =
  | {
      ok: true;
      duplicate: boolean;
    }
  | {
      ok: false;
      duplicate: false;
      error: string;
    };

/**
 * Records a permanent booking lifecycle event.
 *
 * Event logging must never interrupt the customer workflow. Errors are
 * reported to the application logger and returned to the caller rather
 * than thrown.
 */
export async function recordBookingEvent(
  input: RecordBookingEventInput,
): Promise<RecordBookingEventResult> {
  try {
    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from("booking_events")
      .insert({
        booking_id: input.bookingId,
        customer_id: input.customerId ?? null,
        actor_profile_id: input.actorProfileId ?? null,
        request_id: input.requestId ?? null,
        source: input.source ?? "system",
        event_type: input.eventType,
        outcome: input.outcome ?? "info",
        message: input.message,
        idempotency_key: input.idempotencyKey ?? null,
        metadata: input.metadata ?? {},
      });

    if (!error) {
      return {
        ok: true,
        duplicate: false,
      };
    }

    /*
     * Stripe and other external systems may retry an event. A duplicate
     * idempotency key means the event was already recorded successfully.
     */
    if (
      error.code === "23505" &&
      input.idempotencyKey
    ) {
      return {
        ok: true,
        duplicate: true,
      };
    }

    logger.warn("booking_event_insert_failed", {
      route: input.route,
      requestId: input.requestId ?? undefined,
      customerId: input.customerId ?? null,
      bookingId: input.bookingId,
      error,
      metadata: {
        eventType: input.eventType,
        source: input.source ?? "system",
      },
    });

    return {
      ok: false,
      duplicate: false,
      error: error.message,
    };
  } catch (error) {
    logger.warn("booking_event_insert_exception", {
      route: input.route,
      requestId: input.requestId ?? undefined,
      customerId: input.customerId ?? null,
      bookingId: input.bookingId,
      error,
      metadata: {
        eventType: input.eventType,
        source: input.source ?? "system",
      },
    });

    return {
      ok: false,
      duplicate: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown booking event error.",
    };
  }
}
