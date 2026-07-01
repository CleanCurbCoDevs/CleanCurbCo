import { getResendEnv } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { adminContactNotificationTemplate } from "@/lib/email/templates";
import type { ContactMessageRow } from "@/types/database";

export function sendAdminContactNotification(message: ContactMessageRow) {
  const template = adminContactNotificationTemplate(message);

  return sendTransactionalEmail({
    to: getResendEnv().adminEmails,
    ...template,
    replyTo: message.email,
    templateKey: "admin_contact_notification",
    idempotencyKey: `admin-contact-${message.id}`,
  });
}
