"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Send } from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";
import { SiteFeedbackNudge } from "@/components/site-feedback-nudge";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  addOns,
  binTypes,
  bookingLaunchAgreement,
  bookingSuccessLaunchMessage,
  launchBillingNote,
  launchPromo,
  neighborhoods,
} from "@/lib/site";
import {
  america250Promotion,
  isAmerica250PromoActive,
} from "@/lib/promotions";
import {
  calculateEstimatedPrice,
  formatFrequency,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import type {
  BookingRequest,
  CollectionDay,
  CollectionTimeWindow,
  SameDayPreference,
  SchedulingPreference,
  ServiceFrequency,
} from "@/types/booking";

type FormState = {
  website: string;
  referralCode: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    neighborhood: string;
  };
  service: {
    binCount: number;
    binTypes: string[];
    frequency: ServiceFrequency;
    addOns: string[];
  };
  scheduling: {
    preference: SchedulingPreference;
    collectionDay: CollectionDay | "";
    collectionTimeWindow: CollectionTimeWindow | "";
    sameDayPreference: SameDayPreference;
    requestedDate: string;
  };
  instructions: {
    binLocation: string;
    waterSpigotAvailable: "yes" | "no" | "not_sure";
    notes: string;
  };
  agreements: BookingRequest["agreements"];
};

export type InitialBookingCustomer = Partial<FormState["customer"]>;

const initialState: FormState = {
  website: "",
  referralCode: "",
  customer: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    streetAddress: "",
    city: "Summerville",
    state: "SC",
    zipCode: "",
    neighborhood: "Cane Bay Plantation",
  },
  service: {
    binCount: 2,
    binTypes: ["Trash bin"],
    frequency: "monthly",
    addOns: [],
  },
  scheduling: {
    preference: "next_available_route_day",
    collectionDay: "",
    collectionTimeWindow: "",
    sameDayPreference: "same_day_when_possible",
    requestedDate: "",
  },
  instructions: {
    binLocation: "Curbside",
    waterSpigotAvailable: "yes",
    notes: "",
  },
  agreements: {
    waterUse: false,
    binCondition: false,
    wastewater: false,
    weatherAccess: false,
    photos: false,
    payment: false,
    launchBilling: false,
  },
};

export function BookingForm({
  initialCustomer,
  initialFrequency,
  initialReferralCode = "",
  serviceAreaChecked = false,
  turnstileSiteKey,
}: {
  initialCustomer?: InitialBookingCustomer;
  initialFrequency?: ServiceFrequency;
  initialReferralCode?: string;
  serviceAreaChecked?: boolean;
  turnstileSiteKey: string;
}) {
  const feedback = useActionFeedback();
  const america250Active = isAmerica250PromoActive();

  const [form, setForm] = useState<FormState>(() => ({
    ...initialState,
    customer: {
      ...initialState.customer,
      ...initialCustomer,
    },
    service: {
      ...initialState.service,
      frequency: initialFrequency ?? initialState.service.frequency,
    },
    referralCode: normalizeReferralCode(initialReferralCode),
  }));
  const [submittedBooking, setSubmittedBooking] =
    useState<BookingRequest | null>(null);
  const [setupHref, setSetupHref] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const turnstileDisabled =
    process.env.NEXT_PUBLIC_DISABLE_TURNSTILE === "true" &&
    process.env.NODE_ENV !== "production";

  const turnstileTokenForSubmit = turnstileDisabled
    ? "local-dev-turnstile-bypass"
    : turnstileToken;

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const foundingSpecial = useMemo(
    () =>
      getFoundingNeighborSpecialStatus({
        binCount: form.service.binCount,
        frequency: form.service.frequency,
        addOns: form.service.addOns,
        neighborhood: form.customer.neighborhood,
        createdAt: new Date().toISOString(),
      }),
    [
      form.customer.neighborhood,
      form.service.addOns,
      form.service.binCount,
      form.service.frequency,
    ],
  );

  const estimatedPrice = useMemo(
    () =>
      calculateEstimatedPrice({
        binCount: form.service.binCount,
        frequency: form.service.frequency,
        addOns: form.service.addOns,
        applyFoundingNeighborPromo: foundingSpecial.eligible,
      }),
    [
      form.service.addOns,
      form.service.binCount,
      form.service.frequency,
      foundingSpecial.eligible,
    ],
  );

  function updateCustomer<K extends keyof FormState["customer"]>(
    key: K,
    value: FormState["customer"][K],
  ) {
    setForm((current) => ({
      ...current,
      customer: { ...current.customer, [key]: value },
    }));
  }

  function updateService<K extends keyof FormState["service"]>(
    key: K,
    value: FormState["service"][K],
  ) {
    setForm((current) => ({
      ...current,
      service: { ...current.service, [key]: value },
    }));
  }

  function toggleArrayValue(
    group: "binTypes" | "addOns",
    value: string,
    checked: boolean,
  ) {
    setForm((current) => {
      const values = current.service[group];
      const nextValues = checked
        ? Array.from(new Set([...values, value]))
        : values.filter((item) => item !== value);

      return {
        ...current,
        service: { ...current.service, [group]: nextValues },
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turnstileToken: turnstileTokenForSubmit,
        }),
      });

      const data = (await response.json()) as {
        booking?: BookingRequest;
        redirectTo?: string | null;
        error?: string;
        requestId?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "Booking request failed");
      }

      setSubmittedBooking(data.booking);
      feedback.success("Booking request received.");
      setSetupHref(data.redirectTo ?? null);
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

  if (submittedBooking) {
    return (
      <div className="booking-shell">
        <div className="confirmation-panel">
          <CheckCircle2 size={34} aria-hidden="true" />
          <h2>Thanks! Your request has been received.</h2>
          <p>
            We will email or text you when available to confirm your route day,
            final price, and service details before anything is charged.
            Fresh Starts at the Curb.
          </p>
          <p>{bookingSuccessLaunchMessage}</p>

          {isAmerica250PromoActive() &&
          submittedBooking.service.frequency !== "one_time" ? (
            <p className="promo-confirmation-note">
              Your request was submitted during the America 250 Deal window. We
              will confirm promotional eligibility and final pricing before
              charging.
            </p>
          ) : null}

          <div className="account-setup-success-cta">
            {setupHref ? (
              <>
                <p>
                  Create your customer account to view this request, manage your info, and
                  make future service changes easier.
                </p>

                <a className="button button-dark" href={setupHref}>
                  Create Customer Account
                </a>
              </>
            ) : (
              <>
                <p>
                  Your request is saved. If you already have an account, you can open your
                  customer portal to view updates once this request is connected.
                </p>

                <Link className="button button-dark" href="/portal">
                  Open Customer Portal
                </Link>
              </>
            )}
          </div>
          <p>
            <strong>Booking ID:</strong> {submittedBooking.id}
          </p>

          <SiteFeedbackNudge
            variant="inline"
            context={`Booking confirmation ${submittedBooking.id}`}
          />
        </div>

        <BookingSummary booking={submittedBooking} />
      </div>
    );
  }

  return (
    <div className="booking-shell">
      <form className="booking-form" onSubmit={handleSubmit}>
        <label className="form-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            autoComplete="off"
            tabIndex={-1}
            value={form.website}
            onChange={(event) =>
              setForm((current) => ({ ...current, website: event.target.value }))
            }
          />
        </label>

        {serviceAreaChecked ? (
          <div className="booking-route-confirmation" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>
              Good news. Your address passed the quick service-area check, so we
              prefilled what we could below.
            </p>
          </div>
        ) : null}

        <section className="form-section">
          <h2>Customer Info</h2>
          <div className="form-grid">
            <TextField
              label="First name"
              value={form.customer.firstName}
              onChange={(value) => updateCustomer("firstName", value)}
              required
            />
            <TextField
              label="Last name"
              value={form.customer.lastName}
              onChange={(value) => updateCustomer("lastName", value)}
              required
            />
            <TextField
              label="Phone number"
              type="tel"
              value={form.customer.phone}
              onChange={(value) => updateCustomer("phone", value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.customer.email}
              onChange={(value) => updateCustomer("email", value)}
              required
            />
            <TextField
              label="Street address"
              value={form.customer.streetAddress}
              onChange={(value) => updateCustomer("streetAddress", value)}
              required
            />
            <TextField
              label="City"
              value={form.customer.city}
              onChange={(value) => updateCustomer("city", value)}
              required
            />
            <TextField
              label="State"
              value={form.customer.state}
              onChange={(value) => updateCustomer("state", value)}
              required
            />
            <TextField
              label="ZIP code"
              value={form.customer.zipCode}
              onChange={(value) => updateCustomer("zipCode", value)}
              required
            />

            <label className="field">
              <span>Neighborhood / subdivision</span>
              <select
                value={form.customer.neighborhood}
                onChange={(event) =>
                  updateCustomer("neighborhood", event.target.value)
                }
              >
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood}>{neighborhood}</option>
                ))}
              </select>
            </label>

            <TextField
              label="Referral code, if you have one"
              value={form.referralCode}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  referralCode: normalizeReferralCode(value),
                }))
              }
            />
          </div>
        </section>

        <section className="form-section">
          <h2>Service Selection</h2>

          <div className="form-grid">
            <label className="field">
              <span>Number of bins</span>
              <select
                value={form.service.binCount}
                onChange={(event) =>
                  updateService("binCount", Number(event.target.value))
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4+</option>
              </select>
            </label>

            <label className="field">
              <span>Frequency</span>
              <select
                value={form.service.frequency}
                onChange={(event) =>
                  updateService(
                    "frequency",
                    event.target.value as ServiceFrequency,
                  )
                }
              >
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="every_other_month">Every other month</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
          </div>

          <div>
            <p className="option-label">Bin types</p>
            <div className="choice-grid">
              {binTypes.map((type) => (
                <label className="choice-card" key={type}>
                  <input
                    type="checkbox"
                    checked={form.service.binTypes.includes(type)}
                    onChange={(event) =>
                      toggleArrayValue("binTypes", type, event.target.checked)
                    }
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="option-label">Add-ons</p>
            <div className="choice-grid">
              {addOns.map((addOn) => (
                <label className="choice-card" key={addOn.id}>
                  <input
                    type="checkbox"
                    checked={form.service.addOns.includes(addOn.id)}
                    onChange={(event) =>
                      toggleArrayValue("addOns", addOn.id, event.target.checked)
                    }
                  />
                  <span>
                    {addOn.name} | {addOn.price}
                    <small>{addOn.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Scheduling</h2>
        
          <p className="muted">
            Tell us when your bins are normally emptied. We use that
            information to schedule your cleaning as soon after collection as
            practical.
          </p>
        
          <div className="form-grid">
            <label className="field">
              <span>
                What day are your bins normally emptied?
                <span className="required-mark"> *</span>
              </span>
        
              <select
                value={form.scheduling.collectionDay}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduling: {
                      ...current.scheduling,
                      collectionDay:
                        event.target.value as CollectionDay | "",
                    },
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select your regular collection day
                </option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
                <option value="varies">
                  My collection day varies
                </option>
                <option value="not_sure">I’m not sure</option>
              </select>
            </label>
        
            <label className="field">
              <span>
                What time are your bins usually emptied?
                <span className="required-mark"> *</span>
              </span>
        
              <select
                value={form.scheduling.collectionTimeWindow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduling: {
                      ...current.scheduling,
                      collectionTimeWindow:
                        event.target.value as CollectionTimeWindow | "",
                    },
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select the typical collection time
                </option>
                <option value="before_6_am">Before 6:00 AM</option>
                <option value="6_8_am">6:00–8:00 AM</option>
                <option value="8_10_am">8:00–10:00 AM</option>
                <option value="10_am_12_pm">
                  10:00 AM–12:00 PM
                </option>
                <option value="12_2_pm">12:00–2:00 PM</option>
                <option value="2_4_pm">2:00–4:00 PM</option>
                <option value="4_6_pm">4:00–6:00 PM</option>
                <option value="after_6_pm">After 6:00 PM</option>
                <option value="varies">The time varies</option>
                <option value="not_sure">I’m not sure</option>
              </select>
        
              <small>
                An estimate is completely fine. Collection schedules sometimes
                change.
              </small>
            </label>
        
            <label className="field">
              <span>When would you prefer your bins cleaned?</span>
        
              <select
                value={form.scheduling.sameDayPreference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduling: {
                      ...current.scheduling,
                      sameDayPreference:
                        event.target.value as SameDayPreference,
                    },
                  }))
                }
              >
                <option value="same_day_when_possible">
                  Same day whenever possible
                </option>
                <option value="next_day_preferred">
                  The following day
                </option>
                <option value="no_preference">No preference</option>
              </select>
        
              <small>
                Same-day service happens only after the normal collection window
                has ended.
              </small>
            </label>
          </div>
        
          <div className="choice-grid">
            {[
              {
                value: "next_available_route_day",
                title: "Use my regular collection schedule",
                note: "Recommended — we’ll place you on the best available route after your bins are emptied.",
              },
              {
                value: "specific_day",
                title: "I need a specific date",
                note: "We’ll review route availability before confirming.",
              },
              {
                value: "urgent",
                title: "One-time urgent cleaning",
                note: "Subject to route availability and possible additional cost.",
              },
            ].map((option) => (
              <label className="choice-card" key={option.value}>
                <input
                  type="radio"
                  name="schedulingPreference"
                  value={option.value}
                  checked={
                    form.scheduling.preference === option.value
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduling: {
                        ...current.scheduling,
                        preference:
                          event.target
                            .value as SchedulingPreference,
                      },
                    }))
                  }
                />
                <span>
                  {option.title}
                  <small>{option.note}</small>
                </span>
              </label>
            ))}
          </div>
        
          {form.scheduling.preference !==
          "next_available_route_day" ? (
            <TextField
              label="Requested service date"
              type="date"
              value={form.scheduling.requestedDate}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  scheduling: {
                    ...current.scheduling,
                    requestedDate: value,
                  },
                }))
              }
              required
            />
          ) : null}
        </section>

        <section className="form-section">
          <h2>Service Instructions</h2>

          <div className="form-grid">
            <label className="field">
              <span>Where will your bins be?</span>
              <select
                value={form.instructions.binLocation}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instructions: {
                      ...current.instructions,
                      binLocation: event.target.value,
                    },
                  }))
                }
              >
                <option>Curbside</option>
                <option>Driveway</option>
                <option>Side of garage</option>
                <option>Other</option>
              </select>
            </label>

            <label className="field">
              <span>Is an exterior water spigot available?</span>
              <select
                value={form.instructions.waterSpigotAvailable}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instructions: {
                      ...current.instructions,
                      waterSpigotAvailable: event.target
                        .value as FormState["instructions"]["waterSpigotAvailable"],
                    },
                  }))
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not_sure">Not sure</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.instructions.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  instructions: {
                    ...current.instructions,
                    notes: event.target.value,
                  },
                }))
              }
              placeholder="Gate code, bin location, heavy odor, dog in yard, HOA instructions, broken lid/wheel, anything else"
            />
          </label>
        </section>

        <section className="form-section">
          <h2>Required Agreements</h2>
          <Agreement
            checked={form.agreements.waterUse}
            onChange={(checked) => setAgreement("waterUse", checked, setForm)}
            label="I authorize Clean Curb Co. to use an exterior water spigot at the service address when needed. Water usage is minimal and may be recorded with an inline water meter."
          />
          <Agreement
            checked={form.agreements.binCondition}
            onChange={(checked) =>
              setAgreement("binCondition", checked, setForm)
            }
            label="I understand bins must be empty and accessible at the scheduled service time. Bins with excessive loose trash, hazardous waste, wet paint, chemicals, concrete, human/animal remains, or unsafe materials may be refused or subject to additional fees."
          />
          <Agreement
            checked={form.agreements.wastewater}
            onChange={(checked) => setAgreement("wastewater", checked, setForm)}
            label="I understand Clean Curb Co. uses reasonable efforts to collect, manage, or redirect wastewater when appropriate and will not intentionally discharge wastewater into storm drains."
          />
          <Agreement
            checked={form.agreements.weatherAccess}
            onChange={(checked) =>
              setAgreement("weatherAccess", checked, setForm)
            }
            label="I understand service may be delayed or rescheduled due to weather, equipment issues, inaccessible bins, or unsafe conditions."
          />
          <Agreement
            checked={form.agreements.photos}
            onChange={(checked) => setAgreement("photos", checked, setForm)}
            label="I authorize Clean Curb Co. to take before/after photos of my bins and service area for service verification. Photos will not identify my address without permission."
          />
          <Agreement
            checked={form.agreements.payment}
            onChange={(checked) => setAgreement("payment", checked, setForm)}
            label="I understand payment is due at booking or upon completion, depending on the service selected."
          />
          <Agreement
            checked={Boolean(form.agreements.launchBilling)}
            onChange={(checked) =>
              setAgreement("launchBilling", checked, setForm)
            }
            label={bookingLaunchAgreement}
          />
        </section>

        {error ? (
          <p className="confirmation-panel" role="alert">
            {error}
          </p>
        ) : null}

        <div className="submit-area">
          {turnstileDisabled ? (
            <div
              className="turnstile-panel local-dev-turnstile-bypass"
              role="status"
            >
              Local dev verification bypass is enabled. Turnstile is skipped on
              localhost.
            </div>
          ) : (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              action="booking_submit"
              resetKey={turnstileResetKey}
              onTokenChange={handleTurnstileToken}
            />
          )}

          <button
            className="button button-dark"
            type="submit"
            disabled={isSubmitting || (!turnstileDisabled && !turnstileToken)}
          >
            <Send size={20} aria-hidden="true" />
            {isSubmitting ? "Sending Request..." : "Request My Cleaning"}
          </button>

          <p className="muted">
            No surprise charges. We confirm your route day and final price
            before service.
          </p>
        </div>
      </form>

      <aside className="estimate-panel">
        <CalendarCheck size={30} aria-hidden="true" />
        <h2>Estimated visit price</h2>

        <div className="estimate-total">
          <strong>${estimatedPrice}</strong>
          <span>/ visit</span>
        </div>

        <p>
          <strong>{formatFrequency(form.service.frequency)}</strong>
          <br />
          Estimated visit for {form.service.binCount}
          {form.service.binCount === 1 ? " bin" : " bins"}.
        </p>

        <div className="launch-reminder">
          <p className="section-kicker">Founding Neighbor Special</p>
          <strong>
            {foundingSpecial.eligible
              ? `$${foundingSpecial.specialPrice} first 2-bin recurring clean`
              : launchPromo}
          </strong>
          <span>
            {foundingSpecial.eligible
              ? foundingSpecial.reason
              : `Not applied to this estimate: ${foundingSpecial.reason}`}
          </span>
          <small>{launchBillingNote}</small>
        </div>

        {america250Active ? (
          <div className="america250-estimate-callout">
            <div>
              <p className="section-kicker">America 250 Deal</p>
              <strong>
                {america250Promotion.discountPercent}% off recurring base pricing
              </strong>
            </div>

            <p>
              Today and tomorrow only. Stacks with the Founding Neighbor Special
              when eligible.
            </p>

            {form.service.frequency === "one_time" ? (
              <span>
                Choose Monthly, Every Other Month, or Quarterly to use this
                recurring service discount.
              </span>
            ) : (
              <span>
                Eligible recurring bookings submitted by{" "}
                {america250Promotion.deadlineLabel} may qualify.
              </span>
            )}

            <Link href={america250Promotion.detailsHref}>Learn More</Link>
          </div>
        ) : null}

        <div className="estimate-panel-section">
          <h3>What happens after you submit?</h3>
          <ol className="number-list">
            <li>We confirm your route day by email or text when available.</li>
            <li>You approve the final price/payment link before service.</li>
            <li>We clean the bins and send completion photos.</li>
          </ol>
        </div>

        <p className="estimate-note">
          Estimate shown until route day, add-ons, and final price are confirmed.
        </p>
      </aside>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <span className="required-mark"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function Agreement({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="choice-card">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
      />
      <span>{label}</span>
    </label>
  );
}

function setAgreement(
  key: keyof BookingRequest["agreements"],
  checked: boolean,
  setForm: React.Dispatch<React.SetStateAction<FormState>>,
) {
  setForm((current) => ({
    ...current,
    agreements: { ...current.agreements, [key]: checked },
  }));
}

function normalizeReferralCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").slice(0, 24).toUpperCase();
}

function formatCollectionDay(value?: CollectionDay) {
  if (!value) {
    return "Not provided";
  }

  if (value === "not_sure") {
    return "Not sure";
  }

  if (value === "varies") {
    return "Varies";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function BookingSummary({ booking }: { booking: BookingRequest }) {
  return (
    <aside className="estimate-panel">
      <h3>Request Summary</h3>
      <p>
        <strong>{formatFrequency(booking.service.frequency)}</strong>
        <br />
        {booking.service.binCount}{" "}
        {booking.service.binCount === 1 ? "bin" : "bins"}
      </p>
      <p>
        <strong>Estimated price:</strong> ${booking.service.estimatedPrice}
        <br />
        <strong>Neighborhood:</strong> {booking.customer.neighborhood}
        <br />
        <strong>Collection day:</strong>{" "}
        {formatCollectionDay(booking.scheduling.collectionDay)}
        <br />
        <strong>Scheduling:</strong>{" "}
        {booking.scheduling.preference.replaceAll("_", " ")}
      </p>
      <p>
        We will confirm the route day, final price, and payment timing before
        service.
      </p>
    </aside>
  );
}
