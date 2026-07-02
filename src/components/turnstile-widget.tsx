"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
          options: {
            sitekey: string;
            action?: string;
            callback: (token: string) => void;
            "expired-callback": () => void;
            "error-callback": () => void;
            "timeout-callback"?: () => void;
          },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  action?: string;
  resetKey?: number;
  onTokenChange: (token: string) => void;
};

export function TurnstileWidget({
  siteKey,
  action,
  resetKey = 0,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetRendered, setWidgetRendered] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Complete verification before submitting.",
  );

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) {
      return;
    }

    onTokenChange("");
    setWidgetRendered(false);
    setStatusMessage("Complete verification before submitting.");

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => {
        setStatusMessage("Verification complete.");
        onTokenChange(token);
      },
      "expired-callback": () => {
        setStatusMessage("Verification expired. Please verify again.");
        onTokenChange("");
      },
      "error-callback": () => {
        setStatusMessage("Verification could not load. Please refresh and try again.");
        onTokenChange("");
      },
      "timeout-callback": () => {
        setStatusMessage("Verification timed out. Please verify again.");
        onTokenChange("");
      },
    });
    setWidgetRendered(true);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      setWidgetRendered(false);
    };
  }, [action, onTokenChange, resetKey, scriptReady, siteKey]);

  if (!siteKey) {
    return (
      <div className="turnstile-panel" role="status">
        Verification is not configured. Please contact Clean Curb Co. before
        submitting this booking.
      </div>
    );
  }

  return (
    <div className="turnstile-panel">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <span className="muted">{statusMessage}</span>
      <div ref={containerRef} className="turnstile-widget" />
      {!widgetRendered ? (
        <span className="muted">Loading secure verification...</span>
      ) : null}
      <noscript>
        Verification requires JavaScript. Please enable JavaScript or contact
        Clean Curb Co. to book directly.
      </noscript>
    </div>
  );
}
