"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

export function MaintenanceSignupForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/maintenance-signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            website,
          }),
        },
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? "We could not save your email.",
        );
      }

      setSubmitted(true);
      setEmail("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="confirmation-panel">
        <CheckCircle2 size={30} aria-hidden="true" />
        <h2>You’re on the list.</h2>
        <p>
          We’ll let you know as soon as Clean Curb Co. is
          accepting online bookings again.
        </p>
      </div>
    );
  }

  return (
    <form
      className="auth-form"
      onSubmit={handleSubmit}
    >
      <label
        className="form-honeypot"
        aria-hidden="true"
      >
        <span>Website</span>

        <input
          autoComplete="off"
          tabIndex={-1}
          value={website}
          onChange={(event) =>
            setWebsite(event.target.value)
          }
        />
      </label>

      <label className="field">
        <span>Email address</span>

        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
        />
      </label>

      {error ? (
        <p
          className="confirmation-panel"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="button button-primary"
        type="submit"
        disabled={isSubmitting}
      >
        <Mail size={20} aria-hidden="true" />

        {isSubmitting
          ? "Joining..."
          : "Let Me Know When You’re Back"}
      </button>
    </form>
  );
}
