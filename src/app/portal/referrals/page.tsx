import type { Metadata } from "next";
import { CopyButton } from "@/components/copy-button";
import { PortalShell } from "@/components/shells/portal-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getPortalContext } from "@/lib/portal-data";
import { ensureReferralCode } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Portal Referrals",
};

export default async function PortalReferralsPage() {
  const context = await getPortalContext("/portal/referrals");
  const referralCode =
    context.auth.status === "ok"
      ? await ensureReferralCode(context.auth.profile)
      : null;
  const referralPath = referralCode ? `/book?ref=${referralCode}` : "";

  return (
    <PortalShell title="Referral rewards" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Referrals</p>
        <h1>Neighbor routes get better with neighbors.</h1>
        <p className="muted">
          Give a neighbor your link. When they book and complete service, you
          can earn a service credit.
        </p>

        {referralCode ? (
          <div className="promo-strip referral-strip">
            <div>
              <p className="section-kicker">Your referral code</p>
              <h2>{referralCode}</h2>
              <p>{referralPath}</p>
            </div>
            <div className="action-row">
              <CopyButton value={referralCode} label="Copy Code" />
              <CopyButton value={referralPath} label="Copy Link" />
            </div>
          </div>
        ) : (
          <p>Referral codes are available after sign-in.</p>
        )}

        <section className="detail-panel">
          <h2>Referral status</h2>
          {context.referrals.length ? (
            <div className="data-table">
              {context.referrals.map((referral) => (
                <article className="data-row" key={referral.id}>
                  <div>
                    <strong>{referral.referred_email ?? "Neighbor booking"}</strong>
                    <span>{referral.referral_code ?? referralCode}</span>
                  </div>
                  <span className={`status-badge status-${referral.status}`}>
                    {humanizeStatus(referral.status)}
                  </span>
                  <span>
                    ${referral.reward_value ?? 5}{" "}
                    {referral.reward_type ?? "service_credit"}
                  </span>
                  <span>{formatDate(referral.created_at)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">
              No referral activity yet. Share the link, then watch this spot.
            </p>
          )}
        </section>
      </section>
    </PortalShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
