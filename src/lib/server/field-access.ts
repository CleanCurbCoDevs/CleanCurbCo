import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AuthResult } from "@/lib/supabase/auth";
import { isAdminRole } from "@/lib/supabase/roles";

import type {
  BookingRow,
  RouteDayRow,
  RouteStopRow,
  ServiceVisitRow,
} from "@/types/database";

export type AuthorizedFieldAuth =
  Extract<
    AuthResult,
    {
      status: "ok";
    }
  >;

type FieldAccessFailure = {
  ok: false;
  status: 400 | 403 | 404 | 500;
  message: string;
};

type AuthorizedRouteDay = {
  ok: true;
  admin: ReturnType<
    typeof getSupabaseAdmin
  >;
  routeDay: RouteDayRow;
};

export type AuthorizedFieldStopBundle = {
  ok: true;
  admin: ReturnType<
    typeof getSupabaseAdmin
  >;
  routeDay: RouteDayRow;
  stop: RouteStopRow;
  visit: ServiceVisitRow;
  booking: BookingRow;
};

function accessFailure(
  status: FieldAccessFailure["status"],
  message: string,
): FieldAccessFailure {
  return {
    ok: false,
    status,
    message,
  };
}

export async function getAuthorizedFieldRouteDay(
  input: {
    auth: AuthorizedFieldAuth;
    routeDayId: string;
  },
): Promise<
  AuthorizedRouteDay |
  FieldAccessFailure
> {
  const routeDayId =
    input.routeDayId.trim();

  if (!routeDayId) {
    return accessFailure(
      400,
      "The route could not be identified.",
    );
  }

  const admin =
    getSupabaseAdmin();

  const {
    data: routeDay,
    error,
  } = await admin
    .from("route_days")
    .select("*")
    .eq("id", routeDayId)
    .maybeSingle();

  if (error) {
    return accessFailure(
      500,
      "The route could not be verified.",
    );
  }

  if (!routeDay) {
    return accessFailure(
      404,
      "The route no longer exists.",
    );
  }

  if (
    !isAdminRole(
      input.auth.profile.role,
    ) &&
    routeDay
      .assigned_technician_id !==
      input.auth.userId
  ) {
    return accessFailure(
      403,
      "This route is assigned to another technician.",
    );
  }

  return {
    ok: true,
    admin,
    routeDay,
  };
}

export async function getAuthorizedFieldStopBundle(
  input: {
    auth: AuthorizedFieldAuth;
    routeStopId?: string | null;
    visitId?: string | null;
    bookingId?: string | null;
  },
): Promise<
  AuthorizedFieldStopBundle |
  FieldAccessFailure
> {
  const routeStopId =
    input.routeStopId?.trim() ?? "";

  const visitId =
    input.visitId?.trim() ?? "";

  const suppliedBookingId =
    input.bookingId?.trim() ?? "";

  if (
    !routeStopId &&
    !visitId
  ) {
    return accessFailure(
      400,
      "The field request must identify a service stop.",
    );
  }

  const admin =
    getSupabaseAdmin();

  const stopResult =
    routeStopId
      ? await admin
          .from("route_stops")
          .select("*")
          .eq("id", routeStopId)
          .maybeSingle()
      : await admin
          .from("route_stops")
          .select("*")
          .eq(
            "service_visit_id",
            visitId,
          )
          .maybeSingle();

  if (stopResult.error) {
    return accessFailure(
      500,
      "The field stop could not be verified.",
    );
  }

  const stop =
    stopResult.data ?? null;

  if (!stop) {
    return accessFailure(
      404,
      "The field stop could not be found.",
    );
  }

  if (
    routeStopId &&
    stop.id !== routeStopId
  ) {
    return accessFailure(
      400,
      "The route-stop identifiers do not match.",
    );
  }

  if (
    visitId &&
    stop.service_visit_id !==
      visitId
  ) {
    return accessFailure(
      400,
      "The service visit does not belong to this stop.",
    );
  }

  if (!stop.route_day_id) {
    return accessFailure(
      404,
      "The field stop is not attached to a route.",
    );
  }

  const routeAccess =
    await getAuthorizedFieldRouteDay({
      auth: input.auth,
      routeDayId:
        stop.route_day_id,
    });

  if (!routeAccess.ok) {
    return routeAccess;
  }

  if (!stop.service_visit_id) {
    return accessFailure(
      404,
      "The field stop does not have a service visit.",
    );
  }

  const {
    data: visit,
    error: visitError,
  } = await admin
    .from("service_visits")
    .select("*")
    .eq(
      "id",
      stop.service_visit_id,
    )
    .maybeSingle();

  if (visitError) {
    return accessFailure(
      500,
      "The service visit could not be verified.",
    );
  }

  if (!visit) {
    return accessFailure(
      404,
      "The service visit could not be found.",
    );
  }

  const resolvedBookingId =
    stop.booking_id ??
    visit.booking_id ??
    "";

  if (!resolvedBookingId) {
    return accessFailure(
      404,
      "The stop does not have a booking.",
    );
  }

  if (
    suppliedBookingId &&
    suppliedBookingId !==
      resolvedBookingId
  ) {
    return accessFailure(
      400,
      "The booking does not belong to this field stop.",
    );
  }

  if (
    stop.booking_id &&
    visit.booking_id &&
    stop.booking_id !==
      visit.booking_id
  ) {
    return accessFailure(
      400,
      "The stop and service visit reference different bookings.",
    );
  }

  const {
    data: booking,
    error: bookingError,
  } = await admin
    .from("bookings")
    .select("*")
    .eq(
      "id",
      resolvedBookingId,
    )
    .maybeSingle();

  if (bookingError) {
    return accessFailure(
      500,
      "The booking could not be verified.",
    );
  }

  if (!booking) {
    return accessFailure(
      404,
      "The booking could not be found.",
    );
  }

  if (
    visit.booking_id &&
    visit.booking_id !== booking.id
  ) {
    return accessFailure(
      400,
      "The service visit and booking do not match.",
    );
  }

  return {
    ok: true,
    admin,
    routeDay:
      routeAccess.routeDay,
    stop,
    visit,
    booking,
  };
}
