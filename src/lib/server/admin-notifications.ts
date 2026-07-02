import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/types/database";

type AdminNotificationInsert =
  Database["public"]["Tables"]["admin_notifications"]["Insert"];

export async function createAdminNotification(input: AdminNotificationInsert) {
  try {
    await getSupabaseAdmin().from("admin_notifications").insert(input);
  } catch (error) {
    logger.error("admin_notification_insert_failed", {
      action: input.type,
      customerId: input.customer_id,
      bookingId: input.booking_id,
      error,
    });
  }
}
