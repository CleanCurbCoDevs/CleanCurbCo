"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

type ContactReason =
  | "Booking question"
  | "Waitlist"
  | "General question"
  | "HOA or group route";

type ContactRequest = {
  name: string;
  phone: string;
  email: string;
  location: string;
  reason: ContactReason;
  message: string;
  website: string;
};

const initialContactRequest: ContactRequest = {
  name: "",
  phone: "",
  email: "",
  location: "",
  reason: "Booking question",
  message: "",
  website: "",
};

export function ContactForm() {
  const [request, setRequest] = useState<ContactRequest>(
    initialContactRequest,
  );
  const [submittedRequest, setSubmittedRequest] =
    useState<ContactRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof ContactRequest>(
    key: K,
    value: ContactRequest[K],
  ) {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Message failed");
      }

      setSubmittedRequest(request);
      setRequest(initialContactRequest);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something got stuck. Please try again or contact us directly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="form-section" aria-labelledby="contact-form-heading">
      <h2 id="contact-form-heading">Send a quick note</h2>
      <p className="muted">
        Booking question, waitlist request, HOA route idea, or just a normal
        human question. We will follow up.
      </p>

      {submittedRequest ? (
        <div className="confirmation-panel">
          <CheckCircle2 size={30} aria-hidden="true" />
          <h2>Thanks, {submittedRequest.name}.</h2>
          <p>
            Your {submittedRequest.reason.toLowerCase()} note has been
            received. For same-day questions, calling or emailing us directly is
            still the fastest route.
          </p>
        </div>
      ) : null}

      <form className="booking-form" onSubmit={handleSubmit}>
        <label className="form-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            autoComplete="off"
            tabIndex={-1}
            value={request.website}
            onChange={(event) => updateField("website", event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Name <span className="required-mark">*</span></span>
            <input
              value={request.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Phone <span className="required-mark">*</span></span>
            <input
              type="tel"
              value={request.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Email <span className="required-mark">*</span></span>
            <input
              type="email"
              value={request.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Address or neighborhood <span className="required-mark">*</span></span>
            <input
              value={request.location}
              onChange={(event) => updateField("location", event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Reason</span>
          <select
            value={request.reason}
            onChange={(event) =>
              updateField("reason", event.target.value as ContactReason)
            }
          >
            <option>Booking question</option>
            <option>Waitlist</option>
            <option>General question</option>
            <option>HOA or group route</option>
          </select>
        </label>
        <label className="field">
          <span>Message <span className="required-mark">*</span></span>
          <textarea
            value={request.message}
            onChange={(event) => updateField("message", event.target.value)}
            required
            placeholder="Tell us what you need cleaned, what neighborhood you are in, or how many neighbors might want route service."
          />
        </label>
        {error ? (
          <p className="confirmation-panel" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-dark" type="submit" disabled={isSubmitting}>
          <Send size={20} aria-hidden="true" />
          {isSubmitting ? "Sending..." : "Send Message"}
        </button>
      </form>
    </section>
  );
}
