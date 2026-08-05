import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  setSmsContactPreference,
  TWILIO_INBOUND_PATH,
  twilioFormToRecord,
  type TwilioFormRecord,
  validateTwilioWebhook,
} from "@/lib/sms/twilio";

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "REVOKE",
  "OPTOUT",
]);

const START_KEYWORDS = new Set([
  "START",
  "UNSTOP",
]);

const HELP_KEYWORDS = new Set([
  "HELP",
  "INFO",
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

function emptyTwiml() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const params = twilioFormToRecord(form);

  const validRequest = validateTwilioWebhook({
    path: TWILIO_INBOUND_PATH,
    signature:
      request.headers.get("x-twilio-signature"),
    params,
  });

  if (!validRequest) {
    return new Response("Forbidden", {
      status: 403,
    });
  }

  const from = getTwilioValue(
    params,
    "From",
  );

  const body = getTwilioValue(
    params,
    "Body",
  ).trim();

  const messageSid = getTwilioValue(
    params,
    "MessageSid",
  );

  const optOutType = getTwilioValue(
    params,
    "OptOutType",
  ).toUpperCase();

  const keyword = body.toUpperCase();

  const eventType =
    optOutType ||
    (STOP_KEYWORDS.has(keyword)
      ? "STOP"
      : START_KEYWORDS.has(keyword)
        ? "START"
        : HELP_KEYWORDS.has(keyword)
          ? "HELP"
          : "");

  if (eventType === "STOP") {
    await setSmsContactPreference({
      phone: from,
      status: "opted_out",
      source: "twilio_inbound_stop",
      messageSid,
    });

    return emptyTwiml();
  }

  if (eventType === "START") {
    await setSmsContactPreference({
      phone: from,
      status: "opted_in",
      source: "twilio_inbound_start",
      messageSid,
    });

    return emptyTwiml();
  }

  /*
   * Twilio normally handles HELP automatically.
   * Avoid sending a duplicate reply if it reaches us.
   */
  if (eventType === "HELP") {
    return emptyTwiml();
  }

  /*
   * Surface normal customer replies in the admin portal.
   */
  if (from && body) {
    await createAdminNotification({
      type: "inbound_sms",
      title: "Incoming customer text",
      message:
        `${from}: ${body.slice(0, 500)}`,
      href: "/admin",
      severity: "info",
    });
  }

  return emptyTwiml();
}
