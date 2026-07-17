import "server-only";

import { Resend } from "resend";
import {
  fieldOnTheWayTemplate,
  paymentLinkTemplate,
  serviceCompletedTemplate,
  type EmailTemplate,
} from "@/lib/email/templates";
import {
  getResendEnv,
  isResendConfigured,
} from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow } from "@/types/database";

const FACEBOOK_REVIEWS_URL =
  "https://www.facebook.com/profile.php?id=61591401340864&sk=reviews";

const REVIEW_DELAY_HOURS = 20;

type RelatedIds = {
  bookingId?: string | null;
  visitId?: string | null;
  routeStopId?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function facebookReviewRequestTemplate(
  booking: BookingRow,
): EmailTemplate {
  const firstName =
    booking.first_name?.trim() || "there";

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

      <body style="margin:0;padding:0;background:#f5f4ef;color:#111;font-family:Arial,Helvetica,sans-serif">
        <div
          style="display:none;max-height:0;overflow:hidden;opacity:0"
        >
          A quick Facebook recommendation makes a huge difference
          for our small business.
        </div>

        <div style="padding:28px 14px;background:#f5f4ef">
          <div
            style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dedbd0;border-radius:16px;overflow:hidden;box-shadow:0 14px 40px rgba(5,5,5,.08)"
          >
            <div
              style="background:#050505;color:#ffffff;padding:24px;border-bottom:5px solid #00ff38"
            >
              <p
                style="margin:0 0 8px;color:#ffe38a;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase"
              >
                Clean Curb Co.
              </p>

              <h1
                style="margin:0;font-size:28px;line-height:1.1"
              >
                Did we leave things fresh?
              </h1>

              <p
                style="margin:8px 0 0;color:#ffe38a;font-weight:800"
              >
                Fresh Starts at the Curb.
              </p>
            </div>

            <div
              style="padding:26px;font-size:16px;line-height:1.65;color:#222"
            >
              <p style="margin-top:0">
                Hey ${escapeHtml(firstName)},
              </p>

              <p>
                Thanks again for trusting Clean Curb Co. with the
                gross stuff. We hope your bins are looking cleaner,
                smelling better, and feeling significantly less
                suspicious.
              </p>

              <p>
                As a new local, veteran-owned small business, a
                quick Facebook recommendation helps more than you
                might think. It lets nearby neighbors know we are
                real people doing real work—and not just three
                raccoons operating a pressure washer.
              </p>

              <p style="margin:26px 0">
                <a
                  href="${escapeHtml(FACEBOOK_REVIEWS_URL)}"
                  style="display:inline-block;background:#00ff38;color:#050505;padding:14px 20px;border-radius:10px;font-weight:800;text-decoration:none"
                >
                  Recommend Clean Curb Co. on Facebook
                </a>
              </p>

              <p
                style="font-size:14px;color:#625d53;background:#f8f4e8;border:1px solid #dedbd0;border-radius:12px;padding:14px"
              >
                <strong>Not on Facebook?</strong>
                No worries at all. Clean Curb Co. is also on Yelp
                if that is where you prefer to share your
                experience.
              </p>

              <p>
                Every recommendation, referral, and person willing
                to trust us with the gross stuff genuinely matters.
                Thank you for supporting Clean Curb Co.
              </p>

              <p style="margin-bottom:0">
                Stay fresh,<br />
                <strong>The Clean Curb Co. Team</strong>
              </p>
            </div>

            <div
              style="background:#111;color:#d8d2c3;padding:20px 26px;font-size:13px;line-height:1.6"
            >
              <p
                style="margin:0 0 8px;font-weight:800;color:#ffffff"
              >
                Clean Curb Co.
              </p>

              <p style="margin:0 0 10px">
                Local, veteran-owned garbage bin cleaning serving
                Summerville and surrounding Charleston-area
                communities.
              </p>

              <p style="margin:0;color:#ffe38a">
                Need help? Reply directly to this email.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = [
    `Hey ${firstName},`,
    "",
    "Thanks again for trusting Clean Curb Co. with the gross stuff. We hope your bins are looking cleaner and smelling better.",
    "",
    "As a new local, veteran-owned small business, a quick Facebook recommendation helps nearby neighbors find and trust us:",
    FACEBOOK_REVIEWS_URL,
    "",
    "Not on Facebook? No worries at all. Clean Curb Co. is also on Yelp if that is where you prefer to share your experience.",
    "",
    "Every recommendation and referral genuinely matters. Thank you for supporting Clean Curb Co.",
    "",
    "Stay fresh,",
    "The Clean Curb Co. Team",
  ].join("\n");

  return {
    subject: "Did we leave things fresh?",
    html,
    text,
  };
}

async function recordNotification(
  input: {
    booking: BookingRow;
    templateKey: string;
    status: "sent" | "failed" | "skipped";
    resendId?: string | null;
    errorMessage?: string | null;
  } & RelatedIds,
) {
  try {
    const admin = getSupabaseAdmin();

    await admin.from("notification_events").insert({
      recipient_profile_id:
        input.booking.customer_id,
      recipient_email: input.booking.email,
      recipient_phone: input.booking.phone,
      channel: "email",
      template_key: input.templateKey,
      status: input.status,
      resend_id: input.resendId ?? null,
      error_message: input.errorMessage ?? null,
      related_booking_id:
        input.bookingId ?? input.booking.id,
      related_visit_id: input.visitId ?? null,
      related_route_stop_id:
        input.routeStopId ?? null,
    });
  } catch {
    // Notification logging should not block field work.
  }
}

async function sendAndLog(
  booking: BookingRow,
  templateKey: string,
  template: EmailTemplate,
  ids: RelatedIds,
) {
  const result = await sendTransactionalEmail({
    to: booking.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    templateKey,
    relatedBookingId:
      ids.bookingId ?? booking.id,
    relatedVisitId: ids.visitId ?? null,
  });

  await recordNotification({
    booking,
    templateKey,
    status:
      result.status === "sent"
        ? "sent"
        : result.status === "failed"
          ? "failed"
          : "skipped",
    resendId:
      "id" in result ? result.id : null,
    errorMessage:
      result.status === "failed"
        ? JSON.stringify(result.error)
        : result.status === "skipped"
          ? result.reason
          : null,
    ...ids,
  });

  return result;
}

async function scheduleFacebookReviewRequestEmail(
  booking: BookingRow,
  ids: RelatedIds,
) {
  if (booking.review_request_sent_at) {
    return {
      status: "skipped" as const,
      reason: "Review request already scheduled.",
    };
  }

  if (!booking.email?.trim()) {
    await recordNotification({
      booking,
      templateKey: "review_request",
      status: "skipped",
      errorMessage:
        "Customer does not have an email address.",
      ...ids,
    });

    return {
      status: "skipped" as const,
      reason:
        "Customer does not have an email address.",
    };
  }

  if (!isResendConfigured()) {
    await recordNotification({
      booking,
      templateKey: "review_request",
      status: "skipped",
      errorMessage: "Resend is not configured.",
      ...ids,
    });

    return {
      status: "skipped" as const,
      reason: "Resend is not configured.",
    };
  }

  const scheduledAt = new Date(
    Date.now() +
      REVIEW_DELAY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const template =
    facebookReviewRequestTemplate(booking);

  const {
    apiKey,
    from,
    replyTo,
  } = getResendEnv();

  try {
    const resend = new Resend(apiKey);

    const { data, error } =
      await resend.emails.send(
        {
          from,
          to: [booking.email],
          subject: template.subject,
          html: template.html,
          text: template.text,
          replyTo,
          scheduledAt,
        },
        {
          headers: {
            "Idempotency-Key":
              `review-request/${booking.id}`,
          },
        },
      );

    if (error) {
      await recordNotification({
        booking,
        templateKey: "review_request",
        status: "failed",
        errorMessage:
          getSafeErrorMessage(error),
        ...ids,
      });

      return {
        status: "failed" as const,
        error,
      };
    }

    const admin = getSupabaseAdmin();

    const { error: bookingUpdateError } =
      await admin
        .from("bookings")
        .update({
          review_request_sent_at: scheduledAt,
        })
        .eq("id", booking.id)
        .is("review_request_sent_at", null);

    await recordNotification({
      booking,
      templateKey: "review_request",
      status: "sent",
      resendId: data?.id ?? null,
      errorMessage: bookingUpdateError
        ? `Email scheduled, but the booking marker failed to update: ${bookingUpdateError.message}`
        : null,
      ...ids,
    });

    return {
      status: "scheduled" as const,
      id: data?.id ?? null,
      scheduledAt,
    };
  } catch (error) {
    await recordNotification({
      booking,
      templateKey: "review_request",
      status: "failed",
      errorMessage:
        getSafeErrorMessage(error),
      ...ids,
    });

    return {
      status: "failed" as const,
      error,
    };
  }
}

export async function sendOnTheWayEmail(
  booking: BookingRow,
  ids: RelatedIds,
) {
  return sendAndLog(
    booking,
    "field_on_the_way",
    fieldOnTheWayTemplate(booking),
    ids,
  );
}

export async function sendServiceCompletedEmail(
  booking: BookingRow,
  ids: RelatedIds & {
    paymentLink?: string | null;
  },
) {
  const result = await sendAndLog(
    booking,
    "service_completed",
    serviceCompletedTemplate(
      booking,
      ids.paymentLink,
    ),
    ids,
  );

  await scheduleFacebookReviewRequestEmail(
    booking,
    ids,
  );

  return result;
}

export async function sendFieldPaymentLinkEmail(
  booking: BookingRow,
  ids: RelatedIds,
) {
  return sendAndLog(
    booking,
    "payment_link",
    paymentLinkTemplate(booking),
    ids,
  );
}

export async function sendFieldReviewRequestEmail(
  booking: BookingRow,
  ids: RelatedIds,
) {
  const result = await sendAndLog(
    booking,
    "review_request",
    facebookReviewRequestTemplate(booking),
    ids,
  );

  if (result.status === "sent") {
    const admin = getSupabaseAdmin();

    await admin
      .from("bookings")
      .update({
        review_request_sent_at:
          new Date().toISOString(),
      })
      .eq("id", booking.id);
  }

  return result;
}
