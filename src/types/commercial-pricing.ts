import type {
  CommercialSiteCondition,
} from "@/types/commercial";

import type {
  CommercialQuoteAssessment,
  CommercialSiteContext,
  CommercialSurfaceMeasurement,
  CommercialSurfaceProductivityMap,
  CommercialSurfaceRateMap,
} from "@/types/commercial-measurement";

export const commercialPricingModels = [
  "commercial_site",
  "hoa_route",
  "apartment_hybrid",
] as const;

export type CommercialPricingModel =
  (typeof commercialPricingModels)[number];

export const commercialVisitTypes = [
  "initial",
  "recurring",
] as const;

export type CommercialVisitType =
  (typeof commercialVisitTypes)[number];

export const commercialSupplyTiers = [
  "light",
  "moderate",
  "heavy",
  "custom",
] as const;

export type CommercialSupplyTier =
  (typeof commercialSupplyTiers)[number];

export const commercialAccessComplexities = [
  "standard",
  "limited",
  "difficult",
] as const;

export type CommercialAccessComplexity =
  (typeof commercialAccessComplexities)[number];

export const commercialQuoteStatuses = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "superseded",
  "void",
] as const;

export type CommercialQuoteStatus =
  (typeof commercialQuoteStatuses)[number];

export const commercialQuoteLineItemTypes = [
  "service",
  "add_on",
  "fee",
  "discount",
  "informational",
] as const;

export type CommercialQuoteLineItemType =
  (typeof commercialQuoteLineItemTypes)[number];

export type CommercialTaskMinuteDefaults = {
  dumpsterExterior: number;
  trashEnclosure: number;
  concretePad: number;
  commercialCart: number;
  setup: number;
};

export type CommercialHoaPricingTier = {
  minimumBins: number;
  maximumBins: number | null;
  pricePerBinCents: number;
  requiresManualReview: boolean;
};

export type CommercialConditionMultipliers =
  Record<CommercialSiteCondition, number>;

export type CommercialAccessMultipliers =
  Record<CommercialAccessComplexity, number>;

export type CommercialPricingProfileValues = {
  currency: string;

  laborRateCents: number;

  initialCommercialMinimumCents: number;
  recurringCommercialMinimumCents: number;

  initialMobilizationCents: number;
  recurringMobilizationCents: number;

  lightSuppliesCents: number;
  moderateSuppliesCents: number;
  heavySuppliesCents: number;

  defaultUncertaintyPercent: number;
  roundingIncrementCents: number;

  hoaRouteMinimumCents: number;
  apartmentMinimumCents: number;

  hoaUnstagedSurchargePerBinCents: number;
  hoaAdditionalZoneFeeCents: number;
  hoaCoordinationFeeCents: number;
  
  assessmentVehicleCostPerMileCents: number;
  
  siteVisitRecommendedSquareFeet: number;
  siteVisitRecommendedPriceCents: number;
  
  surfaceRatesCents:
    CommercialSurfaceRateMap;
  
  surfacePersonMinutesPer100SquareFeet:
    CommercialSurfaceProductivityMap;
  
  taskMinutes: CommercialTaskMinuteDefaults;
  conditionMultipliers: CommercialConditionMultipliers;
  accessMultipliers: CommercialAccessMultipliers;
  hoaTiers: CommercialHoaPricingTier[];
};

export type CommercialWorkUnits = {
  dumpsterExteriors: number;
  trashEnclosures: number;
  concretePads: number;
  commercialCarts: number;

  /**
   * Extra person-minutes for work that does not fit a standard unit.
   */
  customPersonMinutes: number;
};

type CommercialPricingInputBase = {
  visitType: CommercialVisitType;
  crewSize: number;

  condition: CommercialSiteCondition;
  accessComplexity: CommercialAccessComplexity;

  supplyTier: CommercialSupplyTier;
  customSupplyCents: number;

  specialCostsCents: number;

  /**
   * May be positive for an added charge or negative for a discount.
   */
  manualAdjustmentCents: number;

  /**
   * Leave null to use the active pricing profile default.
   */
  uncertaintyPercent: number | null;

  surfaceMeasurements:
    CommercialSurfaceMeasurement[];
  
  quoteAssessment:
    CommercialQuoteAssessment;
  
  siteContext:
    CommercialSiteContext;
  };


export type CommercialSitePricingInput =
  CommercialPricingInputBase & {
    model: "commercial_site";
    workUnits: CommercialWorkUnits;
  };

export type CommercialHoaRoutePricingInput =
  CommercialPricingInputBase & {
    model: "hoa_route";

    binCount: number;

    /**
     * Optional override. Null uses the commercial-cart
     * person-minute default from the pricing profile.
     */
    personMinutesPerBin: number | null;

    binsStagedTogether: boolean;
    collectionZoneCount: number;
    residentCoordinationRequired: boolean;
  };

export type CommercialApartmentPricingInput =
  CommercialPricingInputBase & {
    model: "apartment_hybrid";

    centralWorkUnits: CommercialWorkUnits;

    cartCount: number;
    personMinutesPerCart: number | null;

    cartsStagedTogether: boolean;
    collectionZoneCount: number;
    residentCoordinationRequired: boolean;
  };

export type CommercialPricingInput =
  | CommercialSitePricingInput
  | CommercialHoaRoutePricingInput
  | CommercialApartmentPricingInput;

export type CommercialPricingCalculation = {
  model: CommercialPricingModel;
  visitType: CommercialVisitType;
  currency: string;

  estimatedPersonMinutes: number;
  estimatedPersonHours: number;
  estimatedOnsiteMinutes: number;

  measuredSquareFeet: number;

  surfacePersonMinutes: number;
  surfaceLaborCents: number;
  surfaceMarketCents: number;
  
  assessmentInternalCostCents: number;
  assessmentRecoveryCents: number;
  
  /**
   * Clean Curb Co. commercial quotes are always free.
   */
  customerQuoteFeeCents: 0;
  
  siteVisitRecommended: boolean;
  siteVisitReasons: string[];
  
  laborCents: number;
  mobilizationCents: number;
  suppliesCents: number;
  specialCostsCents: number;

  routeMarketCents: number;
  routeAdjustmentsCents: number;
  manualAdjustmentCents: number;

  uncertaintyPercent: number;
  uncertaintyCents: number;

  costModelCents: number;
  marketModelCents: number;

  minimumCents: number;
  minimumApplied: boolean;

  preRoundSuggestedPriceCents: number;
  suggestedPriceCents: number;

  appliedHoaTier:
    CommercialHoaPricingTier | null;

  warnings: string[];
};

export const DEFAULT_COMMERCIAL_PRICING_PROFILE:
  CommercialPricingProfileValues = {
    currency: "usd",

    laborRateCents: 6000,

    initialCommercialMinimumCents: 17500,
    recurringCommercialMinimumCents: 15000,

    initialMobilizationCents: 7500,
    recurringMobilizationCents: 5000,

    lightSuppliesCents: 1500,
    moderateSuppliesCents: 3000,
    heavySuppliesCents: 5000,

    defaultUncertaintyPercent: 10,
    roundingIncrementCents: 500,

    hoaRouteMinimumCents: 50000,
    apartmentMinimumCents: 50000,

    hoaUnstagedSurchargePerBinCents: 400,
    hoaAdditionalZoneFeeCents: 5000,
    hoaCoordinationFeeCents: 7500,
    
    assessmentVehicleCostPerMileCents: 70,
    
    siteVisitRecommendedSquareFeet: 1500,
    siteVisitRecommendedPriceCents: 100000,
    
    surfaceRatesCents: {
      concrete_pad: 40,
      enclosure_floor: 45,
      enclosure_walls: 50,
      general_exterior: 30,
      grease_area: 65,
      other: 40,
    },
    
    surfacePersonMinutesPer100SquareFeet: {
      concrete_pad: 20,
      enclosure_floor: 24,
      enclosure_walls: 30,
      general_exterior: 18,
      grease_area: 35,
      other: 24,
    },
    
    taskMinutes: {
      dumpsterExterior: 30,
      trashEnclosure: 60,
      concretePad: 45,
      commercialCart: 12,
      setup: 30,
    },

    conditionMultipliers: {
      light: 0.85,
      moderate: 1,
      heavy: 1.4,
      not_sure: 1.15,
    },

    accessMultipliers: {
      standard: 1,
      limited: 1.15,
      difficult: 1.3,
    },

    hoaTiers: [
      {
        minimumBins: 20,
        maximumBins: 39,
        pricePerBinCents: 2500,
        requiresManualReview: false,
      },
      {
        minimumBins: 40,
        maximumBins: 74,
        pricePerBinCents: 2200,
        requiresManualReview: false,
      },
      {
        minimumBins: 75,
        maximumBins: 149,
        pricePerBinCents: 1900,
        requiresManualReview: false,
      },
      {
        minimumBins: 150,
        maximumBins: null,
        pricePerBinCents: 1800,
        requiresManualReview: true,
      },
    ],
  };
