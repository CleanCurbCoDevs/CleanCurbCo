import type {
  CommercialPricingProfileValues,
} from "@/types/commercial-pricing";

import type {
  CommercialQuoteAssessment,
  CommercialSurfaceMeasurement,
} from "@/types/commercial-measurement";

export function calculateCommercialSurfaceSquareFeet(
  measurement: CommercialSurfaceMeasurement,
) {
  const quantity = nonNegative(
    measurement.quantity,
  );

  const perAreaSquareFeet =
    measurement.dimensionMode ===
    "manual_square_feet"
      ? nonNegative(
          measurement.manualSquareFeet,
        )
      : nonNegative(
          measurement.dimensionAFeet,
        ) *
        nonNegative(
          measurement.dimensionBFeet,
        );

  return roundTwoDecimals(
    perAreaSquareFeet * quantity,
  );
}

export function calculateCommercialTotalSquareFeet(
  measurements:
    CommercialSurfaceMeasurement[],
) {
  return roundTwoDecimals(
    measurements.reduce(
      (total, measurement) =>
        total +
        calculateCommercialSurfaceSquareFeet(
          measurement,
        ),
      0,
    ),
  );
}

export function calculateCommercialAssessmentInternalCost(
  profile: CommercialPricingProfileValues,
  assessment: CommercialQuoteAssessment,
) {
  const assessorCount = Math.max(
    1,
    Math.round(
      nonNegative(
        assessment.assessorCount,
      ),
    ),
  );
  const isOnsite =
    assessment.method === "onsite";
  
  const fieldPersonMinutes =
    isOnsite
      ? (
          nonNegative(
            assessment.travelMinutes,
          ) +
          nonNegative(
            assessment.onsiteMinutes,
          )
        ) * assessorCount
      : 0;

  const adminPersonMinutes =
    nonNegative(
      assessment.adminMinutes,
    );

  const totalPersonMinutes =
    fieldPersonMinutes +
    adminPersonMinutes;

  const laborCents = Math.round(
    (
      totalPersonMinutes / 60
    ) *
      nonNegative(
        profile.laborRateCents,
      ),
  );

  const mileageCents =
    isOnsite
      ? Math.round(
          nonNegative(
            assessment.roundTripMiles,
          ) *
            nonNegative(
              profile
                .assessmentVehicleCostPerMileCents,
            ),
        )
      : 0;

  const otherCostsCents = Math.round(
    nonNegative(
      assessment.otherCostsCents,
    ),
  );

  return {
    assessorCount,

    fieldPersonMinutes:
      roundTwoDecimals(
        fieldPersonMinutes,
      ),

    adminPersonMinutes:
      roundTwoDecimals(
        adminPersonMinutes,
      ),

    totalPersonMinutes:
      roundTwoDecimals(
        totalPersonMinutes,
      ),

    laborCents,
    mileageCents,
    otherCostsCents,

    totalCents:
      laborCents +
      mileageCents +
      otherCostsCents,
  };
}

function nonNegative(
  value: number,
) {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function roundTwoDecimals(
  value: number,
) {
  return (
    Math.round(value * 100) / 100
  );
}
