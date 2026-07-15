import "server-only";

import { createHash, randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/env";

export function createClaimToken() {
  return randomBytes(32).toString("base64url");
}

export function hashClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccountSetupLink(bookingId: string, token: string) {
  const url = new URL("/account-setup", getSiteUrl());
  url.searchParams.set("booking", bookingId);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createPaymentSetupLink(bookingId: string, token?: string | null) {
  const url = new URL("/payment-setup", getSiteUrl());
  url.searchParams.set("booking", bookingId);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export function createLoginClaimLink(
  bookingId: string,
  token: string,
) {
  const url = new URL("/login", getSiteUrl());

  url.searchParams.set("booking", bookingId);
  url.searchParams.set("token", token);
  url.searchParams.set("next", "/portal");

  return url.toString();
}
