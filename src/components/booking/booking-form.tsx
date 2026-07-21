"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";
import { SiteFeedbackNudge } from "@/components/site-feedback-nudge";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  addOns,
  binTypes,
  bookingLaunchAgreement,
  launchBillingNote,
  launchPromo,
  neighborhoods,
} from "@/lib/site";
import {
  getGa4ServerContext,
  trackAnalyticsEvent,
} from "@/lib/client-analytics";
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
  PaymentPreference,
  SameDayPreference,
  SchedulingPreference,
  ServiceFrequency,
} from "@/types/booking";

type CustomerPaymentPreference = Exclude<
  PaymentPreference,
  "manual_other"
>;

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
  payment: {
    preference: CustomerPaymentPreference;
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
  payment: {
    preference: "stripe",
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
  const bookingStartedTracked = useRef(false);  
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
  const [checkoutIssue, setCheckoutIssue] = useState("");
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

function handleBookingStart() {
  if (bookingStartedTracked.current) {
    return;
  }

  bookingStartedTracked.current = true;

  trackAnalyticsEvent("booking_started", {
    service_type: "bin_cleaning",
    service_frequency: form.service.frequency,
    bin_count: form.service.binCount,
    value: estimatedPrice,
    currency: "USD",
  });
}
  
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const ga4Context = await getGa4ServerContext();
    
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turnstileToken: turnstileTokenForSubmit,
          analytics: ga4Context,
        }),
      });

      const data = (await response.json()) as {
        booking?: BookingRequest;
        redirectTo?: string | null;
        checkoutUrl?: string | null;
        checkoutError?: string | null;
        error?: string;
        requestId?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "Booking request failed");
      }

      if (
        form.payment.preference === "stripe" &&
        data.checkoutUrl
      ) {
        trackAnalyticsEvent("checkout_started", {
          service_type: "bin_cleaning",
          service_frequency: form.service.frequency,
          bin_count: form.service.binCount,
          value: estimatedPrice,
          currency: "USD",
        });
      
        feedback.success(
          "Booking saved. Opening secure checkout...",
        );
      
        window.location.assign(data.checkoutUrl);
        return;
      }
      
      setCheckoutIssue(data.checkoutError ?? "");
      setSubmittedBooking(data.booking);
      setSetupHref(data.redirectTo ?? null);
      
      if (data.checkoutError) {
        feedback.error(data.checkoutError);
      } else {
        feedback.success("Booking request received.");
      }
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
          
          {checkoutIssue ? (
            <p className="form-error" role="alert">
              {checkoutIssue}
            </p>
          ) : null}
          
          <p>
            Your booking has been received. We will review your collection schedule
            and confirm your route details by email or text when available. If you
            selected card payment, your Stripe Checkout result is reflected in your
            booking and payment records.
          </p>

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
      <form
        id="booking-form"
        className="booking-form"
        onFocusCapture={handleBookingStart}
        onSubmit={handleSubmit}
      >
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
          <p className="section-kicker">
            First things first
          </p>
        
          <h2>Where are we cleaning?</h2>
        
          <p className="muted">
            A few details now means less back-and-forth later.
            Give us the basics once, and we’ll handle the gross part.
          </p>
        
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
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
                <option value={9}>9</option>
                <option value={10}>10</option>
              </select>
              
              <small>
                Each additional bin adds $10. For more than 10 bins, contact us for a
                custom quote.
              </small>
              
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

        <section className="form-section scheduling-section">
          <h2>Scheduling</h2>
        
          <p className="muted">
            Tell us when your bins are normally emptied. We use that
            information to schedule your cleaning as soon after collection as
            practical.
          </p>
        
          <div className="scheduling-fields">
            <label className="field">
              <span>
                Regular collection day
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
                  Select collection day
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
                Typical collection time
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
                  Select collection time
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
        
            <label className="field scheduling-preference-field">
              <span>Preferred cleaning timing</span>
        
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
        
          <div className="choice-grid scheduling-choice-grid">
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
          <h2>Payment Method</h2>
        
          <p className="muted">
            Card payment is handled through secure Stripe Checkout after your booking
            details are saved. Venmo Business, Zelle, and pay-in-person selections
            require manual confirmation and are not considered paid until payment is
            received and verified.
          </p>
        
          <div className="choice-grid">
            {[
              {
                value: "stripe",
                title: "Card",
                note:
                  "Recommended. Secure checkout is handled through Stripe. Apple Pay or Google Pay may appear when supported by your device, browser, and Stripe. Clean Curb Co. does not receive your full card number or security code.",
              },
              {
                value: "venmo_business",
                title: "Venmo Business",
                note:
                  "We will provide or confirm the appropriate business-payment instructions. Your booking remains unpaid until the payment is received and verified.",
              },
              {
                value: "zelle",
                title: "Zelle",
                note:
                  "We will provide or confirm the appropriate Zelle instructions. Your booking remains unpaid until the payment is received and verified.",
              },
              {
                value: "cash_in_person",
                title: "Pay in person",
                note:
                  "Payment must be collected and recorded during the service visit before the stop is completed.",
              },
            ].map((option) => (
              <label className="choice-card" key={option.value}>
                <input
                  type="radio"
                  name="paymentPreference"
                  value={option.value}
                  checked={form.payment.preference === option.value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment: {
                        preference:
                          event.target.value as CustomerPaymentPreference,
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
        
          {form.payment.preference === "stripe" ? (
            <p className="muted">
              Your estimated booking total will be collected through secure Stripe
              Checkout. Starting-at add-ons or additional work will not be added
              without your approval.
            </p>
          ) : form.payment.preference === "cash_in_person" ? (
            <p className="muted">
              Your field technician will receive a payment-due alert and must record
              the service amount and any optional tip separately.
            </p>
          ) : (
            <p className="muted">
              Your booking will remain unpaid until the external payment is received
              and manually verified by Clean Curb Co.
            </p>
          )}
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
            onChange={(checked) =>
              setAgreement("payment", checked, setForm)
            }
            label={
              form.payment.preference === "cash_in_person"
                ? "I understand that payment must be collected and recorded during the service visit before the stop is completed."
                : form.payment.preference === "venmo_business" ||
                    form.payment.preference === "zelle"
                  ? "I understand that my booking is not considered paid until Clean Curb Co. receives and verifies the selected external payment."
                  : "I authorize the estimated booking total shown on this form to be collected through secure Stripe Checkout. I understand that starting-at add-ons or additional work will not be charged without my approval."
            }
          />
          
          <Agreement
            checked={Boolean(form.agreements.launchBilling)}
            onChange={(checked) =>
              setAgreement("launchBilling", checked, setForm)
            }
            label={
              form.service.frequency === "one_time"
                ? bookingLaunchAgreement
                : `${bookingLaunchAgreement} I am also requesting ${formatFrequency(
                    form.service.frequency,
                  ).toLowerCase()} service. I understand that selecting a recurring frequency does not guarantee a specific future route date and that future visits may require a saved payment method, payment link, invoice, or other separately confirmed billing arrangement.`
            }
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
            {isSubmitting
              ? form.payment.preference === "stripe"
                ? "Opening Secure Checkout..."
                : "Submitting Booking..."
              : form.payment.preference === "stripe"
                ? "Continue to Secure Checkout"
                : "Submit My Booking"}
          </button>

          <p className="muted">
            Your requested service date remains subject to route availability. Your
            selected payment preference and required acknowledgments will be saved with
            your booking.
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
            <li>
              Your booking details and preferred payment method are saved.
            </li>
            <li>
              Card customers continue to secure Stripe Checkout. Manual payment
              selections remain unpaid until verified.
            </li>
            <li>
              We review your collection schedule and confirm your route details.
            </li>
            <li>
              We clean the bins and send completion updates or photos when available.
            </li>
          </ol>
        </div>

        <p className="estimate-note">
          The displayed total is based on the information submitted. Starting-at
          add-ons or additional work require confirmation before an additional amount
          is charged.
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

function formatPaymentPreference(
  value?: PaymentPreference,
) {
  if (value === "venmo_business") {
    return "Venmo Business";
  }

  if (value === "zelle") {
    return "Zelle";
  }

  if (value === "cash_in_person") {
    return "Pay in person";
  }

  if (value === "manual_other") {
    return "Manually arranged";
  }

  return "Card through Stripe";
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
        <br />
        <strong>Payment method:</strong>{" "}
        {formatPaymentPreference(booking.payment.preference)}
      </p>
      <p>
        We will review your collection schedule and confirm your route details.
        Card payments are processed through Stripe Checkout, while manual payment
        selections remain unpaid until received and verified.
      </p>
    </aside>
  );
}
