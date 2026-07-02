"use client";

import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";

type ResetPasswordFormProps = {
  mode: "request" | "update";
  code?: string;
};

export function ResetPasswordForm({ mode, code }: ResetPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (mode === "update" && password !== confirmPassword) {
      setError("Those passwords do not match yet.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "request"
          ? "/api/auth/reset-password"
          : "/api/auth/update-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "request" ? { email } : { code, password },
          ),
        },
      );
      const data = (await response.json()) as {
        message?: string;
        redirectTo?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Password reset failed");
      }

      if (data.redirectTo) {
        window.location.assign(data.redirectTo);
        return;
      }

      setMessage(
        data.message ??
          "If an account exists for that email, a reset link is on the way.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not process that reset request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {mode === "request" ? (
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
        </>
      )}

      {message ? <p className="confirmation-panel">{message}</p> : null}
      {error ? <p className="confirmation-panel">{error}</p> : null}

      <button className="button button-dark" type="submit" disabled={isSubmitting}>
        {mode === "request" ? (
          <Mail size={20} aria-hidden="true" />
        ) : (
          <KeyRound size={20} aria-hidden="true" />
        )}
        {isSubmitting
          ? "Sending..."
          : mode === "request"
            ? "Send Reset Link"
            : "Update Password"}
      </button>
    </form>
  );
}
