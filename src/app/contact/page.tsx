import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { brand, launchNotice, launchReservationCopy } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Clean Curb Co. for garbage bin cleaning in Cane Bay and nearby Summerville communities.",
};

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
          <aside className="launch-info-card contact-launch-note">
            <p className="section-kicker">Launch timing</p>
            <h2>{launchNotice}</h2>
            <p>{launchReservationCopy}</p>
            <Link className="button button-dark" href="/book">
              Book Now
            </Link>
          </aside>
          <div className="contact-form-wrap">
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
