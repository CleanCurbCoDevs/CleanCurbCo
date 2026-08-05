import "server-only";

import type {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

type AdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type ChecklistRpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error:
    ChecklistRpcError | null;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<
      string,
      unknown
    >,
  ) => PromiseLike<RpcResponse>;
};

type ChecklistFailure = {
  ok: false;
  message: string;
  code: string | null;
  error:
    ChecklistRpcError | null;
};

type ChecklistSuccess<Data> = {
  ok: true;
  data: Data;
};

type ChecklistResult<Data> =
  | ChecklistSuccess<Data>
  | ChecklistFailure;

export type ChecklistWorkResult = {
  checklistId: string;
  visitId: string;
  routeStopId: string;
  bookingId: string;
  customerId: string | null;
  generation: number;
  unresolvedCount: number;
  inProgress: boolean;
  alreadySubmitted: boolean;
  preparedAt?: string;
  storageBucket?: string;
  storagePath?: string;
};

export type ChecklistFinalizationResult = {
  alreadyFinalized: boolean;
  checklistId: string;
  submittedAt: string;
  storageBucket: string;
  storagePath: string;
};

function checklistErrorCode(
  message: string,
) {
  const marker =
    "checklist_submission:";

  const index =
    message.indexOf(marker);

  if (index < 0) {
    return null;
  }

  return (
    message
      .slice(
        index +
          marker.length,
      )
      .split(/[\s:]/)[0]
      ?.trim() ||
    null
  );
}

function checklistErrorMessage(
  message: string,
) {
  if (
    message.includes(
      "checklist_submission:not_assigned",
    )
  ) {
    return "This checklist belongs to another technician’s route.";
  }

  if (
    message.includes(
      "checklist_submission:proof_locked",
    )
  ) {
    return "This checklist has already been submitted and is locked.";
  }

  if (
    message.includes(
      "checklist_submission:not_in_progress",
    )
  ) {
    return "Start the service before submitting the final checklist.";
  }

  if (
    message.includes(
      "checklist_submission:invalid_stage",
    )
  ) {
    return "Arrive at the stop before saving checklist progress.";
  }

  if (
    message.includes(
      "checklist_submission:stale_items",
    )
  ) {
    return "The checklist changed after this page loaded. Refresh it before saving.";
  }

  if (
    message.includes(
      "checklist_submission:invalid_items",
    )
  ) {
    return "One or more submitted checklist items are invalid.";
  }

  if (
    message.includes(
      "checklist_submission:stale_generation",
    )
  ) {
    return "A newer checklist submission attempt already exists.";
  }

  if (
    message.includes(
      "checklist_submission:archive_missing",
    )
  ) {
    return "Supabase has not confirmed the checklist PDF archive.";
  }

  if (
    message.includes(
      "checklist_submission:invalid_archive",
    )
  ) {
    return "The generated PDF does not belong to this checklist submission.";
  }

  if (
    message.includes(
      "checklist_submission:notes_too_long",
    )
  ) {
    return "Shorten the customer-facing checklist notes before saving.";
  }

  if (
    message.includes(
      "checklist_submission:stop_missing",
    ) ||
    message.includes(
      "checklist_submission:visit_missing",
    ) ||
    message.includes(
      "checklist_submission:booking_missing",
    ) ||
    message.includes(
      "checklist_submission:checklist_missing",
    ) ||
    message.includes(
      "checklist_submission:missing_relationship",
    )
  ) {
    return "The related checklist or service stop could not be loaded.";
  }

  if (
    message.includes(
      "checklist_submission:booking_mismatch",
    ) ||
    message.includes(
      "checklist_submission:relationship_mismatch",
    )
  ) {
    return "The checklist records do not belong to the same service stop.";
  }

  return "The checklist operation failed. Refresh the stop and try again.";
}

async function invokeChecklistRpc<
  Data,
>(
  admin: AdminClient,
  functionName: string,
  args: Record<
    string,
    unknown
  >,
): Promise<
  ChecklistResult<Data>
> {
  const client =
    admin as unknown as RpcClient;

  const {
    data,
    error,
  } = await client.rpc(
    functionName,
    args,
  );

  if (error) {
    return {
      ok: false,
      message:
        checklistErrorMessage(
          error.message,
        ),
      code:
        checklistErrorCode(
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
        "The checklist operation did not return a valid result.",
      code: null,
      error: null,
    };
  }

  return {
    ok: true,
    data: data as Data,
  };
}

export function saveChecklistWork(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    items: Array<{
      id: string;
      status: string;
      notes: string | null;
    }>;
    overallNotes: string | null;
    prepareSubmission: boolean;
  },
) {
  return invokeChecklistRpc<
    ChecklistWorkResult
  >(
    admin,
    "field_save_checklist_work_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_items:
        input.items,
      p_overall_notes:
        input.overallNotes,
      p_prepare_submission:
        input.prepareSubmission,
    },
  );
}

export function finalizeChecklistSubmission(
  admin: AdminClient,
  input: {
    checklistId: string;
    actorProfileId: string;
    generation: number;
    storageBucket: string;
    storagePath: string;
  },
) {
  return invokeChecklistRpc<
    ChecklistFinalizationResult
  >(
    admin,
    "field_finalize_checklist_submission_atomic",
    {
      p_checklist_id:
        input.checklistId,
      p_actor_profile_id:
        input.actorProfileId,
      p_generation:
        input.generation,
      p_storage_bucket:
        input.storageBucket,
      p_storage_path:
        input.storagePath,
    },
  );
}

export function failChecklistSubmission(
  admin: AdminClient,
  input: {
    checklistId: string;
    actorProfileId: string;
    generation: number;
    error: string;
  },
) {
  return invokeChecklistRpc<{
    changed: boolean;
    checklistId?: string;
    reason?: string;
  }>(
    admin,
    "field_fail_checklist_submission_atomic",
    {
      p_checklist_id:
        input.checklistId,
      p_actor_profile_id:
        input.actorProfileId,
      p_generation:
        input.generation,
      p_error:
        input.error,
    },
  );
}
