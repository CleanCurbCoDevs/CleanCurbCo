import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  commercialQuoteConfirmationTemplate,
} from "@/lib/email/templates";
import type {
  CommercialQuoteRequestRow,
} from "@/types/database";

export function sendCommercialQuoteConfirmation(
  quote: CommercialQuoteRequestRow,
) {
  const template =
    commercialQuoteConfirmationTemplate(quote);

  return sendTransactionalEmail({
    to: quote.email,
    ...template,
    templateKey: "commercial_quote_confirmation",
    idempotencyKey:
      `commercial-quote-confirmation-${quote.id}`,
  });
}
