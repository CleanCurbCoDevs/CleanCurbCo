import "server-only";

import { getResendEnv, getSiteUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  adminCareerApplicationTemplate,
  careerApplicationConfirmationTemplate,
} from "@/lib/email/templates";
import type { CareerApplicationRow } from "@/types/database";

export async function sendCareerApplicationEmails(
  application: CareerApplicationRow,
) {
  const confirmation = careerApplicationConfirmationTemplate(application);
  const adminTemplate = adminCareerApplicationTemplate(
    application,
    `${getSiteUrl()}/admin/careers`,
  );
  const { adminEmails } = getResendEnv();

  await Promise.allSettled([
    sendTransactionalEmail({
      to: application.email,
      ...confirmation,
      templateKey: "career_application_confirmation",
      idempotencyKey: `career-confirmation-${application.id}`,
    }),
    sendTransactionalEmail({
      to: adminEmails,
      ...adminTemplate,
      replyTo: application.email,
      templateKey: "admin_career_application",
      idempotencyKey: `admin-career-${application.id}`,
    }),
  ]);
}
