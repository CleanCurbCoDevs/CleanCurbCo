export type ActionResult<Data = unknown> = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: Data;
};

export function actionSuccess<Data = unknown>(
  message: string,
  data?: Data,
): ActionResult<Data> {
  return { ok: true, message, data };
}

export function actionFailure(message: string): ActionResult {
  return { ok: false, error: message };
}
