import Link from "next/link";
import { CalendarCheck, HelpCircle, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { publicPageMetadata } from "@/lib/seo";
import { brand } from "@/lib/site";
import { LaunchStatusCard } from "@/components/launch-status-card";

export const metadata = publicPageMetadata({
  title: "Contact",
  description:
    "Contact Clean Curb Co. for garbage bin cleaning in Cane Bay and nearby Summerville communities.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Contact</p>
          <h1>Questions, route requests, or waitlist notes?</h1>
          <p>
            Send a note and we will follow up. The company that communicates
            has to start somewhere.
          </p>
        </div>
      </section>
      <section className="section section-cream contact-section">
        <div className="container contact-choice-grid">
          <article className="contact-choice-card">
            <CalendarCheck size={24} aria-hidden="true" />
            <p className="section-kicker">Need service?</p>
            <h2>Book first. We will confirm the details.</h2>
            <p>
              Ready to get on a route? Booking is the fastest way to send your
              address, bin count, add-ons, and service preferences.
            </p>
            <Link className="button button-primary" href="/book">
              Book Cleaning
            </Link>
          </article>

          <article className="contact-choice-card">
            <MapPin size={24} aria-hidden="true" />
            <p className="section-kicker">Route / waitlist question?</p>
            <h2>Not sure whether you fit the route?</h2>
            <p>
              Send your neighborhood, general location, and what you need cleaned.
              We will let you know whether it fits the current route plan.
            </p>
            <a className="button button-secondary" href={brand.emailHref}>
              Email Us
            </a>
          </article>

          <article className="contact-choice-card">
            <HelpCircle size={24} aria-hidden="true" />
            <p className="section-kicker">Need help?</p>
            <h2>Questions, weird bin situation, or support?</h2>
            <p>
              Use the form below for service questions, account help, special
              cleanup notes, or anything that does not fit neatly in the booking form.
            </p>
            <a className="button button-dark" href="#contact-form">
              Send a Note
            </a>
          </article>
        </div>

        <div className="container contact-card-grid">
          <article className="card contact-info-card">
            <Phone size={24} aria-hidden="true" />
            <h3>Phone</h3>
            <p>
              <a className="contact-link" href={brand.phoneHref}>
                {brand.phone}
              </a>
            </p>
          </article>
          <article className="card contact-info-card">
            <Mail size={24} aria-hidden="true" />
            <h3>Email</h3>
            <p>
              <a className="contact-link" href={brand.emailHref}>
                {brand.email}
              </a>
            </p>
          </article>
          <article className="card contact-info-card">
            <MapPin size={24} aria-hidden="true" />
            <h3>Route</h3>
            <p>{brand.area}</p>
          </article>
        </div>
        <div className="container contact-body-grid">
          <LaunchStatusCard
            variant="card"
            className="launch-info-card contact-launch-note"
            showButton
          />
          <div className="contact-form-wrap" id="contact-form">
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
