import "server-only";

import { getTurnstileEnv } from "@/lib/env";
import { logger } from "@/lib/server/logger";

type TurnstileSiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

type VerifyTurnstileInput = {
  token?: string | null;
  remoteIp?: string;
  requestId: string;
  route: string;
  expectedAction?: string;
};

export type TurnstileVerificationResult =
  | { success: true; requestId: string }
  | {
      success: false;
      requestId: string;
      error: string;
      status: number;
      codes?: string[];
    };

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

export async function verifyTurnstileToken({
  token,
  remoteIp,
  requestId,
  route,
  expectedAction,
}: VerifyTurnstileInput): Promise<TurnstileVerificationResult> {
  const { secretKey } = getTurnstileEnv();
  const cleanToken = token?.trim();

  if (!secretKey) {
    logger.error("turnstile_secret_missing", { requestId, route });
    return {
      success: false,
      requestId,
      status: 503,
      error: "Verification is not configured. Please contact Clean Curb Co.",
    };
  }

  if (!cleanToken) {
    logger.warn("turnstile_token_missing", { requestId, route });
    return {
      success: false,
      requestId,
      status: 403,
      error: "Verification failed. Please refresh the challenge and try again.",
      codes: ["missing-input-response"],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const form = new FormData();
    form.set("secret", secretKey);
    form.set("response", cleanToken);
    form.set("idempotency_key", crypto.randomUUID());
    if (remoteIp) form.set("remoteip", remoteIp);

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const result = (await response.json()) as TurnstileSiteverifyResponse;
    const durationMs = Math.round(performance.now() - startedAt);
    const codes = result["error-codes"] ?? [];
    const isTestingSecret = secretKey.startsWith("1x000");
    const actionMismatch =
      Boolean(expectedAction) &&
      !isTestingSecret &&
      Boolean(result.action) &&
      result.action !== expectedAction;
    const actionMissing =
      Boolean(expectedAction) && !isTestingSecret && !result.action;

    if (!response.ok || !result.success || actionMismatch) {
      logger.warn("turnstile_validation_failed", {
        requestId,
        route,
        durationMs,
        status: response.status.toString(),
        metadata: {
          codes,
          hostname: result.hostname ?? null,
          action: result.action ?? null,
          expectedAction: expectedAction ?? null,
          actionMismatch,
          actionMissing,
        },
      });
      return {
        success: false,
        requestId,
        status: 403,
        error: "Verification failed. Please refresh the challenge and try again.",
        codes: actionMismatch ? [...codes, "action-mismatch"] : codes,
      };
    }

    logger.info("turnstile_validation_succeeded", {
      requestId,
      route,
      durationMs,
      metadata: {
        hostname: result.hostname ?? null,
        action: result.action ?? null,
      },
    });
    return { success: true, requestId };
  } catch (error) {
    logger.error("turnstile_validation_error", {
      requestId,
      route,
      error,
    });
    return {
      success: false,
      requestId,
      status: 503,
      error: "Verification is temporarily unavailable. Please try again.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
