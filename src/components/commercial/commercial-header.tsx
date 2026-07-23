import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Menu,
  Phone,
} from "lucide-react";
import { brand } from "@/lib/site";

const commercialNav = [
  {
    label: "Overview",
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
];

export function CommercialHeader() {
  return (
    <header className="commercial-site-header">
      <div className="commercial-utility-bar">
        <div className="container commercial-utility-inner">
          <span className="commercial-utility-message">
            <Building2 size={14} aria-hidden="true" />
            Property cleaning built around the actual site.
          </span>

          <div className="commercial-utility-actions">
            <a href={brand.phoneHref}>
              <Phone size={13} aria-hidden="true" />
              {brand.phone}
            </a>

            <Link href="/">
              Residential Services
            </Link>
          </div>
        </div>
      </div>

      <div className="commercial-header-main">
        <div className="container commercial-header-inner">
          <Link
            className="commercial-brand"
            href="/commercial"
            aria-label="Clean Curb Co. Commercial Services home"
          >
            <span
              className="commercial-brand-mark"
              aria-hidden="true"
            >
              <Image
                src="/clean-curb-logo.png"
                alt=""
                width={64}
                height={64}
                className="commercial-brand-image"
              />
            </span>

            <span className="commercial-brand-copy">
              <span className="commercial-brand-name">
                {brand.name}
              </span>

              <span className="commercial-brand-division">
                Commercial Services
              </span>
            </span>
          </Link>

          <nav
            className="commercial-desktop-nav"
            aria-label="Commercial navigation"
          >
            {commercialNav.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}

            <Link
              className="commercial-header-cta"
              href="/commercial/request-quote"
            >
              Request Site Quote
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </nav>

          <details className="commercial-mobile-menu">
            <summary>
              <Menu size={18} aria-hidden="true" />
              Menu
            </summary>

            <nav
              className="commercial-mobile-menu-panel"
              aria-label="Commercial mobile navigation"
            >
              {commercialNav.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}

              <Link
                className="commercial-mobile-quote-link"
                href="/commercial/request-quote"
              >
                Request Site Quote
                <ArrowRight size={16} aria-hidden="true" />
              </Link>

              <Link
                className="commercial-mobile-residential-link"
                href="/"
              >
                Residential Services
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
