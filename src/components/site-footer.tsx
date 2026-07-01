import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/lib/site";

const footerLinks = [
  { label: "Book Now", href: "/book" },
  { label: "Pricing", href: "/pricing" },
  { label: "Services", href: "/services" },
  { label: "Service Area", href: "/service-area" },
  { label: "Contact", href: "/contact" },
  { label: "Careers", href: "/careers" },
  { label: "Employee Login", href: "/employee-login" },
  { label: "Customer Portal", href: "/portal" },
  { label: "FAQ", href: "/faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="grid">
            <BrandLogo />
            <p className="muted">
              Residential garbage bin cleaning, sanitizing, and deodorizing
              for neighbors who would rather not touch that bin.
            </p>
            <p className="muted">
              Locally owned | Veteran owned | Eco-conscious
              <br />
              Now building routes in {brand.area}
            </p>
            <p className="muted">
              <a className="contact-link" href={brand.phoneHref}>
                {brand.phone}
              </a>
              <br />
              <a className="contact-link" href={brand.emailHref}>
                {brand.email}
              </a>
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            {footerLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="footer-small">
          {brand.legalNote} Public-facing service is provided under the Clean
          Curb Co. brand.
        </p>
      </div>
    </footer>
  );
}
