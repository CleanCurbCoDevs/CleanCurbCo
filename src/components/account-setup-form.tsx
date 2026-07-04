"use client";

import { useState } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";

type AccountSetupFormProps = {
  bookingId: string;
  token: string;
  email: string;
  customerName: string;
};

export function AccountSetupForm({
  bookingId,
  token,
  email,
  customerName,
}: AccountSetupFormProps) {
  const feedback = useActionFeedback();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Those passwords do not match yet.");
      feedback.error("Those passwords do not match yet.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          token,
          email,
          password,
        }),
      });
      const data = (await response.json()) as {
        redirectTo?: string;
        error?: string;
      };

      if (!response.ok || !data.redirectTo) {
        throw new Error(data.error ?? "Account setup failed");
      }

      feedback.success("Account created. Opening your portal.");
      window.location.assign(data.redirectTo);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "We could not set up that account. Please try again.";
      setError(message);
      feedback.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="confirmation-panel">
        <CheckCircle2 size={30} aria-hidden="true" />
        <h2>Your booking request has been received.</h2>
        <p>
          Create your account to manage service updates, service details, and
          future before/after photos.
        </p>
      </div>

      <label className="field">
        <span>Name</span>
        <input value={customerName} readOnly />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} readOnly />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>

      {error ? <p className="confirmation-panel">{error}</p> : null}

      <button className="button button-dark" type="submit" disabled={isSubmitting}>
        <LockKeyhole size={20} aria-hidden="true" />
        {isSubmitting ? "Setting Up..." : "Create Account"}
      </button>
    </form>
  );
}
