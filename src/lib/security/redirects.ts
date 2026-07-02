import type { AppRole } from "@/types/database";

const REDIRECT_PARAM_PATTERN = /^(next|redirect|redirect_to|redirectTo|return_to|returnTo|returnPath)$/i;
const BLOCKED_SCHEME_PATTERN = /^(?:javascript|data|vbscript|file):/i;

const roleAllowedPrefixes: Record<AppRole, string[]> = {
  customer: ["/portal", "/account-setup", "/payment-setup"],
  technician: ["/field"],
  admin: ["/"],
  owner: ["/"],
};

type RedirectOptions = {
  allowedPrefixes?: readonly string[];
  fallback?: string | null;
  allowSearchParams?: boolean;
};

function decodeRepeatedly(value: string) {
  let current = value;

  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) return decoded;
      current = decoded;
    } catch {
      return "";
    }
  }

  return current;
}

function hasUnsafeNestedRedirect(url: URL) {
  for (const [key, value] of url.searchParams.entries()) {
    if (REDIRECT_PARAM_PATTERN.test(key) && value) {
      const nested = sanitizeInternalRedirectPath(value, {
        allowedPrefixes: ["/"],
        allowSearchParams: false,
      });
      if (!nested) return true;
    }
  }

  return false;
}

export function sanitizeInternalRedirectPath(
  value: unknown,
  options: RedirectOptions = {},
) {
  if (typeof value !== "string") return options.fallback ?? null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return options.fallback ?? null;

  const decoded = decodeRepeatedly(trimmed);
  const candidates = [trimmed, decoded];
  const hasBlockedShape = candidates.some((candidate) => {
    const lower = candidate.toLowerCase();
    return (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.includes("\\") ||
      candidate.includes("\u0000") ||
      BLOCKED_SCHEME_PATTERN.test(lower)
    );
  });

  if (hasBlockedShape) return options.fallback ?? null;

  const rawPath = decoded.split(/[?#]/)[0] ?? "";
  if (rawPath.split("/").some((segment) => segment === ".." || segment === ".")) {
    return options.fallback ?? null;
  }

  let url: URL;
  try {
    url = new URL(decoded, "https://cleancurbco.com");
  } catch {
    return options.fallback ?? null;
  }

  if (url.origin !== "https://cleancurbco.com") return options.fallback ?? null;

  const allowedPrefixes = options.allowedPrefixes ?? ["/"];
  const isAllowed = allowedPrefixes.some((prefix) => {
    if (prefix === "/") return url.pathname.startsWith("/");
    return url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
  });

  if (!isAllowed) return options.fallback ?? null;

  if (options.allowSearchParams !== false && hasUnsafeNestedRedirect(url)) {
    return options.fallback ?? null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeRedirectForRole(
  role: AppRole | null | undefined,
  value: unknown,
  fallback: string | null = defaultRedirectForRole(role),
) {
  const effectiveRole = role ?? "customer";
  return sanitizeInternalRedirectPath(value, {
    allowedPrefixes: roleAllowedPrefixes[effectiveRole],
    fallback,
  });
}

export function canRoleSafelyAccessPath(
  role: AppRole | null | undefined,
  path: unknown,
) {
  return Boolean(safeRedirectForRole(role, path, null));
}

function defaultRedirectForRole(role: AppRole | null | undefined) {
  if (role === "admin" || role === "owner") return "/admin";
  if (role === "technician") return "/field/today";
  return "/portal";
}
