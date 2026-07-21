import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Droplets,
  Flag,
  HeartHandshake,
  Home,
  Leaf,
  MapPin,
  MessageSquareText,
  Route,
  ShieldCheck,
  Sparkles,
  SprayCan,
  Trash2,
} from "lucide-react";
import { FAQAccordion } from "@/components/faq-accordion";
import { PricingCard } from "@/components/pricing-card";
import { SectionHeader } from "@/components/section-header";
import { ServiceAreaChecker } from "@/components/service-area-checker";
import { ServiceCard } from "@/components/service-card";
import {
  addOns,
  futureServices,
  oneTimeRows,
  recurringPlans,
  serviceAreas,
} from "@/lib/site";

const proofPhotos = [
  {
    src: "/images/proof/bin-cleaning-action-driveway.jpeg",
    alt: "Clean Curb Co. rinsing a residential garbage bin on a driveway.",
    caption: "High-pressure rinse inside and out",
    className: "featured",
    position: "center 48%",
  },
  {
    src: "/images/proof/bin-inside-before-detail.jpeg",
    alt: "Inside view of a garbage bin before detailed cleaning.",
    caption: "Lid, rim, handles, and wheel areas",
    position: "center 42%",
  },
  {
    src: "/images/proof/bin-cleaning-process.jpeg",
    alt: "Clean Curb Co. cleaning a residential garbage bin during service.",
    caption: "Deodorizing finish",
    position: "center 50%",
  },
  {
    src: "/images/proof/bin-inside-after-detail.jpeg",
    alt: "Inside view of a garbage bin after rinsing and cleaning.",
    caption: "Photo updates after service",
    position: "center 50%",
  },
];

const pricingPlanLinks = {
  one_time: {
    href: "/book?frequency=one-time",
    label: "Choose One-Time",
  },
  monthly: {
    href: "/book?frequency=monthly",
    label: "Choose Monthly",
  },
  every_other_month: {
    href: "/book?frequency=every-other-month",
    label: "Choose Every 2 Months",
  },
  quarterly: {
    href: "/book?frequency=quarterly",
    label: "Choose Quarterly",
  },
} as const;

export function ProblemSection() {
  const problems = [
    "Smelly bins",
    "Flies and maggots",
    "Garage odors",
    "Sticky residue",
    "Dirty trash pads",
    "Bacteria and grime",
  ];

  return (
    <section className="section section-dark">
      <div className="container grid grid-2">
        <div>
          <SectionHeader
            kicker="The problem"
            title="Trash day should not stink all week."
          >
            We clean, sanitize, and deodorize the bins you would rather not
            touch. Fair enough. Nobody dreams of scrubbing a trash can.
          </SectionHeader>
          <Link className="button button-primary" href="/book">
            <Sparkles size={20} aria-hidden="true" />
            Get a Fresh Start
          </Link>
        </div>
        <ul className="problem-list">
          {problems.map((problem) => (
            <li key={problem}>
              <CheckCircle2 size={19} aria-hidden="true" />
              {problem}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProofSection() {
  return (
    <section className="section section-white">
      <div className="container">
        <SectionHeader
          kicker="Service photos"
          title="Real bins. Real fresh starts."
          centered
        >
          A quick look at the kind of curbside cleanup we are bringing to
          Summerville-area neighborhoods.
        </SectionHeader>
        <div className="proof-gallery" aria-label="Clean Curb Co. service photos">
          <ProofPhotoCard photo={proofPhotos[0]} priority />
          <div className="proof-support-grid">
            {proofPhotos.slice(1).map((photo) => (
              <ProofPhotoCard photo={photo} key={photo.src} />
            ))}
          </div>
        </div>
        <p className="proof-note">Real photos from Clean Curb Co. service work.</p>
      </div>
    </section>
  );
}

export function WhatGetsCleanedSection() {
  const cards = [
    {
      icon: Trash2,
      title: "Inside the bin",
      description:
        "We rinse out the gunk, residue, and mystery sludge that builds up below the bag line.",
    },
    {
      icon: Droplets,
      title: "Lid and rim",
      description: "The spots you grab most often get extra attention.",
    },
    {
      icon: Sparkles,
      title: "Handles and wheels",
      description:
        "Because trash day should not leave your hands smelling like regret.",
    },
    {
      icon: Home,
      title: "Curbside area",
      description:
        "Optional pad cleanup helps freshen the spot where your bins live.",
    },
  ];

  return (
    <section className="section section-cream">
      <div className="container">
        <SectionHeader kicker="Included care" title="What gets cleaned?" centered>
          The bin gets attention where it counts, from the inside walls to the
          parts your hands meet on trash day.
        </SectionHeader>
        <div className="grid grid-4">
          {cards.map((card) => (
            <ServiceCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      title: "Book the gross stuff",
      body:
        "Tell us your address, bin count, service plan, and any curbside add-ons you want reviewed.",
    },
    {
      title: "We confirm the route",
      body:
        "We confirm your service area, route day, final price, and payment timing by email or text when available.",
    },
    {
      title: "You leave it accessible",
      body:
        "Roll bins out or tell us where the mess is. We clean, document, and send updates when the job is done.",
    },
  ];

  return (
    <section className="section section-white how-it-works-section">
      <div className="container">
        <SectionHeader
          kicker="How it works"
          title="Ridiculously easy, as gross chores should be."
        >
          Your job is to book it and make the area accessible. Our job is to
          handle the hose-and-regret part.
        </SectionHeader>

        <ol className="how-step-list" aria-label="How Clean Curb Co. works">
          {steps.map((step, index) => (
            <li className="card how-step-card" key={step.title}>
              <span className="step-number" aria-hidden="true">
                Step {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="section section-cream" id="pricing">
      <div className="container">
        <SectionHeader
          kicker="Pricing"
          title="Pick your level of fresh."
        >
          Choose a one-time reset or keep the stink from making
          a comeback with recurring service.
        </SectionHeader>

        <div className="grid grid-4">
          <article className="card pricing-card">
            <span className="plan-badge">
              One-Time Clean
            </span>

            <div>
              <h3>One-Time Clean</h3>
              <p>
                Great for a reset, move-in, or the bin that
                went rogue.
              </p>
            </div>

            <ul className="check-list">
              {oneTimeRows.map((row) => (
                <li key={row.label}>
                  <CheckCircle2
                    size={18}
                    aria-hidden="true"
                  />

                  <span>
                    {row.label}:{" "}
                    <strong>{row.price}</strong>
                  </span>
                </li>
              ))}
            </ul>

            <Link
              className="button button-dark"
              href={pricingPlanLinks.one_time.href}
            >
              {pricingPlanLinks.one_time.label}
            </Link>
          </article>

          {recurringPlans.map((plan) => (
            <PricingCard
              key={plan.id}
              label={plan.label}
              name={plan.name}
              price={plan.price}
              suffix={plan.suffix}
              frequency={plan.frequency}
              highlights={plan.highlights}
              ctaHref={pricingPlanLinks[plan.id].href}
              ctaLabel={pricingPlanLinks[plan.id].label}
              featured={plan.featured}
            />
          ))}
        </div>

        <div className="pricing-fine-print">
          <p>
            <strong>
              Recurring plans include up to 2 bins.
            </strong>{" "}
            Extra recurring bins are typically $8–$10 each.
          </p>

          <p>
            Card payments use secure Stripe Checkout.
            Route timing is coordinated around your normal
            collection day.
          </p>
        </div>
      </div>
    </section>
  );
}

export function AddOnsSection() {
  const icons = [SprayCan, Sparkles, Trash2, Droplets, Home];

  return (
    <section className="section section-white">
      <div className="container">
        <SectionHeader kicker="Add-ons" title="Helpful extras for outdoor messes.">
          We solve dirty, smelly, outdoor problems. Starting-at services get a
          final price confirmed before service.
        </SectionHeader>
        <div className="grid grid-3">
          {addOns.map((addOn, index) => (
            <ServiceCard
              key={addOn.id}
              icon={icons[index] ?? Sparkles}
              title={`${addOn.name} | ${addOn.price}`}
              description={addOn.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServiceAreaSection() {
  return (
    <section className="section section-dark">
      <div className="container service-area-panel">
        <div>
          <SectionHeader kicker="Instant checker" title="Check your route fit.">
            Enter the basics before booking and we will help confirm whether
            your address fits the current route or needs a quick follow-up.
          </SectionHeader>
          <ServiceAreaChecker />
        </div>
        <ul className="route-list">
          {serviceAreas.map((area) => (
            <li key={area}>
              <MapPin size={18} aria-hidden="true" />
              {area}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ExpectationsSection() {
  const expectations = [
    {
      icon: MessageSquareText,
      title: "Clear route updates",
      description: "Email or text updates when available, so you know what is happening.",
    },
    {
      icon: DollarSign,
      title: "Final price confirmed",
      description: "Starting-at add-ons are confirmed before service.",
    },
    {
      icon: Camera,
      title: "Before/after photos",
      description: "You get photo updates after the cleaning is complete.",
    },
    {
      icon: Home,
      title: "No awkward door-knocking",
      description: "Leave bins accessible and we handle the curbside work.",
    },
    {
      icon: ShieldCheck,
      title: "24-hour promise",
      description: "If something is not right, let us know and we will help.",
    },
    {
      icon: Flag,
      title: "Local and veteran-owned",
      description: "Built for local neighborhood routes, not corporate call-center vibes.",
    },
  ];

  return (
    <section className="section section-white">
      <div className="container">
        <SectionHeader kicker="What to expect" title="Clear updates. Cleaner curb. Less weirdness." centered>
          Simple communication, honest pricing, and proof when the job is done.
        </SectionHeader>
        <div className="grid grid-3">
          {expectations.map((card) => (
            <ServiceCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhyChooseUsSection() {
  const cards = [
    {
      icon: MapPin,
      title: "Local",
      description: "Built for Summerville-area neighborhoods and nearby communities.",
    },
    {
      icon: Flag,
      title: "Veteran-owned",
      description: "A disciplined, service-first approach without the corporate feel.",
    },
    {
      icon: Leaf,
      title: "Eco-conscious",
      description: "Practical products and wastewater care whenever possible.",
    },
    {
      icon: MessageSquareText,
      title: "Clear communication",
      description: "Email or text updates for confirmations, reminders, and completion when available.",
    },
    {
      icon: Camera,
      title: "Before/after photos",
      description: "Proof that your bins got the fresh-start treatment.",
    },
    {
      icon: ShieldCheck,
      title: "Satisfaction promise",
      description: "Let us know within 24 hours and we will make it right.",
    },
    {
      icon: Route,
      title: "Route-based pricing",
      description: "Neighborhood routes help keep visits efficient and affordable.",
    },
    {
      icon: HeartHandshake,
      title: "Friendly service",
      description: "Professional, neighborly, and only lightly amused by bin drama.",
    },
  ];

  return (
    <section className="section section-cream">
      <div className="container">
        <SectionHeader kicker="Why choose us" title="Local routes. Clear updates. No weirdness.">
          The customer experience is designed around one thought: that was
          ridiculously easy.
        </SectionHeader>
        <div className="grid grid-4">
          {cards.map((card) => (
            <ServiceCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FreshStartPromiseSection() {
  return (
    <section className="section promise-band">
      <div className="container promise-card">
        <p className="section-kicker">The Fresh Start Promise</p>
        <h2>If you are not happy, we will come back and make it right.</h2>
        <p>
          Let us know within 24 hours and we will return at no additional
          charge. Clean bins should feel simple, reliable, and worth it.
        </p>
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section className="section section-white" id="faq">
      <div className="container">
        <SectionHeader kicker="Support" title="Common questions">
          Still wondering about something? Send us a note and we will help.
        </SectionHeader>
        <FAQAccordion />
      </div>
    </section>
  );
}

export function FinalCTASection() {
  return (
    <section className="section final-cta">
      <div className="container">
        <SectionHeader
          kicker="Ready?"
          title="Ready for a fresh start at the curb?"
        >
          Join a local route and let trash day stop following you back to the
          garage. {launchPromo}
        </SectionHeader>
        <div className="hero-actions">
          <Link className="button button-primary" href="/book">
            <CalendarIcon />
            Book My Bin Cleaning
          </Link>
          <Link className="button button-secondary" href="/book">
            <BadgeCheck size={20} aria-hidden="true" />
            Join a Local Route
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FutureServicesSection() {
  return (
    <section className="section section-dark">
      <div className="container">
        <SectionHeader
          kicker="Future services"
          title="More outdoor cleanups are on the roadmap."
        >
          Launch focus stays on residential garbage bin cleaning. These services
          are planned for later as the route and equipment base grows.
        </SectionHeader>
        <div className="grid grid-3">
          {futureServices.map((service) => (
            <article className="card dark-card" key={service}>
              <span className="status-badge">Coming Soon</span>
              <h3>{service}</h3>
              <p>Available later as routes, equipment, and neighborhood demand grow.</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CalendarIcon() {
  return <ClipboardCheck size={20} aria-hidden="true" />;
}

function ProofPhotoCard({
  photo,
  priority,
}: {
  photo: (typeof proofPhotos)[number];
  priority?: boolean;
}) {
  return (
    <figure
      className={`proof-card${photo.className ? ` ${photo.className}` : ""}`}
      key={photo.src}
    >
      <span className="proof-image-frame">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={
            photo.className === "featured"
              ? "(max-width: 719px) 100vw, 1180px"
              : "(max-width: 719px) 100vw, 33vw"
          }
          className="proof-image"
          style={{ objectPosition: photo.position }}
          loading={priority ? "eager" : "lazy"}
        />
      </span>
      <figcaption>{photo.caption}</figcaption>
    </figure>
  );
}
