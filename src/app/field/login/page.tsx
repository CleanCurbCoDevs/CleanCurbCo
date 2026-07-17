import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { isFieldRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Employee Login | CCC Field",
  description:
    "Secure employee login for Clean Curb Co. field operations.",

  applicationName: "CCC Field",
  manifest: "/field/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "CCC Field",
    statusBarStyle: "black-translucent",
  },

  icons: {
    icon: [
      {
        url: "/ccc-field-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/ccc-field-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/ccc-field-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default async function FieldLoginPage() {
  const auth = await getCurrentProfile();

  if (auth.status === "ok" && isFieldRole(auth.profile.role)) {
    redirect("/field/today");
  }

  return (
    <main className="field-app field-app-access">
      <section className="field-access-card">
        <div className="field-login-brand">
          <span className="field-brand-mark" aria-hidden="true">
            CCC
          </span>

          <div>
            <p>Clean Curb Co.</p>
            <strong>Field Operations</strong>
          </div>
        </div>

        <p className="section-kicker">Authorized Personnel</p>

        <h1>Employee Login</h1>

        <p>
          Sign in to access today&apos;s route, service stops, photos,
          checklists, and field operations.
        </p>

        {auth.status === "ok" && !isFieldRole(auth.profile.role) ? (
          <div className="confirmation-panel" role="alert">
            <strong>Field access unavailable.</strong>

            <p>
              This account is not authorized to use the Clean Curb Co.
              Field App.
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <p className="muted">Loading secure employee login...</p>
            }
          >
            <LoginForm
              buttonLabel="Enter Field App"
              nextPath="/field/today"
              showForgotPassword={false}
            />
          </Suspense>
        )}

        <p className="field-login-help">
          Need help accessing your account? Contact a Clean Curb Co.
          administrator.
        </p>
      </section>
    </main>
  );
}
