import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/lib/site";

const footerGroups = [
  {
    title: "Service",
    links: [
      { label: "Book Now", href: "/book" },
      { label: "Pricing", href: "/pricing" },
      { label: "Services", href: "/services" },
      { label: "Service Area", href: "/service-area" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Account",
      links: [
        { label: "Customer Portal", href: "/portal" },
        { label: "Careers", href: "/careers" },
      ],
  },
  {
    title: "Contact / Legal",
    links: [
      { label: brand.phone, href: brand.phoneHref },
      { label: brand.email, href: brand.emailHref },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Service Policy", href: "/service-policy" },
      { label: "Payment Policy", href: "/payment-policy" },
      { label: "Cancellation & Refunds", href: "/cancellation-refund-policy" },
      {
        label: "Cookie Settings & Analytics",
        href: "/cookie-analytics-policy#cookie-settings",
      },
      { label: "Security", href: "/vulnerability-disclosure" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <BrandLogo />
            <p className="muted">
              Locally owned, veteran-owned curbside cleaning and outdoor grime cleanup
              for Summerville-area communities.
            </p>
          </div>
          {footerGroups.map((group) => (
            <nav
              className="footer-column"
              aria-label={`${group.title} footer links`}
              key={group.title}
            >
              <h2>{group.title}</h2>
              <ul className="footer-links">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="footer-small footer-meta-links">
          <span>{brand.legalNote}</span>
          <Link href="/employee-login">Team login</Link>
        </div>
      </div>
    </footer>
  );
}
