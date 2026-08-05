import "server-only";

import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  requireField,
  type AuthResult,
} from "@/lib/supabase/auth";

import {
  isAdminRole,
} from "@/lib/supabase/roles";

import type {
  BookingRow,
  PaymentRow,
  ProfileRow,
  RouteBreakRow,
  RouteDayRow,
  RouteStopRow,
  ServiceAddressRow,
  ServiceChecklistRow,
  ServicePhotoRow,
  ServiceVisitRow,
} from "@/types/database";

export type FieldContext = {
  auth: AuthResult;
  routeDays: RouteDayRow[];
  routeStops: RouteStopRow[];
  bookings: BookingRow[];
  visits: ServiceVisitRow[];
  addresses: ServiceAddressRow[];
  checklists: ServiceChecklistRow[];
  photos: ServicePhotoRow[];
  breaks: RouteBreakRow[];
  payments: PaymentRow[];
  profiles: ProfileRow[];
};

function emptyFieldContext(
  auth: AuthResult,
): FieldContext {
  return {
    auth,
    routeDays: [],
    routeStops: [],
    bookings: [],
    visits: [],
    addresses: [],
    checklists: [],
    photos: [],
    breaks: [],
    payments: [],
    profiles: [],
  };
}

function uniqueIds(
  values: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          Boolean(value),
      ),
    ),
  );
}

function dedupeById<
  Row extends {
    id: string;
  },
>(
  groups: Array<
    Row[] | null | undefined
  >,
) {
  const rows =
    new Map<string, Row>();

  groups
    .flatMap(
      (group) => group ?? [],
    )
    .forEach((row) => {
      rows.set(row.id, row);
    });

  return Array.from(
    rows.values(),
  );
}

function logFieldLoadError(
  name: string,
  error: unknown,
  userId: string,
) {
  if (!error) {
    return;
  }

  logger.error(
    "field_context_query_failed",
    {
      action:
        "field_context_load",
      userId,
      error,
      metadata: {
        query: name,
      },
    },
  );
}

export function businessToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value ?? "2026";

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value ?? "01";

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export async function getFieldContext(
  nextPath = "/field/today",
): Promise<FieldContext> {
  const auth =
    await requireField(nextPath);

  if (auth.status !== "ok") {
    return emptyFieldContext(auth);
  }

  const admin =
    getSupabaseAdmin();

  if (
    isAdminRole(
      auth.profile.role,
    )
  ) {
    const [
      routeDaysResult,
      routeStopsResult,
      bookingsResult,
      visitsResult,
      addressesResult,
      checklistsResult,
      photosResult,
      breaksResult,
      paymentsResult,
      profilesResult,
    ] = await Promise.all([
      admin
        .from("route_days")
        .select("*")
        .order(
          "route_date",
          {
            ascending: false,
          },
        ),

      admin
        .from("route_stops")
        .select("*")
        .order(
          "stop_order",
          {
            ascending: true,
          },
        ),

      admin
        .from("bookings")
        .select("*")
        .order(
          "confirmed_route_day",
          {
            ascending: true,
          },
        ),

      admin
        .from("service_visits")
        .select("*")
        .order(
          "route_day",
          {
            ascending: true,
          },
        ),

      admin
        .from(
          "service_addresses",
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          },
        ),

      admin
        .from(
          "service_checklists",
        )
        .select("*")
        .order(
          "updated_at",
          {
            ascending: false,
          },
        ),

      admin
        .from("service_photos")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          },
        ),

      admin
        .from("route_breaks")
        .select("*")
        .order(
          "started_at",
          {
            ascending: false,
          },
        ),

      admin
        .from("payments")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          },
        ),

      admin
        .from("profiles")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          },
        ),
    ]);

    return {
      auth,
      routeDays:
        routeDaysResult.data ??
        [],
      routeStops:
        routeStopsResult.data ??
        [],
      bookings:
        bookingsResult.data ??
        [],
      visits:
        visitsResult.data ??
        [],
      addresses:
        addressesResult.data ??
        [],
      checklists:
        checklistsResult.data ??
        [],
      photos:
        photosResult.data ??
        [],
      breaks:
        breaksResult.data ??
        [],
      payments:
        paymentsResult.data ??
        [],
      profiles:
        profilesResult.data ??
        [],
    };
  }

  const [
    routeDaysResult,
    breaksResult,
    profileResult,
  ] = await Promise.all([
    admin
      .from("route_days")
      .select("*")
      .eq(
        "assigned_technician_id",
        auth.userId,
      )
      .order(
        "route_date",
        {
          ascending: false,
        },
      ),

    admin
      .from("route_breaks")
      .select("*")
      .eq(
        "technician_id",
        auth.userId,
      )
      .order(
        "started_at",
        {
          ascending: false,
        },
      ),

    admin
      .from("profiles")
      .select("*")
      .eq("id", auth.userId)
      .maybeSingle(),
  ]);

  logFieldLoadError(
    "route_days",
    routeDaysResult.error,
    auth.userId,
  );

  logFieldLoadError(
    "route_breaks",
    breaksResult.error,
    auth.userId,
  );

  logFieldLoadError(
    "profile",
    profileResult.error,
    auth.userId,
  );

  const routeDays =
    routeDaysResult.data ?? [];

  const routeDayIds =
    uniqueIds(
      routeDays.map(
        (routeDay) =>
          routeDay.id,
      ),
    );

  const routeStopsResult =
    routeDayIds.length
      ? await admin
          .from("route_stops")
          .select("*")
          .in(
            "route_day_id",
            routeDayIds,
          )
          .order(
            "stop_order",
            {
              ascending: true,
            },
          )
      : {
          data:
            [] as RouteStopRow[],
          error: null,
        };

  logFieldLoadError(
    "route_stops",
    routeStopsResult.error,
    auth.userId,
  );

  const routeStops =
    routeStopsResult.data ?? [];

  const routeStopIds =
    uniqueIds(
      routeStops.map(
        (stop) => stop.id,
      ),
    );

  const visitIds =
    uniqueIds(
      routeStops.map(
        (stop) =>
          stop.service_visit_id,
      ),
    );

  const visitsResult =
    visitIds.length
      ? await admin
          .from(
            "service_visits",
          )
          .select("*")
          .in("id", visitIds)
          .order(
            "route_day",
            {
              ascending: true,
            },
          )
      : {
          data:
            [] as ServiceVisitRow[],
          error: null,
        };

  logFieldLoadError(
    "service_visits",
    visitsResult.error,
    auth.userId,
  );

  const visits =
    visitsResult.data ?? [];

  const bookingIds =
    uniqueIds([
      ...routeStops.map(
        (stop) =>
          stop.booking_id,
      ),
      ...visits.map(
        (visit) =>
          visit.booking_id,
      ),
    ]);

  const bookingsResult =
    bookingIds.length
      ? await admin
          .from("bookings")
          .select("*")
          .in("id", bookingIds)
          .order(
            "confirmed_route_day",
            {
              ascending: true,
            },
          )
      : {
          data:
            [] as BookingRow[],
          error: null,
        };

  logFieldLoadError(
    "bookings",
    bookingsResult.error,
    auth.userId,
  );

  const bookings =
    bookingsResult.data ?? [];

  const customerIds =
    uniqueIds(
      bookings.map(
        (booking) =>
          booking.customer_id,
      ),
    );

  const addressesResult =
    customerIds.length
      ? await admin
          .from(
            "service_addresses",
          )
          .select("*")
          .in(
            "customer_id",
            customerIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as ServiceAddressRow[],
          error: null,
        };

  const checklistsByStop =
    routeStopIds.length
      ? await admin
          .from(
            "service_checklists",
          )
          .select("*")
          .in(
            "route_stop_id",
            routeStopIds,
          )
          .order(
            "updated_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as ServiceChecklistRow[],
          error: null,
        };

  const checklistsByVisit =
    visitIds.length
      ? await admin
          .from(
            "service_checklists",
          )
          .select("*")
          .in(
            "service_visit_id",
            visitIds,
          )
          .order(
            "updated_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as ServiceChecklistRow[],
          error: null,
        };

  const photosByStop =
    routeStopIds.length
      ? await admin
          .from("service_photos")
          .select("*")
          .in(
            "route_stop_id",
            routeStopIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as ServicePhotoRow[],
          error: null,
        };

  const photosByVisit =
    visitIds.length
      ? await admin
          .from("service_photos")
          .select("*")
          .in(
            "service_visit_id",
            visitIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as ServicePhotoRow[],
          error: null,
        };

  const paymentsByBooking =
    bookingIds.length
      ? await admin
          .from("payments")
          .select("*")
          .in(
            "booking_id",
            bookingIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as PaymentRow[],
          error: null,
        };

  const paymentsByVisit =
    visitIds.length
      ? await admin
          .from("payments")
          .select("*")
          .in(
            "service_visit_id",
            visitIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
      : {
          data:
            [] as PaymentRow[],
          error: null,
        };

  [
    [
      "service_addresses",
      addressesResult.error,
    ],
    [
      "checklists_by_stop",
      checklistsByStop.error,
    ],
    [
      "checklists_by_visit",
      checklistsByVisit.error,
    ],
    [
      "photos_by_stop",
      photosByStop.error,
    ],
    [
      "photos_by_visit",
      photosByVisit.error,
    ],
    [
      "payments_by_booking",
      paymentsByBooking.error,
    ],
    [
      "payments_by_visit",
      paymentsByVisit.error,
    ],
  ].forEach(
    ([name, error]) => {
      logFieldLoadError(
        String(name),
        error,
        auth.userId,
      );
    },
  );

  return {
    auth,
    routeDays,
    routeStops,
    bookings,
    visits,
    addresses:
      addressesResult.data ??
      [],
    checklists:
      dedupeById<
        ServiceChecklistRow
      >([
        checklistsByStop.data,
        checklistsByVisit.data,
      ]),
    photos:
      dedupeById<
        ServicePhotoRow
      >([
        photosByStop.data,
        photosByVisit.data,
      ]),
    breaks:
      breaksResult.data ??
      [],
    payments:
      dedupeById<
        PaymentRow
      >([
        paymentsByBooking.data,
        paymentsByVisit.data,
      ]),
    profiles:
      profileResult.data
        ? [
            profileResult.data,
          ]
        : [],
  };
}
