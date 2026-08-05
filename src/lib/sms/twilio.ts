import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { getSiteUrl } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export const TWILIO_INBOUND_PATH =
  "/api/twilio/inbound";

export const TWILIO_STATUS_PATH =
  "/api/twilio/status";

type TwilioFormValue =
  | string
  | string[];

export type TwilioFormRecord =
  Record<string, TwilioFormValue>;

type SmsRelatedIds = {
  recipientProfileId?: string | null;
  bookingId?: string | null;
  visitId?: string | null;
  routeStopId?: string | null;
};

type SendTransactionalSmsInput =
  SmsRelatedIds & {
    to: string;
    body: string;
    templateKey: string;
    consentGranted: boolean;
  };

function getTwilioConfig() {
  return {
    accountSid:
      process.env.TWILIO_ACCOUNT_SID ?? "",
    apiKeySid:
      process.env.TWILIO_API_KEY_SID ?? "",
    apiKeySecret:
      process.env.TWILIO_API_KEY_SECRET ?? "",
    authToken:
      process.env.TWILIO_AUTH_TOKEN ?? "",
    messagingServiceSid:
      process.env.TWILIO_MESSAGING_SERVICE_SID ?? "",
  };
}

export function isTwilioConfigured() {
  const config = getTwilioConfig();

  return Boolean(
    config.accountSid &&
      config.apiKeySid &&
      config.apiKeySecret &&
      config.authToken &&
      config.messagingServiceSid,
  );
}

export function normalizeSmsPhone(
  value: string,
) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+${digits}`;
  }

  if (
    trimmed.startsWith("+") &&
    digits.length >= 10 &&
    digits.length <= 15
  ) {
    return `+${digits}`;
  }

  return null;
}

export function twilioFormToRecord(
  form: URLSearchParams,
): TwilioFormRecord {
  const params: TwilioFormRecord = {};

  for (const [key, value] of form.entries()) {
    const current = params[key];

    if (current === undefined) {
      params[key] = value;
    } else if (Array.isArray(current)) {
      params[key] = [...current, value];
    } else {
      params[key] = [current, value];
    }
  }

  return params;
}

function encodeTwilioParameter(
  name: string,
  value: TwilioFormValue,
) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value))
      .sort()
      .map((item) => `${name}${item}`)
      .join("");
  }

  return `${name}${value}`;
}

function expectedTwilioSignature(
  url: string,
  params: TwilioFormRecord,
  authToken: string,
) {
  const payload = Object.keys(params)
    .sort()
    .reduce(
      (current, key) =>
        current +
        encodeTwilioParameter(
          key,
          params[key],
        ),
      url,
    );

  return createHmac("sha1", authToken)
    .update(Buffer.from(payload, "utf8"))
    .digest("base64");
}

export function validateTwilioWebhook(input: {
  path: string;
  signature: string | null;
  params: TwilioFormRecord;
}) {
  const { authToken } = getTwilioConfig();

  if (!authToken || !input.signature) {
    return false;
  }

  const webhookUrl =
    `${getSiteUrl()}${input.path}`;

  const expected =
    expectedTwilioSignature(
      webhookUrl,
      input.params,
      authToken,
    );

  const actualBuffer =
    Buffer.from(input.signature);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actualBuffer,
    expectedBuffer,
  );
}

async function recordSmsNotification(input: {
  recipientPhone: string;
  templateKey: string;
  status:
    | "queued"
    | "sent"
    | "failed"
    | "skipped";
  providerMessageId?: string | null;
  providerStatus?: string | null;
  providerErrorCode?: string | null;
  errorMessage?: string | null;
} & SmsRelatedIds) {
  try {
    const admin = getSupabaseAdmin();

    await admin
      .from("notification_events")
      .insert({
        recipient_profile_id:
          input.recipientProfileId ?? null,
        recipient_email: null,
        recipient_phone:
          input.recipientPhone,
        channel: "sms",
        template_key: input.templateKey,
        status: input.status,
        related_booking_id:
          input.bookingId ?? null,
        related_visit_id:
          input.visitId ?? null,
        related_route_stop_id:
          input.routeStopId ?? null,
        resend_id: null,
        provider_message_id:
          input.providerMessageId ?? null,
        provider_status:
          input.providerStatus ?? null,
        provider_error_code:
          input.providerErrorCode ?? null,
        error_message:
          input.errorMessage ?? null,
        delivered_at: null,
      });
  } catch {
    // Notification logging must not block operations.
  }
}

export async function setSmsContactPreference(
  input: {
    phone: string;
    status: "opted_in" | "opted_out";
    source: string;
    messageSid?: string | null;
  },
) {
  const normalizedPhone =
    normalizeSmsPhone(input.phone);

  if (!normalizedPhone) {
    return {
      ok: false as const,
      reason: "Invalid phone number.",
    };
  }

  const now = new Date().toISOString();
  const admin = getSupabaseAdmin();

const preferenceRecord: Database["public"]["Tables"]["sms_contact_preferences"]["Insert"] = {
  normalized_phone: normalizedPhone,
  status: input.status,
  source: input.source,
  last_inbound_message_sid:
    input.messageSid ?? null,
};

if (input.status === "opted_in") {
  preferenceRecord.opted_in_at = now;
  preferenceRecord.opted_out_at = null;
} else {
  preferenceRecord.opted_out_at = now;
}

  const { error } = await admin
    .from("sms_contact_preferences")
    .upsert(preferenceRecord, {
      onConflict: "normalized_phone",
    });

  if (error) {
    return {
      ok: false as const,
      reason: error.message,
    };
  }

  /*
   * Keep portal profiles synchronized without altering
   * the historical consent snapshot stored on bookings.
   */
  try {
    const { data: profiles } = await admin
      .from("profiles")
      .select(
        "id, phone, sms_opt_in_at, sms_consent_version",
      );

    const matchingProfiles = (profiles ?? []).filter(
      (profile) =>
        normalizeSmsPhone(profile.phone ?? "") ===
        normalizedPhone,
    );

    const profileIds =
      input.status === "opted_in"
        ? matchingProfiles
            .filter(
              (profile) =>
                profile.sms_opt_in_at ||
                profile.sms_consent_version,
            )
            .map((profile) => profile.id)
        : matchingProfiles.map(
            (profile) => profile.id,
          );

    if (profileIds.length) {
      await admin
        .from("profiles")
        .update(
          input.status === "opted_in"
            ? {
                sms_opt_in: true,
                sms_opt_in_at: now,
                sms_opt_out_at: null,
                sms_opt_in_source:
                  input.source,
              }
            : {
                sms_opt_in: false,
                sms_opt_out_at: now,
              },
        )
        .in("id", profileIds);
    }
  } catch {
    /*
     * The phone-level suppression record is authoritative,
     * so profile synchronization cannot block the webhook.
     */
  }

  return {
    ok: true as const,
    normalizedPhone,
  };
}

export async function sendTransactionalSms(
  input: SendTransactionalSmsInput,
) {
  const normalizedPhone =
    normalizeSmsPhone(input.to);

  if (!normalizedPhone) {
    await recordSmsNotification({
      ...input,
      recipientPhone: input.to,
      status: "skipped",
      errorMessage:
        "Phone number could not be normalized.",
    });

    return {
      status: "skipped" as const,
      reason:
        "Phone number could not be normalized.",
    };
  }

  if (!input.consentGranted) {
    await recordSmsNotification({
      ...input,
      recipientPhone: normalizedPhone,
      status: "skipped",
      errorMessage:
        "Current SMS consent was not found.",
    });

    return {
      status: "skipped" as const,
      reason:
        "Current SMS consent was not found.",
    };
  }

  const admin = getSupabaseAdmin();

  const { data: preference } = await admin
    .from("sms_contact_preferences")
    .select("status")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  if (preference?.status === "opted_out") {
    await recordSmsNotification({
      ...input,
      recipientPhone: normalizedPhone,
      status: "skipped",
      errorMessage:
        "Recipient is on the SMS suppression list.",
    });

    return {
      status: "skipped" as const,
      reason:
        "Recipient is on the SMS suppression list.",
    };
  }

  if (!isTwilioConfigured()) {
    await recordSmsNotification({
      ...input,
      recipientPhone: normalizedPhone,
      status: "skipped",
      errorMessage:
        "Twilio is not configured.",
    });

    return {
      status: "skipped" as const,
      reason: "Twilio is not configured.",
    };
  }

  const config = getTwilioConfig();

const payload = new URLSearchParams({
  To: normalizedPhone,
  MessagingServiceSid:
    config.messagingServiceSid,
  Body: input.body,
  StatusCallback:
    `${getSiteUrl()}${TWILIO_STATUS_PATH}`,
});

  try {
    const authorization =
      Buffer.from(
        `${config.apiKeySid}:${config.apiKeySecret}`,
      ).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${authorization}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
        cache: "no-store",
      },
    );

    const result =
      (await response
        .json()
        .catch(() => ({}))) as Record<
        string,
        unknown
      >;

    const providerMessageId =
      typeof result.sid === "string"
        ? result.sid
        : null;

    const providerStatus =
      typeof result.status === "string"
        ? result.status
        : null;

    const providerErrorCode =
      result.code === undefined ||
      result.code === null
        ? null
        : String(result.code);

    if (!response.ok || !providerMessageId) {
      const errorMessage =
        typeof result.message === "string"
          ? result.message
          : `Twilio returned HTTP ${response.status}.`;

      await recordSmsNotification({
        ...input,
        recipientPhone: normalizedPhone,
        status: "failed",
        providerMessageId,
        providerStatus,
        providerErrorCode,
        errorMessage,
      });

      return {
        status: "failed" as const,
        error: errorMessage,
        code: providerErrorCode,
      };
    }

    await recordSmsNotification({
      ...input,
      recipientPhone: normalizedPhone,
      status: "queued",
      providerMessageId,
      providerStatus,
    });

    return {
      status: "queued" as const,
      sid: providerMessageId,
      providerStatus:
        providerStatus ?? "accepted",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown Twilio error.";

    await recordSmsNotification({
      ...input,
      recipientPhone: normalizedPhone,
      status: "failed",
      errorMessage,
    });

    return {
      status: "failed" as const,
      error: errorMessage,
      code: null,
    };
  }
}
