export const COOKIE_CONSENT_STORAGE_KEY = "ccc_cookie_consent";
export const COOKIE_CONSENT_CHANGED_EVENT = "ccc:cookie-consent-changed";
export const COOKIE_CONSENT_VERSION = 1;

export type CookieConsentChoices = {
  analytics: boolean;
  experience: boolean;
  performance: boolean;
};

export type StoredCookieConsent = CookieConsentChoices & {
  necessary: true;
  version: number;
  updatedAt: string;
};

export const DEFAULT_COOKIE_CHOICES: CookieConsentChoices = {
  analytics: false,
  experience: false,
  performance: false,
};

export const ALL_COOKIE_CHOICES: CookieConsentChoices = {
  analytics: true,
  experience: true,
  performance: true,
};

const PRIVATE_ANALYTICS_ROUTES = [
  "/admin",
  "/portal",
  "/field",
  "/api",
  "/login",
  "/employee-login",
  "/reset-password",
  "/account-setup",
  "/signup",
  "/payment-setup",
  "/billing",
];

export function isPrivateAnalyticsRoute(pathname: string): boolean {
  return PRIVATE_ANALYTICS_ROUTES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createStoredCookieConsent(
  choices: CookieConsentChoices,
): StoredCookieConsent {
  return {
    necessary: true,
    analytics: choices.analytics,
    experience: choices.experience,
    performance: choices.performance,
    version: COOKIE_CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

function isStoredCookieConsent(
  value: unknown,
): value is StoredCookieConsent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredCookieConsent>;

  return (
    candidate.necessary === true &&
    candidate.version === COOKIE_CONSENT_VERSION &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.analytics === "boolean" &&
    typeof candidate.experience === "boolean" &&
    typeof candidate.performance === "boolean"
  );
}

export function readCookieConsent(): StoredCookieConsent | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(
      COOKIE_CONSENT_STORAGE_KEY,
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isStoredCookieConsent(parsedValue)) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

export function writeCookieConsent(
  consent: StoredCookieConsent,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify(consent),
    );
  } catch {
    // Some browsers or privacy modes can block localStorage.
    // The in-memory consent state will still work for this visit.
  }
}

export function dispatchCookieConsentChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT),
  );
}

function expireCookie(name: string, domain?: string): void {
  const domainPart = domain ? `; domain=${domain}` : "";

  document.cookie =
    `${name}=; Max-Age=0; path=/${domainPart}; SameSite=Lax`;
}

export function clearKnownAnalyticsCookies(): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  try {
    const cookieNames = document.cookie
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter(Boolean);

    const analyticsCookieNames = cookieNames.filter(
      (name) =>
        name === "_ga" ||
        name === "_gid" ||
        name === "_gat" ||
        name === "_clck" ||
        name === "_clsk" ||
        name.startsWith("_ga_") ||
        name.startsWith("_gac_"),
    );

    const hostname = window.location.hostname;
    const hostnameParts = hostname.split(".");
    const rootDomain =
      hostnameParts.length >= 2
        ? `.${hostnameParts.slice(-2).join(".")}`
        : undefined;

    const domains = Array.from(
      new Set(
        [
          hostname,
          `.${hostname}`,
          rootDomain,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    for (const cookieName of analyticsCookieNames) {
      expireCookie(cookieName);

      for (const domain of domains) {
        expireCookie(cookieName, domain);
      }
    }
  } catch {
    // Cookie cleanup is best-effort. Third-party domain cookies
    // cannot always be removed directly by first-party JavaScript.
  }
}

export function revokeGoogleAnalyticsConsent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  clearKnownAnalyticsCookies();
}

export function revokeClarityConsent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.clarity?.("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: "denied",
  });

  clearKnownAnalyticsCookies();
}
