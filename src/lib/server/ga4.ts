import "server-only";

import { logger } from "@/lib/server/logger";

type Ga4EventParameter =
  | string
  | number
  | boolean
  | null
  | undefined;

type SendGa4ServerEventInput = {
  eventName: string;
  clientId: string;
  sessionId?: string | null;
  parameters?: Record<string, Ga4EventParameter>;
  requestId?: string;
  route?: string;
  bookingId?: string;
};

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

const GA_API_SECRET =
  process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim() ?? "";

function cleanEventParameters(
  parameters: Record<string, Ga4EventParameter>,
): Record<string, string | number | boolean> {
  const cleaned: Record<
    string,
    string | number | boolean
  > = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (
      typeof value === "number" &&
      !Number.isFinite(value)
    ) {
      continue;
    }

    cleaned[key] =
      typeof value === "string"
        ? value.slice(0, 100)
        : value;
  }

  return cleaned;
}

export async function sendGa4ServerEvent({
  eventName,
  clientId,
  sessionId,
  parameters = {},
  requestId,
  route = "unknown",
  bookingId,
}: SendGa4ServerEventInput): Promise<boolean> {
  if (
    !GA_MEASUREMENT_ID ||
    !GA_API_SECRET ||
    !clientId
  ) {
    logger.warn("ga4_server_event_skipped", {
      requestId,
      route,
      bookingId,
      metadata: {
        eventName,
        hasMeasurementId: Boolean(GA_MEASUREMENT_ID),
        hasApiSecret: Boolean(GA_API_SECRET),
        hasClientId: Boolean(clientId),
      },
    });

    return false;
  }

  if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) {
    logger.warn("ga4_server_event_invalid_name", {
      requestId,
      route,
      bookingId,
      metadata: {
        eventName,
      },
    });

    return false;
  }

  const eventParameters: Record<
    string,
    string | number | boolean
  > = {
    ...cleanEventParameters(parameters),
    engagement_time_msec: 1,
  };

  if (
    sessionId &&
    /^\d+$/.test(sessionId)
  ) {
    eventParameters.session_id = Number(sessionId);
  }

  const endpoint =
    "https://www.google-analytics.com/mp/collect" +
    `?measurement_id=${encodeURIComponent(
      GA_MEASUREMENT_ID,
    )}` +
    `&api_secret=${encodeURIComponent(GA_API_SECRET)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 3000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        non_personalized_ads: true,
        events: [
          {
            name: eventName,
            params: eventParameters,
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn("ga4_server_event_rejected", {
        requestId,
        route,
        bookingId,
        metadata: {
          eventName,
          status: response.status,
        },
      });

      return false;
    }

    logger.info("ga4_server_event_sent", {
      requestId,
      route,
      bookingId,
      metadata: {
        eventName,
      },
    });

    return true;
  } catch (error) {
    logger.warn("ga4_server_event_failed", {
      requestId,
      route,
      bookingId,
      error,
      metadata: {
        eventName,
      },
    });

    return false;
  } finally {
    clearTimeout(timeout);
  }
}
