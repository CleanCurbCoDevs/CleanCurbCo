import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { defaultRouteForRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Employee Login",
  description:
    "Employee login for Clean Curb Co. field tools, route operations, and admin resources.",
};

export default async function EmployeeLoginPage() {
  const auth = await getCurrentProfile();

  if (auth.status === "ok") {
    redirect(defaultRouteForRole(auth.profile.role));
  }

  return (
    <main>
      <section className="employee-login-page">
        <div className="employee-login-shell">
          <section className="employee-login-card">
            <p className="section-kicker">Clean Curb Co.</p>
            <h1>Employee Login</h1>
            <p>
              Access Clean Curb Co. field tools, route operations, and admin
              resources.
            </p>
            <Suspense fallback={<p className="muted">Loading secure employee login...</p>}>
              <LoginForm buttonLabel="Sign In" nextPath="/field/today" />
            </Suspense>
            <div className="employee-login-links">
              <Link href="/">Back to Home</Link>
              <Link href="/login">Customer Login</Link>
              <Link href="/reset-password">Forgot Password</Link>
            </div>
          </section>
          <section className="employee-login-aside">
            <p className="section-kicker">Field Command</p>
            <h2>Built for service day.</h2>
            <p>
              Technicians land on today&apos;s route. Admins and owners land in
              the admin dashboard and can jump into field operations when
              needed.
            </p>
            <div className="mini-list">
              <span>Routes</span>
              <span>Photos</span>
              <span>Checklists</span>
              <span>Payments</span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
