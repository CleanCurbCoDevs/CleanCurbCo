import "server-only";

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
  RouteDayRow,
  RouteStopRow,
  ServiceChecklistRow,
  ServiceVisitRow,
} from "@/types/database";

const HISTORY_PAGE_SIZE =
  25;

const historyStatuses = [
  "completed",
  "needs_follow_up",
  "skipped",
] as const;

const historyTimes = [
  "morning",
  "afternoon",
  "evening",
] as const;

const historyProofFilters = [
  "complete",
  "missing_before",
  "missing_checklist",
  "missing_after",
] as const;

const historySorts = [
  "newest",
  "oldest",
  "customer_asc",
  "customer_desc",
  "time_asc",
  "time_desc",
] as const;

type HistoryStatus =
  typeof historyStatuses[number];

type HistoryTime =
  typeof historyTimes[number];

type HistoryProof =
  typeof historyProofFilters[number];

type HistorySort =
  typeof historySorts[number];

export type FieldHistoryQuery = {
  q?: string;
  year?: string;
  month?: string;
  day?: string;
  status?: string;
  technician?: string;
  time?: string;
  proof?: string;
  issues?: string;
  sort?: string;
  page?: string;
};

export type FieldHistoryRecord = {
  stop:
    RouteStopRow;

  visit:
    ServiceVisitRow | null;

  booking:
    BookingRow | null;

  routeDay:
    RouteDayRow | null;

  checklist:
    ServiceChecklistRow | null;

  payment:
    PaymentRow | null;

  technician:
    ProfileRow | null;

  beforePhotoCount:
    number;

  afterPhotoCount:
    number;

  issuePhotoCount:
    number;

  beforeProofComplete:
    boolean;

  afterProofComplete:
    boolean;

  completedBy:
    string | null;

  eventDate:
    string;
};

type FieldHistoryMetrics = {
  scopeCount:
    number;

  completedCount:
    number;

  followUpCount:
    number;

  proofCompleteCount:
    number;

  servicedRevenue:
    number;
};

type FieldHistoryPagination = {
  page:
    number;

  pageSize:
    number;

  totalCount:
    number;

  pageCount:
    number;
};

type FieldHistoryTechnician = {
  id:
    string;

  name:
    string;
};

type FieldHistoryFilters = {
  search:
    string;

  year:
    string;

  month:
    string;

  day:
    string;

  status:
    string;

  technician:
    string;

  time:
    string;

  proof:
    string;

  issuesOnly:
    boolean;

  sort:
    HistorySort;

  page:
    number;
};

export type FieldHistoryPageData = {
  auth:
    AuthResult;

  records:
    FieldHistoryRecord[];

  metrics:
    FieldHistoryMetrics;

  pagination:
    FieldHistoryPagination;

  availableYears:
    number[];

  technicians:
    FieldHistoryTechnician[];

  filters:
    FieldHistoryFilters;

  loadError:
    string | null;
};

type HistoryRpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type HistoryRpcResponse = {
  data:
    unknown;

  error:
    HistoryRpcError | null;
};

type HistoryRpcClient = {
  rpc: (
    functionName: string,
    args: Record<
      string,
      unknown
    >,
  ) => PromiseLike<
    HistoryRpcResponse
  >;
};

function pickEnum<
  Value extends string,
>(
  value:
    string | undefined,
  values:
    readonly Value[],
  fallback:
    Value | null,
) {
  const cleaned =
    value?.trim() ?? "";

  return values.includes(
    cleaned as Value,
  )
    ? cleaned as Value
    : fallback;
}

function parseBoundedInteger(
  value:
    string | undefined,
  minimum:
    number,
  maximum:
    number,
) {
  const parsed =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function cleanUuid(
  value:
    string | undefined,
) {
  const cleaned =
    value?.trim() ?? "";

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      cleaned,
    )
    ? cleaned
    : null;
}

function cleanDate(
  value:
    string | undefined,
) {
  const cleaned =
    value?.trim() ?? "";

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(
        cleaned,
      )
  ) {
    return null;
  }

  const date =
    new Date(
      `${cleaned}T12:00:00Z`,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : cleaned;
}

function emptyHistoryData(
  auth:
    AuthResult,
  filters:
    FieldHistoryFilters,
  loadError:
    string | null = null,
): FieldHistoryPageData {
  return {
    auth,

    records: [],

    metrics: {
      scopeCount:
        0,

      completedCount:
        0,

      followUpCount:
        0,

      proofCompleteCount:
        0,

      servicedRevenue:
        0,
    },

    pagination: {
      page:
        1,

      pageSize:
        HISTORY_PAGE_SIZE,

      totalCount:
        0,

      pageCount:
        1,
    },

    availableYears: [],

    technicians: [],

    filters,

    loadError,
  };
}

function normalizeFilters(
  query:
    FieldHistoryQuery,
): FieldHistoryFilters {
  const search =
    query.q
      ?.trim()
      .slice(
        0,
        120,
      ) ?? "";

  const year =
    parseBoundedInteger(
      query.year,
      2000,
      2100,
    );

  const month =
    parseBoundedInteger(
      query.month,
      1,
      12,
    );

  const day =
    cleanDate(
      query.day,
    );

  const status =
    pickEnum(
      query.status,
      historyStatuses,
      null,
    );

  const time =
    pickEnum(
      query.time,
      historyTimes,
      null,
    );

  const proof =
    pickEnum(
      query.proof,
      historyProofFilters,
      null,
    );

  const sort =
    pickEnum(
      query.sort,
      historySorts,
      "newest",
    ) ?? "newest";

  const page =
    parseBoundedInteger(
      query.page,
      1,
      100000,
    ) ?? 1;

  return {
    search,

    year:
      year
        ? String(
            year,
          )
        : "",

    month:
      month
        ? String(
            month,
          ).padStart(
            2,
            "0",
          )
        : "",

    day:
      day ?? "",

    status:
      status ?? "",

    technician:
      cleanUuid(
        query.technician,
      ) ?? "",

    time:
      time ?? "",

    proof:
      proof ?? "",

    issuesOnly:
      query.issues ===
      "true",

    sort,

    page,
  };
}

function validHistoryPayload(
  value:
    unknown,
): value is {
  records:
    FieldHistoryRecord[];

  metrics:
    FieldHistoryMetrics;

  pagination:
    FieldHistoryPagination;

  availableYears:
    number[];

  technicians:
    FieldHistoryTechnician[];
} {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return false;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  return (
    Array.isArray(
      candidate.records,
    ) &&
    Array.isArray(
      candidate.availableYears,
    ) &&
    Array.isArray(
      candidate.technicians,
    ) &&
    Boolean(
      candidate.metrics,
    ) &&
    typeof candidate.metrics ===
      "object" &&
    Boolean(
      candidate.pagination,
    ) &&
    typeof candidate.pagination ===
      "object"
  );
}

export async function getFieldHistoryPage(
  query:
    FieldHistoryQuery,
  nextPath =
    "/field/history",
): Promise<FieldHistoryPageData> {
  const filters =
    normalizeFilters(
      query,
    );

  const auth =
    await requireField(
      nextPath,
    );

  if (
    auth.status !==
    "ok"
  ) {
    return emptyHistoryData(
      auth,
      filters,
    );
  }

  const admin =
    getSupabaseAdmin();

  const client =
    admin as unknown as
      HistoryRpcClient;

  const canViewAllHistory =
    isAdminRole(
      auth.profile.role,
    );

  const {
    data,
    error,
  } = await client.rpc(
    "field_service_history_page",
    {
      p_actor_profile_id:
        auth.userId,

      p_search:
        filters.search ||
        null,

      p_year:
        filters.year
          ? Number(
              filters.year,
            )
          : null,

      p_month:
        filters.month
          ? Number(
              filters.month,
            )
          : null,

      p_day:
        filters.day ||
        null,

      p_status:
        filters.status ||
        null,

      p_technician_id:
        canViewAllHistory &&
        filters.technician
          ? filters.technician
          : null,

      p_time_of_day:
        filters.time ||
        null,

      p_proof:
        filters.proof ||
        null,

      p_issues_only:
        filters.issuesOnly,

      p_sort:
        filters.sort,

      p_page:
        filters.page,

      p_page_size:
        HISTORY_PAGE_SIZE,
    },
  );

  if (error) {
    logger.error(
      "field_history_query_failed",
      {
        action:
          "field_history_load",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        error,

        metadata: {
          filters,
        },
      },
    );

    return emptyHistoryData(
      auth,
      filters,
      "Service history could not be loaded. Refresh the page and try again.",
    );
  }

  if (
    !validHistoryPayload(
      data,
    )
  ) {
    logger.error(
      "field_history_payload_invalid",
      {
        action:
          "field_history_load",

        userId:
          auth.userId,

        role:
          auth.profile.role,

        metadata: {
          filters,
        },
      },
    );

    return emptyHistoryData(
      auth,
      filters,
      "Service history returned an invalid response.",
    );
  }

  return {
    auth,

    records:
      data.records,

    metrics: {
      scopeCount:
        Number(
          data.metrics
            .scopeCount ??
          0,
        ),

      completedCount:
        Number(
          data.metrics
            .completedCount ??
          0,
        ),

      followUpCount:
        Number(
          data.metrics
            .followUpCount ??
          0,
        ),

      proofCompleteCount:
        Number(
          data.metrics
            .proofCompleteCount ??
          0,
        ),

      servicedRevenue:
        Number(
          data.metrics
            .servicedRevenue ??
          0,
        ),
    },

    pagination: {
      page:
        Math.max(
          1,
          Number(
            data.pagination
              .page ??
            1,
          ),
        ),

      pageSize:
        Math.max(
          1,
          Number(
            data.pagination
              .pageSize ??
            HISTORY_PAGE_SIZE,
          ),
        ),

      totalCount:
        Math.max(
          0,
          Number(
            data.pagination
              .totalCount ??
            0,
          ),
        ),

      pageCount:
        Math.max(
          1,
          Number(
            data.pagination
              .pageCount ??
            1,
          ),
        ),
    },

    availableYears:
      data.availableYears
        .map(
          (year) =>
            Number(
              year,
            ),
        )
        .filter(
          (year) =>
            Number.isInteger(
              year,
            ),
        ),

    technicians:
      data.technicians
        .filter(
          (
            technician,
          ): technician is
            FieldHistoryTechnician =>
            Boolean(
              technician &&
              typeof technician.id ===
                "string" &&
              typeof technician.name ===
                "string",
            ),
        ),

    filters: {
      ...filters,

      page:
        Math.max(
          1,
          Number(
            data.pagination
              .page ??
            filters.page,
          ),
        ),
    },

    loadError:
      null,
  };
}
