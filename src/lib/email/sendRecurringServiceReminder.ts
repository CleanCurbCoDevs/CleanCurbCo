import "server-only";

import { sendTransactionalEmail } from "@/lib/email/resend";
import { recurringServiceReminderTemplate } from "@/lib/email/templates";
import type { BookingRow } from "@/types/database";

type SendRecurringServiceReminderInput = {
  booking: BookingRow;
  visitId: string;
  serviceDate: string;
  portalUrl: string;
  billingUrl: string;
  paymentMethodMissing: boolean;
};

export function sendRecurringServiceReminder({
  booking,
  visitId,
  serviceDate,
  portalUrl,
  billingUrl,
  paymentMethodMissing,
}: SendRecurringServiceReminderInput) {
  const template =
    recurringServiceReminderTemplate(
      booking,
      serviceDate,
      {
        portalUrl,
        billingUrl,
        paymentMethodMissing,
      },
    );

  return sendTransactionalEmail({
    to: booking.email,
    ...template,
    templateKey: "recurring_service_reminder",
    relatedBookingId: booking.id,
    relatedVisitId: visitId,
    idempotencyKey:
      `recurring-service-reminder-${visitId}-${serviceDate}`,
  });
}
