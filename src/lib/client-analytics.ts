"use client";

import { readCookieConsent } from "@/lib/cookie-consent";

type AnalyticsParameter =
  | string
  | number
  | boolean
  | null
  | undefined;

export type Ga4ServerContext = {
  clientId: string;
  sessionId: string | null;
};

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

function analyticsAllowed(): boolean {
  return Boolean(
    GA_MEASUREMENT_ID &&
      typeof window !== "undefined" &&
      typeof window.gtag === "function" &&
      readCookieConsent()?.analytics,
  );
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: Record<string, AnalyticsParameter> = {},
): void {
  if (!analyticsAllowed()) {
    return;
  }

  const cleanParameters = Object.fromEntries(
    Object.entries(parameters).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  );

  window.gtag?.("event", eventName, {
    send_to: GA_MEASUREMENT_ID,
    ...cleanParameters,
  });
}

function getGtagValue(
  fieldName: "client_id" | "session_id",
  timeoutMs = 750,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!analyticsAllowed()) {
      resolve(null);
      return;
    }

    let completed = false;

    const finish = (value: unknown) => {
      if (completed) {
        return;
      }

      completed = true;
      window.clearTimeout(timeout);

      const normalizedValue =
        typeof value === "string" || typeof value === "number"
          ? String(value).trim()
          : "";

      resolve(normalizedValue || null);
    };

    const timeout = window.setTimeout(() => {
      finish(null);
    }, timeoutMs);

    window.gtag?.(
      "get",
      GA_MEASUREMENT_ID,
      fieldName,
      finish,
    );
  });
}

export async function getGa4ServerContext(): Promise<
  Ga4ServerContext | null
> {
  if (!analyticsAllowed()) {
    return null;
  }

  const [clientId, sessionId] = await Promise.all([
    getGtagValue("client_id"),
    getGtagValue("session_id"),
  ]);

  if (!clientId) {
    return null;
  }

  return {
    clientId,
    sessionId,
  };
}
