import { readCookieConsent } from "@/lib/cookie-consent";

export const ANALYTICS_EVENTS = {
  bookingStarted: "booking_started",
  serviceSelected: "service_selected",
  bookingStepCompleted: "booking_step_completed",
  bookingSubmitted: "booking_submitted",
  quoteRequested: "quote_requested",
  serviceAreaChecked: "service_area_checked",
  couponApplied: "coupon_applied",
  phoneClicked: "phone_clicked",
  emailClicked: "email_clicked",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsEventParameters = Record<
  string,
  string | number | boolean | undefined
>;

const BLOCKED_PARAMETER_KEYS = new Set([
  "name",
  "first_name",
  "last_name",
  "full_name",
  "customer_name",
  "email",
  "email_address",
  "phone",
  "phone_number",
  "address",
  "street",
  "street_address",
  "customer_address",
  "notes",
  "customer_notes",
  "message",
  "card_number",
  "payment_method",
  "payment_method_id",
  "stripe_customer_id",
  "booking_id",
]);

function removeSensitiveParameters(
  parameters: AnalyticsEventParameters,
): Record<string, string | number | boolean> {
  const safeParameters: Record<
    string,
    string | number | boolean
  > = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined) {
      continue;
    }

    if (BLOCKED_PARAMETER_KEYS.has(key.toLowerCase())) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[analytics] Blocked potentially sensitive event parameter: ${key}`,
        );
      }

      continue;
    }

    safeParameters[key] = value;
  }

  return safeParameters;
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  parameters: AnalyticsEventParameters = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  const consent = readCookieConsent();
  const safeParameters =
    removeSensitiveParameters(parameters);

  if (consent?.analytics && window.gtag) {
    window.gtag("event", eventName, safeParameters);
  }

  if (consent?.experience && window.clarity) {
    window.clarity("event", eventName);
  }
}
