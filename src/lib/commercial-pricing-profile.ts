import {
  DEFAULT_COMMERCIAL_PRICING_PROFILE,
  type CommercialPricingProfileValues,
} from "@/types/commercial-pricing";

import type {
  CommercialPricingProfileRow,
} from "@/types/database";

export function commercialPricingProfileRowToValues(
  row: CommercialPricingProfileRow | null,
): CommercialPricingProfileValues {
  const fallback =
    DEFAULT_COMMERCIAL_PRICING_PROFILE;

  if (!row) {
    return clonePricingProfile(fallback);
  }

  return {
    currency:
      row.currency || fallback.currency,

    laborRateCents: safeInteger(
      row.labor_rate_cents,
      fallback.laborRateCents,
    ),

    initialCommercialMinimumCents:
      safeInteger(
        row.initial_commercial_minimum_cents,
        fallback.initialCommercialMinimumCents,
      ),

    recurringCommercialMinimumCents:
      safeInteger(
        row.recurring_commercial_minimum_cents,
        fallback.recurringCommercialMinimumCents,
      ),

    initialMobilizationCents:
      safeInteger(
        row.initial_mobilization_cents,
        fallback.initialMobilizationCents,
      ),

    recurringMobilizationCents:
      safeInteger(
        row.recurring_mobilization_cents,
        fallback.recurringMobilizationCents,
      ),

    lightSuppliesCents:
      safeInteger(
        row.light_supplies_cents,
        fallback.lightSuppliesCents,
      ),

    moderateSuppliesCents:
      safeInteger(
        row.moderate_supplies_cents,
        fallback.moderateSuppliesCents,
      ),

    heavySuppliesCents:
      safeInteger(
        row.heavy_supplies_cents,
        fallback.heavySuppliesCents,
      ),

    defaultUncertaintyPercent:
      safeNumber(
        row.default_uncertainty_percent,
        fallback.defaultUncertaintyPercent,
      ),

    roundingIncrementCents:
      Math.max(
        1,
        safeInteger(
          row.rounding_increment_cents,
          fallback.roundingIncrementCents,
        ),
      ),

    hoaRouteMinimumCents:
      safeInteger(
        row.hoa_route_minimum_cents,
        fallback.hoaRouteMinimumCents,
      ),

    apartmentMinimumCents:
      safeInteger(
        row.apartment_minimum_cents,
        fallback.apartmentMinimumCents,
      ),

    hoaUnstagedSurchargePerBinCents:
      safeInteger(
        row.hoa_unstaged_surcharge_per_bin_cents,
        fallback
          .hoaUnstagedSurchargePerBinCents,
      ),

    hoaAdditionalZoneFeeCents:
      safeInteger(
        row.hoa_additional_zone_fee_cents,
        fallback.hoaAdditionalZoneFeeCents,
      ),

    hoaCoordinationFeeCents:
      safeInteger(
        row.hoa_coordination_fee_cents,
        fallback.hoaCoordinationFeeCents,
      ),

    assessmentVehicleCostPerMileCents:
      safeInteger(
        row
          .assessment_vehicle_cost_per_mile_cents,
        fallback
          .assessmentVehicleCostPerMileCents,
      ),
    
    siteVisitRecommendedSquareFeet:
      safeInteger(
        row.site_visit_recommended_sqft,
        fallback
          .siteVisitRecommendedSquareFeet,
      ),
    
    siteVisitRecommendedPriceCents:
      safeInteger(
        row
          .site_visit_recommended_price_cents,
        fallback
          .siteVisitRecommendedPriceCents,
      ),
    
    surfaceRatesCents: {
      ...fallback.surfaceRatesCents,
      ...(row.surface_rates_cents ?? {}),
    },
    
    surfacePersonMinutesPer100SquareFeet: {
      ...fallback
        .surfacePersonMinutesPer100SquareFeet,
    
      ...(row
        .surface_person_minutes_per_100_sqft ??
        {}),
    },

    surfaceRatesCents: {
      ...profile.surfaceRatesCents,
    },
    
    surfacePersonMinutesPer100SquareFeet: {
      ...profile
        .surfacePersonMinutesPer100SquareFeet,
    },
        
    taskMinutes: {
      ...fallback.taskMinutes,
      ...(row.task_minutes ?? {}),
    },

    conditionMultipliers: {
      ...fallback.conditionMultipliers,
      ...(row.condition_multipliers ?? {}),
    },

    accessMultipliers: {
      ...fallback.accessMultipliers,
      ...(row.access_multipliers ?? {}),
    },

    hoaTiers:
      Array.isArray(row.hoa_tiers) &&
      row.hoa_tiers.length
        ? row.hoa_tiers.map((tier) => ({
            ...tier,
          }))
        : fallback.hoaTiers.map(
            (tier) => ({
              ...tier,
            }),
          ),
  };
}

function clonePricingProfile(
  profile: CommercialPricingProfileValues,
): CommercialPricingProfileValues {
  return {
    ...profile,

    taskMinutes: {
      ...profile.taskMinutes,
    },

    conditionMultipliers: {
      ...profile.conditionMultipliers,
    },

    accessMultipliers: {
      ...profile.accessMultipliers,
    },

    hoaTiers: profile.hoaTiers.map(
      (tier) => ({
        ...tier,
      }),
    ),
  };
}

function safeInteger(
  value: number,
  fallback: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : fallback;
}

function safeNumber(
  value: number,
  fallback: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}
