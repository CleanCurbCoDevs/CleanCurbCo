import "server-only";

import type {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

type AdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type ProofRpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error: ProofRpcError | null;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};

type ProofFailure = {
  ok: false;
  message: string;
  code: string | null;
  error: ProofRpcError | null;
};

type ProofSuccess<Data> = {
  ok: true;
  data: Data;
};

type ProofResult<Data> =
  | ProofSuccess<Data>
  | ProofFailure;

export type PhotoAttachmentResult = {
  alreadyAttached: boolean;
  photoId: string;
  visitId: string;
  routeStopId: string;
  photoType:
    | "before"
    | "after"
    | "issue"
    | "other";
};

export type PhotoDeletionResult = {
  alreadyDeleted: boolean;
  photoId?: string;
  visitId?: string;
  routeStopId?: string;
  photoType?:
    | "before"
    | "after"
    | "issue"
    | "other";
  storageBucket?: string;
  storagePath?: string;
};

export type PhotoExceptionResult = {
  beforeException: boolean;
  afterException: boolean;
  reason: string | null;
  recordedAt: string | null;
};

function proofErrorCode(
  message: string,
) {
  const marker =
    "field_proof:";

  const markerIndex =
    message.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  return message
    .slice(
      markerIndex +
        marker.length,
    )
    .split(/[\s:]/)[0]
    ?.trim() || null;
}

function proofErrorMessage(
  message: string,
) {
  if (
    message.includes(
      "field_proof:not_assigned",
    )
  ) {
    return "This proof record belongs to another technician’s route.";
  }

  if (
    message.includes(
      "field_proof:proof_locked",
    )
  ) {
    return "This service proof is locked and can no longer be changed.";
  }

  if (
    message.includes(
      "field_proof:not_in_progress",
    )
  ) {
    return "Start the service before documenting a photo exception.";
  }

  if (
    message.includes(
      "field_proof:invalid_photo_stage",
    )
  ) {
    return "This type of photo cannot be uploaded at the stop’s current stage.";
  }

  if (
    message.includes(
      "field_proof:exception_reason_required",
    )
  ) {
    return "Add a short explanation before using a photo exception.";
  }

  if (
    message.includes(
      "field_proof:before_photo_exists",
    )
  ) {
    return "A before photo already exists, so a before-photo exception is not needed.";
  }

  if (
    message.includes(
      "field_proof:after_photo_exists",
    )
  ) {
    return "An after photo already exists, so an after-photo exception is not needed.";
  }

  if (
    message.includes(
      "field_proof:invalid_photo_size",
    )
  ) {
    return "Each photo must be 20 MB or smaller.";
  }

  if (
    message.includes(
      "field_proof:invalid_photo_type",
    )
  ) {
    return "Use a supported service-photo format and category.";
  }

  if (
    message.includes(
      "field_proof:invalid_photo_path",
    ) ||
    message.includes(
      "field_proof:invalid_photo_bucket",
    )
  ) {
    return "The uploaded photo does not belong to this service stop.";
  }

  if (
    message.includes(
      "field_proof:photo_object_missing",
    )
  ) {
    return "Supabase has not confirmed the uploaded photo yet.";
  }

  if (
    message.includes(
      "field_proof:photo_relationship_mismatch",
    ) ||
    message.includes(
      "field_proof:booking_mismatch",
    )
  ) {
    return "The photo and service records do not belong to the same stop.";
  }

  if (
    message.includes(
      "field_proof:stop_missing",
    ) ||
    message.includes(
      "field_proof:visit_missing",
    ) ||
    message.includes(
      "field_proof:booking_missing",
    ) ||
    message.includes(
      "field_proof:missing_relationship",
    )
  ) {
    return "The related service stop could not be loaded.";
  }

  return "The service-proof operation failed. Refresh the stop and try again.";
}

async function invokeProofRpc<Data>(
  admin: AdminClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<ProofResult<Data>> {
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
        proofErrorMessage(
          error.message,
        ),
      code:
        proofErrorCode(
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
        "The service-proof operation did not return a valid result.",
      code: null,
      error: null,
    };
  }

  return {
    ok: true,
    data: data as Data,
  };
}

export function attachFieldServicePhoto(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    photoType: string;
    storageBucket: string;
    storagePath: string;
    contentType: string;
    fileSize: number;
  },
) {
  return invokeProofRpc<
    PhotoAttachmentResult
  >(
    admin,
    "field_attach_service_photo_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_photo_type:
        input.photoType,
      p_storage_bucket:
        input.storageBucket,
      p_storage_path:
        input.storagePath,
      p_content_type:
        input.contentType,
      p_file_size:
        input.fileSize,
    },
  );
}

export function deleteFieldServicePhoto(
  admin: AdminClient,
  input: {
    photoId: string;
    actorProfileId: string;
  },
) {
  return invokeProofRpc<
    PhotoDeletionResult
  >(
    admin,
    "field_delete_service_photo_atomic",
    {
      p_photo_id:
        input.photoId,
      p_actor_profile_id:
        input.actorProfileId,
    },
  );
}

export function setFieldPhotoException(
  admin: AdminClient,
  input: {
    routeStopId: string;
    actorProfileId: string;
    beforeException: boolean;
    afterException: boolean;
    reason: string | null;
  },
) {
  return invokeProofRpc<
    PhotoExceptionResult
  >(
    admin,
    "field_set_photo_exception_atomic",
    {
      p_route_stop_id:
        input.routeStopId,
      p_actor_profile_id:
        input.actorProfileId,
      p_before_exception:
        input.beforeException,
      p_after_exception:
        input.afterException,
      p_reason:
        input.reason,
    },
  );
}
