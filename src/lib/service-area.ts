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
  "Other / Not sure",
];

const coveredZipCodes = new Set(["29486"]);

const coveredRouteKeywords = [
  { label: "Cane Bay", terms: ["cane bay", "canebay"] },
  { label: "Cane Bay Plantation", terms: ["cane bay plantation"] },
  { label: "Lindera Preserve", terms: ["lindera", "lindera preserve"] },
  { label: "The Oaks", terms: ["the oaks"] },
  { label: "Old Rice Retreat", terms: ["old rice", "old rice retreat"] },
  { label: "Sanctuary Cove", terms: ["sanctuary cove"] },
  { label: "Four Seasons", terms: ["four seasons"] },
  { label: "Lakes of Cane Bay", terms: ["lakes of cane bay"] },
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
  const isCoveredZip = coveredZipCodes.has(normalizedZip);
  const isSummervilleContext =
    normalizedCity.includes("summerville") || addressText.includes("summerville");

  if (
    isSouthCarolina &&
    (matchedNeighborhood || (isCoveredZip && isSummervilleContext))
  ) {
    const matchedArea =
      matchedNeighborhood?.label ??
      (input.neighborhood !== "Other / Not sure" && input.neighborhood
        ? input.neighborhood
        : "Cane Bay / nearby Summerville route");

    return {
      status: "covered",
      matchedArea,
      message:
        "Good news. This address looks like it is inside our current Cane Bay / nearby Summerville route area.",
      bookingHref: buildBookingHref(input, matchedArea),
    };
  }

  return {
    status: "not_covered",
    message:
      "Sorry, we are not there yet. Clean Curb Co. is starting in Cane Bay and nearby Summerville route pockets, and we plan to expand route by route in the future.",
  };
}

function buildBookingHref(input: ServiceAreaCheckInput, matchedArea: string) {
  const params = new URLSearchParams();
  params.set("serviceAreaChecked", "yes");
  setIfPresent(params, "streetAddress", input.streetAddress);
  setIfPresent(params, "city", input.city || "Summerville");
  setIfPresent(params, "state", input.state || "SC");
  setIfPresent(params, "zipCode", input.zipCode);
  setIfPresent(params, "neighborhood", normalizeBookingNeighborhood(matchedArea));

  return `/book?${params.toString()}`;
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
