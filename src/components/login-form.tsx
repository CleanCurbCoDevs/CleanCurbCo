"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";

export function LoginForm({
  nextPath,
  buttonLabel = "Log In",
}: {
  nextPath?: string;
  buttonLabel?: string;
}) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const resetComplete = searchParams.get("reset") === "complete";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          next: searchParams.get("next") ?? nextPath ?? undefined,
        }),
      });
      const data = (await response.json()) as {
        redirectTo?: string;
        error?: string;
      };

      if (!response.ok || !data.redirectTo) {
        throw new Error(data.error ?? "Login failed");
      }

      window.location.assign(data.redirectTo);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not log you in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {resetComplete ? (
        <div className="confirmation-panel">
          <h2>Password updated.</h2>
          <p>You can log in with your new password.</p>
        </div>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="confirmation-panel">{error}</p> : null}
      <button className="button button-dark" type="submit" disabled={isSubmitting}>
        <LogIn size={20} aria-hidden="true" />
        {isSubmitting ? "Signing In..." : buttonLabel}
      </button>
      <Link className="muted underline-link" href="/reset-password">
        Forgot your password?
      </Link>
    </form>
  );
}
