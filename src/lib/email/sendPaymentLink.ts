import { sendTransactionalEmail } from "@/lib/email/resend";
import { paymentLinkTemplate } from "@/lib/email/templates";
import type { BookingRow } from "@/types/database";

export function sendPaymentLink(booking: BookingRow) {
  const template = paymentLinkTemplate(booking);

  return sendTransactionalEmail({
    to: booking.email,
    ...template,
    templateKey: "payment_link",
    relatedBookingId: booking.id,
    idempotencyKey: `payment-link-${booking.id}-${booking.stripe_checkout_session_id ?? "manual"}`,
  });
}
