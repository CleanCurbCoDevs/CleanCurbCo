import "server-only";

import { logger } from "@/lib/server/logger";

const OPTIMOROUTE_API_BASE = "https://api.optimoroute.com/v1";
const DEFAULT_TIMEOUT_MS = 20_000;

type OptimoRouteRequestContext = {
  requestId?: string;
  route?: string;
  action?: string;
};

type OptimoRouteResponse = {
  success: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type OptimoRouteOrderPayload = {
  operation: "CREATE" | "UPDATE" | "SYNC" | "MERGE";
  orderNo: string;
  type: "T" | "D" | "P";
  date: string;
  duration?: number;
  priority?: "L" | "M" | "H" | "C";
  load1?: number;
  email?: string;
  phone?: string;
  notes?: string;
  notificationPreference?: "dont_notify" | "email" | "sms" | "both";
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  customField5?: string;
  timeWindows?: Array<{ twFrom: string; twTo: string }>;
  allowedDates?: { from?: string; to?: string };
  location: {
    address: string;
    locationName?: string;
    locationNo?: string;
    notes?: string;
    acceptPartialMatch?: boolean;
    acceptMultipleResults?: boolean;
    storeInvalid?: boolean;
  };
};

export type OptimoRouteCreateOrderResponse = OptimoRouteResponse & {
  id?: string;
  location?: {
    valid?: boolean;
    address?: string;
    locationNo?: string;
    locationName?: string;
  };
};

export type OptimoRoutePlanningResponse = OptimoRouteResponse & {
  planningId?: number;
  missingOrders?: string[];
  ordersWithInvalidLocation?: string[];
};

export type OptimoRoutePlanningStatusResponse = OptimoRouteResponse & {
  status?: "N" | "R" | "C" | "F" | "E";
  percentageComplete?: number;
};

export type OptimoRouteRouteStop = {
  stopNumber: number;
  orderNo: string;
  id: string;
  scheduledAt?: string;
  scheduledAtDt?: string;
  arrivalTimeDt?: string;
  address?: string;
  locationName?: string;
  distance?: number;
  travelTime?: number;
};

export type OptimoRouteRoute = {
  driverExternalId?: string;
  driverSerial?: string;
  driverName?: string;
  vehicleRegistration?: string;
  vehicleLabel?: string;
  duration?: number;
  distance?: number;
  stops: OptimoRouteRouteStop[];
};

export type OptimoRouteRoutesResponse = OptimoRouteResponse & {
  routes?: OptimoRouteRoute[];
};

export type OptimoRouteSchedulingInfoResponse = OptimoRouteResponse & {
  orderScheduled?: boolean;
  scheduleInformation?: {
    driverExternalId?: string | null;
    driverSerial?: string | null;
    driverName?: string | null;
    vehicleRegistration?: string | null;
    vehicleLabel?: string | null;
    stopNumber?: number;
    scheduledAt?: string;
    scheduledAtDt?: string;
    arrivalTimeDt?: string;
    travelTime?: number;
    distance?: number;
    liveEstimate?: {
      arrivalTimeDt?: string | null;
      startTimeDt?: string | null;
    } | null;
  };
};

export class OptimoRouteApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "OptimoRouteApiError";
    this.code = options.code;
    this.status = options.status;
  }
}

function getApiKey() {
  const apiKey = process.env.OPTIMOROUTE_API_KEY?.trim();
  if (!apiKey) {
    throw new OptimoRouteApiError("OptimoRoute API key is not configured.");
  }
  return apiKey;
}

function apiUrl(path: string) {
  const url = new URL(`${OPTIMOROUTE_API_BASE}/${path.replace(/^\//, "")}`);
  url.searchParams.set("key", getApiKey());
  return url;
}

function appendQuery(url: URL, query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) return url;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function optimorouteFetch<T extends OptimoRouteResponse>(
  path: string,
  init: RequestInit & {
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {},
  context: OptimoRouteRequestContext = {},
): Promise<T> {
  const startedAt = performance.now();
  const url = appendQuery(apiUrl(path), init.query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || data.success === false) {
      const message =
        data.message ||
        data.code ||
        `OptimoRoute request failed with status ${response.status}.`;
      logger.warn("optimoroute_api_request_failed", {
        requestId: context.requestId,
        route: context.route,
        action: context.action,
        status: String(response.status),
        durationMs: Math.round(performance.now() - startedAt),
        metadata: {
          endpoint: path,
          code: data.code,
          message,
        },
      });
      throw new OptimoRouteApiError(message, {
        code: data.code,
        status: response.status,
      });
    }

    logger.info("optimoroute_api_request_succeeded", {
      requestId: context.requestId,
      route: context.route,
      action: context.action,
      durationMs: Math.round(performance.now() - startedAt),
      metadata: { endpoint: path },
    });

    return data;
  } catch (error) {
    if (error instanceof OptimoRouteApiError) throw error;

    logger.error("optimoroute_api_request_error", {
      requestId: context.requestId,
      route: context.route,
      action: context.action,
      durationMs: Math.round(performance.now() - startedAt),
      error,
      metadata: { endpoint: path },
    });

    throw new OptimoRouteApiError(
      error instanceof Error ? error.message : "OptimoRoute request failed.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function createOptimoRouteClient(context: OptimoRouteRequestContext = {}) {
  return {
    createOrder(order: OptimoRouteOrderPayload) {
      return optimorouteFetch<OptimoRouteCreateOrderResponse>(
        "create_order",
        {
          method: "POST",
          body: JSON.stringify(order),
        },
        { ...context, action: context.action ?? "optimoroute_create_order" },
      );
    },

    startPlanning(input: {
      date: string;
      useOrderObjects: Array<{ orderNo: string }>;
      includeScheduledOrders?: boolean;
    }) {
      return optimorouteFetch<OptimoRoutePlanningResponse>(
        "start_planning",
        {
          method: "POST",
          body: JSON.stringify({
            date: input.date,
            startWith: "EMPTY",
            balancing: "OFF",
            includeScheduledOrders: input.includeScheduledOrders ?? false,
            useOrderObjects: input.useOrderObjects,
          }),
        },
        { ...context, action: context.action ?? "optimoroute_start_planning" },
      );
    },

    getPlanningStatus(planningId: number) {
      return optimorouteFetch<OptimoRoutePlanningStatusResponse>(
        "get_planning_status",
        { method: "GET", query: { planningId } },
        { ...context, action: context.action ?? "optimoroute_planning_status" },
      );
    },

    getRoutes(date: string) {
      return optimorouteFetch<OptimoRouteRoutesResponse>(
        "get_routes",
        { method: "GET", query: { date } },
        { ...context, action: context.action ?? "optimoroute_get_routes" },
      );
    },

    getSchedulingInfo(orderNo: string) {
      return optimorouteFetch<OptimoRouteSchedulingInfoResponse>(
        "get_scheduling_info",
        { method: "GET", query: { orderNo } },
        { ...context, action: context.action ?? "optimoroute_get_scheduling_info" },
      );
    },
  };
}
