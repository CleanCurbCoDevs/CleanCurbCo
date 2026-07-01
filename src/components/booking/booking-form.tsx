"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Send } from "lucide-react";
import { addOns, binTypes, launchPromo, neighborhoods } from "@/lib/site";
import { calculateEstimatedPrice, formatFrequency } from "@/lib/pricing";
import type {
  BookingRequest,
  SchedulingPreference,
  ServiceFrequency,
} from "@/types/booking";

type FormState = {
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
    requestedDate: string;
  };
  instructions: {
    binLocation: string;
    waterSpigotAvailable: "yes" | "no" | "not_sure";
    notes: string;
  };
  agreements: BookingRequest["agreements"];
};

const initialState: FormState = {
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
  },
};

export function BookingForm({ initialReferralCode = "" }: { initialReferralCode?: string }) {
  const [form, setForm] = useState<FormState>(() => ({
    ...initialState,
    referralCode: normalizeReferralCode(initialReferralCode),
  }));
  const [submittedBooking, setSubmittedBooking] =
    useState<BookingRequest | null>(null);
  const [setupHref, setSetupHref] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const estimatedPrice = useMemo(
    () =>
      calculateEstimatedPrice({
        binCount: form.service.binCount,
        frequency: form.service.frequency,
        addOns: form.service.addOns,
        applyFoundingNeighborPromo: form.service.frequency !== "one_time",
      }),
    [form.service.addOns, form.service.binCount, form.service.frequency],
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
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as {
        booking?: BookingRequest;
        redirectTo?: string | null;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "Booking request failed");
      }

      setSubmittedBooking(data.booking);
      setSetupHref(data.redirectTo ?? null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something got stuck. Please try again or contact us directly.",
      );
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
            We will text you shortly to confirm your Cane Bay route day and
            final price. Fresh Starts at the Curb.
          </p>
          {setupHref ? (
            <a className="button button-dark" href={setupHref}>
              Set Up Customer Account
            </a>
          ) : null}
          <p>
            <strong>Booking ID:</strong> {submittedBooking.id}
          </p>
        </div>
        <BookingSummary booking={submittedBooking} />
      </div>
    );
  }

  return (
    <div className="booking-shell">
      <form className="booking-form" onSubmit={handleSubmit}>
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
            We service Cane Bay by neighborhood route. After booking, we will
            confirm your next available route day by text.
          </p>
          <div className="choice-grid">
            {[
              {
                value: "next_available_route_day",
                title: "Next available route day",
                note: "Best for route pricing and quick confirmation.",
              },
              {
                value: "specific_day",
                title: "I need a specific day",
                note: "Subject to availability and possible additional fee.",
              },
              {
                value: "urgent",
                title: "One-time urgent clean",
                note: "Subject to availability and possible additional fee.",
              },
            ].map((option) => (
              <label className="choice-card" key={option.value}>
                <input
                  type="radio"
                  name="schedulingPreference"
                  value={option.value}
                  checked={form.scheduling.preference === option.value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduling: {
                        ...current.scheduling,
                        preference: event.target.value as SchedulingPreference,
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
          {form.scheduling.preference !== "next_available_route_day" ? (
            <TextField
              label="Requested date"
              type="date"
              value={form.scheduling.requestedDate}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  scheduling: { ...current.scheduling, requestedDate: value },
                }))
              }
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
            onChange={(checked) =>
              setAgreement("waterUse", checked, setForm)
            }
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
            onChange={(checked) =>
              setAgreement("wastewater", checked, setForm)
            }
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
        </section>

        {error ? (
          <p className="confirmation-panel" role="alert">
            {error}
          </p>
        ) : null}

        <div className="submit-area">
          <button className="button button-dark" type="submit" disabled={isSubmitting}>
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
          {form.service.frequency === "one_time"
            ? formatFrequency(form.service.frequency)
            : "Estimated first visit"}{" "}
          for {form.service.binCount}
          {form.service.binCount === 1 ? " bin" : " bins"}.
        </p>
        <p className="estimate-note">
          Estimate shown until we confirm your route day, add-ons, and final
          price.
        </p>
        <div className="launch-reminder">
          <p className="section-kicker">Founding Neighbor Special</p>
          <strong>{launchPromo}</strong>
        </div>
        <div className="estimate-panel-section">
          <h3>What happens after you submit?</h3>
          <ol className="number-list">
            <li>We text you to confirm your route day.</li>
            <li>You get your final price before service.</li>
            <li>We clean the bins and send completion photos.</li>
          </ol>
        </div>
        <ul className="check-list">
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            We will confirm your route day by text.
          </li>
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            Starting-at add-ons get final approval first.
          </li>
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            Payment link can be sent after confirmation.
          </li>
        </ul>
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
        <strong>Scheduling:</strong>{" "}
        {booking.scheduling.preference.replaceAll("_", " ")}
      </p>
      <p>
        We will confirm the route day, final price, and payment link before
        service.
      </p>
    </aside>
  );
}
