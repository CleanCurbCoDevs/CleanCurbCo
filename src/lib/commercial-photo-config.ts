import type {
  CommercialPropertyType,
  CommercialServiceInterest,
} from "@/types/commercial";

export const COMMERCIAL_QUOTE_PHOTO_BUCKET =
  "commercial-quote-photos";

export const COMMERCIAL_QUOTE_MAX_PHOTOS = 6;

export const COMMERCIAL_QUOTE_MAX_PHOTO_BYTES =
  10 * 1024 * 1024;

export const COMMERCIAL_QUOTE_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const optionalPhotoServices =
  new Set<CommercialServiceInterest>([
    "commercial_trash_bins",
    "commercial_recycling_bins",
    "hoa_community_routes",
    "other_exterior_cleaning",
  ]);

const optionalPhotoPropertyTypes =
  new Set<CommercialPropertyType>([
    "office",
    "retail_small_business",
  ]);

export function shouldOfferCommercialQuotePhotos(input: {
  propertyType: CommercialPropertyType;
  serviceInterests: CommercialServiceInterest[];
}) {
  return (
    optionalPhotoPropertyTypes.has(input.propertyType) ||
    input.serviceInterests.some((service) =>
      optionalPhotoServices.has(service),
    )
  );
}

export function isAllowedCommercialPhotoType(
  value: string,
) {
  return (
    COMMERCIAL_QUOTE_PHOTO_TYPES as readonly string[]
  ).includes(value);
}

export function getCommercialPhotoExtension(
  filename: string,
  mimeType: string,
) {
  const filenameExtension = filename
    .toLowerCase()
    .split(".")
    .pop();

  const allowedExtensions = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif",
  ]);

  if (
    filenameExtension &&
    allowedExtensions.has(filenameExtension)
  ) {
    return filenameExtension === "jpeg"
      ? "jpg"
      : filenameExtension;
  }

  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  return extensionByMimeType[mimeType] ?? null;
}
