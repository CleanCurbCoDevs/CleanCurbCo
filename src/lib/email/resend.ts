import "server-only";

import { Resend } from "resend";
import { getResendEnv, isResendConfigured } from "@/lib/env";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | string[];
  templateKey: string;
  relatedBookingId?: string | null;
  relatedVisitId?: string | null;
  idempotencyKey?: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  const { apiKey } = getResendEnv();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown email error.";
  }
}

function logEmailResult(
  level: "info" | "warn" | "error",
  event: string,
  input: {
    templateKey: string;
    recipientCount: number;
    status: "sent" | "failed" | "skipped";
    relatedBookingId?: string | null;
    relatedVisitId?: string | null;
    resendId?: string | null;
    errorMessage?: string | null;
  },
) {
  logger[level](event, {
    route: "email",
    bookingId: input.relatedBookingId ?? null,
    status: input.status,
    metadata: {
      templateKey: input.templateKey,
      recipientCount: input.recipientCount,
      relatedVisitId: input.relatedVisitId ?? null,
      resendId: input.resendId ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

function isCriticalEmailTemplate(templateKey: string) {
  return (
    templateKey.startsWith("admin_") ||
    [
      "booking_confirmation",
      "commercial_quote_confirmation",
      "customer_request_received",
      "account_deletion_requested",
      "payment_setup_invite",
      "payment_setup_completed",
    ].includes(templateKey)
  );
}

async function notifyCriticalEmailFailure(input: {
  templateKey: string;
  subject: string;
  relatedBookingId?: string | null;
  errorMessage: string;
}) {
  if (!isCriticalEmailTemplate(input.templateKey)) return;

  await createAdminNotification({
    type: "critical_email_failed",
    title: "Critical email failed",
    message: `${input.templateKey} failed: ${input.subject}`,
    href: input.relatedBookingId
      ? `/admin/bookings?q=${input.relatedBookingId}`
      : "/admin",
    booking_id: input.relatedBookingId ?? null,
    severity: "urgent",
    metadata: {
      templateKey: input.templateKey,
      errorMessage: input.errorMessage,
    },
  });
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const { from, replyTo } = getResendEnv();
  const recipientCount = recipients.length;

  if (!recipients.length) {
    logEmailResult("warn", "email_send_skipped", {
      templateKey: input.templateKey,
      recipientCount,
      status: "skipped",
      relatedBookingId: input.relatedBookingId,
      relatedVisitId: input.relatedVisitId,
      errorMessage: "No recipients configured.",
    });
    return { status: "skipped" as const, reason: "No recipients configured." };
  }

  if (!isResendConfigured()) {
    await Promise.all(
      recipients.map((recipient) =>
        recordEmailEvent({
          recipient,
          subject: input.subject,
          templateKey: input.templateKey,
          status: "failed",
          errorMessage: "Resend is not configured.",
          relatedBookingId: input.relatedBookingId,
          relatedVisitId: input.relatedVisitId,
        }),
      ),
    );

    logEmailResult("warn", "email_send_skipped", {
      templateKey: input.templateKey,
      recipientCount,
      status: "skipped",
      relatedBookingId: input.relatedBookingId,
      relatedVisitId: input.relatedVisitId,
      errorMessage: "Resend is not configured.",
    });

    await notifyCriticalEmailFailure({
      templateKey: input.templateKey,
      subject: input.subject,
      relatedBookingId: input.relatedBookingId,
      errorMessage: "Resend is not configured.",
    });

    return { status: "skipped" as const, reason: "Resend is not configured." };
  }

  const resend = getResendClient();
  const configuredReplyTo = input.replyTo ?? replyTo;

  try {
    const { data, error } = await resend.emails.send(
      {
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: configuredReplyTo,
      },
      input.idempotencyKey
        ? {
            headers: {
              "Idempotency-Key": input.idempotencyKey,
            },
          }
        : undefined,
    );

    const errorMessage = error ? getSafeErrorMessage(error) : null;

    await Promise.all(
      recipients.map((recipient) =>
        recordEmailEvent({
          recipient,
          subject: input.subject,
          templateKey: input.templateKey,
          status: error ? "failed" : "sent",
          resendId: data?.id ?? null,
          errorMessage,
          relatedBookingId: input.relatedBookingId,
          relatedVisitId: input.relatedVisitId,
        }),
      ),
    );

    logEmailResult(error ? "error" : "info", "email_send_completed", {
      templateKey: input.templateKey,
      recipientCount,
      status: error ? "failed" : "sent",
      relatedBookingId: input.relatedBookingId,
      relatedVisitId: input.relatedVisitId,
      resendId: data?.id ?? null,
      errorMessage,
    });

    if (error) {
      await notifyCriticalEmailFailure({
        templateKey: input.templateKey,
        subject: input.subject,
        relatedBookingId: input.relatedBookingId,
        errorMessage: errorMessage ?? "Resend send error.",
      });
      return { status: "failed" as const, error };
    }

    return { status: "sent" as const, id: data?.id ?? null };
  } catch (error) {
    const errorMessage = getSafeErrorMessage(error);

    await Promise.all(
      recipients.map((recipient) =>
        recordEmailEvent({
          recipient,
          subject: input.subject,
          templateKey: input.templateKey,
          status: "failed",
          errorMessage,
          relatedBookingId: input.relatedBookingId,
          relatedVisitId: input.relatedVisitId,
        }),
      ),
    );

    logEmailResult("error", "email_send_exception", {
      templateKey: input.templateKey,
      recipientCount,
      status: "failed",
      relatedBookingId: input.relatedBookingId,
      relatedVisitId: input.relatedVisitId,
      errorMessage,
    });

    await notifyCriticalEmailFailure({
      templateKey: input.templateKey,
      subject: input.subject,
      relatedBookingId: input.relatedBookingId,
      errorMessage,
    });

    return { status: "failed" as const, error };
  }
}

async function recordEmailEvent(input: {
  recipient: string;
  subject: string;
  templateKey: string;
  status: "sent" | "failed";
  resendId?: string | null;
  errorMessage?: string | null;
  relatedBookingId?: string | null;
  relatedVisitId?: string | null;
}) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("email_events").insert({
      recipient_email: input.recipient,
      subject: input.subject,
      template_key: input.templateKey,
      status: input.status,
      resend_id: input.resendId ?? null,
      error_message: input.errorMessage ?? null,
      related_booking_id: input.relatedBookingId ?? null,
      related_visit_id: input.relatedVisitId ?? null,
    });
  } catch {
    // Email logging should never block a customer-facing form.
  }
}
