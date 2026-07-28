import { getSiteUrl } from "@/lib/env";
import { sendRecurringServiceReminder } from "@/lib/email/sendRecurringServiceReminder";
import { logger } from "@/lib/server/logger";
import { getStripePaymentMethodState } from "@/lib/server/stripe-payment-method";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BookingRow,
  ServiceVisitRow,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderVisit = Pick<
  ServiceVisitRow,
  "id" | "booking_id" | "route_day" | "status"
>;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const route =
    "/api/cron/recurring-service-reminders";

  const cronSecret = process.env.CRON_SECRET;
  const authorization =
    request.headers.get("authorization");

  if (
    !cronSecret ||
    authorization !== `Bearer ${cronSecret}`
  ) {
    logger.warn(
      "recurring_service_reminder_unauthorized",
      {
        route,
        status: "unauthorized",
      },
    );

    return Response.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const targetDate =
    getEasternDatePlusDays(new Date(), 14);

  const admin = getSupabaseAdmin();

  const {
    data: visitRows,
    error: visitError,
  } = await admin
    .from("service_visits")
    .select(
      "id, booking_id, route_day, status",
    )
    .eq("route_day", targetDate)
    .eq("status", "scheduled")
    .not("booking_id", "is", null);

  if (visitError) {
    logger.error(
      "recurring_service_reminder_visit_lookup_failed",
      {
        route,
        status: "failed",
        error: visitError,
        metadata: {
          targetDate,
        },
      },
    );

    return Response.json(
      {
        success: false,
        error:
          "Scheduled visits could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }

  const visits =
    (visitRows ?? []) as ReminderVisit[];

  if (!visits.length) {
    return Response.json({
      success: true,
      targetDate,
      candidates: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
  }

  const visitIds = visits.map(
    (visit) => visit.id,
  );

  const bookingIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.booking_id)
        .filter(
          (bookingId): bookingId is string =>
            Boolean(bookingId),
        ),
    ),
  );

  const [
    bookingResult,
    previousEmailResult,
  ] = await Promise.all([
    admin
      .from("bookings")
      .select("*")
      .in("id", bookingIds),

    admin
      .from("email_events")
      .select("related_visit_id")
      .eq(
        "template_key",
        "recurring_service_reminder",
      )
      .eq("status", "sent")
      .in("related_visit_id", visitIds),
  ]);

  if (bookingResult.error) {
    logger.error(
      "recurring_service_reminder_booking_lookup_failed",
      {
        route,
        status: "failed",
        error: bookingResult.error,
        metadata: {
          targetDate,
          bookingCount: bookingIds.length,
        },
      },
    );

    return Response.json(
      {
        success: false,
        error: "Bookings could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }

  if (previousEmailResult.error) {
    logger.error(
      "recurring_service_reminder_history_lookup_failed",
      {
        route,
        status: "failed",
        error: previousEmailResult.error,
        metadata: {
          targetDate,
        },
      },
    );

    return Response.json(
      {
        success: false,
        error:
          "Reminder history could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }

  const bookings =
    (bookingResult.data ?? []) as BookingRow[];

  const bookingsById = new Map(
    bookings.map((booking) => [
      booking.id,
      booking,
    ]),
  );

  const alreadySentVisitIds = new Set(
    (previousEmailResult.data ?? [])
      .map((event) => event.related_visit_id)
      .filter(Boolean),
  );

  const siteUrl = getSiteUrl();

  const portalUrl = new URL(
    "/portal/bookings",
    siteUrl,
  ).toString();

  const billingUrl = new URL(
    "/portal/billing",
    siteUrl,
  ).toString();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const visit of visits) {
    if (alreadySentVisitIds.has(visit.id)) {
      skipped += 1;
      continue;
    }

    if (!visit.booking_id || !visit.route_day) {
      skipped += 1;
      continue;
    }

    const booking =
      bookingsById.get(visit.booking_id);

    if (
      !booking ||
      booking.frequency === "one_time" ||
      booking.status === "cancelled"
    ) {
      skipped += 1;
      continue;
    }

    const paymentMethodState =
      await getStripePaymentMethodState({
        stripeCustomerId:
          booking.stripe_customer_id,
        stripeSubscriptionId:
          booking.stripe_subscription_id,
      });

    if (
      paymentMethodState.status ===
      "unavailable"
    ) {
      logger.warn(
        "recurring_service_reminder_payment_status_unavailable",
        {
          route,
          bookingId: booking.id,
          status: "warning",
          metadata: {
            visitId: visit.id,
            targetDate,
          },
        },
      );
    }

    const result =
      await sendRecurringServiceReminder({
        booking,
        visitId: visit.id,
        serviceDate: visit.route_day,
        portalUrl,
        billingUrl,
        paymentMethodMissing:
          paymentMethodState.status ===
          "missing",
      });

    if (result.status === "sent") {
      sent += 1;
    } else if (result.status === "skipped") {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  logger.info(
    "recurring_service_reminder_run_completed",
    {
      route,
      status:
        failed > 0
          ? "completed_with_failures"
          : "completed",
      durationMs:
        Date.now() - startedAt,
      metadata: {
        targetDate,
        candidates: visits.length,
        sent,
        skipped,
        failed,
      },
    },
  );

  return Response.json({
    success: failed === 0,
    targetDate,
    candidates: visits.length,
    sent,
    skipped,
    failed,
  });
}

function getEasternDatePlusDays(
  now: Date,
  days: number,
) {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

  const year = Number(
    parts.find(
      (part) => part.type === "year",
    )?.value,
  );

  const month = Number(
    parts.find(
      (part) => part.type === "month",
    )?.value,
  );

  const day = Number(
    parts.find(
      (part) => part.type === "day",
    )?.value,
  );

  const targetDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days,
    ),
  );

  return targetDate
    .toISOString()
    .slice(0, 10);
}
