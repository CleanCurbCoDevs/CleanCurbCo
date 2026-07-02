import { addOns } from "@/lib/site";
import type { ServiceFrequency } from "@/types/booking";

type PriceInput = {
  binCount: number;
  frequency: ServiceFrequency;
  addOns: string[];
  applyFoundingNeighborPromo?: boolean;
};

type FoundingNeighborSpecialInput = {
  binCount: number;
  frequency: ServiceFrequency;
  addOns?: string[];
  createdAt?: string | null;
  neighborhood?: string | null;
  estimatedPrice?: number | null;
};

export type FoundingNeighborSpecialStatus =
  | "eligible"
  | "applied"
  | "not_eligible";

export const pricingConfig = {
  foundingNeighborSpecialEnabled: true,
  foundingNeighborRecurringTwoBinFirstCleanPrice: 25,
  recurringExtraBinPrice: 10,
  foundingNeighborCutoffDate: "2026-07-13T23:59:59-04:00",
  foundingNeighborRouteLabel: "Cane Bay launch route",
};

const foundingRouteNeighborhoods = [
  "cane bay",
  "cane bay plantation",
  "lindera preserve",
  "the oaks",
  "old rice retreat",
  "sanctuary cove",
  "four seasons",
  "lakes of cane bay",
];

const recurringBase: Record<ServiceFrequency, number> = {
  one_time: 0,
  monthly: 25,
  every_other_month: 30,
  quarterly: 35,
};

export function calculateBasePrice(binCount: number, frequency: ServiceFrequency) {
  const safeBinCount = Math.max(1, binCount);

  if (frequency === "one_time") {
    if (safeBinCount === 1) return 25;
    if (safeBinCount === 2) return 35;
    if (safeBinCount === 3) return 45;
    return 45 + (safeBinCount - 3) * 10;
  }

  const extraBins = Math.max(0, safeBinCount - 2);
  return recurringBase[frequency] + extraBins * pricingConfig.recurringExtraBinPrice;
}

export function calculateBookingEstimate(input: PriceInput) {
  const addOnTotal = input.addOns.reduce((total, addOnId) => {
    const addOn = addOns.find((item) => item.id === addOnId);
    return total + (addOn?.estimate ?? 0);
  }, 0);

  const eligibleForFoundingSpecial =
    pricingConfig.foundingNeighborSpecialEnabled &&
    input.applyFoundingNeighborPromo &&
    input.frequency !== "one_time" &&
    input.binCount <= 2;

  const basePrice = eligibleForFoundingSpecial
    ? pricingConfig.foundingNeighborRecurringTwoBinFirstCleanPrice
    : calculateBasePrice(input.binCount, input.frequency);

  return basePrice + addOnTotal;
}

export function calculateEstimatedPrice(input: PriceInput) {
  return calculateBookingEstimate(input);
}

export function getFoundingNeighborSpecialStatus(
  input: FoundingNeighborSpecialInput,
) {
  const addOnsForEstimate = input.addOns ?? [];
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const cutoff = new Date(pricingConfig.foundingNeighborCutoffDate);
  const isBeforeCutoff = Number.isNaN(createdAt.getTime())
    ? false
    : createdAt <= cutoff;
  const isRecurring = input.frequency !== "one_time";
  const isFoundingRoute = isFoundingRouteNeighborhood(input.neighborhood);
  const isTwoBinClean = input.binCount <= 2;
  const standardPrice = calculateBookingEstimate({
    binCount: input.binCount,
    frequency: input.frequency,
    addOns: addOnsForEstimate,
    applyFoundingNeighborPromo: false,
  });
  const specialPrice = calculateBookingEstimate({
    binCount: input.binCount,
    frequency: input.frequency,
    addOns: addOnsForEstimate,
    applyFoundingNeighborPromo: true,
  });

  if (!pricingConfig.foundingNeighborSpecialEnabled) {
    return {
      status: "not_eligible" as const,
      eligible: false,
      applied: false,
      reason: "Special pricing is disabled.",
      standardPrice,
      specialPrice,
    };
  }

  if (!isRecurring) {
    return {
      status: "not_eligible" as const,
      eligible: false,
      applied: false,
      reason: "Not recurring.",
      standardPrice,
      specialPrice,
    };
  }

  if (!isFoundingRoute) {
    return {
      status: "not_eligible" as const,
      eligible: false,
      applied: false,
      reason: "Outside founding Cane Bay route.",
      standardPrice,
      specialPrice,
    };
  }

  if (!isBeforeCutoff) {
    return {
      status: "not_eligible" as const,
      eligible: false,
      applied: false,
      reason: "After promo period.",
      standardPrice,
      specialPrice,
    };
  }

  if (!isTwoBinClean) {
    return {
      status: "not_eligible" as const,
      eligible: false,
      applied: false,
      reason: "More than two bins.",
      standardPrice,
      specialPrice,
    };
  }

  const applied = input.estimatedPrice === undefined || input.estimatedPrice === null
    ? false
    : input.estimatedPrice === specialPrice;

  return {
    status: applied ? ("applied" as const) : ("eligible" as const),
    eligible: true,
    applied,
    reason: "Recurring Cane Bay route before launch.",
    standardPrice,
    specialPrice,
  };
}

export function shouldApplyFoundingNeighborSpecial(
  input: FoundingNeighborSpecialInput,
) {
  return getFoundingNeighborSpecialStatus(input).eligible;
}

export function formatFrequency(frequency: ServiceFrequency) {
  const labels: Record<ServiceFrequency, string> = {
    one_time: "One-Time Clean",
    monthly: "Fresh Routine - Monthly",
    every_other_month: "Most Popular - Every Other Month",
    quarterly: "Seasonal Fresh Start - Quarterly",
  };

  return labels[frequency];
}

function isFoundingRouteNeighborhood(neighborhood?: string | null) {
  const normalized = (neighborhood ?? "").trim().toLowerCase();
  if (!normalized || normalized === "other / not sure") return false;
  return foundingRouteNeighborhoods.some(
    (area) => normalized === area || normalized.includes(area),
  );
}
