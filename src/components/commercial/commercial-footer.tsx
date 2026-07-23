import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { brand } from "@/lib/site";

const commercialLinks = [
  {
    label: "Commercial Overview",
    href: "/commercial",
  },
  {
    label: "Services",
    href: "/commercial#commercial-services",
  },
  {
    label: "Quote Factors",
    href: "/commercial#commercial-scope",
  },
  {
    label: "Request Site Quote",
    href: "/commercial/request-quote",
  },
];

const companyLinks = [
  {
    label: "Residential Services",
    href: "/",
  },
  {
    label: "Contact Clean Curb Co.",
    href: "/contact",
  },
  {
    label: "Privacy",
    href: "/privacy",
  },
  {
    label: "Terms",
    href: "/terms",
  },
  {
    label: "Service Policy",
    href: "/service-policy",
  },
];

export function CommercialFooter() {
  return (
    <footer className="commercial-site-footer">
      <div className="commercial-footer-cta-band">
        <div className="container commercial-footer-cta-inner">
          <div>
            <p className="commercial-footer-kicker">
              Ready when the property is
            </p>

            <h2>
              The trash area is part of the property.
              Let&apos;s make it look managed.
            </h2>

            <p>
              Send us the property details. We will review
              the containers, access, frequency, and actual
              cleaning scope before confirming pricing.
            </p>
          </div>

          <div className="commercial-footer-cta-actions">
            <Link
              className="commercial-footer-primary-cta"
              href="/commercial/request-quote"
            >
              Request Site Quote
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <a
              className="commercial-footer-phone-cta"
              href={brand.phoneHref}
            >
              <Phone size={17} aria-hidden="true" />
              Call {brand.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="container commercial-footer-grid">
        <div className="commercial-footer-brand">
          <div className="commercial-footer-brand-heading">
            <span className="commercial-footer-brand-icon">
              <Building2 size={23} aria-hidden="true" />
            </span>

            <div>
              <strong>{brand.name}</strong>
              <span>Commercial Services</span>
            </div>
          </div>

          <p>
            Site-specific cleaning for qualifying bins,
            dumpsters, enclosures, concrete collection areas,
            HOA routes, and managed properties.
          </p>

          <p className="commercial-footer-positioning">
            Professional enough for the property file.
            Still willing to admit dumpsters are disgusting.
          </p>
        </div>

        <nav
          className="commercial-footer-column"
          aria-label="Commercial footer navigation"
        >
          <h2>Commercial</h2>

          <ul>
            {commercialLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="commercial-footer-column">
          <h2>Properties We Review</h2>

          <ul className="commercial-footer-property-list">
            <li>HOAs and communities</li>
            <li>Apartment properties</li>
            <li>Property-management portfolios</li>
            <li>Restaurants and food service</li>
            <li>Offices and local businesses</li>
          </ul>
        </div>

        <div className="commercial-footer-column">
          <h2>Company & Contact</h2>

          <ul>
            <li>
              <a href={brand.phoneHref}>
                <Phone size={15} aria-hidden="true" />
                {brand.phone}
              </a>
            </li>

            <li>
              <a href={brand.emailHref}>
                <Mail size={15} aria-hidden="true" />
                {brand.email}
              </a>
            </li>

            <li>
              <span className="commercial-footer-location">
                <MapPin size={15} aria-hidden="true" />
                Summerville-area routes
              </span>
            </li>

            {companyLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="commercial-footer-bottom">
        <div className="container commercial-footer-bottom-inner">
          <span>{brand.legalNote}</span>

          <span>
            Fresh Starts at the Curb.
            Commercial mess included.
          </span>
        </div>
      </div>
    </footer>
  );
}
