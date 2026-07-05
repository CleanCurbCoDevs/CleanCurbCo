import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, DollarSign } from "lucide-react";
import {
  launchPromo,
  launchReservationCopy,
  launchRouteHeadline,
} from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import {
  AddOnsSection,
  ExpectationsSection,
  FAQSection,
  FinalCTASection,
  FreshStartPromiseSection,
  HowItWorksSection,
  PricingSection,
  ProofSection,
  ProblemSection,
  ServiceAreaSection,
  WhatGetsCleanedSection,
  WhyChooseUsSection,
} from "@/components/sections/home-sections";

export const metadata = publicPageMetadata({
  title: "Curbside Cleaning & Garbage Bin Cleaning in Summerville, SC",
  description:
    "Curbside cleaning, garbage bin cleaning, sanitizing, deodorizing, and outdoor grime cleanup for Summerville, Cane Bay, Goose Creek, Moncks Corner, and nearby communities.",
  path: "/",
});

export default function Home() {
  return (
    <main>
      <section className="hero-section">
        <Image
          src="/images/proof/bin-cleaning-action-driveway.jpeg"
          alt="Clean Curb Co. pressure washing a residential garbage bin on a driveway."
          fill
          preload
          sizes="100vw"
          className="hero-image"
        />

        <div className="hero-scrim" />

        <div className="container hero-content">
          <h1>Fresh Starts at the Curb.</h1>

          <p className="hero-subtitle">
            Curbside bin cleaning and grime cleanup for Cane Bay, Summerville,
            and nearby neighborhoods.
          </p>

          <p className="trust-line">
            Locally owned • Veteran-owned • Route-based service
          </p>

          <div className="hero-actions">
            <Link className="button button-primary" href="/book">
              <CalendarCheck size={20} aria-hidden="true" />
              Book Curbside Cleaning
            </Link>

            <Link className="button button-secondary" href="#pricing">
              <DollarSign size={20} aria-hidden="true" />
              See Pricing
            </Link>
          </div>

          <p className="hero-note">
            Reserve your spot now. You won&apos;t be charged until your route
            and service are confirmed.
          </p>
        </div>
      </section>

   <section className="launch-special-band">
  <div className="container">
    <article className="launch-special-card">
      <p className="section-kicker">Launch Special</p>

      <h2>First 2-bin cleaning only $25.</h2>

      <p>
        Join a recurring Cane Bay route and reserve your spot before our first
        planned route on July 13, 2026. You won&apos;t be charged until your
        route day and service are confirmed.
      </p>

      <Link className="button button-primary" href="/book">
        Book Your Spot
      </Link>
    </article>
  </div>
</section>

      <ProblemSection />
      <ProofSection />
      <WhatGetsCleanedSection />
      <HowItWorksSection />
      <PricingSection />
      <AddOnsSection />
      <ServiceAreaSection />
      <ExpectationsSection />
      <WhyChooseUsSection />
      <FreshStartPromiseSection />
      <FAQSection />
      <FinalCTASection />
    </main>
  );
}
