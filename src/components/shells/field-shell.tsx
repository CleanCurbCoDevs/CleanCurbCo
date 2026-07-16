import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { FieldBottomNav } from "@/components/field-bottom-nav";
import { humanizeStatus } from "@/lib/booking-utils";
import {
  requireField,
  type AuthResult,
} from "@/lib/supabase/auth";
import { isAdminRole } from "@/lib/supabase/roles";

type FieldShellProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  auth?: AuthResult;
};

export async function FieldShell({
  title,
  subtitle,
  children,
  auth,
}: FieldShellProps) {
  const currentAuth = auth ?? (await requireField("/field/today"));

  if (currentAuth.status !== "ok") {
    return (
      <main className="field-app field-app-access">
        <section className="field-access-card">
          <p className="section-kicker">Clean Curb Co.</p>

          <h1>Field App Access</h1>

          <p>
            This area is reserved for Clean Curb Co. service team members.
          </p>

          <div className="field-actions">
            <Link className="button button-primary" href="/login">
              Employee Login
            </Link>

            <Link className="button button-outline" href="/portal">
              Customer Portal
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const canSeeAdminLinks = isAdminRole(currentAuth.profile.role);

  const technicianName =
    [
      currentAuth.profile.first_name,
      currentAuth.profile.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    currentAuth.email ||
    "Clean Curb Technician";

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="field-app">
      <div className="field-shell field-shell-v2">
        <header className="field-topbar">
          <div className="field-topbar-brand">
            <span className="field-brand-mark" aria-hidden="true">
              CCC
            </span>

            <div>
              <p>Clean Curb Co.</p>
              <strong>Field Operations</strong>
            </div>
          </div>

          <div className="field-topbar-actions">
            {canSeeAdminLinks ? (
            <Link
              className="field-admin-link"
              href="/admin"
              aria-label="Open admin dashboard"
            >
              <LayoutDashboard size={19} aria-hidden="true" />
              <span>Admin</span>
            </Link>
            ) : null}
          </div>
        </header>

        <section className="field-welcome-strip">
          <div>
            <p className="field-welcome-date">{today}</p>

            <h1>{title}</h1>

            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <div className="field-user-chip">
            <span>{technicianName}</span>

            <small>
              {humanizeStatus(currentAuth.profile.role)}
            </small>
          </div>
        </section>

        <div className="field-content">{children}</div>

        <FieldBottomNav />
      </div>
    </main>
  );
}