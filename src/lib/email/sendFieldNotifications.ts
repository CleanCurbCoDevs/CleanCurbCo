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
    <html lang="en">
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
          Your bins are cleaner. Now tell the neighbors how we did.
        </div>

        <div style="padding:28px 14px;background:#f5f4ef">
          <div
            style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dedbd0;border-radius:16px;overflow:hidden;box-shadow:0 14px 40px rgba(5,5,5,.08)"
          >
            <div style="height:6px;background:#e53935"></div>

            <div
              style="background:#050505;color:#ffffff;padding:26px;border-bottom:5px solid #00ff38"
            >
              <p
                style="margin:0 0 8px;color:#ffe38a;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase"
              >
                Clean Curb Co.
              </p>

              <h1
                style="margin:0;font-size:28px;line-height:1.15"
              >
                How'd we do with the gross stuff?
              </h1>

              <p
                style="margin:10px 0 0;color:#ffe38a;font-weight:800"
              >
                Fresh Starts at the Curb.
              </p>
            </div>

            <div
              style="padding:28px 26px;font-size:16px;line-height:1.65;color:#222"
            >
              <p style="margin-top:0">
                Hey ${escapeHtml(firstName)},
              </p>

              <p>
                Your bins have had a little time to enjoy their fresh
                start. We hope they are looking cleaner, smelling
                better, and feeling considerably less suspicious.
              </p>

              <p>
                Clean Curb Co. is still the new kid on the route, so
                an honest Facebook recommendation helps more than
                you might think. It lets nearby neighbors know we are
                real people doing real work—and not just three
                raccoons operating a pressure washer.
              </p>

              <div style="margin:28px 0;text-align:center">
                <a
                  href="${escapeHtml(FACEBOOK_REVIEWS_URL)}"
                  style="display:inline-block;background:#00ff38;color:#050505;padding:15px 22px;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none"
                >
                  Recommend Us on Facebook
                </a>
              </div>

              <div
                style="margin:24px 0;background:#f4efff;border:1px solid #c9b8f4;border-left:6px solid #6d28d9;border-radius:12px;padding:16px"
              >
                <p
                  style="margin:0 0 6px;color:#3f1d78;font-weight:800"
                >
                  More of a Google or Yelp person?
                </p>

                <p style="margin:0;color:#514760;font-size:14px">
                  We're getting those profiles squared away too.
                  They are still finishing their official verification
                  rinse, so Facebook is the best place to review us
                  right now. Once everything is live, you'll be able
                  to find Clean Curb Co. on Google and Yelp too.
                </p>
              </div>

              <p>
                Every review, referral, and person willing to trust us
                with the gross stuff genuinely matters. Thanks for
                supporting a local, veteran-owned small business.
              </p>

              <p style="margin-bottom:0">
                Stay fresh,<br />
                <strong>The Clean Curb Co. Team</strong><br />
                <span style="color:#6d28d9;font-style:italic">
                  Fresh Starts at the Curb.
                </span>
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

              <p style="margin:0 0 8px">
                <a
                  href="tel:+18438884124"
                  style="color:#00ff38;text-decoration:none"
                >
                  +1 (843) 888-4124
                </a>

                <span style="color:#807b70"> | </span>

                <a
                  href="mailto:contact@cleancurbco.com"
                  style="color:#00ff38;text-decoration:none"
                >
                  contact@cleancurbco.com
                </a>
              </p>

              <p style="margin:0;color:#ffe38a;font-weight:700">
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
    "Your bins have had a little time to enjoy their fresh start. We hope they are looking cleaner, smelling better, and feeling considerably less suspicious.",
    "",
    "Clean Curb Co. is still the new kid on the route, so an honest Facebook recommendation helps more than you might think. It lets nearby neighbors know we are real people doing real work—and not just three raccoons operating a pressure washer.",
    "",
    "Recommend us on Facebook:",
    FACEBOOK_REVIEWS_URL,
    "",
    "More of a Google or Yelp person? We're getting those profiles squared away too. They are still finishing their official verification rinse, so Facebook is the best place to review us right now. Once everything is live, you'll be able to find Clean Curb Co. on Google and Yelp too.",
    "",
    "Every review, referral, and person willing to trust us with the gross stuff genuinely matters. Thanks for supporting a local, veteran-owned small business.",
    "",
    "Stay fresh,",
    "The Clean Curb Co. Team",
    "Fresh Starts at the Curb.",
  ].join("\n");

  return {
    subject: "How'd we do with the gross stuff?",
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
