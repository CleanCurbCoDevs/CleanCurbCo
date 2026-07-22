import { getResendEnv } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  adminCommercialQuoteNotificationTemplate,
} from "@/lib/email/templates";
import type {
  CommercialQuoteRequestRow,
} from "@/types/database";

export function sendAdminCommercialQuoteNotification(
  quote: CommercialQuoteRequestRow,
) {
  const template =
    adminCommercialQuoteNotificationTemplate(quote);

  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...template,
    replyTo: quote.email,
    templateKey: "admin_commercial_quote_notification",
    idempotencyKey:
      `admin-commercial-quote-${quote.id}`,
  });
}
