import "server-only";

import type {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

type AdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error: RpcError | null;
};

type RpcCapableClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};

type LifecycleFailure = {
  ok: false;
  message: string;
  error: RpcError | null;
};

type LifecycleSuccess<Data> = {
  ok: true;
  data: Data;
};

type LifecycleResult<Data> =
  | LifecycleSuccess<Data>
  | LifecycleFailure;

export type StopTransitionResult = {
  changed: boolean;
  previousStatus: string;
  status: string;
  transitionAt?: string;
  routeStopId: string;
  visitId: string;
  bookingId: string | null;
};

export type StopCompletionResult = {
  alreadyCompleted: boolean;
  completedAt: string | null;
  beforeCount?: number;
  afterCount?: number;
  routeStopId: string;
  visitId: string;
  bookingId: string;
};

export type NextStopResult = {
  routeComplete: boolean;
  changed: boolean;
  nextStopId?: string;
  nextVisitId?: string;
  nextBookingId?: string | null;
  breakEnded?: boolean;
  breakId?: string;
};

export type FollowUpResult = {
  changed: boolean;
  status: "needs_follow_up";
  transitionAt?: string;
  routeStopId: string;
  visitId: string;
  bookingId: string;
};

export type RescheduleResult = {
  changed: boolean;
  requestCreated: boolean;
  requestId: string;
  status: "rescheduled";
  transitionAt: string;
  routeStopId: string;
  visitId: string;
  bookingId: string;
};

async function invokeLifecycleRpc<Data>(
  admin: AdminClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<LifecycleResult<Data>> {
  const rpcClient =
    admin as unknown as RpcCapableClient;

  const {
    data,
    error,
  } = await rpcClient.rpc(
    functionName,
    args,
  );

  if (error) {
    return {
      ok: false,
      message:
        lifecycleErrorMessage(
          error.message,
        ),
      error,
    };
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {
      ok: false,
      message:
        "The lifecycle operation did not return a valid result.",
      error: null,
    };
  }

  return {
    ok: true,
    data: data as Data,
  };
}

function lifecycleErrorMessage(
  message: string,
) {
  if (
    message.includes(
      "field_lifecycle:not_assigned",
    )
  ) {
    return "This route is assigned to another technician.";
  }

  if (
    message.includes(
      "field_lifecycle:invalid_transition",
    )
  ) {
    return "That stop-status change is not allowed from its current state.";
  }

  if (
    message.includes(
      "field_lifecycle:use_completion_action",
    )
  ) {
    return "Use Complete Stop after finishing the required service proof.";
  }

  if (
    message.includes(
      "field_lifecycle:inconsistent_status",
    ) ||
    message.includes(
      "field_lifecycle:partial_completion",
    )
  ) {
    return "The stop records do not agree. Admin review is required before continuing.";
  }

  if (
    message.includes(
      "field_lifecycle:not_in_progress",
    )
  ) {
    return "Start service before completing this stop.";
  }

  if (
    message.includes(
      "field_lifecycle:payment_required",
    )
  ) {
    return "Record the required payment before completing this stop.";
  }

  if (
    message.includes(
      "field_lifecycle:checklist_required",
    )
  ) {
    return "Finish and submit the cleaning checklist before completing this stop.";
  }

  if (
    message.includes(
      "field_lifecycle:before_photo_required",
    )
  ) {
    return "Upload a before photo or document a valid before-photo exception.";
  }

  if (
    message.includes(
      "field_lifecycle:after_photo_required",
    )
  ) {
    return "Upload an after photo or document a valid after-photo exception.";
  }

  if (
    message.includes(
      "field_lifecycle:current_stop_incomplete",
    )
  ) {
    return "Complete the current stop before moving to the next one.";
  }

  if (
    message.includes(
      "field_lifecycle:active_break",
    )
  ) {
    return "End your active break before moving to the next stop.";
  }

  if (
    message.includes(
      "field_lifecycle:next_stop_already_started",
    )
  ) {
    return "The next stop has already moved beyond the on-the-way stage.";
  }

  if (
    message.includes(
      "field_lifecycle:break_not_owned",
    )
  ) {
    return "That break does not belong to your account.";
  }

  if (
    message.includes(
      "field_lifecycle:break_already_ended",
    )
  ) {
    return "That break has already ended.";
  }

  if (
    message.includes(
      "field_lifecycle:stop_missing",
    ) ||
    message.includes(
      "field_lifecycle:visit_missing",
    ) ||
    message.includes(
      "field_lifecycle:booking_missing",
    )
  ) {
    return "The related field stop could not be loaded.";
  }
    if (
    message.includes(
      "field_lifecycle:invalid_follow_up_reason",
    )
  ) {
    return "Choose a valid follow-up reason.";
  }

  if (
    message.includes(
      "field_lifecycle:follow_up_notes_required",
    )
  ) {
    return "Add a note explaining the follow-up problem.";
  }

  if (
    message.includes(
      "field_lifecycle:reschedule_details_required",
    )
  ) {
    return "Add a requested date or note for admin.";
  }

  if (
    message.includes(
      "field_lifecycle:break_route_mismatch",
    )
  ) {
    return "This break belongs to a different route. Return to Today and open the correct route.";
  }
  return "The field lifecycle operation failed. Refresh the page and try again.";
}

export function transitionFieldStop(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    nextStatus: string;
  },
) {
  return invokeLifecycleRpc<
    StopTransitionResult
  >(
    admin,
    "field_transition_stop_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_next_status:
        input.nextStatus,
    },
  );
}

export function completeFieldStop(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    beforeExceptionAllowed: boolean;
    afterExceptionAllowed: boolean;
  },
) {
  return invokeLifecycleRpc<
    StopCompletionResult
  >(
    admin,
    "field_complete_stop_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_before_exception_allowed:
        input.beforeExceptionAllowed,
      p_after_exception_allowed:
        input.afterExceptionAllowed,
    },
  );
}

export function prepareNextFieldStop(
  admin: AdminClient,
  input: {
    currentRouteStopId: string;
    actorProfileId: string;
  },
) {
  return invokeLifecycleRpc<
    NextStopResult
  >(
    admin,
    "field_prepare_next_stop_atomic",
    {
      p_current_route_stop_id:
        input.currentRouteStopId,
      p_actor_profile_id:
        input.actorProfileId,
    },
  );
}

export function endBreakAndPrepareNextFieldStop(
  admin: AdminClient,
  input: {
    breakId: string;
    currentRouteStopId: string;
    actorProfileId: string;
  },
) {
  return invokeLifecycleRpc<
    NextStopResult
  >(
    admin,
    "field_end_break_and_prepare_next_stop_atomic",
    {
      p_break_id:
        input.breakId,
      p_current_route_stop_id:
        input.currentRouteStopId,
      p_actor_profile_id:
        input.actorProfileId,
    },
  );
}
export function markFieldStopFollowUp(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    reason: string;
    notes: string | null;
  },
) {
  return invokeLifecycleRpc<
    FollowUpResult
  >(
    admin,
    "field_mark_follow_up_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_reason:
        input.reason,
      p_notes:
        input.notes,
    },
  );
}

export function requestFieldStopReschedule(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    requestedRouteDay:
      | string
      | null;
    notes: string | null;
  },
) {
  return invokeLifecycleRpc<
    RescheduleResult
  >(
    admin,
    "field_request_reschedule_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_requested_route_day:
        input.requestedRouteDay,
      p_notes:
        input.notes,
    },
  );
}
