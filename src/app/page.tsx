import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, DollarSign } from "lucide-react";
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
          <h1>Your bins have seen some things.</h1>
        
          <p className="hero-subtitle">
            We clean, sanitize, and deodorize trash and recycling bins
            right at the curb—so you don’t have to.
          </p>
        
          <p className="trust-line">
            Starting at $25 • Local and veteran-owned
          </p>
        
          <div className="hero-actions">
            <Link className="button button-primary" href="/book">
              <CalendarCheck size={20} aria-hidden="true" />
              Get the Gross Stuff Handled
            </Link>
        
            <Link className="button button-secondary" href="#pricing">
              <DollarSign size={20} aria-hidden="true" />
              See Pricing
            </Link>
          </div>
        
          <p className="hero-note">
            No need to be home. Completion photos included.
          </p>
        </div>
      </section>

      <section className="launch-special-band">
        <div className="container">
          <article className="launch-special-card">
            <p className="section-kicker">
              Founding Neighbor Special
            </p>
          
            <h2>Your first recurring 2-bin cleaning is $25.</h2>
          
            <p>
              Choose monthly, every-other-month, or quarterly service.
              Your first qualifying 2-bin cleaning is $25, and your exact
              plan price is shown before checkout.
            </p>
          
            <Link className="button button-primary" href="/book">
              Get My Bins Handled
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
