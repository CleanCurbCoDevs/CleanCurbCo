import { getResendEnv } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { adminBookingNotificationTemplate } from "@/lib/email/templates";
import type { BookingRow } from "@/types/database";

export function sendAdminBookingNotification(booking: BookingRow) {
  const template = adminBookingNotificationTemplate(booking);

  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...template,
    replyTo: booking.email,
    templateKey: "admin_booking_notification",
    relatedBookingId: booking.id,
    idempotencyKey: `admin-booking-${booking.id}`,
  });
}
