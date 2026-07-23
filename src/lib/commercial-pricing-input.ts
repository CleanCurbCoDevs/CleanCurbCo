import {
  commercialPropertyTypes,
  commercialSiteConditions,
  commercialWaterAvailabilityValues,
  type CommercialPropertyType,
  type CommercialSiteCondition,
  type CommercialWaterAvailability,
} from "@/types/commercial";

import {
  commercialMeasurementConfidences,
  commercialMeasurementModes,
  commercialMeasurementSources,
  commercialQuoteAssessmentMethods,
  commercialSurfaceTypes,
  type CommercialMeasurementConfidence,
  type CommercialMeasurementMode,
  type CommercialMeasurementSource,
  type CommercialQuoteAssessment,
  type CommercialQuoteAssessmentMethod,
  type CommercialSiteContext,
  type CommercialSurfaceMeasurement,
  type CommercialSurfaceType,
} from "@/types/commercial-measurement";

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

    surfaceMeasurements:
      normalizeSurfaceMeasurements(
        raw?.surfaceMeasurements,
      ),
    
    quoteAssessment:
      normalizeQuoteAssessment(
        raw?.quoteAssessment,
      ),
    
    siteContext:
      normalizeSiteContext(
        raw?.siteContext,
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

function normalizeSurfaceMeasurements(
  value: unknown,
): CommercialSurfaceMeasurement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 50)
    .map((entry, index) => {
      const raw = asRecord(entry);

      return {
        id: cleanText(
          raw?.id,
          `measurement-${index + 1}`,
          80,
        ),

        label: cleanText(
          raw?.label,
          `Area ${index + 1}`,
          120,
        ),

        surfaceType:
          enumValue(
            raw?.surfaceType,
            commercialSurfaceTypes,
            "concrete_pad",
          ) as CommercialSurfaceType,

        quantity: boundedNumber(
          raw?.quantity,
          0,
          1_000,
          1,
        ),

        dimensionMode:
          enumValue(
            raw?.dimensionMode,
            commercialMeasurementModes,
            "dimensions",
          ) as CommercialMeasurementMode,

        dimensionAFeet:
          boundedNumber(
            raw?.dimensionAFeet,
            0,
            100_000,
            0,
          ),

        dimensionBFeet:
          boundedNumber(
            raw?.dimensionBFeet,
            0,
            100_000,
            0,
          ),

        manualSquareFeet:
          boundedNumber(
            raw?.manualSquareFeet,
            0,
            100_000_000,
            0,
          ),

        source:
          enumValue(
            raw?.source,
            commercialMeasurementSources,
            "customer_dimensions",
          ) as CommercialMeasurementSource,

        confidence:
          enumValue(
            raw?.confidence,
            commercialMeasurementConfidences,
            "preliminary",
          ) as CommercialMeasurementConfidence,
      };
    });
}

function normalizeQuoteAssessment(
  value: unknown,
): CommercialQuoteAssessment {
  const raw = asRecord(value);

  return {
    method:
      enumValue(
        raw?.method,
        commercialQuoteAssessmentMethods,
        "online",
      ) as CommercialQuoteAssessmentMethod,

    assessorCount:
      boundedInteger(
        raw?.assessorCount,
        1,
        20,
        1,
      ),

    travelMinutes:
      boundedNumber(
        raw?.travelMinutes,
        0,
        10_000,
        0,
      ),

    onsiteMinutes:
      boundedNumber(
        raw?.onsiteMinutes,
        0,
        10_000,
        0,
      ),

    adminMinutes:
      boundedNumber(
        raw?.adminMinutes,
        0,
        10_000,
        20,
      ),

    roundTripMiles:
      boundedNumber(
        raw?.roundTripMiles,
        0,
        100_000,
        0,
      ),

    otherCostsCents:
      boundedInteger(
        raw?.otherCostsCents,
        0,
        100_000_000,
        0,
      ),

    notes: cleanText(
      raw?.notes,
      "",
      1_000,
    ),
  };
}

function normalizeSiteContext(
  value: unknown,
): CommercialSiteContext {
  const raw = asRecord(value);

  return {
    propertyType:
      enumValue(
        raw?.propertyType,
        commercialPropertyTypes,
        "other",
      ) as CommercialPropertyType,

    photoCount:
      boundedInteger(
        raw?.photoCount,
        0,
        1_000,
        0,
      ),

    waterAvailability:
      enumValue(
        raw?.waterAvailability,
        commercialWaterAvailabilityValues,
        "not_sure",
      ) as CommercialWaterAvailability,

    surfaceWorkExpected:
      booleanValue(
        raw?.surfaceWorkExpected,
        false,
      ),
  };
}

function cleanText(
  value: unknown,
  fallback: string,
  maximumLength: number,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value
    .trim()
    .slice(0, maximumLength);

  return cleaned || fallback;
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
