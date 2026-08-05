import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  TWILIO_STATUS_PATH,
  twilioFormToRecord,
  type TwilioFormRecord,
  validateTwilioWebhook,
} from "@/lib/sms/twilio";

const TERMINAL_STATUSES = new Set([
  "delivered",
  "undelivered",
  "failed",
]);

function getTwilioValue(
  params: TwilioFormRecord,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const params = twilioFormToRecord(form);

  const validRequest = validateTwilioWebhook({
    path: TWILIO_STATUS_PATH,
    signature:
      request.headers.get("x-twilio-signature"),
    params,
  });

  if (!validRequest) {
    return new Response("Forbidden", {
      status: 403,
    });
  }

  const messageSid = getTwilioValue(
    params,
    "MessageSid",
  );

  const messageStatus = getTwilioValue(
    params,
    "MessageStatus",
  ).toLowerCase();

  const errorCode =
    getTwilioValue(params, "ErrorCode") ||
    null;

  if (!messageSid || !messageStatus) {
    return new Response("Invalid callback", {
      status: 400,
    });
  }

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from("notification_events")
    .select("provider_status")
    .eq("provider_message_id", messageSid)
    .maybeSingle();

  /*
   * Do not let a delayed intermediate callback replace
   * an already-recorded terminal delivery result.
   */
  if (
    existing?.provider_status &&
    TERMINAL_STATUSES.has(
      existing.provider_status,
    ) &&
    !TERMINAL_STATUSES.has(messageStatus)
  ) {
    return new Response(null, {
      status: 204,
    });
  }

  const notificationStatus =
    messageStatus === "failed" ||
    messageStatus === "undelivered"
      ? "failed"
      : messageStatus === "sent" ||
          messageStatus === "delivered"
        ? "sent"
        : "queued";

  await admin
    .from("notification_events")
    .update({
      status: notificationStatus,
      provider_status: messageStatus,
      provider_error_code: errorCode,
      ...(messageStatus === "delivered"
        ? {
            delivered_at:
              new Date().toISOString(),
          }
        : {}),
      ...(notificationStatus === "failed"
        ? {
            error_message:
              `Twilio delivery failed${
                errorCode
                  ? ` with error ${errorCode}`
                  : ""
              }.`,
          }
        : {}),
    })
    .eq(
      "provider_message_id",
      messageSid,
    );

  return new Response(null, {
    status: 204,
  });
}
