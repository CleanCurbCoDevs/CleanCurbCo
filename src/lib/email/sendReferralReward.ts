import { sendTransactionalEmail } from "@/lib/email/resend";
import { referralRewardTemplate } from "@/lib/email/templates";
import type { ProfileRow, ReferralRow } from "@/types/database";

export function sendReferralRewardEmail(
  referral: ReferralRow,
  referrer: ProfileRow,
  mode: "ready" | "sent",
) {
  if (!referrer.email) {
    return Promise.resolve({ status: "skipped" as const, reason: "No email." });
  }

  const template = referralRewardTemplate(referral, mode);

  return sendTransactionalEmail({
    to: referrer.email,
    ...template,
    templateKey: mode === "ready" ? "referral_reward_ready" : "referral_reward_sent",
    idempotencyKey: `referral-reward-${mode}-${referral.id}-${referral.status}`,
  });
}
