import "server-only";

import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BookingExceptionRow,
  BookingExceptionSeverity,
} from "@/types/database";

type OpenBookingExceptionInput = {
  bookingId: string;
  customerId?: string | null;
  sourceEventId?: string | null;
  requestId?: string | null;
  route?: string;
  source?: string;
  exceptionType: string;
  severity?: BookingExceptionSeverity;
  title: string;
  message: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
};

/*
 * Exception recording must never break the customer workflow
 * that exposed the exception. Failures are logged and return
 * null rather than being thrown back into checkout, booking,
 * notification, or account-setup routes.
 */
export async function openBookingException(
  input: OpenBookingExceptionInput,
): Promise<BookingExceptionRow | null> {
  const bookingId = input.bookingId.trim();
  const source =
    input.source?.trim() || "system";
  const exceptionType =
    input.exceptionType.trim();
  const title = input.title.trim();
  const message = input.message.trim();
  const dedupeKey =
    input.dedupeKey.trim();

  if (
    !bookingId ||
    !exceptionType ||
    !title ||
    !message ||
    !dedupeKey
  ) {
    logger.error(
      "booking_exception_invalid_input",
      {
        requestId:
          input.requestId ?? undefined,
        route: input.route,
        bookingId:
          bookingId || undefined,
        metadata: {
          hasExceptionType:
            Boolean(exceptionType),
          hasTitle: Boolean(title),
          hasMessage: Boolean(message),
          hasDedupeKey:
            Boolean(dedupeKey),
        },
      },
    );

    return null;
  }

  const { data, error } =
    await getSupabaseAdmin().rpc(
      "open_booking_exception",
      {
        p_booking_id: bookingId,
        p_customer_id:
          input.customerId ?? null,
        p_source_event_id:
          input.sourceEventId ?? null,
        p_request_id:
          input.requestId ?? null,
        p_source: source,
        p_exception_type:
          exceptionType,
        p_severity:
          input.severity ?? "warning",
        p_title: title,
        p_message: message,
        p_dedupe_key: dedupeKey,
        p_metadata:
          input.metadata ?? {},
      },
    );

  if (error || !data) {
    logger.error(
      "booking_exception_open_failed",
      {
        requestId:
          input.requestId ?? undefined,
        route: input.route,
        bookingId,
        customerId:
          input.customerId ?? undefined,
        error,
        metadata: {
          exceptionType,
          dedupeKey,
        },
      },
    );

    return null;
  }

  logger.info(
    "booking_exception_opened",
    {
      requestId:
        input.requestId ?? undefined,
      route: input.route,
      bookingId,
      customerId:
        data.customer_id ?? undefined,
      metadata: {
        exceptionId: data.id,
        exceptionType:
          data.exception_type,
        status: data.status,
        severity: data.severity,
        occurrenceCount:
          data.occurrence_count,
        dedupeKey: data.dedupe_key,
      },
    },
  );

  return data;
}
