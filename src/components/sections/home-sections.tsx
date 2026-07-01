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
import { ServiceCard } from "@/components/service-card";
import {
  addOns,
  futureServices,
  launchPromo,
  oneTimeRows,
  recurringPlans,
  serviceAreas,
} from "@/lib/site";

const proofPhotos = [
  {
    src: "/images/proof/bin-cleaning-action-driveway.jpeg",
    alt: "Clean Curb Co. rinsing a residential garbage bin on a driveway.",
    caption: "High-pressure rinse inside and out",
    className: "large",
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
          A quick look at the kind of curbside cleanup we are bringing to Cane
          Bay and nearby Summerville neighborhoods.
        </SectionHeader>
        <div className="proof-gallery" aria-label="Clean Curb Co. service photos">
          {proofPhotos.map((photo) => (
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
                    photo.className === "large"
                      ? "(max-width: 719px) 100vw, 58vw"
                      : "(max-width: 719px) 100vw, 28vw"
                  }
                  className="proof-image"
                  style={{ objectPosition: photo.position }}
                />
              </span>
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
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
      title: "Book your cleaning",
      body: "Tell us your address, bin count, and preferred service plan.",
    },
    {
      title: "We confirm your route day",
      body: "You will get a text with your service window and final price before we show up.",
    },
    {
      title: "Roll bins to the curb",
      body: "We clean them outside, deodorize, and send photo updates when we are done.",
    },
  ];

  return (
    <section className="section section-white">
      <div className="container">
        <SectionHeader
          kicker="How it works"
          title="Ridiculously easy, as trash-can chores should be."
        >
          Work each stop from top to bottom? That is our job. Your job is to
          book, roll the bins out, and enjoy a less dramatic trash day.
        </SectionHeader>
        <div className="grid grid-3">
          {steps.map((step, index) => (
            <article className="card" key={step.title}>
              <span className="step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="section section-cream" id="pricing">
      <div className="container">
        <div className="promo-strip">
          <p className="section-kicker">Founding Neighbor Special</p>
          <h2>
            Get your first 2-bin cleaning for <strong>$25</strong> when you
            join any recurring plan.
          </h2>
          <p>{launchPromo}</p>
        </div>
        <SectionHeader kicker="Pricing" title="Simple pricing. Cleaner bins.">
          We clean by neighborhood route to keep service affordable, reliable,
          and efficient. Extra recurring bins are typically +$8-$10 each.
          Recurring service keeps the stink from getting a comeback tour.
        </SectionHeader>
        <div className="route-status-card">
          <div>
            <p className="section-kicker">Route status</p>
            <h3>Now building our first Cane Bay routes.</h3>
            <p>
              Early customers help us build efficient neighborhood cleaning
              days and lock in smoother recurring service.
            </p>
          </div>
          <Link className="button button-primary" href="/book">
            Join the Route
          </Link>
        </div>
        <div className="grid grid-4">
          <article className="card pricing-card">
            <span className="plan-badge">One-Time Clean</span>
            <div>
              <h3>One-Time Clean</h3>
              <p>Great for a reset, move-in, or the bin that went rogue.</p>
            </div>
            <ul className="check-list">
              {oneTimeRows.map((row) => (
                <li key={row.label}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>
                    {row.label}: <strong>{row.price}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <Link className="button button-dark" href="/book">
              Book One-Time
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
              featured={plan.featured}
            />
          ))}
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
          <SectionHeader kicker="Service area" title="Now Serving Cane Bay">
            We are starting with Cane Bay and nearby Summerville communities,
            then expanding route by route. If you are close by but not sure
            whether you are in range, send us your address and we will check.
          </SectionHeader>
          <div className="hero-actions">
            <Link className="button button-primary" href="/book">
              Check My Address
            </Link>
            <Link className="button button-secondary" href="/contact">
              Join Waitlist
            </Link>
          </div>
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
      title: "Clear route-day texts",
      description: "No guessing whether your bin is on the list.",
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
      description: "Built for Cane Bay routes, not corporate call-center vibes.",
    },
  ];

  return (
    <section className="section section-white">
      <div className="container">
        <SectionHeader kicker="What to expect" title="Clean bins, clear texts, no weirdness." centered>
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
      description: "Built for Cane Bay and nearby Summerville communities.",
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
      description: "Texts for confirmation, reminders, updates, and completion.",
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
        <SectionHeader kicker="Why choose us" title="Clean bins, clear texts, no weirdness.">
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
        <SectionHeader kicker="FAQ" title="Quick answers before trash day.">
          If your question is not here, send it over. We are building this to be
          easy for real neighbors, not imaginary perfect customers.
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
          Join the Cane Bay route and let trash day stop following you back to
          the garage. {launchPromo}
        </SectionHeader>
        <div className="hero-actions">
          <Link className="button button-primary" href="/book">
            <CalendarIcon />
            Book My Bin Cleaning
          </Link>
          <Link className="button button-secondary" href="/book">
            <BadgeCheck size={20} aria-hidden="true" />
            Join Cane Bay Route
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
