"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import {
  isClarityAnalyticsRoute,
  isPrivateAnalyticsRoute,
  StoredCookieConsent,
} from "@/lib/cookie-consent";

type AnalyticsManagerProps = {
  consent: StoredCookieConsent | null;
};

export function AnalyticsManager({
  consent,
}: AnalyticsManagerProps) {
  const pathname = usePathname() || "/";
  const [googleAnalyticsReady, setGoogleAnalyticsReady] =
    useState(false);

  const googleAnalyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

  const clarityProjectId =
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || "";

  const isPrivateRoute = isPrivateAnalyticsRoute(pathname);

  const allowTrafficAnalytics =
    Boolean(consent?.analytics) && !isPrivateRoute;

  const allowExperienceAnalytics =
    Boolean(consent?.experience) &&
    isClarityAnalyticsRoute(pathname);

  const allowPerformanceAnalytics =
    Boolean(consent?.performance) && !isPrivateRoute;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.gtag ||
      !consent?.analytics
    ) {
      return;
    }

    const analyticsStatus = isPrivateRoute
      ? "denied"
      : "granted";

    window.gtag("consent", "update", {
      analytics_storage: analyticsStatus,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }, [
    consent?.analytics,
    googleAnalyticsReady,
    isPrivateRoute,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.clarity ||
      !consent?.experience
    ) {
      return;
    }
  
    window.clarity("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: allowExperienceAnalytics
        ? "granted"
        : "denied",
    });
  }, [
    allowExperienceAnalytics,
    consent?.experience,
  ]);
  
  useEffect(() => {
    if (
      !allowTrafficAnalytics ||
      !googleAnalyticsReady ||
      !googleAnalyticsId ||
      typeof window === "undefined" ||
      !window.gtag
    ) {
      return;
    }

    const pagePath =
      `${pathname}${window.location.search}`;

    window.gtag("event", "page_view", {
      send_to: googleAnalyticsId,
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });
  }, [
    allowTrafficAnalytics,
    googleAnalyticsId,
    googleAnalyticsReady,
    pathname,
  ]);

  const googleAnalyticsIdForScript = JSON.stringify(
    googleAnalyticsId,
  );

  const clarityProjectIdForScript = JSON.stringify(
    clarityProjectId,
  );

  return (
    <>
      {allowTrafficAnalytics && googleAnalyticsId ? (
        <>
          <Script
            id="ccc-google-analytics-config"
            strategy="afterInteractive"
          >
            {`
              window.dataLayer = window.dataLayer || [];
      
              window.gtag = window.gtag || function gtag() {
                window.dataLayer.push(arguments);
              };
      
              window.gtag("consent", "default", {
                analytics_storage: "granted",
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied"
              });
      
              window.gtag("js", new Date());
      
              window.gtag("config", ${googleAnalyticsIdForScript}, {
                send_page_view: false,
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false
              });
            `}
          </Script>
      
          <Script
            id="ccc-google-analytics-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
              googleAnalyticsId,
            )}`}
            strategy="afterInteractive"
            onLoad={() => setGoogleAnalyticsReady(true)}
            onReady={() => setGoogleAnalyticsReady(true)}
          />
        </>
      ) : null}

      {allowExperienceAnalytics && clarityProjectId ? (
        <Script
          id="ccc-microsoft-clarity"
          strategy="afterInteractive"
        >
          {`
            (function(c,l,a,r,i,t,y){
              c[a] = c[a] || function(){
                (c[a].q = c[a].q || []).push(arguments);
              };

              t = l.createElement(r);
              t.async = 1;
              t.src = "https://www.clarity.ms/tag/" + i;

              y = l.getElementsByTagName(r)[0];
              y.parentNode.insertBefore(t, y);
            })(
              window,
              document,
              "clarity",
              "script",
              ${clarityProjectIdForScript}
            );

            window.clarity("consentv2", {
              ad_Storage: "denied",
              analytics_Storage: "granted"
            });
          `}
        </Script>
      ) : null}

      {allowTrafficAnalytics ? <Analytics /> : null}

      {allowPerformanceAnalytics ? (
        <SpeedInsights />
      ) : null}
    </>
  );
}
