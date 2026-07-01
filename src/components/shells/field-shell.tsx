import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireField, type AuthResult } from "@/lib/supabase/auth";
import { isAdminRole } from "@/lib/supabase/roles";
import { humanizeStatus } from "@/lib/booking-utils";

const fieldLinks = [
  { label: "Today", href: "/field/today" },
  { label: "Routes", href: "/field/routes" },
  { label: "Breaks", href: "/field/breaks" },
  { label: "History", href: "/field/history" },
];

export async function FieldShell({
  title,
  children,
  auth,
}: {
  title: string;
  children?: React.ReactNode;
  auth?: AuthResult;
}) {
  const currentAuth = auth ?? (await requireField("/field/today"));

  if (currentAuth.status !== "ok") {
    return (
      <main className="field-app">
        <div className="field-shell">
          <section className="field-access-card">
            <p className="section-kicker">Clean Curb Co.</p>
            <h1>Field App Access</h1>
            <p>
              This area is for Clean Curb Co. service team members only.
            </p>
            <div className="field-actions">
              <Link className="button button-primary" href="/portal">
                Go to Customer Portal
              </Link>
              <LogoutButton />
            </div>
          </section>
        </div>
      </main>
    );
  }

  const canSeeAdminLinks = isAdminRole(currentAuth.profile.role);
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="field-app">
      <div className="field-shell">
        <header className="field-header">
          <div className="field-header-main">
            <div>
              <p className="section-kicker">Clean Curb Co.</p>
              <h1>Field Command</h1>
              <p>
                Route operations, service photos, checklists, and payments.
              </p>
            </div>
            <div className="field-header-meta">
              <span className={`status-badge status-${currentAuth.profile.role}`}>
                {humanizeStatus(currentAuth.profile.role)}
              </span>
              <span className="field-date-pill">{today}</span>
              <span className="field-online-pill">Online</span>
            </div>
          </div>
          <div className="field-header-actions">
            {canSeeAdminLinks ? (
              <>
                <Link className="button button-outline light" href="/admin">
                  Back to Admin
                </Link>
                <Link className="button button-outline light" href="/admin/routes">
                  Admin Routes
                </Link>
              </>
            ) : null}
            <LogoutButton />
          </div>
        </header>
        <section className="field-title-strip">
          <div>
            <p className="section-kicker">Current View</p>
            <h2>{title}</h2>
          </div>
        </section>
        <nav className="field-nav" aria-label="Field app navigation">
          {fieldLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
