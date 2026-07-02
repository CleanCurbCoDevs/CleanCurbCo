import "server-only";

import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import {
  createOptimoRouteClient,
  OptimoRouteApiError,
  type OptimoRouteRoute,
  type OptimoRouteRouteStop,
} from "@/lib/optimoroute/client";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import { formatFrequency, getFoundingNeighborSpecialStatus } from "@/lib/pricing";
import { writeAdminAuditLog } from "@/lib/server/admin-audit";
import { logger } from "@/lib/server/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BookingRow,
  PaymentRow,
  ProfileRow,
  RouteDayRow,
  RouteStopRow,
  ServiceVisitRow,
} from "@/types/database";

export type OptimoRouteSyncOptions = {
  includePaymentBlocked?: boolean;
  includeNotApproved?: boolean;
};

type RouteStopBundle = {
  routeDay: RouteDayRow;
  stop: RouteStopRow;
  booking: BookingRow | null;
  visit: ServiceVisitRow | null;
  payment: PaymentRow | null;
};

type ActorContext = {
  userId: string;
  email?: string | null;
  role: ProfileRow["role"];
};

type RequestContext = {
  requestId?: string;
  route?: string;
  action?: string;
  actor?: ActorContext;
};

const readyBookingStatuses = new Set([
  "confirmed",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
]);

export function isValidRouteDayId(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  );
}

export function getOptimoRouteOrderNo(stop: Pick<RouteStopRow, "id" | "optimoroute_order_no">) {
  return stop.optimoroute_order_no || `CCC-${stop.id}`;
}

export function getOptimizedStopSortValue(stop: RouteStopRow) {
  return stop.optimoroute_stop_sequence ?? stop.stop_order ?? Number.MAX_SAFE_INTEGER;
}

export function sortStopsForField(a: RouteStopRow, b: RouteStopRow) {
  const aHasOptimizedOrder = a.optimoroute_stop_sequence !== null;
  const bHasOptimizedOrder = b.optimoroute_stop_sequence !== null;
  if (aHasOptimizedOrder && bHasOptimizedOrder) {
    const optimized = getOptimizedStopSortValue(a) - getOptimizedStopSortValue(b);
    if (optimized !== 0) return optimized;
  }
  if (aHasOptimizedOrder !== bHasOptimizedOrder) {
    return aHasOptimizedOrder ? -1 : 1;
  }
  const manual = (a.stop_order ?? 0) - (b.stop_order ?? 0);
  if (manual !== 0) return manual;
  return a.created_at.localeCompare(b.created_at);
}

export function getRouteStopEligibility(
  input: RouteStopBundle,
  options: OptimoRouteSyncOptions = {},
) {
  const reasons: string[] = [];
  const { routeDay, stop, booking, visit, payment } = input;

  if (stop.route_day_id !== routeDay.id) reasons.push("Outside selected route date.");
  if (!booking) reasons.push("Missing linked booking.");
  if (!visit) reasons.push("Missing linked service visit.");

  if (booking) {
    const hasAddress = Boolean(
      booking.street_address?.trim() &&
        booking.city?.trim() &&
        booking.state?.trim(),
    );
    if (!hasAddress) reasons.push("Missing service address.");
    if (booking.status === "cancelled") reasons.push("Customer cancelled.");
    if (!readyBookingStatuses.has(booking.status) && !options.includeNotApproved) {
      reasons.push("Not approved for routing.");
    }

    const clearance = getServiceClearanceStatus(booking, payment);
    if (!clearance.cleared && !options.includePaymentBlocked) {
      reasons.push(clearance.label);
    }
  }

  if (stop.status === "cancelled") reasons.push("Stop cancelled.");
  if (stop.status === "completed") reasons.push("Already completed.");
  if (visit?.status === "completed" || visit?.completed_at) {
    reasons.push("Already completed.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    summary: reasons.length ? reasons.join(" ") : "Eligible for OptimoRoute.",
  };
}

export function getStopDurationMinutes(booking: BookingRow) {
  const addOnMinutes = Math.min(18, booking.add_ons.length * 4);
  return Math.max(15, Math.min(45, 12 + booking.bin_count * 4 + addOnMinutes));
}

export function mapStopToOptimoRouteOrder(input: RouteStopBundle) {
  if (!input.booking) {
    throw new Error("Cannot map OptimoRoute order without a booking.");
  }

  const { routeDay, stop, booking } = input;
  const special = getFoundingNeighborSpecialStatus({
    binCount: booking.bin_count,
    frequency: booking.frequency,
    addOns: booking.add_ons,
    createdAt: booking.created_at,
    neighborhood: booking.neighborhood,
    estimatedPrice: booking.estimated_price,
  });
  const clearance = getServiceClearanceStatus(booking, input.payment);
  const customerName = `${booking.first_name} ${booking.last_name}`.trim();
  const notes = [
    `Clean Curb Co stop ${stop.id}`,
    `${booking.bin_count} bin(s), ${formatFrequency(booking.frequency)}`,
    booking.bin_location ? `Bin location: ${booking.bin_location}` : "",
    booking.customer_notes ? `Customer note: ${booking.customer_notes}` : "",
    stop.technician_notes ? `Route note: ${stop.technician_notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    operation: "SYNC" as const,
    orderNo: getOptimoRouteOrderNo(stop),
    type: "T" as const,
    date: routeDay.route_date,
    duration: getStopDurationMinutes(booking),
    priority: "M" as const,
    load1: booking.bin_count,
    email: booking.email,
    phone: booking.phone,
    notes,
    notificationPreference: "dont_notify" as const,
    customField1: `Payment: ${clearance.label}`,
    customField2: `Service: ${humanizeStatus(stop.status)}`,
    customField3: `Special: ${humanizeStatus(special.status)} - ${special.reason}`,
    customField4: `Bins: ${booking.bin_count}`,
    customField5: `CCC stop: ${stop.id}`,
    location: {
      address: `${formatBookingAddress(booking)}, USA`,
      locationName: customerName || formatBookingAddress(booking),
      locationNo: `CCC-${booking.service_address_id ?? booking.id}`,
      notes: booking.bin_location ?? undefined,
      acceptPartialMatch: true,
      acceptMultipleResults: false,
      storeInvalid: false,
    },
  };
}

async function getRouteBundle(routeDayId: string): Promise<{
  routeDay: RouteDayRow | null;
  bundles: RouteStopBundle[];
}> {
  const admin = getSupabaseAdmin();
  const [{ data: routeDay }, { data: stops }] = await Promise.all([
    admin.from("route_days").select("*").eq("id", routeDayId).maybeSingle(),
    admin
      .from("route_stops")
      .select("*")
      .eq("route_day_id", routeDayId)
      .order("stop_order", { ascending: true }),
  ]);

  if (!routeDay) return { routeDay: null, bundles: [] };

  const routeStops = stops ?? [];
  const bookingIds = routeStops.map((stop) => stop.booking_id).filter(Boolean) as string[];
  const visitIds = routeStops.map((stop) => stop.service_visit_id).filter(Boolean) as string[];

  const [bookingsResult, visitsResult, paymentsResult] = await Promise.all([
    bookingIds.length
      ? admin.from("bookings").select("*").in("id", bookingIds)
      : Promise.resolve({ data: [] as BookingRow[] }),
    visitIds.length
      ? admin.from("service_visits").select("*").in("id", visitIds)
      : Promise.resolve({ data: [] as ServiceVisitRow[] }),
    bookingIds.length || visitIds.length
      ? admin
          .from("payments")
          .select("*")
          .or(
            [
              bookingIds.length ? `booking_id.in.(${bookingIds.join(",")})` : "",
              visitIds.length ? `service_visit_id.in.(${visitIds.join(",")})` : "",
            ]
              .filter(Boolean)
              .join(","),
          )
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as PaymentRow[] }),
  ]);

  const bookings = bookingsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  return {
    routeDay,
    bundles: routeStops.map((stop) => {
      const booking = bookings.find((item) => item.id === stop.booking_id) ?? null;
      const visit = visits.find((item) => item.id === stop.service_visit_id) ?? null;
      const payment =
        payments.find(
          (item) =>
            item.booking_id === stop.booking_id ||
            item.service_visit_id === stop.service_visit_id,
        ) ?? null;
      return { routeDay, stop, booking, visit, payment };
    }),
  };
}

export async function getOptimoRoutePreview(routeDayId: string) {
  const { routeDay, bundles } = await getRouteBundle(routeDayId);
  if (!routeDay) return null;
  return {
    routeDay,
    stops: bundles.map((bundle) => ({
      stop: bundle.stop,
      booking: bundle.booking,
      visit: bundle.visit,
      payment: bundle.payment,
      eligibility: getRouteStopEligibility(bundle),
      forcedEligibility: getRouteStopEligibility(bundle, {
        includePaymentBlocked: true,
        includeNotApproved: true,
      }),
    })),
  };
}

export async function syncRouteDayToOptimoRoute(
  routeDayId: string,
  options: OptimoRouteSyncOptions,
  context: RequestContext = {},
) {
  const { routeDay, bundles } = await getRouteBundle(routeDayId);
  if (!routeDay) {
    return { ok: false, status: 404, error: "Route day was not found." };
  }

  const admin = getSupabaseAdmin();
  const eligible = bundles.filter(
    (bundle) => getRouteStopEligibility(bundle, options).eligible,
  );
  const skipped = bundles
    .filter((bundle) => !getRouteStopEligibility(bundle, options).eligible)
    .map((bundle) => ({
      routeStopId: bundle.stop.id,
      orderNo: getOptimoRouteOrderNo(bundle.stop),
      reason: getRouteStopEligibility(bundle, options).summary,
    }));

  if (!eligible.length) {
    return {
      ok: false,
      status: 400,
      error: "No eligible stops are ready to sync.",
      skipped,
    };
  }

  const client = createOptimoRouteClient(context);
  const synced: Array<{ routeStopId: string; orderNo: string; orderId?: string }> = [];
  const failed: Array<{ routeStopId: string; orderNo: string; error: string }> = [];

  for (const bundle of eligible) {
    const orderNo = getOptimoRouteOrderNo(bundle.stop);
    await admin
      .from("route_stops")
      .update({
        optimoroute_order_no: orderNo,
        optimoroute_sync_status: "syncing",
        optimoroute_sync_error: null,
      })
      .eq("id", bundle.stop.id);

    try {
      const response = await client.createOrder(mapStopToOptimoRouteOrder(bundle));
      await admin
        .from("route_stops")
        .update({
          optimoroute_order_no: orderNo,
          optimoroute_order_id: response.id ?? bundle.stop.optimoroute_order_id,
          optimoroute_sync_status: "synced",
          optimoroute_sync_error: null,
          optimoroute_last_synced_at: new Date().toISOString(),
        })
        .eq("id", bundle.stop.id);
      synced.push({ routeStopId: bundle.stop.id, orderNo, orderId: response.id });
    } catch (error) {
      const message = safeOptimoRouteErrorMessage(error);
      await admin
        .from("route_stops")
        .update({
          optimoroute_order_no: orderNo,
          optimoroute_sync_status: "sync_failed",
          optimoroute_sync_error: message,
          optimoroute_last_synced_at: new Date().toISOString(),
        })
        .eq("id", bundle.stop.id);
      failed.push({ routeStopId: bundle.stop.id, orderNo, error: message });
    }
  }

  await recordRouteEvent(routeDay, "optimoroute_stops_synced", {
    context,
    metadata: {
      syncedCount: synced.length,
      failedCount: failed.length,
      skippedCount: skipped.length,
    },
  });

  return {
    ok: synced.length > 0,
    status: synced.length > 0 ? 200 : 502,
    routeDayId,
    synced,
    failed,
    skipped,
  };
}

export async function startOptimoRoutePlanning(
  routeDayId: string,
  context: RequestContext = {},
) {
  const { routeDay, bundles } = await getRouteBundle(routeDayId);
  if (!routeDay) {
    return { ok: false, status: 404, error: "Route day was not found." };
  }

  const orderObjects = bundles
    .filter((bundle) =>
      ["synced", "planning_pending", "scheduled", "unscheduled", "imported"].includes(
        bundle.stop.optimoroute_sync_status,
      ),
    )
    .map((bundle) => ({ orderNo: getOptimoRouteOrderNo(bundle.stop) }));

  if (!orderObjects.length) {
    return {
      ok: false,
      status: 400,
      error: "Sync at least one eligible stop before starting optimization.",
    };
  }

  const client = createOptimoRouteClient(context);
  const admin = getSupabaseAdmin();

  try {
    const response = await client.startPlanning({
      date: routeDay.route_date,
      useOrderObjects: orderObjects,
      includeScheduledOrders: false,
    });
    const planningId = response.planningId ?? null;
    await Promise.all([
      admin
        .from("route_days")
        .update({
          optimoroute_planning_id: planningId,
          optimoroute_planning_status: planningId ? "running" : "started",
          optimoroute_planning_error: null,
          optimoroute_last_planned_at: new Date().toISOString(),
        })
        .eq("id", routeDay.id),
      admin
        .from("route_stops")
        .update({
          optimoroute_sync_status: "planning_pending",
          optimoroute_planning_status: "running",
          optimoroute_sync_error: null,
        })
        .eq("route_day_id", routeDay.id)
        .in(
          "optimoroute_order_no",
          orderObjects.map((item) => item.orderNo),
        ),
    ]);
    await recordRouteEvent(routeDay, "optimoroute_planning_started", {
      context,
      metadata: { planningId, orderCount: orderObjects.length },
    });
    return { ok: true, status: 200, planningId, orderCount: orderObjects.length };
  } catch (error) {
    const message = safeOptimoRouteErrorMessage(error);
    await admin
      .from("route_days")
      .update({
        optimoroute_planning_status: "failed",
        optimoroute_planning_error: message,
      })
      .eq("id", routeDay.id);
    return { ok: false, status: 502, error: message };
  }
}

export async function checkOptimoRoutePlanningStatus(
  routeDayId: string,
  context: RequestContext = {},
) {
  const { routeDay } = await getRouteBundle(routeDayId);
  if (!routeDay) {
    return { ok: false, status: 404, error: "Route day was not found." };
  }
  if (!routeDay.optimoroute_planning_id) {
    return {
      ok: false,
      status: 400,
      error: "No OptimoRoute planning job is stored for this route day.",
    };
  }

  const client = createOptimoRouteClient(context);
  const admin = getSupabaseAdmin();

  try {
    const response = await client.getPlanningStatus(routeDay.optimoroute_planning_id);
    const status = mapPlanningStatus(response.status);

    await admin
      .from("route_days")
      .update({
        optimoroute_planning_status: status,
        optimoroute_planning_error: response.message ?? null,
      })
      .eq("id", routeDay.id);

    if (status === "failed" || status === "cancelled") {
      await admin
        .from("route_stops")
        .update({
          optimoroute_sync_status: "planning_failed",
          optimoroute_planning_status: status,
          optimoroute_sync_error: response.message ?? status,
        })
        .eq("route_day_id", routeDay.id)
        .eq("optimoroute_sync_status", "planning_pending");
    }

    return {
      ok: true,
      status: 200,
      planningStatus: status,
      optimorouteStatus: response.status,
      percentageComplete: response.percentageComplete ?? null,
      planningId: routeDay.optimoroute_planning_id,
    };
  } catch (error) {
    const message = safeOptimoRouteErrorMessage(error);
    await admin
      .from("route_days")
      .update({
        optimoroute_planning_status: "failed",
        optimoroute_planning_error: message,
      })
      .eq("id", routeDay.id);
    return { ok: false, status: 502, error: message };
  }
}

export async function importOptimoRouteSchedule(
  routeDayId: string,
  context: RequestContext = {},
) {
  const { routeDay, bundles } = await getRouteBundle(routeDayId);
  if (!routeDay) {
    return { ok: false, status: 404, error: "Route day was not found." };
  }

  const admin = getSupabaseAdmin();
  const imported: Array<{ routeStopId: string; orderNo: string; sequence: number }> = [];
  const unscheduled: Array<{ routeStopId: string; orderNo: string }> = [];
  const syncedBundles = bundles.filter((bundle) => bundle.stop.optimoroute_order_no);

  if (!syncedBundles.length) {
    return {
      ok: false,
      status: 400,
      error: "Sync at least one stop before importing an optimized route.",
    };
  }

  try {
    const client = createOptimoRouteClient(context);
    const response = await client.getRoutes(routeDay.route_date);
    const scheduledStops = flattenOptimizedStops(response.routes ?? []);
    const scheduledByOrderNo = new Map(
      scheduledStops
        .filter((item) => item.stop.orderNo?.startsWith("CCC-"))
        .map((item) => [item.stop.orderNo, item]),
    );

    await Promise.all(
      syncedBundles
        .map(async (bundle) => {
          const orderNo = getOptimoRouteOrderNo(bundle.stop);
          const scheduled = scheduledByOrderNo.get(orderNo);

          if (!scheduled) {
            await admin
              .from("route_stops")
              .update({
                optimoroute_sync_status: "unscheduled",
                optimoroute_sync_error: "OptimoRoute did not schedule this stop.",
                optimoroute_planning_status: routeDay.optimoroute_planning_status,
              })
              .eq("id", bundle.stop.id);
            unscheduled.push({ routeStopId: bundle.stop.id, orderNo });
            return;
          }

          const sequence = scheduled.stop.stopNumber;
          await admin
            .from("route_stops")
            .update({
              optimoroute_order_id: scheduled.stop.id ?? bundle.stop.optimoroute_order_id,
              optimoroute_sync_status: "imported",
              optimoroute_sync_error: null,
              optimoroute_scheduled_at: parseOptimoRouteDateTime(
                scheduled.stop.scheduledAtDt,
                routeDay.route_date,
              ),
              optimoroute_stop_sequence: sequence,
              optimoroute_route_id: scheduled.routeId,
              optimoroute_driver_name: scheduled.route.driverName ?? null,
              optimoroute_eta: parseOptimoRouteDateTime(
                scheduled.stop.arrivalTimeDt ?? scheduled.stop.scheduledAtDt,
                routeDay.route_date,
              ),
              optimoroute_travel_time_seconds: scheduled.stop.travelTime ?? null,
              optimoroute_distance_meters: scheduled.stop.distance ?? null,
              optimoroute_planning_status: "imported",
            })
            .eq("id", bundle.stop.id);
          imported.push({ routeStopId: bundle.stop.id, orderNo, sequence });
        }),
    );
  } catch (error) {
    const message = safeOptimoRouteErrorMessage(error);
    await admin
      .from("route_days")
      .update({
        optimoroute_planning_status: "failed",
        optimoroute_planning_error: message,
      })
      .eq("id", routeDay.id);
    return { ok: false, status: 502, error: message };
  }

  await admin
    .from("route_days")
    .update({
      optimoroute_planning_status: "imported",
      optimoroute_planning_error: unscheduled.length
        ? `${unscheduled.length} synced stop(s) were not scheduled.`
        : null,
      optimoroute_last_imported_at: new Date().toISOString(),
    })
    .eq("id", routeDay.id);

  await recordRouteEvent(routeDay, "optimoroute_schedule_imported", {
    context,
    metadata: {
      importedCount: imported.length,
      unscheduledCount: unscheduled.length,
    },
  });

  return {
    ok: imported.length > 0,
    status: imported.length > 0 ? 200 : 400,
    imported,
    unscheduled,
  };
}

function flattenOptimizedStops(routes: OptimoRouteRoute[]) {
  return routes.flatMap((route, routeIndex) => {
    const routeId =
      route.driverSerial ||
      route.driverExternalId ||
      route.vehicleLabel ||
      route.vehicleRegistration ||
      `route-${routeIndex + 1}`;
    return (route.stops ?? []).map((stop: OptimoRouteRouteStop) => ({
      route,
      routeId,
      stop,
    }));
  });
}

function mapPlanningStatus(status?: string) {
  if (status === "N") return "new";
  if (status === "R") return "running";
  if (status === "C") return "cancelled";
  if (status === "F") return "finished";
  if (status === "E") return "failed";
  return status ?? "unknown";
}

function parseOptimoRouteDateTime(value?: string | null, routeDate?: string) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}-04:00`;
  const date = new Date(withZone);
  if (!Number.isNaN(date.getTime())) return date.toISOString();

  if (routeDate && /^\d{2}:\d{2}$/.test(value)) {
    const fallback = new Date(`${routeDate}T${value}:00-04:00`);
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  }

  return null;
}

function safeOptimoRouteErrorMessage(error: unknown) {
  if (error instanceof OptimoRouteApiError) {
    return [error.code, error.message].filter(Boolean).join(": ");
  }
  return error instanceof Error ? error.message : "OptimoRoute request failed.";
}

async function recordRouteEvent(
  routeDay: RouteDayRow,
  eventType: string,
  input: {
    context: RequestContext;
    metadata?: Record<string, unknown>;
  },
) {
  const admin = getSupabaseAdmin();
  const metadata = {
    requestId: input.context.requestId,
    routeDayId: routeDay.id,
    routeDate: routeDay.route_date,
    ...(input.metadata ?? {}),
  };
  await Promise.allSettled([
    admin.from("service_events").insert({
      actor_profile_id: input.context.actor?.userId ?? null,
      event_type: eventType,
      message: `OptimoRoute ${eventType.replace(/^optimoroute_/, "").replace(/_/g, " ")}.`,
      metadata,
    }),
    writeAdminAuditLog({
      action: eventType,
      actor_user_id: input.context.actor?.userId ?? null,
      actor_email: input.context.actor?.email ?? null,
      actor_role: input.context.actor?.role ?? null,
      target_type: "route_day",
      target_id: routeDay.id,
      customer_id: null,
      booking_id: null,
      before_summary: {},
      after_summary: metadata,
      note: "OptimoRoute routing supplement action.",
      request_id: input.context.requestId ?? null,
      status: "success",
      metadata,
    }),
  ]);

  logger.info(eventType, {
    requestId: input.context.requestId,
    route: input.context.route,
    action: input.context.action,
    userId: input.context.actor?.userId,
    role: input.context.actor?.role,
    metadata,
  });
}
