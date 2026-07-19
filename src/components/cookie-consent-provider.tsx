"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnalyticsManager } from "@/components/analytics-manager";
import {
  ALL_COOKIE_CHOICES,
  COOKIE_CONSENT_CHANGED_EVENT,
  CookieConsentChoices,
  createStoredCookieConsent,
  DEFAULT_COOKIE_CHOICES,
  dispatchCookieConsentChanged,
  isPrivateAnalyticsRoute,
  readCookieConsent,
  revokeClarityConsent,
  revokeGoogleAnalyticsConsent,
  StoredCookieConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent";

type SaveCookieConsentOptions = {
  reload?: boolean;
};

type CookieConsentContextValue = {
  consent: StoredCookieConsent | null;
  ready: boolean;
  saveConsent: (
    choices: CookieConsentChoices,
    options?: SaveCookieConsentOptions,
  ) => void;
};

const CookieConsentContext =
  createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent(): CookieConsentContextValue {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error(
      "useCookieConsent must be used inside CookieConsentProvider.",
    );
  }

  return context;
}

type CookieConsentProviderProps = {
  children: React.ReactNode;
};

export function CookieConsentProvider({
  children,
}: CookieConsentProviderProps) {
  const pathname = usePathname() || "/";
  const [consent, setConsent] =
    useState<StoredCookieConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readCookieConsent());
      setReady(true);
    };

    syncConsent();

    window.addEventListener("storage", syncConsent);
    window.addEventListener(
      COOKIE_CONSENT_CHANGED_EVENT,
      syncConsent,
    );

    return () => {
      window.removeEventListener("storage", syncConsent);
      window.removeEventListener(
        COOKIE_CONSENT_CHANGED_EVENT,
        syncConsent,
      );
    };
  }, []);

  const saveConsent = useCallback(
    (
      choices: CookieConsentChoices,
      options: SaveCookieConsentOptions = {},
    ) => {
      const nextConsent = createStoredCookieConsent(choices);

      if (!nextConsent.analytics) {
        revokeGoogleAnalyticsConsent();
      }

      if (!nextConsent.experience) {
        revokeClarityConsent();
      }

      writeCookieConsent(nextConsent);
      setConsent(nextConsent);
      dispatchCookieConsentChanged();

      if (options.reload) {
        window.setTimeout(() => {
          window.location.reload();
        }, 50);
      }
    },
    [],
  );

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      ready,
      saveConsent,
    }),
    [consent, ready, saveConsent],
  );

  const isPreferencePage =
    pathname === "/cookie-analytics-policy";

  const shouldShowBanner =
    ready &&
    !consent &&
    !isPreferencePage &&
    !isPrivateAnalyticsRoute(pathname);

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}

      <AnalyticsManager consent={consent} />

      {shouldShowBanner ? (
        <CookieBanner
          onAccept={() => saveConsent(ALL_COOKIE_CHOICES)}
          onDecline={() =>
            saveConsent(DEFAULT_COOKIE_CHOICES)
          }
        />
      ) : null}
    </CookieConsentContext.Provider>
  );
}

type CookieBannerProps = {
  onAccept: () => void;
  onDecline: () => void;
};

function CookieBanner({
  onAccept,
  onDecline,
}: CookieBannerProps) {
  const bannerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const banner = bannerRef.current;

    if (!banner) {
      return;
    }

    try {
      if (
        typeof banner.showPopover === "function" &&
        !banner.matches(":popover-open")
      ) {
        banner.showPopover();
      }
    } catch (error) {
      console.warn(
        "The cookie banner could not enter the top layer.",
        error,
      );
    }
  }, []);

  function closeBanner() {
    const banner = bannerRef.current;

    try {
      if (
        banner &&
        typeof banner.hidePopover === "function" &&
        banner.matches(":popover-open")
      ) {
        banner.hidePopover();
      }
    } catch {
      // The consent state will still remove the banner.
    }
  }

  function handleAccept() {
    closeBanner();
    onAccept();
  }

  function handleDecline() {
    closeBanner();
    onDecline();
  }

  return (
    <aside
      ref={bannerRef}
      popover="manual"
      className="cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      <div className="cookie-banner-card">
        <div className="cookie-banner-copy">
          <p className="cookie-banner-kicker">
            Cookies, minus the crumbs
          </p>

          <h2 id="cookie-banner-title">
            Help us make the website better.
          </h2>

          <p id="cookie-banner-description">
            We use optional analytics to understand what is
            working, where visitors get stuck, and when the
            website needs another rinse. Essential storage stays
            on so the site works and remembers your choice.
          </p>
        </div>

        <div className="cookie-banner-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleAccept}
            aria-label="Accept all optional cookies"
          >
            Accept
          </button>

          <Link
            className="button button-secondary"
            href="/cookie-analytics-policy#cookie-settings"
            onClick={closeBanner}
          >
            Accept some
          </Link>

          <button
            type="button"
            className="cookie-banner-decline"
            onClick={handleDecline}
          >
            Decline optional cookies
          </button>
        </div>
      </div>
    </aside>
  );
}
