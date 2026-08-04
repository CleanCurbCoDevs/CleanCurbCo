import "server-only";

import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  requireAdmin,
  type AuthResult,
} from "@/lib/supabase/auth";
import type {
  BookingExceptionRow,
  BookingRow,
  ProfileRow,
} from "@/types/database";

export type BookingExceptionCounts = {
  open: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
  active: number;
};

export type AdminBookingExceptionsContext = {
  auth: AuthResult;
  activeExceptions: BookingExceptionRow[];
  historyExceptions: BookingExceptionRow[];
  bookings: BookingRow[];
  profiles: ProfileRow[];
  assignableProfiles: ProfileRow[];
  counts: BookingExceptionCounts;
  loadError: string | null;
};

/*
 * Active exceptions are never artificially limited. They are
 * the operational queue and must all remain visible.
 *
 * Closed history is intentionally bounded because it is
 * reference material rather than active work.
 */
export async function getAdminBookingExceptions(): Promise<AdminBookingExceptionsContext> {
  const auth = await requireAdmin(
    "/admin/exceptions",
  );

  const emptyContext: AdminBookingExceptionsContext = {
    auth,
    activeExceptions: [],
    historyExceptions: [],
    bookings: [],
    profiles: [],
    assignableProfiles: [],
    counts: {
      open: 0,
      acknowledged: 0,
      resolved: 0,
      dismissed: 0,
      active: 0,
    },
    loadError: null,
  };

  if (auth.status !== "ok") {
    return emptyContext;
  }

  const admin = getSupabaseAdmin();

  const [
    activeResult,
    historyResult,
    openCountResult,
    acknowledgedCountResult,
    resolvedCountResult,
    dismissedCountResult,
    assignableProfilesResult,
  ] = await Promise.all([
    admin
      .from("booking_exceptions")
      .select("*")
      .in("status", [
        "open",
        "acknowledged",
      ])
      .order("last_seen_at", {
        ascending: false,
      }),

    admin
      .from("booking_exceptions")
      .select("*")
      .in("status", [
        "resolved",
        "dismissed",
      ])
      .order("last_seen_at", {
        ascending: false,
      })
      .limit(250),

    admin
      .from("booking_exceptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "open"),

    admin
      .from("booking_exceptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "acknowledged"),

    admin
      .from("booking_exceptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "resolved"),

    admin
      .from("booking_exceptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "dismissed"),

    admin
      .from("profiles")
      .select("*")
      .in("role", [
        "owner",
        "admin",
      ])
      .order("first_name", {
        ascending: true,
      })
      .order("last_name", {
        ascending: true,
      }),
  ]);

  const loadErrors = [
    activeResult.error,
    historyResult.error,
    openCountResult.error,
    acknowledgedCountResult.error,
    resolvedCountResult.error,
    dismissedCountResult.error,
    assignableProfilesResult.error,
  ].filter(Boolean);

  if (loadErrors.length) {
    logger.error(
      "admin_booking_exceptions_load_failed",
      {
        action:
          "booking_exceptions_load",
        userId: auth.userId,
        role: auth.profile.role,
        error: loadErrors[0],
        metadata: {
          errorCount:
            loadErrors.length,
        },
      },
    );
  }

  const activeExceptions =
    activeResult.data ?? [];

  const historyExceptions =
    historyResult.data ?? [];

  const allExceptions = [
    ...activeExceptions,
    ...historyExceptions,
  ];

  const bookingIds = [
    ...new Set(
      allExceptions.map(
        (exception) =>
          exception.booking_id,
      ),
    ),
  ];

  const profileIds = [
    ...new Set(
      allExceptions.flatMap(
        (exception) => [
          exception.customer_id,
          exception.assigned_to_profile_id,
          exception.acknowledged_by_profile_id,
          exception.resolved_by_profile_id,
        ],
      ).filter(
        (value): value is string =>
          Boolean(value),
      ),
    ),
  ];

  let bookings: BookingRow[] = [];
  let profiles: ProfileRow[] = [];

  if (bookingIds.length) {
    const { data, error } = await admin
      .from("bookings")
      .select("*")
      .in("id", bookingIds);

    if (error) {
      logger.error(
        "admin_booking_exceptions_bookings_load_failed",
        {
          action:
            "booking_exceptions_load",
          userId: auth.userId,
          role: auth.profile.role,
          error,
          metadata: {
            bookingCount:
              bookingIds.length,
          },
        },
      );

      loadErrors.push(error);
    } else {
      bookings = data ?? [];
    }
  }

  if (profileIds.length) {
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .in("id", profileIds);

    if (error) {
      logger.error(
        "admin_booking_exceptions_profiles_load_failed",
        {
          action:
            "booking_exceptions_load",
          userId: auth.userId,
          role: auth.profile.role,
          error,
          metadata: {
            profileCount:
              profileIds.length,
          },
        },
      );

      loadErrors.push(error);
    } else {
      profiles = data ?? [];
    }
  }

  const open =
    openCountResult.count ?? 0;

  const acknowledged =
    acknowledgedCountResult.count ?? 0;

  return {
    auth,
    activeExceptions,
    historyExceptions,
    bookings,
    profiles,
    assignableProfiles:
      assignableProfilesResult.data ?? [],
    counts: {
      open,
      acknowledged,
      resolved:
        resolvedCountResult.count ?? 0,
      dismissed:
        dismissedCountResult.count ?? 0,
      active:
        open + acknowledged,
    },
    loadError: loadErrors.length
      ? "Some exception data could not be loaded. Refresh before making decisions."
      : null,
  };
}

/*
 * Lightweight exact count for the admin shell and dashboard.
 * This does not load exception records or widen getAdminContext.
 */
export async function getActiveBookingExceptionCount(): Promise<number> {
  const { count, error } =
    await getSupabaseAdmin()
      .from("booking_exceptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("status", [
        "open",
        "acknowledged",
      ]);

  if (error) {
    logger.error(
      "active_booking_exception_count_failed",
      {
        action:
          "booking_exception_count",
        error,
      },
    );

    return 0;
  }

  return count ?? 0;
}
