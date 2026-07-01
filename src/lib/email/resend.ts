import "server-only";

import { Resend } from "resend";
import { getResendEnv, isResendConfigured } from "@/lib/env";
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
  message: string,
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
  const payload = {
    service: "email",
    message,
    templateKey: input.templateKey,
    recipientCount: input.recipientCount,
    status: input.status,
    relatedBookingId: input.relatedBookingId ?? null,
    relatedVisitId: input.relatedVisitId ?? null,
    resendId: input.resendId ?? null,
    errorMessage: input.errorMessage ?? null,
  };

  console[level](JSON.stringify(payload));
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
