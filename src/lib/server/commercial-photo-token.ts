import "server-only";

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export function createCommercialPhotoUploadToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCommercialPhotoUploadToken(
  token: string,
) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function commercialPhotoUploadTokenMatches(
  token: string,
  expectedHash: string,
) {
  const received = Buffer.from(
    hashCommercialPhotoUploadToken(token),
    "utf8",
  );

  const expected = Buffer.from(
    expectedHash,
    "utf8",
  );

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function getCommercialPhotoUploadExpiration() {
  return new Date(
    Date.now() + 72 * 60 * 60 * 1000,
  ).toISOString();
}
