import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Clean Curb Co. customer portal login.",
};

export default function LoginPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Login</p>
          <h1>Welcome back.</h1>
          <p>
            View your Clean Curb Co. bookings, route updates, payment links,
            and service photos. Already booked? Use the email address from
            your booking to access your account.
          </p>
        </div>
      </section>
      <section className="section section-cream">
        <div className="container auth-layout">
          <Suspense fallback={<p className="muted">Loading secure login...</p>}>
            <LoginForm />
          </Suspense>
          <section className="placeholder-panel">
            <p className="section-kicker">New here?</p>
            <h2>Book first, then set up your account.</h2>
            <p>
              New here? Book your first cleaning first, then we will help you
              get your account set up so your route request and service
              address stay together.
            </p>
            <Link className="button button-dark" href="/book">
              Book a Cleaning
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}
