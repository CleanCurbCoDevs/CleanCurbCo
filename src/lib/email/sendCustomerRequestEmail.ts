import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  customerRequestReceivedTemplate,
  customerRequestUpdatedTemplate,
} from "@/lib/email/templates";
import type { CustomerRequestRow, ProfileRow } from "@/types/database";

export function sendCustomerRequestReceived(
  request: CustomerRequestRow,
  profile: ProfileRow,
) {
  if (!profile.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  const template = customerRequestReceivedTemplate(request);

  return sendTransactionalEmail({
    to: profile.email,
    ...template,
    templateKey: "customer_request_received",
    idempotencyKey: `customer-request-received-${request.id}`,
  });
}

export function sendCustomerRequestUpdate(
  request: CustomerRequestRow,
  profile: ProfileRow,
) {
  if (!profile.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  const template = customerRequestUpdatedTemplate(request);

  return sendTransactionalEmail({
    to: profile.email,
    ...template,
    templateKey: "customer_request_updated",
    idempotencyKey: `customer-request-updated-${request.id}-${request.status}`,
  });
}
