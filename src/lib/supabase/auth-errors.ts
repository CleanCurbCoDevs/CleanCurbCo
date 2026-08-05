type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

export function isRecoverableSupabaseSessionError(
  error: unknown,
) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate =
    error as AuthErrorLike;

  const code =
    typeof candidate.code === "string"
      ? candidate.code.toLowerCase()
      : "";

  const message =
    typeof candidate.message === "string"
      ? candidate.message.toLowerCase()
      : "";

  const name =
    typeof candidate.name === "string"
      ? candidate.name.toLowerCase()
      : "";

  return (
    code === "refresh_token_not_found" ||
    message.includes(
      "invalid refresh token",
    ) ||
    message.includes(
      "refresh token not found",
    ) ||
    name.includes(
      "authrefreshdiscardederror",
    ) ||
    message.includes(
      "session state changed mid-flight",
    )
  );
}
