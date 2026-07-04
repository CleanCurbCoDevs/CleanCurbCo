import { neighborhoods } from "@/lib/site";

export type ServiceAreaCheckInput = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  neighborhood: string;
};

export type ServiceAreaCheckResult =
  | {
      status: "covered";
      matchedArea: string;
      message: string;
      bookingHref: string;
    }
  | {
      status: "not_covered";
      message: string;
    };

export const addressCheckerNeighborhoods = [
  "Cane Bay",
  ...neighborhoods.filter((neighborhood) => neighborhood !== "Other / Not sure"),
  "Downtown Summerville",
  "Nexton",
  "Carnes Crossroads",
  "Sangaree",
  "Goose Creek",
  "Moncks Corner",
  "Other / Not sure",
];

const coveredZipCodes = new Set([
  "29483", // Summerville
  "29485", // Summerville
  "29486", // Cane Bay / Nexton / Carnes Crossroads
  "29445", // Goose Creek
  "29461", // Moncks Corner
]);

const coveredCityKeywords = [
  { label: "Summerville", terms: ["summerville"] },
  { label: "Goose Creek", terms: ["goose creek", "goosecreek"] },
  { label: "Moncks Corner", terms: ["moncks corner", "monckscorner"] },
];

const coveredRouteKeywords = [
  { label: "Cane Bay", terms: ["cane bay", "canebay"] },
  { label: "Cane Bay Plantation", terms: ["cane bay plantation"] },
  { label: "Lindera Preserve", terms: ["lindera", "lindera preserve"] },
  { label: "The Oaks", terms: ["the oaks"] },
  { label: "Old Rice Retreat", terms: ["old rice", "old rice retreat"] },
  { label: "Sanctuary Cove", terms: ["sanctuary cove"] },
  { label: "Four Seasons", terms: ["four seasons"] },
  { label: "Lakes of Cane Bay", terms: ["lakes of cane bay"] },
  { label: "Downtown Summerville", terms: ["downtown summerville"] },
  { label: "Nexton", terms: ["nexton"] },
  { label: "Carnes Crossroads", terms: ["carnes crossroads", "carnes"] },
  { label: "Sangaree", terms: ["sangaree"] },
];

export function checkServiceArea(
  input: ServiceAreaCheckInput,
): ServiceAreaCheckResult {
  const normalizedState = normalize(input.state);
  const normalizedCity = normalize(input.city);
  const normalizedZip = digitsOnly(input.zipCode || input.streetAddress);
  const addressText = normalize(
    [
      input.streetAddress,
      input.city,
      input.state,
      input.zipCode,
      input.neighborhood,
    ].join(" "),
  );

  const isSouthCarolina =
    !normalizedState ||
    normalizedState === "sc" ||
    normalizedState === "south carolina" ||
    addressText.includes(" sc ") ||
    addressText.endsWith(" sc");

  const matchedNeighborhood = coveredRouteKeywords.find(({ terms }) =>
    terms.some((term) => addressText.includes(term)),
  );

  const matchedCity = coveredCityKeywords.find(({ terms }) =>
    terms.some(
      (term) => normalizedCity.includes(term) || addressText.includes(term),
    ),
  );

  const isCoveredZip = coveredZipCodes.has(normalizedZip);

  if (isSouthCarolina && (matchedNeighborhood || matchedCity || isCoveredZip)) {
    const matchedArea =
      matchedNeighborhood?.label ??
      matchedCity?.label ??
      zipLabel(normalizedZip) ??
      (input.neighborhood !== "Other / Not sure" && input.neighborhood
        ? input.neighborhood
        : "Summerville-area route review");

    return {
      status: "covered",
      matchedArea,
      message:
        "Good news. This address looks like it is inside our current route-review area. Booking still lets us confirm route fit, timing, final price, and service/payment terms before service.",
      bookingHref: buildBookingHref(input, matchedArea),
    };
  }

  return {
    status: "not_covered",
    message:
      "Sorry, we are not there yet. Clean Curb Co. is building routes around Summerville, Cane Bay, Goose Creek, Moncks Corner, and nearby communities route by route.",
  };
}

function zipLabel(zipCode: string) {
  const labels: Record<string, string> = {
    "29483": "Summerville",
    "29485": "Summerville",
    "29486": "Cane Bay / Nexton / Carnes Crossroads",
    "29445": "Goose Creek",
    "29461": "Moncks Corner",
  };

  return labels[zipCode] ?? null;
}

function buildBookingHref(input: ServiceAreaCheckInput, matchedArea: string) {
  const params = new URLSearchParams();
  params.set("serviceAreaChecked", "yes");
  setIfPresent(params, "streetAddress", input.streetAddress);
  setIfPresent(params, "city", input.city || defaultCityFromMatchedArea(matchedArea));
  setIfPresent(params, "state", input.state || "SC");
  setIfPresent(params, "zipCode", input.zipCode);
  setIfPresent(params, "neighborhood", normalizeBookingNeighborhood(matchedArea));

  return `/book?${params.toString()}`;
}

function defaultCityFromMatchedArea(matchedArea: string) {
  if (matchedArea.includes("Goose Creek")) return "Goose Creek";
  if (matchedArea.includes("Moncks Corner")) return "Moncks Corner";
  return "Summerville";
}

function normalizeBookingNeighborhood(value: string) {
  if (neighborhoods.includes(value)) {
    return value;
  }

  if (value === "Cane Bay") {
    return "Cane Bay Plantation";
  }

  return "Other / Not sure";
}

function setIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const cleanValue = value?.trim();
  if (cleanValue) {
    params.set(key, cleanValue);
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function digitsOnly(value: string) {
  const match = value.match(/\b\d{5}\b/);
  return match?.[0] ?? value.replace(/\D/g, "");
}