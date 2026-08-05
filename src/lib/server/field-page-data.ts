import "server-only";

import {
  businessToday,
  type FieldContext,
} from "@/lib/field-data";

import {
  getAuthorizedFieldStopBundle,
} from "@/lib/server/field-access";

import {
  logger,
} from "@/lib/server/logger";

import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

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
  ServicePhotoRow,
  ServiceVisitRow,
} from "@/types/database";

const ROUTE_LOOKAHEAD_LIMIT =
  60;

const RECENT_BREAK_LIMIT =
  100;

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
        (
          value,
        ): value is string =>
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
      (group) =>
        group ?? [],
    )
    .forEach((row) => {
      rows.set(
        row.id,
        row,
      );
    });

  return Array.from(
    rows.values(),
  );
}

function logLoadError(
  page: string,
  query: string,
  userId: string,
  error: unknown,
) {
  if (!error) {
    return;
  }

  logger.error(
    "field_page_query_failed",
    {
      action:
        "field_page_load",

      userId,

      error,

      metadata: {
        page,
        query,
      },
    },
  );
}

export async function getFieldTodayContext(
  nextPath =
    "/field/today",
): Promise<FieldContext> {
  const auth =
    await requireField(
      nextPath,
    );

  if (
    auth.status !==
    "ok"
  ) {
    return emptyFieldContext(
      auth,
    );
  }

  const admin =
    getSupabaseAdmin();

  const today =
    businessToday();

  let routeDaysQuery =
    admin
      .from(
        "route_days",
      )
      .select("*")
      .eq(
        "route_date",
        today,
      )
      .neq(
        "status",
        "cancelled",
      )
      .order(
        "route_date",
        {
          ascending:
            true,
        },
      )
      .limit(10);

  if (
    !isAdminRole(
      auth.profile.role,
    )
  ) {
    routeDaysQuery =
      routeDaysQuery.eq(
        "assigned_technician_id",
        auth.userId,
      );
  }

  const routeDaysResult =
    await routeDaysQuery;

  logLoadError(
    "today",
    "route_days",
    auth.userId,
    routeDaysResult.error,
  );

  const routeDays =
    routeDaysResult.data ??
    [];

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
          .from(
            "route_stops",
          )
          .select("*")
          .in(
            "route_day_id",
            routeDayIds,
          )
          .neq(
            "status",
            "cancelled",
          )
          .order(
            "stop_order",
            {
              ascending:
                true,
            },
          )
      : {
          data:
            [] as RouteStopRow[],

          error:
            null,
        };

  logLoadError(
    "today",
    "route_stops",
    auth.userId,
    routeStopsResult.error,
  );

  const routeStops =
    routeStopsResult.data ??
    [];

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
          .in(
            "id",
            visitIds,
          )
      : {
          data:
            [] as ServiceVisitRow[],

          error:
            null,
        };

  logLoadError(
    "today",
    "service_visits",
    auth.userId,
    visitsResult.error,
  );

  const visits =
    visitsResult.data ??
    [];

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
          .from(
            "bookings",
          )
          .select("*")
          .in(
            "id",
            bookingIds,
          )
      : {
          data:
            [] as BookingRow[],

          error:
            null,
        };

  logLoadError(
    "today",
    "bookings",
    auth.userId,
    bookingsResult.error,
  );

  const bookings =
    bookingsResult.data ??
    [];

  const serviceAddressIds =
    uniqueIds(
      bookings.map(
        (booking) =>
          booking
            .service_address_id,
      ),
    );

  const customerIds =
    uniqueIds(
      bookings.map(
        (booking) =>
          booking.customer_id,
      ),
    );

  const [
    addressesByIdResult,
    primaryAddressesResult,
    paymentsByBookingResult,
    paymentsByVisitResult,
  ] = await Promise.all([
    serviceAddressIds.length
      ? admin
          .from(
            "service_addresses",
          )
          .select("*")
          .in(
            "id",
            serviceAddressIds,
          )
      : Promise.resolve({
          data:
            [] as ServiceAddressRow[],

          error:
            null,
        }),

    customerIds.length
      ? admin
          .from(
            "service_addresses",
          )
          .select("*")
          .in(
            "customer_id",
            customerIds,
          )
          .eq(
            "is_primary",
            true,
          )
      : Promise.resolve({
          data:
            [] as ServiceAddressRow[],

          error:
            null,
        }),

    bookingIds.length
      ? admin
          .from(
            "payments",
          )
          .select("*")
          .in(
            "booking_id",
            bookingIds,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
      : Promise.resolve({
          data:
            [] as PaymentRow[],

          error:
            null,
        }),

    visitIds.length
      ? admin
          .from(
            "payments",
          )
          .select("*")
          .in(
            "service_visit_id",
            visitIds,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
      : Promise.resolve({
          data:
            [] as PaymentRow[],

          error:
            null,
        }),
  ]);

  [
    [
      "addresses_by_id",
      addressesByIdResult
        .error,
    ],

    [
      "primary_addresses",
      primaryAddressesResult
        .error,
    ],

    [
      "payments_by_booking",
      paymentsByBookingResult
        .error,
    ],

    [
      "payments_by_visit",
      paymentsByVisitResult
        .error,
    ],
  ].forEach(
    (
      [
        query,
        error,
      ],
    ) => {
      logLoadError(
        "today",
        String(query),
        auth.userId,
        error,
      );
    },
  );

  const addresses =
    dedupeById<
      ServiceAddressRow
    >([
      addressesByIdResult
        .data,

      primaryAddressesResult
        .data,
    ]);

  const payments =
    dedupeById<
      PaymentRow
    >([
      paymentsByBookingResult
        .data,

      paymentsByVisitResult
        .data,
    ]).sort(
      (
        left,
        right,
      ) =>
        right.created_at
          .localeCompare(
            left.created_at,
          ),
    );

  return {
    ...emptyFieldContext(
      auth,
    ),

    routeDays,
    routeStops,
    bookings,
    visits,
    addresses,
    payments,
  };
}

export async function getFieldRoutesContext(
  nextPath =
    "/field/routes",
): Promise<FieldContext> {
  const auth =
    await requireField(
      nextPath,
    );

  if (
    auth.status !==
    "ok"
  ) {
    return emptyFieldContext(
      auth,
    );
  }

  const admin =
    getSupabaseAdmin();

  const today =
    businessToday();

  let currentRoutesQuery =
    admin
      .from(
        "route_days",
      )
      .select("*")
      .gte(
        "route_date",
        today,
      )
      .neq(
        "status",
        "cancelled",
      )
      .order(
        "route_date",
        {
          ascending:
            true,
        },
      )
      .limit(
        ROUTE_LOOKAHEAD_LIMIT,
      );

  let completedRoutesQuery =
    admin
      .from(
        "route_days",
      )
      .select("*")
      .or(
        `route_date.lt.${today},status.eq.completed`,
      )
      .neq(
        "status",
        "cancelled",
      )
      .order(
        "route_date",
        {
          ascending:
            false,
        },
      )
      .limit(6);

  if (
    !isAdminRole(
      auth.profile.role,
    )
  ) {
    currentRoutesQuery =
      currentRoutesQuery.eq(
        "assigned_technician_id",
        auth.userId,
      );

    completedRoutesQuery =
      completedRoutesQuery.eq(
        "assigned_technician_id",
        auth.userId,
      );
  }

  const [
    currentRoutesResult,
    completedRoutesResult,
  ] = await Promise.all([
    currentRoutesQuery,
    completedRoutesQuery,
  ]);

  logLoadError(
    "routes",
    "current_routes",
    auth.userId,
    currentRoutesResult.error,
  );

  logLoadError(
    "routes",
    "completed_routes",
    auth.userId,
    completedRoutesResult.error,
  );

  const routeDays =
    dedupeById<
      RouteDayRow
    >([
      currentRoutesResult
        .data,

      completedRoutesResult
        .data,
    ]);

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
          .from(
            "route_stops",
          )
          .select("*")
          .in(
            "route_day_id",
            routeDayIds,
          )
          .neq(
            "status",
            "cancelled",
          )
          .order(
            "stop_order",
            {
              ascending:
                true,
            },
          )
      : {
          data:
            [] as RouteStopRow[],

          error:
            null,
        };

  logLoadError(
    "routes",
    "route_stops",
    auth.userId,
    routeStopsResult.error,
  );

  return {
    ...emptyFieldContext(
      auth,
    ),

    routeDays,

    routeStops:
      routeStopsResult.data ??
      [],
  };
}

export async function getFieldBreaksContext(
  nextPath =
    "/field/breaks",
): Promise<FieldContext> {
  const auth =
    await requireField(
      nextPath,
    );

  if (
    auth.status !==
    "ok"
  ) {
    return emptyFieldContext(
      auth,
    );
  }

  const admin =
    getSupabaseAdmin();

  let recentBreaksQuery =
    admin
      .from(
        "route_breaks",
      )
      .select("*")
      .order(
        "started_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        RECENT_BREAK_LIMIT,
      );

  let openRoutesQuery =
    admin
      .from(
        "route_days",
      )
      .select("*")
      .in(
        "status",
        [
          "planned",
          "active",
        ],
      )
      .order(
        "route_date",
        {
          ascending:
            true,
        },
      )
      .limit(30);

  if (
    !isAdminRole(
      auth.profile.role,
    )
  ) {
    recentBreaksQuery =
      recentBreaksQuery.eq(
        "technician_id",
        auth.userId,
      );

    openRoutesQuery =
      openRoutesQuery.eq(
        "assigned_technician_id",
        auth.userId,
      );
  }

  const [
    activeBreakResult,
    recentBreaksResult,
    openRoutesResult,
  ] = await Promise.all([
    admin
      .from(
        "route_breaks",
      )
      .select("*")
      .eq(
        "technician_id",
        auth.userId,
      )
      .is(
        "ended_at",
        null,
      )
      .order(
        "started_at",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle(),

    recentBreaksQuery,

    openRoutesQuery,
  ]);

  [
    [
      "active_break",
      activeBreakResult.error,
    ],

    [
      "recent_breaks",
      recentBreaksResult.error,
    ],

    [
      "open_routes",
      openRoutesResult.error,
    ],
  ].forEach(
    (
      [
        query,
        error,
      ],
    ) => {
      logLoadError(
        "breaks",
        String(query),
        auth.userId,
        error,
      );
    },
  );

  const breaks =
    dedupeById<
      RouteBreakRow
    >([
      activeBreakResult.data
        ? [
            activeBreakResult
              .data,
          ]
        : [],

      recentBreaksResult
        .data,
    ]);

  const openRoutes =
    openRoutesResult.data ??
    [];

  const linkedRouteDayIds =
    uniqueIds([
      ...breaks.map(
        (routeBreak) =>
          routeBreak
            .route_day_id,
      ),

      ...openRoutes.map(
        (routeDay) =>
          routeDay.id,
      ),
    ]);

  const linkedRoutesResult =
    linkedRouteDayIds.length
      ? await admin
          .from(
            "route_days",
          )
          .select("*")
          .in(
            "id",
            linkedRouteDayIds,
          )
      : {
          data:
            [] as RouteDayRow[],

          error:
            null,
        };

  logLoadError(
    "breaks",
    "linked_routes",
    auth.userId,
    linkedRoutesResult.error,
  );

  const technicianIds =
    uniqueIds(
      breaks.map(
        (routeBreak) =>
          routeBreak
            .technician_id,
      ),
    );

  const profilesResult =
    technicianIds.length
      ? await admin
          .from(
            "profiles",
          )
          .select("*")
          .in(
            "id",
            technicianIds,
          )
      : {
          data:
            [] as ProfileRow[],

          error:
            null,
        };

  logLoadError(
    "breaks",
    "profiles",
    auth.userId,
    profilesResult.error,
  );

  return {
    ...emptyFieldContext(
      auth,
    ),

    routeDays:
      dedupeById<
        RouteDayRow
      >([
        openRoutes,
        linkedRoutesResult.data,
      ]),

    breaks,

    profiles:
      profilesResult.data ??
      [],
  };
}

export async function getFieldStopContext(
  visitId: string,
  nextPath =
    `/field/stops/${visitId}`,
): Promise<FieldContext> {
  const auth =
    await requireField(
      nextPath,
    );

  if (
    auth.status !==
    "ok"
  ) {
    return emptyFieldContext(
      auth,
    );
  }

  const access =
    await getAuthorizedFieldStopBundle(
      {
        auth,
        visitId,
      },
    );

  if (!access.ok) {
    logger.warn(
      "field_stop_page_access_failed",
      {
        action:
          "field_stop_page_load",

        userId:
          auth.userId,

        metadata: {
          visitId,
          status:
            access.status,
          message:
            access.message,
        },
      },
    );

    return emptyFieldContext(
      auth,
    );
  }

  const {
    admin,
    routeDay,
    stop,
    visit,
    booking,
  } = access;

  const [
    addressByIdResult,
    primaryAddressResult,
    photosByStopResult,
    photosByVisitResult,
    paymentsByBookingResult,
    paymentsByVisitResult,
  ] = await Promise.all([
    booking
      .service_address_id
      ? admin
          .from(
            "service_addresses",
          )
          .select("*")
          .eq(
            "id",
            booking
              .service_address_id,
          )
          .maybeSingle()
      : Promise.resolve({
          data:
            null as ServiceAddressRow | null,

          error:
            null,
        }),

    booking.customer_id
      ? admin
          .from(
            "service_addresses",
          )
          .select("*")
          .eq(
            "customer_id",
            booking.customer_id,
          )
          .eq(
            "is_primary",
            true,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(1)
          .maybeSingle()
      : Promise.resolve({
          data:
            null as ServiceAddressRow | null,

          error:
            null,
        }),

    admin
      .from(
        "service_photos",
      )
      .select("*")
      .eq(
        "route_stop_id",
        stop.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      ),

    admin
      .from(
        "service_photos",
      )
      .select("*")
      .eq(
        "service_visit_id",
        visit.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      ),

    admin
      .from(
        "payments",
      )
      .select("*")
      .eq(
        "booking_id",
        booking.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      ),

    admin
      .from(
        "payments",
      )
      .select("*")
      .eq(
        "service_visit_id",
        visit.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      ),
  ]);

  [
    [
      "address_by_id",
      addressByIdResult.error,
    ],

    [
      "primary_address",
      primaryAddressResult.error,
    ],

    [
      "photos_by_stop",
      photosByStopResult.error,
    ],

    [
      "photos_by_visit",
      photosByVisitResult.error,
    ],

    [
      "payments_by_booking",
      paymentsByBookingResult
        .error,
    ],

    [
      "payments_by_visit",
      paymentsByVisitResult
        .error,
    ],
  ].forEach(
    (
      [
        query,
        error,
      ],
    ) => {
      logLoadError(
        "stop",
        String(query),
        auth.userId,
        error,
      );
    },
  );

  const addresses =
    dedupeById<
      ServiceAddressRow
    >([
      addressByIdResult.data
        ? [
            addressByIdResult
              .data,
          ]
        : [],

      primaryAddressResult.data
        ? [
            primaryAddressResult
              .data,
          ]
        : [],
    ]);

  const photos =
    dedupeById<
      ServicePhotoRow
    >([
      photosByStopResult
        .data,

      photosByVisitResult
        .data,
    ]).sort(
      (
        left,
        right,
      ) =>
        right.created_at
          .localeCompare(
            left.created_at,
          ),
    );

  const payments =
    dedupeById<
      PaymentRow
    >([
      paymentsByBookingResult
        .data,

      paymentsByVisitResult
        .data,
    ]).sort(
      (
        left,
        right,
      ) =>
        right.created_at
          .localeCompare(
            left.created_at,
          ),
    );

  return {
    ...emptyFieldContext(
      auth,
    ),

    routeDays: [
      routeDay,
    ],

    routeStops: [
      stop,
    ],

    bookings: [
      booking,
    ],

    visits: [
      visit,
    ],

    addresses,
    photos,
    payments,
  };
}
