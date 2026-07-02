import "server-only";

type LogLevel = "info" | "warn" | "error";

type LogContext = {
  route?: string;
  action?: string;
  requestId?: string;
  userId?: string | null;
  role?: string | null;
  customerId?: string | null;
  bookingId?: string | null;
  durationMs?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|api[_-]?key|service[_-]?role|stripe[_-]?secret|turnstile|card|cvc|cvv|session)/i;

export function createRequestId(headers?: Headers | null) {
  return (
    headers?.get("x-vercel-id") ||
    headers?.get("x-request-id") ||
    headers?.get("cf-ray") ||
    crypto.randomUUID()
  );
}

export function getClientIp(headers?: Headers | null) {
  const forwardedFor = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers?.get("cf-connecting-ip") || forwardedFor || undefined;
}

export function maskEmail(value?: string | null) {
  if (!value) return null;
  const [localPart, domain] = value.toLowerCase().split("@");
  if (!localPart || !domain) return "[invalid-email]";
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function maskPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

function safeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  return { message: String(error) };
}

function safeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(safeValue);
  if (value instanceof Error) return safeError(value);
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) return [key, "[redacted]"];
      if (/email/i.test(key) && typeof item === "string") return [key, maskEmail(item)];
      if (/phone/i.test(key) && typeof item === "string") return [key, maskPhone(item)];
      return [key, safeValue(item)];
    }),
  );
}

function emit(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    route: context.route,
    action: context.action,
    requestId: context.requestId,
    userId: context.userId,
    role: context.role,
    customerId: context.customerId,
    bookingId: context.bookingId,
    durationMs: context.durationMs,
    status: context.status,
    metadata: safeValue(context.metadata),
    error: safeError(context.error),
  };

  const message = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ),
  );

  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else {
    console.log(message);
  }
}

export const logger = {
  info(event: string, context?: LogContext) {
    emit("info", event, context);
  },
  warn(event: string, context?: LogContext) {
    emit("warn", event, context);
  },
  error(event: string, context?: LogContext) {
    emit("error", event, context);
  },
};
