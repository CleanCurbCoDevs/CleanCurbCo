import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/server/logger";
import type { AdminAuditLogRow, Database } from "@/types/database";

export type AuditStatus = AdminAuditLogRow["status"];

type AuditInput = Omit<
  Database["public"]["Tables"]["admin_audit_logs"]["Insert"],
  "created_at"
>;

export async function writeAdminAuditLog(input: AuditInput) {
  try {
    await getSupabaseAdmin().from("admin_audit_logs").insert(input);
  } catch (error) {
    logger.error("admin_audit_log_insert_failed", {
      requestId: input.request_id ?? undefined,
      action: input.action,
      userId: input.actor_user_id,
      role: input.actor_role,
      customerId: input.customer_id,
      bookingId: input.booking_id,
      error,
    });
  }
}
