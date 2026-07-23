import {
  commercialSiteConditions,
  type CommercialSiteCondition,
} from "@/types/commercial";

import {
  commercialAccessComplexities,
  commercialSupplyTiers,
  type CommercialAccessComplexity,
  type CommercialPricingInput,
  type CommercialPricingModel,
  type CommercialSupplyTier,
  type CommercialVisitType,
} from "@/types/commercial-pricing";

export function normalizeCommercialPricingInput(
  rawValue: unknown,
  expectedModel: CommercialPricingModel,
  visitType: CommercialVisitType,
): CommercialPricingInput {
  const raw = asRecord(rawValue);

  const base = {
    visitType,

    crewSize: boundedInteger(
      raw?.crewSize,
      1,
      20,
      2,
    ),

    condition: enumValue(
      raw?.condition,
      commercialSiteConditions,
      "moderate",
    ) as CommercialSiteCondition,

    accessComplexity: enumValue(
      raw?.accessComplexity,
      commercialAccessComplexities,
      "standard",
    ) as CommercialAccessComplexity,

    supplyTier: enumValue(
      raw?.supplyTier,
      commercialSupplyTiers,
      "moderate",
    ) as CommercialSupplyTier,

    customSupplyCents:
      boundedInteger(
        raw?.customSupplyCents,
        0,
        100_000_000,
        0,
      ),

    specialCostsCents:
      boundedInteger(
        raw?.specialCostsCents,
        0,
        100_000_000,
        0,
      ),

    manualAdjustmentCents:
      boundedInteger(
        raw?.manualAdjustmentCents,
        -100_000_000,
        100_000_000,
        0,
      ),

    uncertaintyPercent:
      raw?.uncertaintyPercent === null ||
      raw?.uncertaintyPercent === undefined ||
      raw?.uncertaintyPercent === ""
        ? null
        : boundedNumber(
            raw.uncertaintyPercent,
            0,
            100,
            0,
          ),
  };

  if (expectedModel === "hoa_route") {
    return {
      model: "hoa_route",
      ...base,

      binCount: boundedInteger(
        raw?.binCount,
        0,
        100_000,
        0,
      ),

      personMinutesPerBin:
        nullableBoundedNumber(
          raw?.personMinutesPerBin,
          0,
          1_440,
        ),

      binsStagedTogether:
        booleanValue(
          raw?.binsStagedTogether,
          true,
        ),

      collectionZoneCount:
        boundedInteger(
          raw?.collectionZoneCount,
          1,
          1_000,
          1,
        ),

      residentCoordinationRequired:
        booleanValue(
          raw
            ?.residentCoordinationRequired,
          false,
        ),
    };
  }

  if (
    expectedModel ===
    "apartment_hybrid"
  ) {
    const centralWorkUnits =
      asRecord(
        raw?.centralWorkUnits,
      );

    return {
      model: "apartment_hybrid",
      ...base,

      centralWorkUnits: {
        dumpsterExteriors:
          boundedInteger(
            centralWorkUnits
              ?.dumpsterExteriors,
            0,
            10_000,
            0,
          ),

        trashEnclosures:
          boundedInteger(
            centralWorkUnits
              ?.trashEnclosures,
            0,
            10_000,
            0,
          ),

        concretePads:
          boundedInteger(
            centralWorkUnits
              ?.concretePads,
            0,
            10_000,
            0,
          ),

        commercialCarts:
          boundedInteger(
            centralWorkUnits
              ?.commercialCarts,
            0,
            100_000,
            0,
          ),

        customPersonMinutes:
          boundedNumber(
            centralWorkUnits
              ?.customPersonMinutes,
            0,
            1_000_000,
            0,
          ),
      },

      cartCount: boundedInteger(
        raw?.cartCount,
        0,
        100_000,
        0,
      ),

      personMinutesPerCart:
        nullableBoundedNumber(
          raw?.personMinutesPerCart,
          0,
          1_440,
        ),

      cartsStagedTogether:
        booleanValue(
          raw?.cartsStagedTogether,
          true,
        ),

      collectionZoneCount:
        boundedInteger(
          raw?.collectionZoneCount,
          1,
          1_000,
          1,
        ),

      residentCoordinationRequired:
        booleanValue(
          raw
            ?.residentCoordinationRequired,
          false,
        ),
    };
  }

  const workUnits = asRecord(
    raw?.workUnits,
  );

  return {
    model: "commercial_site",
    ...base,

    workUnits: {
      dumpsterExteriors:
        boundedInteger(
          workUnits
            ?.dumpsterExteriors,
          0,
          10_000,
          0,
        ),

      trashEnclosures:
        boundedInteger(
          workUnits
            ?.trashEnclosures,
          0,
          10_000,
          0,
        ),

      concretePads:
        boundedInteger(
          workUnits
            ?.concretePads,
          0,
          10_000,
          0,
        ),

      commercialCarts:
        boundedInteger(
          workUnits
            ?.commercialCarts,
          0,
          100_000,
          0,
        ),

      customPersonMinutes:
        boundedNumber(
          workUnits
            ?.customPersonMinutes,
          0,
          1_000_000,
          0,
        ),
    },
  };
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

function enumValue<
  T extends readonly string[],
>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" &&
    allowed.includes(value)
    ? (value as T[number])
    : fallback;
}

function booleanValue(
  value: unknown,
  fallback: boolean,
) {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(parsed),
    ),
  );
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed),
  );
}

function nullableBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed),
  );
}
