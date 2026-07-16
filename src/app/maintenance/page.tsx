import type { Metadata } from "next";
import Link from "next/link";
import {
  Construction,
  LogIn,
  MessageCircle,
} from "lucide-react";
import { MaintenanceSignupForm } from "@/components/maintenance-signup-form";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Quick Maintenance",
  description:
    "Clean Curb Co. is temporarily improving its online booking experience.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">
            Quick pit stop
          </p>

          <Construction
            size={44}
            aria-hidden="true"
          />

          <h1>
            We’re tightening a few bolts behind the
            scenes.
          </h1>

          <p>
            Our website is temporarily paused while we
            improve booking and payment reliability.
            We expect to be back shortly.
          </p>
        </div>
      </section>

      <section className="section section-cream">
        <div className="container narrow-container">
          <section className="payment-result-card">
            <p className="section-kicker">
              Want the all-clear?
            </p>

            <h2>
              Leave your email and we’ll let you know
              when online booking is live again.
            </h2>

            <p>
              No spam. Just one message when the site
              is ready to roll.
            </p>

            <MaintenanceSignupForm />

            <div className="payment-result-next">
              <h2>Still need us?</h2>

              <p>
                Our contact page, phone, and email are
                still available while the booking
                system is being improved.
              </p>
            </div>

            <div className="button-row">
              <Link
                className="button button-dark"
                href="/contact"
              >
                <MessageCircle
                  size={20}
                  aria-hidden="true"
                />
                Contact Clean Curb Co.
              </Link>

              <Link
                className="button button-outline"
                href="/login?next=/"
              >
                <LogIn
                  size={20}
                  aria-hidden="true"
                />
                Staff Access
              </Link>
            </div>

            <p className="muted">
              You can also call {brand.phone} or email{" "}
              <a href={brand.emailHref}>
                {brand.email}
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
