import { sendTransactionalEmail } from "@/lib/email/resend";
import { getResendEnv } from "@/lib/env";
import {
  adminCustomerRequestAlertTemplate,
  customerRequestReceivedTemplate,
  customerRequestUpdatedTemplate,
} from "@/lib/email/templates";
import type { BookingRow, CustomerRequestRow, ProfileRow } from "@/types/database";

export function sendCustomerRequestReceived(
  request: CustomerRequestRow,
  profile: ProfileRow,
  booking?: BookingRow | null,
  serviceDate?: string | null,
) {
  if (!profile.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  const template = customerRequestReceivedTemplate(request, booking, serviceDate);

  return sendTransactionalEmail({
    to: profile.email,
    ...template,
    templateKey: "customer_request_received",
    idempotencyKey: `customer-request-received-${request.id}`,
  });
}

export function sendAdminCustomerRequestAlert(
  request: CustomerRequestRow,
  profile: ProfileRow,
  booking?: BookingRow | null,
  serviceDate?: string | null,
) {
  const template = adminCustomerRequestAlertTemplate(
    request,
    profile,
    booking,
    serviceDate,
  );

  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...template,
    replyTo: profile.email ?? booking?.email ?? undefined,
    templateKey: "admin_customer_request_alert",
    relatedBookingId: booking?.id ?? request.booking_id,
    idempotencyKey: `admin-customer-request-${request.id}`,
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
