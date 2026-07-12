import "server-only";

const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

const DEFAULT_CENTER_LATITUDE = 33.105;
const DEFAULT_CENTER_LONGITUDE = -80.125;
const DEFAULT_RADIUS_MILES = 20;
const GEOCODER_TIMEOUT_MS = 7000;

export type ServiceAreaAddress = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode?: string | null;
};

export type ServiceAreaDecision = {
  status: "covered" | "not_covered" | "unverified";
  message: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  maxRadiusMiles: number;
  matchedAddress?: string;
};

type CensusGeocoderResponse = {
  result?: {
    addressMatches?: Array<{
      coordinates?: {
        x?: number;
        y?: number;
      };
      matchedAddress?: string;
      addressComponents?: {
        state?: string;
      };
    }>;
  };
};

export async function evaluateServiceArea(
  address: ServiceAreaAddress,
): Promise<ServiceAreaDecision> {
  const config = getServiceAreaConfig();

  const streetAddress = address.streetAddress.trim();
  const city = address.city.trim();
  const state = address.state.trim();
  const zipCode = address.zipCode?.trim() ?? "";

  if (!streetAddress || !city || !state) {
    return {
      status: "unverified",
      message:
        "Please enter the complete service address so we can verify that it is within our route area.",
      maxRadiusMiles: config.radiusMiles,
    };
  }

  const normalizedState = state.toUpperCase();

  if (normalizedState !== "SC" && normalizedState !== "SOUTH CAROLINA") {
    return {
      status: "not_covered",
      message:
        "This address is outside our current South Carolina service area.",
      maxRadiusMiles: config.radiusMiles,
    };
  }

  const geocodedAddress = await geocodeAddress({
    streetAddress,
    city,
    state,
    zipCode,
  });

  if (!geocodedAddress) {
    return {
      status: "unverified",
      message:
        "We could not confidently verify that address. Please check the street, city, state, and ZIP code and try again.",
      maxRadiusMiles: config.radiusMiles,
    };
  }

  if (
    geocodedAddress.state &&
    geocodedAddress.state.toUpperCase() !== "SC"
  ) {
    return {
      status: "not_covered",
      message:
        "The verified address is outside our current South Carolina service area.",
      latitude: geocodedAddress.latitude,
      longitude: geocodedAddress.longitude,
      maxRadiusMiles: config.radiusMiles,
      matchedAddress: geocodedAddress.matchedAddress,
    };
  }

  const distanceMiles = calculateDistanceMiles(
    config.centerLatitude,
    config.centerLongitude,
    geocodedAddress.latitude,
    geocodedAddress.longitude,
  );

  const roundedDistance = Number(distanceMiles.toFixed(2));

  if (distanceMiles > config.radiusMiles) {
    return {
      status: "not_covered",
      message:
        "This address is outside our standard service radius. Contact us and we may still be able to help when a route brings us nearby.",
      latitude: geocodedAddress.latitude,
      longitude: geocodedAddress.longitude,
      distanceMiles: roundedDistance,
      maxRadiusMiles: config.radiusMiles,
      matchedAddress: geocodedAddress.matchedAddress,
    };
  }

  return {
    status: "covered",
    message:
      "Good news! This address is within our current standard service radius.",
    latitude: geocodedAddress.latitude,
    longitude: geocodedAddress.longitude,
    distanceMiles: roundedDistance,
    maxRadiusMiles: config.radiusMiles,
    matchedAddress: geocodedAddress.matchedAddress,
  };
}

export function getServiceAreaConfig() {
  return {
    centerLatitude: readNumberEnvironmentVariable(
      "SERVICE_AREA_CENTER_LAT",
      DEFAULT_CENTER_LATITUDE,
    ),
    centerLongitude: readNumberEnvironmentVariable(
      "SERVICE_AREA_CENTER_LNG",
      DEFAULT_CENTER_LONGITUDE,
    ),
    radiusMiles: readNumberEnvironmentVariable(
      "SERVICE_AREA_RADIUS_MILES",
      DEFAULT_RADIUS_MILES,
    ),
  };
}

async function geocodeAddress(address: ServiceAreaAddress) {
  const completeAddress = [
    address.streetAddress,
    address.city,
    address.state,
    address.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set("address", completeAddress);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as CensusGeocoderResponse;
    const match = data.result?.addressMatches?.[0];

    const longitude = Number(match?.coordinates?.x);
    const latitude = Number(match?.coordinates?.y);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      state: match?.addressComponents?.state ?? "",
      matchedAddress: match?.matchedAddress ?? completeAddress,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function calculateDistanceMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMiles = 3958.8;

  const latitudeDifference = degreesToRadians(
    endLatitude - startLatitude,
  );
  const longitudeDifference = degreesToRadians(
    endLongitude - startLongitude,
  );

  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2;

  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusMiles * angularDistance;
}

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function readNumberEnvironmentVariable(
  name: string,
  fallback: number,
) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) ? value : fallback;
}
