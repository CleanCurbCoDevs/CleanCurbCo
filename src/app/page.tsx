import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, DollarSign } from "lucide-react";
import {
  brand,
  launchPromo,
  launchReservationCopy,
  launchRouteHeadline,
} from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { LaunchStatusCard } from "@/components/launch-status-card";
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
          <Image
            src="/clean-curb-logo.png"
            alt={brand.logoAlt}
            width={132}
            height={132}
            className="hero-logo"
            loading="eager"
          />
          <p className="eyebrow">Clean Curb Co. | Summerville-area curbside cleaning</p>
          <p className="offer-badge">{launchPromo}</p>
          <h1>Fresh Starts at the Curb.</h1>
            <p className="hero-subtitle">
              We clean the gross curbside stuff nobody wants to deal with.
            </p>
            <p className="hero-supporting">
              Garbage bins are the main thing — but not the only thing.
            </p>
            <LaunchStatusCard />
          <p className="trust-line">
            Locally owned | Veteran owned | Eco-conscious
          </p>
          <div className="hero-chip-list" aria-label="Service highlights">
            <span>Veteran-owned</span>
            <span>Local route-based service</span>            
            <span>Before/after photos</span>
            <span>Email/text route updates</span>
          </div>
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
            Stink happens. We handle it.
            <ArrowRight size={18} aria-hidden="true" />
          </p>
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
