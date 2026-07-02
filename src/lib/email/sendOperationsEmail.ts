import { sendTransactionalEmail } from "@/lib/email/resend";
import { getResendEnv } from "@/lib/env";
import {
  accountDeletionDecisionTemplate,
  accountDeletionRequestedTemplate,
  adminAccountDeletionRequestTemplate,
  adminRouteDateResponseTemplate,
  bookingDecisionTemplate,
  paymentSetupCompletedTemplate,
  paymentSetupInviteTemplate,
  routeDateOfferedTemplate,
  routeDateResponseTemplate,
} from "@/lib/email/templates";
import type {
  AccountDeletionRequestRow,
  BookingRow,
  ProfileRow,
} from "@/types/database";

export function sendAccountDeletionRequested(
  request: AccountDeletionRequestRow,
  profile: ProfileRow,
) {
  if (!profile.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  return sendTransactionalEmail({
    to: profile.email,
    ...accountDeletionRequestedTemplate(request, profile),
    templateKey: "account_deletion_requested",
    idempotencyKey: `account-deletion-requested-${request.id}`,
  });
}

export function sendAdminAccountDeletionRequest(
  request: AccountDeletionRequestRow,
  profile: ProfileRow,
  adminUrl: string,
) {
  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...adminAccountDeletionRequestTemplate(request, profile, adminUrl),
    replyTo: profile.email ?? undefined,
    templateKey: "admin_account_deletion_request",
    idempotencyKey: `admin-account-deletion-${request.id}`,
  });
}

export function sendAccountDeletionDecision(
  request: AccountDeletionRequestRow,
  profile: ProfileRow,
  statusLabel: string,
) {
  if (!profile.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  return sendTransactionalEmail({
    to: profile.email,
    ...accountDeletionDecisionTemplate(request, statusLabel),
    templateKey: "account_deletion_decision",
    idempotencyKey: `account-deletion-decision-${request.id}-${request.status}`,
  });
}

export function sendBookingDecision(
  booking: BookingRow,
  decision: "accepted" | "declined" | "needs_more_information",
  message?: string | null,
) {
  return sendTransactionalEmail({
    to: booking.email,
    ...bookingDecisionTemplate(booking, decision, message),
    templateKey: `booking_${decision}`,
    relatedBookingId: booking.id,
    idempotencyKey: `booking-decision-${booking.id}-${decision}-${booking.updated_at}`,
  });
}

export function sendRouteDateOffer(booking: BookingRow, portalUrl: string) {
  return sendTransactionalEmail({
    to: booking.email,
    ...routeDateOfferedTemplate(booking, portalUrl),
    templateKey: "route_date_offered",
    relatedBookingId: booking.id,
    idempotencyKey: `route-date-offered-${booking.id}-${booking.proposed_route_day ?? "none"}`,
  });
}

export function sendRouteDateResponse(
  booking: BookingRow,
  response: "confirmed" | "declined",
) {
  return sendTransactionalEmail({
    to: booking.email,
    ...routeDateResponseTemplate(booking, response),
    templateKey: `route_date_${response}`,
    relatedBookingId: booking.id,
    idempotencyKey: `route-date-${response}-${booking.id}-${booking.route_responded_at ?? "now"}`,
  });
}

export function sendAdminRouteDateResponse(
  booking: BookingRow,
  response: "confirmed" | "declined",
) {
  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...adminRouteDateResponseTemplate(booking, response),
    replyTo: booking.email,
    templateKey: `admin_route_date_${response}`,
    relatedBookingId: booking.id,
    idempotencyKey: `admin-route-date-${response}-${booking.id}-${booking.route_responded_at ?? "now"}`,
  });
}

export function sendPaymentSetupInvite(
  booking: BookingRow,
  setupUrl: string,
  accountSetupUrl?: string | null,
) {
  return sendTransactionalEmail({
    to: booking.email,
    ...paymentSetupInviteTemplate(booking, setupUrl, accountSetupUrl),
    templateKey: "payment_setup_invite",
    relatedBookingId: booking.id,
    idempotencyKey: `payment-setup-invite-${booking.id}-${setupUrl}`,
  });
}

export function sendPaymentSetupCompleted(booking: BookingRow) {
  return sendTransactionalEmail({
    to: booking.email,
    ...paymentSetupCompletedTemplate(booking),
    templateKey: "payment_setup_completed",
    relatedBookingId: booking.id,
    idempotencyKey: `payment-setup-completed-${booking.id}`,
  });
}
