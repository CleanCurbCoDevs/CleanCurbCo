"use client";

import { useEffect, useState } from "react";
import { useCookieConsent } from "@/components/cookie-consent-provider";
import {
  ALL_COOKIE_CHOICES,
  CookieConsentChoices,
  DEFAULT_COOKIE_CHOICES,
} from "@/lib/cookie-consent";

type OptionalCookieKey = keyof CookieConsentChoices;

const OPTIONAL_COOKIE_OPTIONS: Array<{
  key: OptionalCookieKey;
  title: string;
  providers: string;
  description: string;
}> = [
  {
    key: "analytics",
    title: "Traffic and booking analytics",
    providers: "Google Analytics and Vercel Analytics",
    description:
      "Helps us understand which pages and marketing sources bring visitors to the site, which services receive attention, and where people begin or complete the booking process.",
  },
  {
    key: "experience",
    title: "Experience and usability insights",
    providers: "Microsoft Clarity",
    description:
      "Provides heatmaps and masked session recordings so we can spot confusing buttons, dead clicks, scrolling problems, and parts of the website that need another rinse.",
  },
  {
    key: "performance",
    title: "Website performance monitoring",
    providers: "Vercel Speed Insights",
    description:
      "Measures loading speed and responsiveness so we can identify slow pages, layout movement, and device-specific performance problems.",
  },
];

export function CookiePreferenceCenter() {
  const { consent, ready, saveConsent } =
    useCookieConsent();

  const [choices, setChoices] =
    useState<CookieConsentChoices>(
      DEFAULT_COOKIE_CHOICES,
    );

  useEffect(() => {
    if (!ready) {
      return;
    }

    setChoices(
      consent
        ? {
            analytics: consent.analytics,
            experience: consent.experience,
            performance: consent.performance,
          }
        : DEFAULT_COOKIE_CHOICES,
    );
  }, [consent, ready]);

  function updateChoice(
    key: OptionalCookieKey,
    value: boolean,
  ) {
    setChoices((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveCurrentChoices() {
    saveConsent(choices, {
      reload: true,
    });
  }

  function acceptAll() {
    saveConsent(ALL_COOKIE_CHOICES, {
      reload: true,
    });
  }

  function rejectOptional() {
    saveConsent(DEFAULT_COOKIE_CHOICES, {
      reload: true,
    });
  }

  return (
    <section
      id="cookie-settings"
      className="cookie-preference-center"
      aria-labelledby="cookie-settings-heading"
    >
      <div className="cookie-preference-heading">
        <p className="cookie-preference-kicker">
          Your controls
        </p>

        <h2 id="cookie-settings-heading">
          Cookie and analytics preferences
        </h2>

        <p>
          Choose each optional category separately. Your
          booking, account access, and ability to use the
          website are not conditioned on accepting optional
          analytics.
        </p>

        {consent?.updatedAt ? (
          <p className="cookie-preference-saved">
            Current preferences saved{" "}
            {new Date(
              consent.updatedAt,
            ).toLocaleDateString()}.
          </p>
        ) : null}
      </div>

      <div className="cookie-preference-list">
        <label className="cookie-preference-option cookie-preference-essential">
          <span className="cookie-preference-option-copy">
            <strong>Essential website storage</strong>
            <span className="cookie-preference-provider">
              Always active
            </span>
            <span>
              Required for security, account sessions,
              booking features, payments, fraud prevention,
              and remembering your cookie preferences.
            </span>
          </span>

          <input
            type="checkbox"
            checked
            disabled
            aria-label="Essential website storage is always active"
          />
        </label>

        {OPTIONAL_COOKIE_OPTIONS.map((option) => (
          <label
            className="cookie-preference-option"
            key={option.key}
          >
            <span className="cookie-preference-option-copy">
              <strong>{option.title}</strong>

              <span className="cookie-preference-provider">
                {option.providers}
              </span>

              <span>{option.description}</span>
            </span>

            <input
              type="checkbox"
              checked={choices[option.key]}
              onChange={(event) =>
                updateChoice(
                  option.key,
                  event.target.checked,
                )
              }
              aria-label={`Allow ${option.title}`}
            />
          </label>
        ))}
      </div>

      <div className="cookie-preference-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={saveCurrentChoices}
          disabled={!ready}
        >
          Save my choices
        </button>

        <button
          type="button"
          className="button button-outline cookie-preference-accept-all"
          onClick={acceptAll}
          disabled={!ready}
        >
          Accept all optional
        </button>

        <button
          type="button"
          className="cookie-preference-reject"
          onClick={rejectOptional}
          disabled={!ready}
        >
          Reject all optional cookies
        </button>
      </div>
    </section>
  );
}
