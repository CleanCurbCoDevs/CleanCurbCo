import Link from "next/link";
import { CalendarCheck, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { America250PromoBanner } from "@/components/america250-promo-banner";
import { navItems } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <America250PromoBanner />

      <div className="container site-header-inner">
        <BrandLogo />

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}

          <Link className="button button-primary" href="/book">
            <CalendarCheck size={18} aria-hidden="true" />
            Book Now
          </Link>
        </nav>

        <div className="tablet-header-actions">
          <Link
            className="button button-primary tablet-book-button"
            href="/book"
          >
            <CalendarCheck size={18} aria-hidden="true" />
            Book Now
          </Link>

          <details className="mobile-menu">
            <summary>
              <Menu size={19} aria-hidden="true" />
              Menu
            </summary>

            <nav
              className="mobile-menu-panel"
              aria-label="Mobile navigation"
            >
              {navItems.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}

              <Link href="/book">Book Now</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
