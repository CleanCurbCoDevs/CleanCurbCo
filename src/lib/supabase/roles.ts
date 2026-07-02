import type { AppRole } from "@/types/database";
import { canRoleSafelyAccessPath } from "@/lib/security/redirects";

export function isAdminRole(role?: AppRole | null) {
  return role === "admin" || role === "owner";
}

export function isOwnerRole(role?: AppRole | null) {
  return role === "owner";
}

export function isFieldRole(role?: AppRole | null) {
  return role === "technician" || isAdminRole(role);
}

export function defaultRouteForRole(role?: AppRole | null) {
  if (isAdminRole(role)) return "/admin";
  if (role === "technician") return "/field/today";
  return "/portal";
}

export function canRoleAccessPath(role: AppRole | null | undefined, path: string) {
  return canRoleSafelyAccessPath(role, path);
}
