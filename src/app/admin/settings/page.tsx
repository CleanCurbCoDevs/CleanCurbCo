import type { Metadata } from "next";
import { AdminShell } from "@/components/shells/admin-shell";
import { getAdminContext } from "@/lib/admin-data";
import { getResendEnv, isResendConfigured, isSupabaseConfigured } from "@/lib/env";
import { pricingConfig } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin Settings",
};

export default async function AdminSettingsPage() {
  const context = await getAdminContext("/admin/settings");
  const resendEnv = getResendEnv();

  return (
    <AdminShell title="Settings and pricing" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Settings</p>
        <h1>Launch configuration.</h1>
        <div className="grid grid-3">
          <article className="card">
            <h3>Supabase</h3>
            <p>{isSupabaseConfigured() ? "Configured" : "Needs env vars"}</p>
          </article>
          <article className="card">
            <h3>Resend</h3>
            <p>{isResendConfigured() ? "Configured" : "Needs env vars"}</p>
          </article>
          <article className="card">
            <h3>Admin recipients</h3>
            <p>{resendEnv.adminEmails.join(", ")}</p>
          </article>
          <article className="card">
            <h3>Founding Neighbor Special</h3>
            <p>
              {pricingConfig.foundingNeighborSpecialEnabled ? "Enabled" : "Disabled"}
              <br />$
              {pricingConfig.foundingNeighborRecurringTwoBinFirstCleanPrice} first
              2-bin recurring clean
              <br />
              {pricingConfig.foundingNeighborRouteLabel} before July 13, 2026
            </p>
          </article>
        </div>
      </section>
    </AdminShell>
  );
}
