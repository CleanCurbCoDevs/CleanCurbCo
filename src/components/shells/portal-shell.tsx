import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PlaceholderPanel } from "@/components/placeholder-page";
import { portalFeatures } from "@/lib/site";
import { requireAuth, type AuthResult } from "@/lib/supabase/auth";

const portalLinks = [
  { label: "Dashboard", href: "/portal" },
  { label: "Bookings", href: "/portal/bookings" },
  { label: "Manage Service", href: "/portal/manage-service" },
  { label: "Billing", href: "/portal/billing" },
  { label: "Photos", href: "/portal/photos" },
  { label: "Referrals", href: "/portal/referrals" },
  { label: "Account", href: "/portal/account" },
];

export async function PortalShell({
  title,
  children,
  auth,
}: {
  title: string;
  children?: React.ReactNode;
  auth?: AuthResult;
}) {
  const currentAuth = auth ?? (await requireAuth("/portal"));

  if (currentAuth.status === "unconfigured") {
    return (
      <main className="section section-cream">
        <div className="container">
          <PlaceholderPanel
            title="Customer portal"
            features={portalFeatures.slice(0, 5)}
            ctaHref="/book"
            ctaLabel="Book a Cleaning"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="section section-cream">
      <div className="container shell-layout">
        <div className="shell-topbar">
          <nav className="shell-nav" aria-label="Customer portal navigation">
            {portalLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
        {children ?? (
          <PlaceholderPanel
            title={title}
            features={portalFeatures.slice(0, 6)}
            ctaHref="/book"
            ctaLabel="Book a Cleaning"
          />
        )}
      </div>
    </main>
  );
}
