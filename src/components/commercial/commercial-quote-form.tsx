"use client";

import { useCallback, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  getGa4ServerContext,
  trackAnalyticsEvent,
} from "@/lib/client-analytics";
import {
  commercialDesiredFrequencies,
  commercialDesiredFrequencyLabels,
  commercialPreferredContactMethods,
  commercialPreferredContactMethodLabels,
  commercialPropertyTypes,
  commercialPropertyTypeLabels,
  commercialServiceInterestLabels,
  commercialServiceInterests,
  commercialServicePlanLabels,
  commercialServicePlans,
  commercialSiteConditionLabels,
  commercialSiteConditions,
  commercialStartTimeframeLabels,
  commercialStartTimeframes,
  commercialWaterAvailabilityLabels,
  commercialWaterAvailabilityValues,
  type CommercialQuoteSubmission,
  type CommercialServiceInterest,
} from "@/types/commercial";

type FormState = Omit<
  CommercialQuoteSubmission,
  "turnstileToken" | "analytics"
>;

type SubmittedQuote = {
  id: string;
  businessName: string;
  contactName: string;
  createdAt: string;
};

const initialState: FormState = {
  website: "",

  contact: {
    businessName: "",
    contactName: "",
    role: "",
    email: "",
    phone: "",
    preferredContactMethod: "email",
  },

  property: {
    propertyType: "property_management",
    propertyTypeOther: "",
    streetAddress: "",
    city: "Summerville",
    state: "SC",
    zipCode: "",
    locationCount: 1,
    accessRestrictions: "",
  },

  service: {
    interests: [],
    serviceOther: "",
    containerCount: null,
    containerSizes: "",
    siteCondition: "not_sure",
    waterSpigotAvailable: "not_sure",
    servicePlan: "not_sure",
    desiredFrequency: "not_sure",
    collectionSchedule: "",
  },

  details: {
    startTimeframe: "not_sure",
    description: "",
    additionalNotes: "",
    acknowledgment: false,
  },
};

export function CommercialQuoteForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey: string;
}) {
  const feedback = useActionFeedback();
  const formStartedTracked = useRef(false);

  const [form, setForm] = useState<FormState>(initialState);
  const [submittedQuote, setSubmittedQuote] =
    useState<SubmittedQuote | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const turnstileDisabled =
    process.env.NEXT_PUBLIC_DISABLE_TURNSTILE === "true" &&
    process.env.NODE_ENV !== "production";

  const turnstileTokenForSubmit = turnstileDisabled
    ? "local-dev-turnstile-bypass"
    : turnstileToken;

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  function updateContact<K extends keyof FormState["contact"]>(
    key: K,
    value: FormState["contact"][K],
  ) {
    setForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [key]: value,
      },
    }));
  }

  function updateProperty<K extends keyof FormState["property"]>(
    key: K,
    value: FormState["property"][K],
  ) {
    setForm((current) => ({
      ...current,
      property: {
        ...current.property,
        [key]: value,
      },
    }));
  }

  function updateService<K extends keyof FormState["service"]>(
    key: K,
    value: FormState["service"][K],
  ) {
    setForm((current) => ({
      ...current,
      service: {
        ...current.service,
        [key]: value,
      },
    }));
  }

  function updateDetails<K extends keyof FormState["details"]>(
    key: K,
    value: FormState["details"][K],
  ) {
    setForm((current) => ({
      ...current,
      details: {
        ...current.details,
        [key]: value,
      },
    }));
  }

  function toggleServiceInterest(
    interest: CommercialServiceInterest,
    checked: boolean,
  ) {
    setForm((current) => ({
      ...current,
      service: {
        ...current.service,
        interests: checked
          ? Array.from(
              new Set([...current.service.interests, interest]),
            )
          : current.service.interests.filter(
              (currentInterest) => currentInterest !== interest,
            ),
      },
    }));
  }

  function handleFormStart() {
    if (formStartedTracked.current) {
      return;
    }

    formStartedTracked.current = true;

    trackAnalyticsEvent("commercial_quote_form_started", {
      property_type: form.property.propertyType,
      service_plan: form.service.servicePlan,
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const analytics = await getGa4ServerContext();

      const submission: CommercialQuoteSubmission = {
        ...form,
        turnstileToken: turnstileTokenForSubmit,
        analytics,
      };

      const response = await fetch("/api/commercial-quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submission),
      });

      const data = (await response.json()) as {
        quote?: SubmittedQuote;
        error?: string;
        requestId?: string;
      };

      if (!response.ok || !data.quote) {
        throw new Error(
          data.error ??
            "The quote request could not be submitted.",
        );
      }

      setSubmittedQuote(data.quote);
      feedback.success("Commercial quote request received.");
    } catch (caughtError) {
      setTurnstileToken("");
      setTurnstileResetKey((current) => current + 1);

      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something got stuck. Please try again or contact us directly.";

      setError(message);
      feedback.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedQuote) {
    return (
      <section className="commercial-quote-confirmation">
        <CheckCircle2 size={42} aria-hidden="true" />

        <p className="section-kicker">Request received</p>

        <h2>We got it, {submittedQuote.contactName}.</h2>

        <p>
          We received the commercial quote request for{" "}
          <strong>{submittedQuote.businessName}</strong>. We will review the
          property details and follow up if we need photos, measurements, or a
          walkthrough before preparing the scope.
        </p>

        <div className="commercial-confirmation-note">
          <strong>No service has been scheduled yet.</strong>
          A submitted request is not an accepted quote, contract, or confirmed
          service appointment. We will confirm the scope and pricing first.
        </div>

        <p className="commercial-request-id">
          <strong>Request ID:</strong> {submittedQuote.id}
        </p>
      </section>
    );
  }

  return (
    <div className="commercial-quote-shell">
      <form
        className="commercial-quote-form"
        onFocusCapture={handleFormStart}
        onSubmit={handleSubmit}
      >
        <label className="form-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            autoComplete="off"
            tabIndex={-1}
            value={form.website}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                website: event.target.value,
              }))
            }
          />
        </label>

        <fieldset className="commercial-form-group">
          <legend>
            <span className="commercial-group-icon">
              <UserRound size={21} aria-hidden="true" />
            </span>
            <span>
              <small>Section 1</small>
              Contact information
            </span>
          </legend>

          <div className="commercial-form-grid">
            <label className="commercial-field">
              <span>
                Business or organization{" "}
                <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="organization"
                value={form.contact.businessName}
                onChange={(event) =>
                  updateContact("businessName", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>
                Contact name <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="name"
                value={form.contact.contactName}
                onChange={(event) =>
                  updateContact("contactName", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>Job title or role</span>
              <input
                autoComplete="organization-title"
                value={form.contact.role}
                onChange={(event) =>
                  updateContact("role", event.target.value)
                }
                placeholder="Property manager, board member, owner..."
              />
            </label>

            <label className="commercial-field">
              <span>
                Phone <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="tel"
                type="tel"
                value={form.contact.phone}
                onChange={(event) =>
                  updateContact("phone", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>
                Email <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="email"
                type="email"
                value={form.contact.email}
                onChange={(event) =>
                  updateContact("email", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>Preferred contact method</span>
              <select
                value={form.contact.preferredContactMethod}
                onChange={(event) =>
                  updateContact(
                    "preferredContactMethod",
                    event.target
                      .value as FormState["contact"]["preferredContactMethod"],
                  )
                }
              >
                {commercialPreferredContactMethods.map((method) => (
                  <option key={method} value={method}>
                    {commercialPreferredContactMethodLabels[method]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="commercial-form-group">
          <legend>
            <span className="commercial-group-icon">
              <Building2 size={21} aria-hidden="true" />
            </span>
            <span>
              <small>Section 2</small>
              Property information
            </span>
          </legend>

          <div className="commercial-form-grid">
            <label className="commercial-field">
              <span>
                Property type <span className="required-mark">*</span>
              </span>
              <select
                value={form.property.propertyType}
                onChange={(event) =>
                  updateProperty(
                    "propertyType",
                    event.target
                      .value as FormState["property"]["propertyType"],
                  )
                }
                required
              >
                {commercialPropertyTypes.map((propertyType) => (
                  <option key={propertyType} value={propertyType}>
                    {commercialPropertyTypeLabels[propertyType]}
                  </option>
                ))}
              </select>
            </label>

            {form.property.propertyType === "other" ? (
              <label className="commercial-field">
                <span>
                  Describe the property type{" "}
                  <span className="required-mark">*</span>
                </span>
                <input
                  value={form.property.propertyTypeOther}
                  onChange={(event) =>
                    updateProperty(
                      "propertyTypeOther",
                      event.target.value,
                    )
                  }
                  required
                />
              </label>
            ) : null}

            <label className="commercial-field commercial-field-wide">
              <span>
                Service address <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="street-address"
                value={form.property.streetAddress}
                onChange={(event) =>
                  updateProperty("streetAddress", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>
                City <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="address-level2"
                value={form.property.city}
                onChange={(event) =>
                  updateProperty("city", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>
                State <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="address-level1"
                maxLength={20}
                value={form.property.state}
                onChange={(event) =>
                  updateProperty(
                    "state",
                    event.target.value.toUpperCase(),
                  )
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>
                ZIP code <span className="required-mark">*</span>
              </span>
              <input
                autoComplete="postal-code"
                inputMode="numeric"
                value={form.property.zipCode}
                onChange={(event) =>
                  updateProperty("zipCode", event.target.value)
                }
                required
              />
            </label>

            <label className="commercial-field">
              <span>Number of locations</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.property.locationCount}
                onChange={(event) =>
                  updateProperty(
                    "locationCount",
                    Math.max(1, Number(event.target.value) || 1),
                  )
                }
              />
            </label>

            <label className="commercial-field commercial-field-wide">
              <span>Access or service-hour restrictions</span>
              <textarea
                value={form.property.accessRestrictions}
                onChange={(event) =>
                  updateProperty(
                    "accessRestrictions",
                    event.target.value,
                  )
                }
                placeholder="Locked enclosure, gate access, loading hours, collection-day restrictions, contact required before entry..."
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="commercial-form-group">
          <legend>
            <span className="commercial-group-icon">
              <Sparkles size={21} aria-hidden="true" />
            </span>
            <span>
              <small>Section 3</small>
              What needs cleaning
            </span>
          </legend>

          <p className="commercial-group-help">
            Select everything you want included in the quote.{" "}
            <span className="required-mark">*</span>
          </p>

          <div className="commercial-service-options">
            {commercialServiceInterests.map((interest) => (
              <label
                className="commercial-check-card"
                key={interest}
              >
                <input
                  checked={form.service.interests.includes(interest)}
                  type="checkbox"
                  onChange={(event) =>
                    toggleServiceInterest(
                      interest,
                      event.target.checked,
                    )
                  }
                />
                <span>{commercialServiceInterestLabels[interest]}</span>
              </label>
            ))}
          </div>

          {form.service.interests.includes(
            "other_exterior_cleaning",
          ) ? (
            <label className="commercial-field">
              <span>
                Describe the other service{" "}
                <span className="required-mark">*</span>
              </span>
              <input
                value={form.service.serviceOther}
                onChange={(event) =>
                  updateService("serviceOther", event.target.value)
                }
                required
              />
            </label>
          ) : null}

          <div className="commercial-form-grid commercial-service-detail-grid">
            <label className="commercial-field">
              <span>Approximate container count</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={form.service.containerCount ?? ""}
                onChange={(event) =>
                  updateService(
                    "containerCount",
                    event.target.value
                      ? Number(event.target.value)
                      : null,
                  )
                }
              />
            </label>

            <label className="commercial-field">
              <span>Known container sizes</span>
              <input
                value={form.service.containerSizes}
                onChange={(event) =>
                  updateService(
                    "containerSizes",
                    event.target.value,
                  )
                }
                placeholder="96-gallon carts, 4-yard dumpster..."
              />
            </label>

            <label className="commercial-field">
              <span>Current condition</span>
              <select
                value={form.service.siteCondition}
                onChange={(event) =>
                  updateService(
                    "siteCondition",
                    event.target
                      .value as FormState["service"]["siteCondition"],
                  )
                }
              >
                {commercialSiteConditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {commercialSiteConditionLabels[condition]}
                  </option>
                ))}
              </select>
            </label>

            <label className="commercial-field">
              <span>Exterior water available?</span>
              <select
                value={form.service.waterSpigotAvailable}
                onChange={(event) =>
                  updateService(
                    "waterSpigotAvailable",
                    event.target
                      .value as FormState["service"]["waterSpigotAvailable"],
                  )
                }
              >
                {commercialWaterAvailabilityValues.map((value) => (
                  <option key={value} value={value}>
                    {commercialWaterAvailabilityLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="commercial-field">
              <span>Service plan</span>
              <select
                value={form.service.servicePlan}
                onChange={(event) =>
                  updateService(
                    "servicePlan",
                    event.target
                      .value as FormState["service"]["servicePlan"],
                  )
                }
              >
                {commercialServicePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    {commercialServicePlanLabels[plan]}
                  </option>
                ))}
              </select>
            </label>

            <label className="commercial-field">
              <span>Desired frequency</span>
              <select
                disabled={form.service.servicePlan === "one_time"}
                value={
                  form.service.servicePlan === "one_time"
                    ? "not_sure"
                    : form.service.desiredFrequency
                }
                onChange={(event) =>
                  updateService(
                    "desiredFrequency",
                    event.target
                      .value as FormState["service"]["desiredFrequency"],
                  )
                }
              >
                {commercialDesiredFrequencies.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {commercialDesiredFrequencyLabels[frequency]}
                  </option>
                ))}
              </select>
            </label>

            <label className="commercial-field commercial-field-wide">
              <span>Current trash or collection schedule</span>
              <input
                value={form.service.collectionSchedule}
                onChange={(event) =>
                  updateService(
                    "collectionSchedule",
                    event.target.value,
                  )
                }
                placeholder="Dumpster emptied Monday and Thursday mornings..."
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="commercial-form-group">
          <legend>
            <span className="commercial-group-icon">
              <ClipboardList size={21} aria-hidden="true" />
            </span>
            <span>
              <small>Section 4</small>
              Project details
            </span>
          </legend>

          <div className="commercial-form-grid">
            <label className="commercial-field">
              <span>Desired start timeframe</span>
              <select
                value={form.details.startTimeframe}
                onChange={(event) =>
                  updateDetails(
                    "startTimeframe",
                    event.target
                      .value as FormState["details"]["startTimeframe"],
                  )
                }
              >
                {commercialStartTimeframes.map((timeframe) => (
                  <option key={timeframe} value={timeframe}>
                    {commercialStartTimeframeLabels[timeframe]}
                  </option>
                ))}
              </select>
            </label>

            <label className="commercial-field commercial-field-wide">
              <span>
                Tell us about the property and the problem{" "}
                <span className="required-mark">*</span>
              </span>
              <textarea
                className="commercial-description-field"
                value={form.details.description}
                onChange={(event) =>
                  updateDetails("description", event.target.value)
                }
                placeholder="What needs attention? How quickly does the mess return? Are odors, grease, leaked bags, resident complaints, or appearance the main concern?"
                required
              />
            </label>

            <label className="commercial-field commercial-field-wide">
              <span>Anything else we should know?</span>
              <textarea
                value={form.details.additionalNotes}
                onChange={(event) =>
                  updateDetails(
                    "additionalNotes",
                    event.target.value,
                  )
                }
                placeholder="Vendor requirements, invoicing needs, board approval timing, multiple properties, walkthrough availability..."
              />
            </label>
          </div>

          <label className="commercial-acknowledgment">
            <input
              checked={form.details.acknowledgment}
              type="checkbox"
              onChange={(event) =>
                updateDetails(
                  "acknowledgment",
                  event.target.checked,
                )
              }
              required
            />

            <span>
              <strong>I understand this is a quote request.</strong>
              Submitting this form does not schedule service, accept pricing,
              create a contract, or guarantee that every requested service is
              within Clean Curb Co.’s current scope.
            </span>
          </label>
        </fieldset>

        <div className="commercial-submit-panel">
          <div>
            <h3>Ready to send it?</h3>
            <p>
              We will email a confirmation and follow up after reviewing the
              property details.
            </p>
          </div>

          <TurnstileWidget
            action="commercial_quote_submit"
            onTokenChange={handleTurnstileToken}
            resetKey={turnstileResetKey}
            siteKey={turnstileSiteKey}
          />

          {error ? (
            <p className="commercial-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="button button-primary commercial-submit-button"
            disabled={
              isSubmitting || !turnstileTokenForSubmit
            }
            type="submit"
          >
            <Send size={20} aria-hidden="true" />
            {isSubmitting
              ? "Sending Quote Request..."
              : "Request Commercial Quote"}
          </button>
        </div>
      </form>
    </div>
  );
}
