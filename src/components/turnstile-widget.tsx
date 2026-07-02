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

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) {
      return;
    }

    onTokenChange("");
    setWidgetRendered(false);

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
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
      <span className="muted">Complete verification before submitting.</span>
      <div ref={containerRef} className="turnstile-widget" />
      {!widgetRendered ? (
        <span className="muted">Loading verification...</span>
      ) : null}
    </div>
  );
}
