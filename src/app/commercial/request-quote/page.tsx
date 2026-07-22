import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ClipboardCheck,
  FileSearch,
  MapPin,
} from "lucide-react";
import { CommercialQuoteForm } from "@/components/commercial/commercial-quote-form";
import { publicPageMetadata } from "@/lib/seo";
import "./request-quote.css";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Request a Commercial Cleaning Quote",
    description:
      "Request site-specific pricing for commercial bin, dumpster, trash enclosure, concrete pad, HOA route, and property cleaning services.",
    path: "/commercial/request-quote",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommercialQuotePage() {
  return (
    <main className="commercial-quote-page">
      <section className="commercial-quote-hero">
        <div className="container commercial-quote-hero-grid">
          <div className="commercial-quote-hero-copy">
            <Link className="commercial-back-link" href="/commercial">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to Commercial
            </Link>

            <p className="commercial-quote-eyebrow">
              Site-Specific Quote Request
            </p>

            <h1>Tell us what the property is working with.</h1>

            <p>
              Containers, enclosures, concrete, access restrictions, weird
              schedules, mystery grime—give us the real picture. We will review
              the property and build the quote around the actual work.
            </p>
          </div>

          <aside className="commercial-quote-hero-card">
            <h2>What happens next?</h2>

            <ul>
              <li>
                <FileSearch size={21} aria-hidden="true" />
                <span>
                  <strong>We review the request.</strong>
                  Straightforward sites may be quoted from the information
                  provided.
                </span>
              </li>

              <li>
                <MapPin size={21} aria-hidden="true" />
                <span>
                  <strong>We may request a walkthrough.</strong>
                  Larger or unusual properties sometimes need an in-person look.
                </span>
              </li>

              <li>
                <ClipboardCheck size={21} aria-hidden="true" />
                <span>
                  <strong>You receive a written scope.</strong>
                  Pricing and service details are confirmed before work begins.
                </span>
              </li>

              <li>
                <Camera size={21} aria-hidden="true" />
                <span>
                  <strong>Photos are welcome.</strong>
                  Secure photo uploads are being added before public launch.
                </span>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="commercial-quote-form-section">
        <div className="container">
          <CommercialQuoteForm
            turnstileSiteKey={
              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
            }
          />
        </div>
      </section>
    </main>
  );
}
