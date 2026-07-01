import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin, type AuthResult } from "@/lib/supabase/auth";

const adminLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Routes", href: "/admin/routes" },
  { label: "Checklists", href: "/admin/checklists" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Requests", href: "/admin/requests" },
  { label: "Referrals", href: "/admin/referrals" },
  { label: "Careers", href: "/admin/careers" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Settings", href: "/admin/settings" },
];

export async function AdminShell({
  title,
  children,
  auth,
}: {
  title: string;
  children?: React.ReactNode;
  auth?: AuthResult;
}) {
  const currentAuth = auth ?? (await requireAdmin("/admin"));

  if (currentAuth.status !== "ok") {
    return (
      <main className="section section-cream">
        <div className="container shell-layout">
          <section className="placeholder-panel">
            <p className="section-kicker">Protected Area</p>
            <h1>{title}</h1>
            <p>{currentAuth.message}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="section section-cream">
      <div className="container shell-layout">
        <div className="shell-topbar">
          <nav className="shell-nav" aria-label="Admin navigation">
            {adminLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
        {children ?? (
          <section className="placeholder-panel">
            <p className="section-kicker">Protected Area</p>
            <h1>{title}</h1>
            <p>
              Admin tools are available after sign-in.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
