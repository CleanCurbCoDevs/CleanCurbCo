import type {
  CommercialApartmentPricingInput,
  CommercialHoaPricingTier,
  CommercialHoaRoutePricingInput,
  CommercialPricingCalculation,
  CommercialPricingInput,
  CommercialPricingProfileValues,
  CommercialSitePricingInput,
  CommercialSupplyTier,
  CommercialWorkUnits,
} from "@/types/commercial-pricing";

import {
  calculateCommercialAssessmentInternalCost,
  calculateCommercialSurfaceSquareFeet,
} from "@/lib/commercial-measurements";

type CommercialCorePricingCalculation =
  Omit<
    CommercialPricingCalculation,
    | "measuredSquareFeet"
    | "surfacePersonMinutes"
    | "surfaceLaborCents"
    | "surfaceMarketCents"
    | "assessmentInternalCostCents"
    | "assessmentRecoveryCents"
    | "customerQuoteFeeCents"
    | "siteVisitRecommended"
    | "siteVisitReasons"
  >;

export function calculateCommercialPricing(
  profile: CommercialPricingProfileValues,
  input: CommercialPricingInput,
): CommercialPricingCalculation {
  switch (input.model) {
    case "commercial_site":
      return applyMeasurementAndAssessmentPricing(
        profile,
        input,
        calculateCommercialSitePricing(
          profile,
          input,
        ),
      );

    case "hoa_route":
      return applyMeasurementAndAssessmentPricing(
        profile,
        input,
        calculateHoaRoutePricing(
          profile,
          input,
        ),
      );

    case "apartment_hybrid":
      return applyMeasurementAndAssessmentPricing(
        profile,
        input,
        calculateApartmentPricing(
          profile,
          input,
        ),
      );
  }
}
function calculateCommercialSitePricing(
  profile: CommercialPricingProfileValues,
  input: CommercialSitePricingInput,
): CommercialPricingCalculation {
  const crewSize = normalizeCrewSize(
    input.crewSize,
  );

  const workPersonMinutes =
    calculateWorkPersonMinutes(
      profile,
      input.workUnits,
      input.condition,
      input.accessComplexity,
    );

  const estimatedPersonMinutes =
    workPersonMinutes +
    nonNegativeNumber(
      profile.taskMinutes.setup,
    );

  const laborCents = calculateLaborCents(
    estimatedPersonMinutes,
    profile.laborRateCents,
  );

  const mobilizationCents =
    getMobilizationCents(
      profile,
      input.visitType,
    );

  const suppliesCents =
    getSupplyCents(
      profile,
      input.supplyTier,
      input.customSupplyCents,
    );

  const specialCostsCents =
    nonNegativeInteger(
      input.specialCostsCents,
    );

  const manualAdjustmentCents =
    integerValue(
      input.manualAdjustmentCents,
    );

  const uncertaintyPercent =
    getUncertaintyPercent(
      profile,
      input.uncertaintyPercent,
    );

  const baseCents = Math.max(
    0,
    laborCents +
      mobilizationCents +
      suppliesCents +
      specialCostsCents +
      manualAdjustmentCents,
  );

  const uncertaintyCents =
    calculatePercentageCents(
      baseCents,
      uncertaintyPercent,
    );

  const costModelCents =
    baseCents + uncertaintyCents;

  const minimumCents =
    getCommercialMinimumCents(
      profile,
      input.visitType,
    );

  const preRoundSuggestedPriceCents =
    Math.max(
      minimumCents,
      costModelCents,
    );

  const suggestedPriceCents =
    roundUpCents(
      preRoundSuggestedPriceCents,
      profile.roundingIncrementCents,
    );

  const warnings: string[] = [];

  if (workPersonMinutes <= 0) {
    warnings.push(
      "No standard work units or custom labor minutes were entered.",
    );
  }

  if (input.condition === "not_sure") {
    warnings.push(
      "The property condition is unknown, so the uncertainty allowance should be reviewed.",
    );
  }

  const estimatedOnsiteMinutes =
    calculateOnsiteMinutes(
      estimatedPersonMinutes,
      crewSize,
    );

  if (estimatedOnsiteMinutes > 480) {
    warnings.push(
      "The estimated visit exceeds eight onsite hours and should be reviewed or split into phases.",
    );
  }

  return {
    model: input.model,
    visitType: input.visitType,
    currency: profile.currency,

    estimatedPersonMinutes:
      roundTwoDecimals(
        estimatedPersonMinutes,
      ),

    estimatedPersonHours:
      roundTwoDecimals(
        estimatedPersonMinutes / 60,
      ),

    estimatedOnsiteMinutes,

    laborCents,
    mobilizationCents,
    suppliesCents,
    specialCostsCents,

    routeMarketCents: 0,
    routeAdjustmentsCents: 0,
    manualAdjustmentCents,

    uncertaintyPercent,
    uncertaintyCents,

    costModelCents,
    marketModelCents: costModelCents,

    minimumCents,

    minimumApplied:
      minimumCents >= costModelCents,

    preRoundSuggestedPriceCents,
    suggestedPriceCents,

    appliedHoaTier: null,

    warnings,
  };
}

function calculateHoaRoutePricing(
  profile: CommercialPricingProfileValues,
  input: CommercialHoaRoutePricingInput,
): CommercialPricingCalculation {
  const crewSize = normalizeCrewSize(
    input.crewSize,
  );

  const binCount = nonNegativeInteger(
    input.binCount,
  );

  const personMinutesPerBin =
    input.personMinutesPerBin === null
      ? nonNegativeNumber(
          profile.taskMinutes.commercialCart,
        )
      : nonNegativeNumber(
          input.personMinutesPerBin,
        );

  const conditionMultiplier =
    getConditionMultiplier(
      profile,
      input.condition,
    );

  const accessMultiplier =
    getAccessMultiplier(
      profile,
      input.accessComplexity,
    );

  const routeWorkPersonMinutes =
    binCount *
    personMinutesPerBin *
    conditionMultiplier *
    accessMultiplier;

  const estimatedPersonMinutes =
    routeWorkPersonMinutes +
    nonNegativeNumber(
      profile.taskMinutes.setup,
    );

  const laborCents = calculateLaborCents(
    estimatedPersonMinutes,
    profile.laborRateCents,
  );

  const mobilizationCents =
    getMobilizationCents(
      profile,
      input.visitType,
    );

  const suppliesCents =
    getSupplyCents(
      profile,
      input.supplyTier,
      input.customSupplyCents,
    );

  const specialCostsCents =
    nonNegativeInteger(
      input.specialCostsCents,
    );

  const manualAdjustmentCents =
    integerValue(
      input.manualAdjustmentCents,
    );

  const appliedHoaTier =
    getHoaPricingTier(
      profile.hoaTiers,
      binCount,
    );

  const routeMarketCents =
    appliedHoaTier
      ? binCount *
        appliedHoaTier.pricePerBinCents
      : 0;

  const routeAdjustmentsCents =
    calculateRouteAdjustments(
      profile,
      {
        unitCount: binCount,
        stagedTogether:
          input.binsStagedTogether,
        collectionZoneCount:
          input.collectionZoneCount,
        coordinationRequired:
          input.residentCoordinationRequired,
      },
    );

  const uncertaintyPercent =
    getUncertaintyPercent(
      profile,
      input.uncertaintyPercent,
    );

  const costBaseCents = Math.max(
    0,
    laborCents +
      mobilizationCents +
      suppliesCents +
      specialCostsCents +
      routeAdjustmentsCents +
      manualAdjustmentCents,
  );

  const uncertaintyCents =
    calculatePercentageCents(
      costBaseCents,
      uncertaintyPercent,
    );

  const costModelCents =
    costBaseCents +
    uncertaintyCents;

  const marketModelCents = Math.max(
    0,
    routeMarketCents +
      routeAdjustmentsCents +
      specialCostsCents +
      manualAdjustmentCents,
  );

  const minimumCents =
    profile.hoaRouteMinimumCents;

  const preRoundSuggestedPriceCents =
    Math.max(
      minimumCents,
      costModelCents,
      marketModelCents,
    );

  const suggestedPriceCents =
    roundUpCents(
      preRoundSuggestedPriceCents,
      profile.roundingIncrementCents,
    );

  const warnings: string[] = [];

  if (binCount < 20) {
    warnings.push(
      "This route is below the starting HOA volume tier and will likely price at the minimum invoice.",
    );
  }

  if (!input.binsStagedTogether) {
    warnings.push(
      "Bins are not staged together. Confirm walking distance, access, and resident compliance before sending the quote.",
    );
  }

  if (
    nonNegativeInteger(
      input.collectionZoneCount,
    ) > 1
  ) {
    warnings.push(
      "Multiple collection zones were included. Confirm that the added-zone fee covers actual movement and setup time.",
    );
  }

  if (
    appliedHoaTier
      ?.requiresManualReview
  ) {
    warnings.push(
      "This route is large enough to require a test route or manual pricing review before the quote is sent.",
    );
  }

  if (input.condition === "not_sure") {
    warnings.push(
      "The initial bin condition is unknown. Consider separating the first reset from recurring maintenance pricing.",
    );
  }

  return {
    model: input.model,
    visitType: input.visitType,
    currency: profile.currency,

    estimatedPersonMinutes:
      roundTwoDecimals(
        estimatedPersonMinutes,
      ),

    estimatedPersonHours:
      roundTwoDecimals(
        estimatedPersonMinutes / 60,
      ),

    estimatedOnsiteMinutes:
      calculateOnsiteMinutes(
        estimatedPersonMinutes,
        crewSize,
      ),

    laborCents,
    mobilizationCents,
    suppliesCents,
    specialCostsCents,

    routeMarketCents,
    routeAdjustmentsCents,
    manualAdjustmentCents,

    uncertaintyPercent,
    uncertaintyCents,

    costModelCents,
    marketModelCents,

    minimumCents,

    minimumApplied:
      minimumCents >=
      Math.max(
        costModelCents,
        marketModelCents,
      ),

    preRoundSuggestedPriceCents,
    suggestedPriceCents,

    appliedHoaTier,

    warnings,
  };
}

function calculateApartmentPricing(
  profile: CommercialPricingProfileValues,
  input: CommercialApartmentPricingInput,
): CommercialPricingCalculation {
  const crewSize = normalizeCrewSize(
    input.crewSize,
  );

  const centralPersonMinutes =
    calculateWorkPersonMinutes(
      profile,
      input.centralWorkUnits,
      input.condition,
      input.accessComplexity,
    );

  const cartCount = nonNegativeInteger(
    input.cartCount,
  );

  const personMinutesPerCart =
    input.personMinutesPerCart === null
      ? nonNegativeNumber(
          profile.taskMinutes.commercialCart,
        )
      : nonNegativeNumber(
          input.personMinutesPerCart,
        );

  const conditionMultiplier =
    getConditionMultiplier(
      profile,
      input.condition,
    );

  const accessMultiplier =
    getAccessMultiplier(
      profile,
      input.accessComplexity,
    );

  const cartPersonMinutes =
    cartCount *
    personMinutesPerCart *
    conditionMultiplier *
    accessMultiplier;

  const estimatedPersonMinutes =
    centralPersonMinutes +
    cartPersonMinutes +
    nonNegativeNumber(
      profile.taskMinutes.setup,
    );

  const centralLaborCents =
    calculateLaborCents(
      centralPersonMinutes,
      profile.laborRateCents,
    );

  const totalLaborCents =
    calculateLaborCents(
      estimatedPersonMinutes,
      profile.laborRateCents,
    );

  const mobilizationCents =
    getMobilizationCents(
      profile,
      input.visitType,
    );

  const suppliesCents =
    getSupplyCents(
      profile,
      input.supplyTier,
      input.customSupplyCents,
    );

  const specialCostsCents =
    nonNegativeInteger(
      input.specialCostsCents,
    );

  const manualAdjustmentCents =
    integerValue(
      input.manualAdjustmentCents,
    );

  const appliedHoaTier =
    cartCount > 0
      ? getHoaPricingTier(
          profile.hoaTiers,
          cartCount,
        )
      : null;

  const routeMarketCents =
    appliedHoaTier
      ? cartCount *
        appliedHoaTier.pricePerBinCents
      : 0;

  const routeAdjustmentsCents =
    calculateRouteAdjustments(
      profile,
      {
        unitCount: cartCount,
        stagedTogether:
          input.cartsStagedTogether,
        collectionZoneCount:
          input.collectionZoneCount,
        coordinationRequired:
          input.residentCoordinationRequired,
      },
    );

  const uncertaintyPercent =
    getUncertaintyPercent(
      profile,
      input.uncertaintyPercent,
    );

  const costBaseCents = Math.max(
    0,
    totalLaborCents +
      mobilizationCents +
      suppliesCents +
      specialCostsCents +
      routeAdjustmentsCents +
      manualAdjustmentCents,
  );

  const uncertaintyCents =
    calculatePercentageCents(
      costBaseCents,
      uncertaintyPercent,
    );

  const costModelCents =
    costBaseCents +
    uncertaintyCents;

  const marketModelCents = Math.max(
    0,
    centralLaborCents +
      mobilizationCents +
      suppliesCents +
      specialCostsCents +
      routeMarketCents +
      routeAdjustmentsCents +
      manualAdjustmentCents,
  );

  const minimumCents =
    profile.apartmentMinimumCents;

  const preRoundSuggestedPriceCents =
    Math.max(
      minimumCents,
      costModelCents,
      marketModelCents,
    );

  const suggestedPriceCents =
    roundUpCents(
      preRoundSuggestedPriceCents,
      profile.roundingIncrementCents,
    );

  const warnings: string[] = [];

  if (
    centralPersonMinutes <= 0 &&
    cartCount <= 0
  ) {
    warnings.push(
      "No central waste-area work or individual carts were entered.",
    );
  }

  if (
    cartCount > 0 &&
    !input.cartsStagedTogether
  ) {
    warnings.push(
      "Apartment carts are not staged together. Confirm building layout and walking distance before sending the quote.",
    );
  }

  if (
    appliedHoaTier
      ?.requiresManualReview
  ) {
    warnings.push(
      "The cart count requires a test route or manual review before the quote is sent.",
    );
  }

  if (input.condition === "not_sure") {
    warnings.push(
      "The property condition is unknown. Consider a walkthrough or a separate initial-reset price.",
    );
  }

  return {
    model: input.model,
    visitType: input.visitType,
    currency: profile.currency,

    estimatedPersonMinutes:
      roundTwoDecimals(
        estimatedPersonMinutes,
      ),

    estimatedPersonHours:
      roundTwoDecimals(
        estimatedPersonMinutes / 60,
      ),

    estimatedOnsiteMinutes:
      calculateOnsiteMinutes(
        estimatedPersonMinutes,
        crewSize,
      ),

    laborCents: totalLaborCents,
    mobilizationCents,
    suppliesCents,
    specialCostsCents,

    routeMarketCents,
    routeAdjustmentsCents,
    manualAdjustmentCents,

    uncertaintyPercent,
    uncertaintyCents,

    costModelCents,
    marketModelCents,

    minimumCents,

    minimumApplied:
      minimumCents >=
      Math.max(
        costModelCents,
        marketModelCents,
      ),

    preRoundSuggestedPriceCents,
    suggestedPriceCents,

    appliedHoaTier,

    warnings,
  };
}

function applyMeasurementAndAssessmentPricing(
  profile: CommercialPricingProfileValues,
  input: CommercialPricingInput,
  calculation:
    CommercialCorePricingCalculation,
): CommercialPricingCalculation {
  const conditionMultiplier =
    getConditionMultiplier(
      profile,
      input.condition,
    );

  const accessMultiplier =
    getAccessMultiplier(
      profile,
      input.accessComplexity,
    );

  const surfacePricing =
    calculateMeasuredSurfacePricing(
      profile,
      input,
      conditionMultiplier,
      accessMultiplier,
    );

  const assessment =
    calculateCommercialAssessmentInternalCost(
      profile,
      input.quoteAssessment,
    );

  const assessmentInternalCostCents =
    input.visitType === "initial"
      ? assessment.totalCents
      : 0;

  /**
   * Quotes remain free to the customer.
   * The internal cost is recovered through the initial
   * proposed service price.
   */
  const assessmentRecoveryCents =
    assessmentInternalCostCents;

  const estimatedPersonMinutes =
    calculation.estimatedPersonMinutes +
    surfacePricing.personMinutes;

  const laborCents =
    calculation.laborCents +
    surfacePricing.laborCents;

  const coreCostBeforeUncertainty =
    Math.max(
      0,
      calculation.costModelCents -
        calculation.uncertaintyCents,
    );

  const serviceCostBeforeUncertainty =
    Math.max(
      0,
      coreCostBeforeUncertainty +
        surfacePricing.laborCents,
    );

  const uncertaintyCents =
    calculatePercentageCents(
      serviceCostBeforeUncertainty,
      calculation.uncertaintyPercent,
    );

  const costModelCents =
    serviceCostBeforeUncertainty +
    uncertaintyCents +
    assessmentRecoveryCents;

  const baseMarketCents =
    input.model === "commercial_site"
      ? Math.max(
          0,
          calculation.marketModelCents -
            calculation.uncertaintyCents,
        )
      : calculation.marketModelCents;

  const marketModelCents =
    Math.max(
      0,
      baseMarketCents +
        surfacePricing.marketCents +
        assessmentRecoveryCents,
    );

  const preRoundSuggestedPriceCents =
    Math.max(
      calculation.minimumCents,
      costModelCents,
      marketModelCents,
    );

  const suggestedPriceCents =
    roundUpCents(
      preRoundSuggestedPriceCents,
      profile.roundingIncrementCents,
    );

  const siteVisitReasons =
    getSiteVisitReasons(
      profile,
      input,
      surfacePricing.squareFeet,
      suggestedPriceCents,
    );

  const warnings =
    calculation.warnings.filter(
      (warning) => {
        if (
          surfacePricing.personMinutes <=
          0
        ) {
          return true;
        }

        return (
          !warning.startsWith(
            "No standard work units",
          ) &&
          !warning.startsWith(
            "No central waste-area work",
          )
        );
      },
    );

  if (siteVisitReasons.length) {
    warnings.push(
      `Onsite assessment recommended: ${siteVisitReasons.join(
        " ",
      )}`,
    );
  }

  return {
    ...calculation,

    estimatedPersonMinutes:
      roundTwoDecimals(
        estimatedPersonMinutes,
      ),

    estimatedPersonHours:
      roundTwoDecimals(
        estimatedPersonMinutes / 60,
      ),

    estimatedOnsiteMinutes:
      calculateOnsiteMinutes(
        estimatedPersonMinutes,
        input.crewSize,
      ),

    measuredSquareFeet:
      surfacePricing.squareFeet,

    surfacePersonMinutes:
      surfacePricing.personMinutes,

    surfaceLaborCents:
      surfacePricing.laborCents,

    surfaceMarketCents:
      surfacePricing.marketCents,

    assessmentInternalCostCents,

    assessmentRecoveryCents,

    customerQuoteFeeCents: 0,

    siteVisitRecommended:
      siteVisitReasons.length > 0,

    siteVisitReasons,

    laborCents,

    uncertaintyCents,

    costModelCents,
    marketModelCents,

    minimumApplied:
      calculation.minimumCents >=
      Math.max(
        costModelCents,
        marketModelCents,
      ),

    preRoundSuggestedPriceCents,
    suggestedPriceCents,

    warnings,
  };
}

function calculateMeasuredSurfacePricing(
  profile: CommercialPricingProfileValues,
  input: CommercialPricingInput,
  conditionMultiplier: number,
  accessMultiplier: number,
) {
  let squareFeet = 0;
  let personMinutes = 0;
  let marketCents = 0;

  for (
    const measurement of
    input.surfaceMeasurements
  ) {
    const measurementSquareFeet =
      calculateCommercialSurfaceSquareFeet(
        measurement,
      );

    if (
      measurementSquareFeet <= 0
    ) {
      continue;
    }

    const rateCents =
      profile.surfaceRatesCents[
        measurement.surfaceType
      ] ?? 0;

    const productivityMinutes =
      profile
        .surfacePersonMinutesPer100SquareFeet[
        measurement.surfaceType
      ] ?? 0;

    squareFeet +=
      measurementSquareFeet;

    personMinutes +=
      (
        measurementSquareFeet / 100
      ) *
      productivityMinutes *
      conditionMultiplier *
      accessMultiplier;

    marketCents += Math.round(
      measurementSquareFeet *
        rateCents *
        conditionMultiplier *
        accessMultiplier,
    );
  }

  const laborCents =
    calculateLaborCents(
      personMinutes,
      profile.laborRateCents,
    );

  return {
    squareFeet:
      roundTwoDecimals(squareFeet),

    personMinutes:
      roundTwoDecimals(
        personMinutes,
      ),

    laborCents,

    marketCents:
      Math.max(
        0,
        Math.round(marketCents),
      ),
  };
}

function getSiteVisitReasons(
  profile: CommercialPricingProfileValues,
  input: CommercialPricingInput,
  measuredSquareFeet: number,
  suggestedPriceCents: number,
) {
  if (input.visitType !== "initial") {
    return [];
  }

  const measurementsWithArea =
    input.surfaceMeasurements.filter(
      (measurement) =>
        calculateCommercialSurfaceSquareFeet(
          measurement,
        ) > 0,
    );

  const allMeasurementsVerified =
    measurementsWithArea.length > 0 &&
    measurementsWithArea.every(
      (measurement) =>
        measurement.confidence ===
        "field_verified",
    );

  const onsiteAssessmentCompleted =
    input.quoteAssessment.method ===
      "onsite" &&
    allMeasurementsVerified;

  if (onsiteAssessmentCompleted) {
    return [];
  }

  const reasons: string[] = [];

  if (
    input.quoteAssessment.method ===
      "onsite" &&
    !allMeasurementsVerified
  ) {
    reasons.push(
      "The onsite assessment is selected, but the measurements are not marked field verified.",
    );
  }

  if (
    input.siteContext
      .surfaceWorkExpected &&
    measuredSquareFeet <= 0
  ) {
    reasons.push(
      "No usable surface measurements have been entered.",
    );
  }

  if (
    measurementsWithArea.some(
      (measurement) =>
        measurement.confidence ===
        "preliminary",
    )
  ) {
    reasons.push(
      "One or more measurements are still preliminary.",
    );
  }

  if (
    input.condition === "heavy" ||
    input.condition === "not_sure"
  ) {
    reasons.push(
      "The reported site condition is heavy or uncertain.",
    );
  }

  if (
    input.accessComplexity ===
    "difficult"
  ) {
    reasons.push(
      "Access is marked difficult.",
    );
  }

  if (
    input.siteContext.photoCount < 2
  ) {
    reasons.push(
      "Fewer than two useful property photos are available.",
    );
  }

  if (
    input.siteContext
      .surfaceWorkExpected &&
    input.siteContext
      .waterAvailability !== "yes"
  ) {
    reasons.push(
      "Water availability has not been confirmed.",
    );
  }

  if (
    input.siteContext.propertyType ===
      "restaurant_food_service" &&
    (
      input.siteContext.photoCount < 3 ||
      input.condition === "heavy" ||
      input.condition === "not_sure"
    )
  ) {
    reasons.push(
      "Food-service waste areas benefit from confirming grease, drainage, and access onsite.",
    );
  }

  if (
    measuredSquareFeet >=
    profile
      .siteVisitRecommendedSquareFeet
  ) {
    reasons.push(
      "The measured surface area exceeds the configured remote-quote threshold.",
    );
  }

  if (
    suggestedPriceCents >=
    profile
      .siteVisitRecommendedPriceCents
  ) {
    reasons.push(
      "The proposed project value exceeds the configured remote-quote threshold.",
    );
  }

  return Array.from(
    new Set(reasons),
  );
}

function calculateWorkPersonMinutes(
  profile: CommercialPricingProfileValues,
  workUnits: CommercialWorkUnits,
  condition:
    CommercialSitePricingInput["condition"],
  accessComplexity:
    CommercialSitePricingInput["accessComplexity"],
) {
  const basePersonMinutes =
    nonNegativeInteger(
      workUnits.dumpsterExteriors,
    ) *
      nonNegativeNumber(
        profile.taskMinutes
          .dumpsterExterior,
      ) +
    nonNegativeInteger(
      workUnits.trashEnclosures,
    ) *
      nonNegativeNumber(
        profile.taskMinutes
          .trashEnclosure,
      ) +
    nonNegativeInteger(
      workUnits.concretePads,
    ) *
      nonNegativeNumber(
        profile.taskMinutes
          .concretePad,
      ) +
    nonNegativeInteger(
      workUnits.commercialCarts,
    ) *
      nonNegativeNumber(
        profile.taskMinutes
          .commercialCart,
      ) +
    nonNegativeNumber(
      workUnits.customPersonMinutes,
    );

  return (
    basePersonMinutes *
    getConditionMultiplier(
      profile,
      condition,
    ) *
    getAccessMultiplier(
      profile,
      accessComplexity,
    )
  );
}

function calculateRouteAdjustments(
  profile: CommercialPricingProfileValues,
  input: {
    unitCount: number;
    stagedTogether: boolean;
    collectionZoneCount: number;
    coordinationRequired: boolean;
  },
) {
  const unstagedCents =
    input.stagedTogether
      ? 0
      : nonNegativeInteger(
          input.unitCount,
        ) *
        profile
          .hoaUnstagedSurchargePerBinCents;

  const additionalZones =
    Math.max(
      0,
      nonNegativeInteger(
        input.collectionZoneCount,
      ) - 1,
    );

  const zoneCents =
    additionalZones *
    profile.hoaAdditionalZoneFeeCents;

  const coordinationCents =
    input.coordinationRequired
      ? profile.hoaCoordinationFeeCents
      : 0;

  return (
    unstagedCents +
    zoneCents +
    coordinationCents
  );
}

function getHoaPricingTier(
  tiers: CommercialHoaPricingTier[],
  binCount: number,
) {
  const sortedTiers = [...tiers].sort(
    (a, b) =>
      a.minimumBins - b.minimumBins,
  );

  const matchedTier =
    sortedTiers.find((tier) => {
      const meetsMinimum =
        binCount >= tier.minimumBins;

      const meetsMaximum =
        tier.maximumBins === null ||
        binCount <= tier.maximumBins;

      return (
        meetsMinimum &&
        meetsMaximum
      );
    });

  if (matchedTier) {
    return matchedTier;
  }

  if (!sortedTiers.length) {
    return null;
  }

  if (
    binCount <
    sortedTiers[0].minimumBins
  ) {
    return sortedTiers[0];
  }

  return (
    sortedTiers[
      sortedTiers.length - 1
    ] ?? null
  );
}

function getSupplyCents(
  profile: CommercialPricingProfileValues,
  tier: CommercialSupplyTier,
  customSupplyCents: number,
) {
  switch (tier) {
    case "light":
      return profile.lightSuppliesCents;

    case "moderate":
      return profile.moderateSuppliesCents;

    case "heavy":
      return profile.heavySuppliesCents;

    case "custom":
      return nonNegativeInteger(
        customSupplyCents,
      );
  }
}

function getCommercialMinimumCents(
  profile: CommercialPricingProfileValues,
  visitType:
    CommercialSitePricingInput["visitType"],
) {
  return visitType === "initial"
    ? profile
        .initialCommercialMinimumCents
    : profile
        .recurringCommercialMinimumCents;
}

function getMobilizationCents(
  profile: CommercialPricingProfileValues,
  visitType:
    CommercialSitePricingInput["visitType"],
) {
  return visitType === "initial"
    ? profile.initialMobilizationCents
    : profile
        .recurringMobilizationCents;
}

function getConditionMultiplier(
  profile: CommercialPricingProfileValues,
  condition:
    CommercialSitePricingInput["condition"],
) {
  return Math.max(
    0,
    finiteNumber(
      profile.conditionMultipliers[
        condition
      ],
      1,
    ),
  );
}

function getAccessMultiplier(
  profile: CommercialPricingProfileValues,
  accessComplexity:
    CommercialSitePricingInput["accessComplexity"],
) {
  return Math.max(
    0,
    finiteNumber(
      profile.accessMultipliers[
        accessComplexity
      ],
      1,
    ),
  );
}

function getUncertaintyPercent(
  profile: CommercialPricingProfileValues,
  override: number | null,
) {
  const value =
    override === null
      ? profile
          .defaultUncertaintyPercent
      : override;

  return Math.min(
    100,
    Math.max(
      0,
      finiteNumber(value, 0),
    ),
  );
}

function calculateLaborCents(
  personMinutes: number,
  laborRateCents: number,
) {
  return Math.round(
    (nonNegativeNumber(
      personMinutes,
    ) /
      60) *
      nonNegativeInteger(
        laborRateCents,
      ),
  );
}

function calculatePercentageCents(
  valueCents: number,
  percent: number,
) {
  return Math.round(
    nonNegativeInteger(valueCents) *
      (nonNegativeNumber(percent) /
        100),
  );
}

function calculateOnsiteMinutes(
  personMinutes: number,
  crewSize: number,
) {
  return Math.ceil(
    nonNegativeNumber(personMinutes) /
      normalizeCrewSize(crewSize),
  );
}

function roundUpCents(
  valueCents: number,
  incrementCents: number,
) {
  const value =
    nonNegativeInteger(valueCents);

  const increment = Math.max(
    1,
    nonNegativeInteger(
      incrementCents,
    ),
  );

  return (
    Math.ceil(value / increment) *
    increment
  );
}

function normalizeCrewSize(
  value: number,
) {
  return Math.max(
    1,
    nonNegativeInteger(value),
  );
}

function nonNegativeInteger(
  value: number,
) {
  return Math.max(
    0,
    Math.round(
      finiteNumber(value, 0),
    ),
  );
}

function integerValue(value: number) {
  return Math.round(
    finiteNumber(value, 0),
  );
}

function nonNegativeNumber(
  value: number,
) {
  return Math.max(
    0,
    finiteNumber(value, 0),
  );
}

function finiteNumber(
  value: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function roundTwoDecimals(
  value: number,
) {
  return (
    Math.round(value * 100) / 100
  );
}
