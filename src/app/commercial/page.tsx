import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  FileText,
  MapPin,
  RefreshCw,
  Route,
  Store,
  Trash2,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import { publicPageMetadata } from "@/lib/seo";
import { brand } from "@/lib/site";
import "./commercial.css";

/*
 * Temporary landing point while the dedicated commercial quote form
 * is being built. Change this to "/commercial/request-quote" when
 * that route is complete.
 */
const commercialQuoteHref = "/contact#contact-form";

const customerTypes = [
  {
    icon: Building2,
    title: "HOAs and communities",
    copy:
      "Coordinated neighborhood routes for resident bins, shared collection areas, and community-managed properties.",
  },
  {
    icon: Warehouse,
    title: "Property managers",
    copy:
      "Recurring service for apartment communities, rental properties, shared dumpster areas, and managed portfolios.",
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants and food service",
    copy:
      "Cleaning plans for qualifying bins, dumpsters, enclosures, and concrete collection areas where odor and residue build quickly.",
  },
  {
    icon: Store,
    title: "Offices and local businesses",
    copy:
      "Practical recurring or one-time service for businesses that want cleaner collection areas without adding another job to the staff list.",
  },
];

const serviceOptions = [
  {
    icon: Trash2,
    title: "Commercial bins and dumpsters",
    copy:
      "Cleaning for carts, cans, and qualifying dumpsters. Container size, condition, contents, and access determine the final scope.",
  },
  {
    icon: Droplets,
    title: "Enclosures and concrete pads",
    copy:
      "Targeted cleaning for the collection area around the container, including buildup, leaked bag residue, grime, and lingering odors.",
  },
  {
    icon: RefreshCw,
    title: "Recurring service schedules",
    copy:
      "Weekly, monthly, quarterly, seasonal, or custom route options based on the property and how quickly the gross stuff comes back.",
  },
  {
    icon: Camera,
    title: "Photos and service documentation",
    copy:
      "Clear completion updates can include service photos, areas addressed, service dates, and notes requiring property-management attention.",
  },
];

const quoteFactors = [
  "Number and type of bins or dumpsters",
  "Container size and current condition",
  "Enclosure or concrete-pad size",
  "Site access and service-hour restrictions",
  "Available exterior water access",
  "Wastewater-management requirements",
  "One-time or recurring service frequency",
  "Travel, route density, and property location",
];

const processSteps = [
  {
    title: "Tell us about the property",
    copy:
      "Send the location, container count, service needs, preferred frequency, access notes, and any photos that help explain the situation.",
  },
  {
    title: "We review the actual site",
    copy:
      "Straightforward properties may be quoted from clear photos and details. Larger or more complicated sites may need a walkthrough.",
  },
  {
    title: "You receive a written scope",
    copy:
      "We outline what will be cleaned, the proposed schedule, property responsibilities, and site-specific pricing before work begins.",
  },
  {
    title: "We clean and document",
    copy:
      "Once scheduled, we handle the approved service and provide the agreed-upon completion updates and documentation.",
  },
];

const documentationItems = [
  {
    icon: Camera,
    title: "Before-and-after photos",
    copy: "Visual confirmation of the areas included in the approved scope.",
  },
  {
    icon: Clock,
    title: "Service-date records",
    copy: "A clear record of when scheduled service was completed.",
  },
  {
    icon: ClipboardCheck,
    title: "Areas serviced",
    copy: "Documentation of the containers, pads, or enclosures addressed.",
  },
  {
    icon: FileText,
    title: "Property notes",
    copy:
      "Access problems, damaged containers, unsafe conditions, or other issues can be reported back to the designated contact.",
  },
];

const commercialFaqs = [
  {
    question: "Why is commercial pricing site-specific?",
    answer:
      "A two-bin office and a restaurant dumpster enclosure are not the same job. Pricing depends on container count, size, condition, access, service frequency, water availability, wastewater needs, and the total approved scope.",
  },
  {
    question: "Can you quote a property from photos?",
    answer:
      "Often, yes. Clear photos, container dimensions, counts, access details, and the property address may be enough for a preliminary or final quote. Larger or unusual sites may require a walkthrough.",
  },
  {
    question: "Do you offer recurring commercial service?",
    answer:
      "Yes. Recurring schedules are built around the property’s needs, collection schedule, route availability, and how frequently the service area needs attention.",
  },
  {
    question: "Can you clean every type of dumpster?",
    answer:
      "Not automatically. Dumpster size, design, contents, access, condition, and available equipment must be reviewed before we confirm that the container is within scope.",
  },
  {
    question: "Do you remove trash or haul waste?",
    answer:
      "No. Clean Curb Co. provides approved cleaning services. Containers must be emptied or otherwise ready for service unless the written scope specifically states something different.",
  },
  {
    question: "What materials are outside the normal scope?",
    answer:
      "We do not handle medical waste, hazardous chemicals, unknown substances, or other unsafe materials. Unsafe conditions may require service to be declined or postponed until the area is made suitable for cleaning.",
  },
];

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Commercial Bin, Dumpster, and Enclosure Cleaning",
    description:
      "Commercial bin, dumpster, trash enclosure, and concrete pad cleaning for HOAs, property managers, apartment communities, restaurants, offices, and local businesses in the Summerville area.",
    path: "/commercial",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommercialPage() {
  return (
    <main className="commercial-page">
      <section className="commercial-hero">
        <div className="container commercial-hero-grid">
          <div className="commercial-hero-copy">
            <p className="commercial-eyebrow">Commercial Cleaning</p>

            <h1>
              Your trash area is part of the property.
              <span> It should look managed.</span>
            </h1>

            <p className="commercial-hero-subtitle">
              Commercial bin, dumpster, enclosure, and pad cleaning for
              property managers, HOAs, apartment communities, restaurants,
              offices, and local businesses.
            </p>

            <div className="commercial-hero-actions">
              <Link
                className="button button-primary"
                href={commercialQuoteHref}
              >
                Request a Commercial Quote
                <ArrowRight size={19} aria-hidden="true" />
              </Link>

              <a className="button button-secondary" href="#commercial-services">
                See What We Clean
              </a>
            </div>

            <p className="commercial-hero-note">
              Site-specific pricing. Recurring routes. Completion documentation.
            </p>
          </div>

          <aside className="commercial-hero-card">
            <p className="commercial-card-kicker">
              Built around the property
            </p>

            <h2>No fake flat rate. No mystery scope.</h2>

            <p>
              We review the containers, cleaning area, access, frequency, and
              site requirements before confirming commercial pricing.
            </p>

            <ul>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                One-time and recurring options
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                Written service scope
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                Photo documentation available
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                Local, veteran-owned small business
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="commercial-trust-strip">
        <div className="container commercial-trust-grid">
          <span>
            <Route size={19} aria-hidden="true" />
            Route-based scheduling
          </span>
          <span>
            <ClipboardCheck size={19} aria-hidden="true" />
            Site-specific scopes
          </span>
          <span>
            <Camera size={19} aria-hidden="true" />
            Service documentation
          </span>
          <span>
            <MapPin size={19} aria-hidden="true" />
            Charleston-area service
          </span>
        </div>
      </section>

      <section className="commercial-section commercial-section-light">
        <div className="container">
          <div className="commercial-section-heading">
            <p className="section-kicker">Who we serve</p>
            <h2>
              Built for properties with more than one bin—and more than one
              person noticing.
            </h2>
            <p>
              Commercial service is not residential booking with a bigger bin
              count. The schedule, scope, communication, and documentation all
              need to fit the property.
            </p>
          </div>

          <div className="commercial-audience-grid">
            {customerTypes.map((customer) => {
              const Icon = customer.icon;

              return (
                <article
                  className="commercial-audience-card"
                  key={customer.title}
                >
                  <span className="commercial-icon-box">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <h3>{customer.title}</h3>
                  <p>{customer.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="commercial-section commercial-section-dark"
        id="commercial-services"
      >
        <div className="container">
          <div className="commercial-section-heading">
            <p className="section-kicker">Commercial services</p>
            <h2>The collection area gets gross. We deal with gross.</h2>
            <p>
              Every property is reviewed before service so the quote reflects
              the real containers, surfaces, access, and cleaning requirements.
            </p>
          </div>

          <div className="commercial-service-grid">
            {serviceOptions.map((service) => {
              const Icon = service.icon;

              return (
                <article
                  className="commercial-service-card"
                  key={service.title}
                >
                  <Icon size={26} aria-hidden="true" />
                  <h3>{service.title}</h3>
                  <p>{service.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="commercial-section commercial-scope-section"
        id="commercial-scope"
      >
        <div className="container commercial-scope-layout">
          <div className="commercial-scope-copy">
            <p className="section-kicker">Site-specific pricing</p>
            <h2>
              A restaurant enclosure and an HOA cart route are not the same
              job.
            </h2>
            <p>
              We are not going to throw a suspiciously convenient number on
              the website and hope the property looks exactly like the number
              imagined.
            </p>
            <p>
              Send us the real details. We will build the scope around the real
              property and explain the price before anything gets scheduled.
            </p>

            <Link
              className="button button-dark"
              href={commercialQuoteHref}
            >
              Start a Site Quote
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>

          <aside className="commercial-scope-card">
            <h3>What affects the quote?</h3>

            <ul className="commercial-scope-list">
              {quoteFactors.map((factor) => (
                <li key={factor}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {factor}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="commercial-section commercial-process-section">
        <div className="container">
          <div className="commercial-section-heading commercial-heading-centered">
            <p className="section-kicker">How commercial service works</p>
            <h2>Quote first. Clean second. Document the work.</h2>
            <p>
              Commercial requests are reviewed instead of being pushed through
              the residential instant-booking flow.
            </p>
          </div>

          <ol className="commercial-process-grid">
            {processSteps.map((step, index) => (
              <li className="commercial-process-card" key={step.title}>
                <span className="commercial-step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="commercial-section commercial-documentation-section">
        <div className="container commercial-documentation-layout">
          <div className="commercial-documentation-copy">
            <p className="section-kicker">Service documentation</p>
            <h2>Because “yeah, somebody cleaned it” is not a great record.</h2>
            <p>
              Property managers and commercial contacts need clear updates,
              especially when they are not standing beside the dumpster waiting
              for us. Fair. Nobody wants that assignment.
            </p>
          </div>

          <div className="commercial-documentation-grid">
            {documentationItems.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  className="commercial-documentation-card"
                  key={item.title}
                >
                  <Icon size={22} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="commercial-section commercial-area-section">
        <div className="container commercial-area-card">
          <div>
            <p className="section-kicker">Service area</p>
            <h2>Local routes. Real people. No national call-center maze.</h2>
            <p>
              Commercial requests are currently reviewed throughout{" "}
              {brand.area}. Properties outside the normal route may still be
              considered depending on project size and route feasibility.
            </p>
          </div>

          <div className="commercial-area-location">
            <MapPin size={26} aria-hidden="true" />
            <span>Based in the Summerville area</span>
          </div>
        </div>
      </section>

      <section className="commercial-section commercial-faq-section">
        <div className="container">
          <div className="commercial-section-heading">
            <p className="section-kicker">Commercial FAQ</p>
            <h2>The things property managers ask before sending us photos.</h2>
          </div>

          <div className="commercial-faq-list">
            {commercialFaqs.map((faq) => (
              <details className="commercial-faq-item" key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="commercial-final-section">
        <div className="container commercial-final-card">
          <div>
            <p className="commercial-card-kicker">Ready when the property is</p>
            <h2>Give us the ugly details. We have probably heard worse.</h2>
            <p>
              Send the property location, container count, photos, access
              information, and the service frequency you have in mind. We will
              review it and tell you what makes sense.
            </p>
          </div>

          <div className="commercial-final-actions">
            <Link
              className="button button-primary"
              href={commercialQuoteHref}
            >
              Request a Commercial Quote
              <ArrowRight size={19} aria-hidden="true" />
            </Link>

            <a className="commercial-phone-link" href={brand.phoneHref}>
              Or call {brand.phone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
