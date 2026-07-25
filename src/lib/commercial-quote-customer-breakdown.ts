import {
  calculateCommercialSurfaceSquareFeet,
} from "@/lib/commercial-measurements";

import {
  normalizeCommercialPricingInput,
} from "@/lib/commercial-pricing-input";

import {
  commercialSiteConditionLabels,
} from "@/types/commercial";

import {
  commercialMeasurementConfidenceLabels,
  commercialMeasurementSourceLabels,
  commercialSurfaceTypeLabels,
} from "@/types/commercial-measurement";

import type {
  CommercialSurfaceMeasurement,
} from "@/types/commercial-measurement";

import type {
  CommercialPricingCalculation,
  CommercialPricingInput,
  CommercialPricingProfileValues,
  CommercialQuoteLineItemType,
  CommercialSupplyTier,
  CommercialWorkUnits,
} from "@/types/commercial-pricing";

import type {
  CommercialQuoteLineItemRow,
  CommercialQuoteRow,
} from "@/types/database";

export type CommercialCustomerQuotePhase =
  | "initial"
  | "recurring";

export type CommercialCustomerLineItemDraft = {
  phase:
    CommercialCustomerQuotePhase;

  itemType:
    CommercialQuoteLineItemType;

  name: string;
  description:
    string | null;

  quantity: number;
  unitLabel:
    string | null;

  amountCents: number;

  metadata:
    Record<string, unknown>;
};

export type CommercialCustomerProjectBasis = {
  phase:
    CommercialCustomerQuotePhase;

  operatingSummaries:
    string[];

  workSummaries:
    string[];

  surfaceSummaries:
    string[];
};

type CustomerLineSeed = {
  sourceKey: string;

  name: string;
  description:
    string | null;

  quantity: number;
  unitLabel:
    string | null;

  weight: number;

  metadata:
    Record<string, unknown>;
};

const accessLabels = {
  standard:
    "Standard access",

  limited:
    "Limited access",

  difficult:
    "Difficult access",
} as const;

const supplyLabels:
  Record<
    CommercialSupplyTier,
    string
  > = {
    light:
      "Light cleaning-supply level",

    moderate:
      "Moderate cleaning-supply level",

    heavy:
      "Heavy cleaning-supply level",

    custom:
      "Custom cleaning-supply allowance",
  };

export function buildCommercialCustomerLineItems({
  phase,
  input,
  calculation,
  pricingProfile,
  finalPriceCents,
}: {
  phase:
    CommercialCustomerQuotePhase;

  input:
    CommercialPricingInput;

  calculation:
    CommercialPricingCalculation;

  pricingProfile:
    CommercialPricingProfileValues;

  finalPriceCents: number;
}): CommercialCustomerLineItemDraft[] {
  const normalizedFinalPrice =
    normalizeCents(
      finalPriceCents,
    );

  if (
    normalizedFinalPrice <= 0
  ) {
    return [];
  }

  const serviceSeeds:
    CustomerLineSeed[] = [];

  if (
    input.model ===
    "commercial_site"
  ) {
    addWorkUnitSeeds(
      serviceSeeds,
      input.workUnits,
      pricingProfile,
    );
  }

  if (
    input.model ===
    "hoa_route"
  ) {
    const binCount =
      normalizeQuantity(
        input.binCount,
      );

    if (binCount > 0) {
      const personMinutesPerBin =
        input.personMinutesPerBin ??
        pricingProfile.taskMinutes
          .commercialCart;

      serviceSeeds.push({
        sourceKey:
          "hoa-commercial-cart-route",

        name:
          "Commercial cart cleaning, sanitizing, and deodorizing",

        description:
          "Association or property-managed cart route under the quantities and staging assumptions listed in this quote.",

        quantity:
          binCount,

        unitLabel:
          "bins",

        weight:
          Math.max(
            1,
            binCount *
              Math.max(
                1,
                personMinutesPerBin,
              ),
          ),

        metadata: {
          collectionZoneCount:
            input.collectionZoneCount,

          stagedTogether:
            input.binsStagedTogether,

          residentCoordinationRequired:
            input
              .residentCoordinationRequired,
        },
      });
    }
  }

  if (
    input.model ===
    "apartment_hybrid"
  ) {
    addWorkUnitSeeds(
      serviceSeeds,
      input.centralWorkUnits,
      pricingProfile,
    );

    const cartCount =
      normalizeQuantity(
        input.cartCount,
      );

    if (cartCount > 0) {
      const personMinutesPerCart =
        input.personMinutesPerCart ??
        pricingProfile.taskMinutes
          .commercialCart;

      serviceSeeds.push({
        sourceKey:
          "apartment-commercial-carts",

        name:
          "Individual commercial cart cleaning, sanitizing, and deodorizing",

        description:
          "Cart service under the building, staging, and collection-zone assumptions listed in this quote.",

        quantity:
          cartCount,

        unitLabel:
          "carts",

        weight:
          Math.max(
            1,
            cartCount *
              Math.max(
                1,
                personMinutesPerCart,
              ),
          ),

        metadata: {
          collectionZoneCount:
            input.collectionZoneCount,

          stagedTogether:
            input.cartsStagedTogether,

          residentCoordinationRequired:
            input
              .residentCoordinationRequired,
        },
      });
    }
  }

  addMeasuredSurfaceSeeds(
    serviceSeeds,
    input.surfaceMeasurements,
    pricingProfile,
  );

  if (
    serviceSeeds.length === 0
  ) {
    return [];
  }

  const rawProjectSupportCents =
    Math.max(
      0,
      calculation
        .mobilizationCents +
      calculation
        .suppliesCents +
      calculation
        .specialCostsCents +
      calculation
        .routeAdjustmentsCents +
      calculation
        .assessmentRecoveryCents,
    );

  /*
   * This is a customer-facing allocation, not an
   * assertion that this line exactly reimburses
   * every internal operating cost. Capping it keeps
   * the actual services as the dominant price lines.
   */
  const projectSupportCapCents =
    Math.round(
      normalizedFinalPrice *
        0.35,
    );

  const projectSupportCents =
    Math.min(
      rawProjectSupportCents,
      projectSupportCapCents,
    );

  const customerServicePoolCents =
    Math.max(
      0,
      normalizedFinalPrice -
        projectSupportCents,
    );

  const serviceAllocations =
    allocateCentsByWeight(
      customerServicePoolCents,
      serviceSeeds.map(
        (seed) =>
          seed.weight,
      ),
    );

  const serviceItems =
    serviceSeeds.map(
      (
        seed,
        index,
      ): CommercialCustomerLineItemDraft => ({
        phase,

        itemType:
          "service",

        name:
          seed.name,

        description:
          seed.description,

        quantity:
          seed.quantity,

        unitLabel:
          seed.unitLabel,

        amountCents:
          serviceAllocations[
            index
          ] ?? 0,

        metadata: {
          phase,
          sourceKey:
            seed.sourceKey,

          ...seed.metadata,
        },
      }),
    );

  if (
    projectSupportCents <= 0
  ) {
    return serviceItems;
  }

  return [
    ...serviceItems,

    {
      phase,

      itemType:
        "fee",

      name:
        "Project support and mobilization*",

      description:
        "Standard project-support resources required to complete the quoted scope.",

      quantity:
        1,

      unitLabel:
        "project",

      amountCents:
        projectSupportCents,

      metadata: {
        phase,
        sourceKey:
          "project-support-and-mobilization",

        footnoteRequired:
          true,
      },
    },
  ];
}

export function buildCommercialCustomerProjectBasisFromQuote(
  quote:
    CommercialQuoteRow,

  phase:
    CommercialCustomerQuotePhase,
): CommercialCustomerProjectBasis | null {
  const input =
    getSavedCommercialPricingInput(
      quote,
      phase,
    );

  const calculation =
    getSavedCommercialPricingCalculation(
      quote,
      phase,
    );

  if (
    !input ||
    !calculation
  ) {
    return null;
  }

  const operatingSummaries = [
    `Planned crew: ${Math.max(
      1,
      Math.round(
        input.crewSize,
      ),
    )}`,

    `Estimated onsite service window: ${formatDuration(
      calculation
        .estimatedOnsiteMinutes,
    )}`,

    `Site condition: ${
      commercialSiteConditionLabels[
        input.condition
      ]
    }`,

    `Access assumption: ${
      accessLabels[
        input.accessComplexity
      ]
    }`,

    `Operating assumption: ${
      supplyLabels[
        input.supplyTier
      ]
    }`,
  ];

  return {
    phase,

    operatingSummaries,

    workSummaries:
      buildWorkSummaries(
        input,
      ),

    surfaceSummaries:
      input.surfaceMeasurements
        .map(
          buildSurfaceSummary,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
  };
}

export function getCommercialQuoteLineItemPhase(
  item:
    CommercialQuoteLineItemRow,
): CommercialCustomerQuotePhase {
  return item.metadata
    .phase === "recurring"
    ? "recurring"
    : "initial";
}

function addWorkUnitSeeds(
  seeds:
    CustomerLineSeed[],

  workUnits:
    CommercialWorkUnits,

  pricingProfile:
    CommercialPricingProfileValues,
) {
  addCountSeed(
    seeds,
    {
      sourceKey:
        "dumpster-exteriors",

      name:
        "Dumpster exterior cleaning, sanitizing, and deodorizing",

      description:
        "Exterior container cleaning under the site-condition and access assumptions listed in this quote.",

      quantity:
        workUnits
          .dumpsterExteriors,

      unitLabel:
        "dumpsters",

      personMinutesPerUnit:
        pricingProfile
          .taskMinutes
          .dumpsterExterior,
    },
  );

  addCountSeed(
    seeds,
    {
      sourceKey:
        "trash-enclosures",

      name:
        "Trash enclosure cleaning",

      description:
        "Cleaning of the quoted enclosure areas, excluding repairs and work outside the written scope.",

      quantity:
        workUnits
          .trashEnclosures,

      unitLabel:
        "enclosures",

      personMinutesPerUnit:
        pricingProfile
          .taskMinutes
          .trashEnclosure,
    },
  );

  addCountSeed(
    seeds,
    {
      sourceKey:
        "unmeasured-concrete-pads",

      name:
        "Concrete pad cleaning",

      description:
        "Standard pad units that are not separately represented by measured-square-foot lines.",

      quantity:
        workUnits
          .concretePads,

      unitLabel:
        "pads",

      personMinutesPerUnit:
        pricingProfile
          .taskMinutes
          .concretePad,
    },
  );

  addCountSeed(
    seeds,
    {
      sourceKey:
        "commercial-carts",

      name:
        "Commercial cart cleaning, sanitizing, and deodorizing",

      description:
        "Individual commercial cart service under the quantities listed in this quote.",

      quantity:
        workUnits
          .commercialCarts,

      unitLabel:
        "carts",

      personMinutesPerUnit:
        pricingProfile
          .taskMinutes
          .commercialCart,
    },
  );

  const customPersonMinutes =
    Math.max(
      0,
      workUnits
        .customPersonMinutes,
    );

  if (
    customPersonMinutes > 0
  ) {
    seeds.push({
      sourceKey:
        "additional-quoted-work",

      name:
        "Additional quoted service work",

      description:
        "Customer-facing work described in the accepted scope that does not fit a standard container or surface unit.",

      quantity:
        1,

      unitLabel:
        "scope",

      weight:
        customPersonMinutes,

      metadata: {
        customPersonMinutes,
      },
    });
  }
}

function addCountSeed(
  seeds:
    CustomerLineSeed[],

  input: {
    sourceKey: string;
    name: string;
    description: string;

    quantity: number;
    unitLabel: string;

    personMinutesPerUnit:
      number;
  },
) {
  const quantity =
    normalizeQuantity(
      input.quantity,
    );

  if (quantity <= 0) {
    return;
  }

  seeds.push({
    sourceKey:
      input.sourceKey,

    name:
      input.name,

    description:
      input.description,

    quantity,

    unitLabel:
      input.unitLabel,

    weight:
      Math.max(
        1,
        quantity *
          Math.max(
            1,
            input
              .personMinutesPerUnit,
          ),
      ),

    metadata: {},
  });
}

function addMeasuredSurfaceSeeds(
  seeds:
    CustomerLineSeed[],

  measurements:
    CommercialSurfaceMeasurement[],

  pricingProfile:
    CommercialPricingProfileValues,
) {
  for (
    const measurement of
    measurements
  ) {
    const squareFeet =
      calculateCommercialSurfaceSquareFeet(
        measurement,
      );

    if (squareFeet <= 0) {
      continue;
    }

    const surfaceLabel =
      commercialSurfaceTypeLabels[
        measurement.surfaceType
      ];

    const measurementLabel =
      measurement.label.trim() ||
      surfaceLabel;

    const personMinutesPer100SquareFeet =
      pricingProfile
        .surfacePersonMinutesPer100SquareFeet[
        measurement.surfaceType
      ] ?? 0;

    const estimatedPersonMinutes =
      Math.max(
        1,
        Math.round(
          squareFeet /
            100 *
            Math.max(
              1,
              personMinutesPer100SquareFeet,
            ),
        ),
      );
    seeds.push({
      sourceKey:
        `surface-${measurement.id}`,

      name:
        `${measurementLabel} cleaning`,

      description:
        `${
          commercialMeasurementSourceLabels[
            measurement.source
          ]
        } - ${
          commercialMeasurementConfidenceLabels[
            measurement.confidence
          ]
        }`,
      quantity:
        squareFeet,

      unitLabel:
        "sq. ft.",

      weight:
        estimatedPersonMinutes,

      metadata: {
        measurementId:
          measurement.id,

        surfaceType:
          measurement.surfaceType,

        source:
          measurement.source,

        confidence:
          measurement.confidence,

        squareFeet,

        estimatedPersonMinutes,
      },
    });
  }
}

function buildWorkSummaries(
  input:
    CommercialPricingInput,
) {
  const summaries:
    string[] = [];

  if (
    input.model ===
    "commercial_site"
  ) {
    appendWorkUnitSummaries(
      summaries,
      input.workUnits,
    );
  }

  if (
    input.model ===
    "hoa_route"
  ) {
    summaries.push(
      `Guaranteed route quantity: ${normalizeQuantity(
        input.binCount,
      )} bins`,
    );

    summaries.push(
      `Collection zones: ${Math.max(
        1,
        normalizeQuantity(
          input.collectionZoneCount,
        ),
      )}`,
    );

    summaries.push(
      input.binsStagedTogether
        ? "Route assumption: bins are staged together"
        : "Route assumption: bins are distributed and require movement between stops",
    );
  }

  if (
    input.model ===
    "apartment_hybrid"
  ) {
    appendWorkUnitSummaries(
      summaries,
      input.centralWorkUnits,
    );

    summaries.push(
      `Individual commercial carts: ${normalizeQuantity(
        input.cartCount,
      )}`,
    );

    summaries.push(
      `Collection zones: ${Math.max(
        1,
        normalizeQuantity(
          input.collectionZoneCount,
        ),
      )}`,
    );
  }

  return summaries;
}

function appendWorkUnitSummaries(
  summaries:
    string[],

  workUnits:
    CommercialWorkUnits,
) {
  const rows = [
    [
      "Dumpster exteriors",
      workUnits
        .dumpsterExteriors,
    ],

    [
      "Trash enclosures",
      workUnits
        .trashEnclosures,
    ],

    [
      "Unmeasured concrete pads",
      workUnits
        .concretePads,
    ],

    [
      "Commercial carts",
      workUnits
        .commercialCarts,
    ],
  ] as const;

  for (
    const [
      label,
      value,
    ] of rows
  ) {
    const quantity =
      normalizeQuantity(
        value,
      );

    if (quantity > 0) {
      summaries.push(
        `${label}: ${quantity}`,
      );
    }
  }

  if (
    workUnits
      .customPersonMinutes > 0
  ) {
    summaries.push(
      "Additional customer-facing work is included as described in the written scope.",
    );
  }
}

function buildSurfaceSummary(
  measurement:
    CommercialSurfaceMeasurement,
) {
  const squareFeet =
    calculateCommercialSurfaceSquareFeet(
      measurement,
    );

  if (squareFeet <= 0) {
    return null;
  }

  const label =
    measurement.label.trim() ||
    commercialSurfaceTypeLabels[
      measurement.surfaceType
    ];

  return `${label}: ${formatSquareFeet(
    squareFeet,
  )} sq. ft. - ${
    commercialMeasurementSourceLabels[
      measurement.source
    ]
  } - ${
    commercialMeasurementConfidenceLabels[
      measurement.confidence
    ]
  }`;
}

function getSavedCommercialPricingInput(
  quote:
    CommercialQuoteRow,

  phase:
    CommercialCustomerQuotePhase,
): CommercialPricingInput | null {
  const raw =
    quote.calculator_input[
      phase
    ];

  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return null;
  }

  return normalizeCommercialPricingInput(
    raw,
    quote.pricing_model,
    phase,
  );
}

function getSavedCommercialPricingCalculation(
  quote:
    CommercialQuoteRow,

  phase:
    CommercialCustomerQuotePhase,
): CommercialPricingCalculation | null {
  const raw =
    quote.calculator_output[
      phase
    ];

  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return null;
  }

  const candidate =
    raw as Partial<
      CommercialPricingCalculation
    >;

  if (
    !Number.isFinite(
      candidate
        .estimatedOnsiteMinutes,
    )
  ) {
    return null;
  }

  return raw as
    CommercialPricingCalculation;
}

function allocateCentsByWeight(
  totalCents: number,
  weights: number[],
) {
  if (
    weights.length === 0
  ) {
    return [];
  }

  const normalizedTotal =
    normalizeCents(
      totalCents,
    );

  const normalizedWeights =
    weights.map(
      (weight) =>
        Number.isFinite(weight)
          ? Math.max(
              0,
              weight,
            )
          : 0,
    );

  let totalWeight =
    normalizedWeights.reduce(
      (
        total,
        weight,
      ) =>
        total + weight,
      0,
    );

  if (totalWeight <= 0) {
    totalWeight =
      normalizedWeights.length;

    normalizedWeights.fill(1);
  }

  const rawAllocations =
    normalizedWeights.map(
      (weight) =>
        normalizedTotal *
        weight /
        totalWeight,
    );

  const allocations =
    rawAllocations.map(
      (value) =>
        Math.floor(value),
    );

  let remainder =
    normalizedTotal -
    allocations.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    );

  const remainderOrder =
    rawAllocations
      .map(
        (
          value,
          index,
        ) => ({
          index,
          fraction:
            value -
            Math.floor(value),
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.fraction -
            left.fraction ||
          left.index -
            right.index,
      );

  let cursor = 0;

  while (
    remainder > 0
  ) {
    const target =
      remainderOrder[
        cursor %
          remainderOrder.length
      ];

    allocations[
      target.index
    ] += 1;

    remainder -= 1;
    cursor += 1;
  }

  return allocations;
}

function normalizeQuantity(
  value: number,
) {
  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.round(value),
      )
    : 0;
}

function normalizeCents(
  value: number,
) {
  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.round(value),
      )
    : 0;
}

function formatSquareFeet(
  value: number,
) {
  return value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits:
        2,
    },
  );
}

function formatDuration(
  minutes: number,
) {
  const normalizedMinutes =
    Number.isFinite(minutes)
      ? Math.max(
          0,
          Math.round(minutes),
        )
      : 0;

  const hours =
    Math.floor(
      normalizedMinutes /
        60,
    );

  const remainingMinutes =
    normalizedMinutes % 60;

  if (
    hours <= 0
  ) {
    return `${remainingMinutes} minutes`;
  }

  if (
    remainingMinutes <= 0
  ) {
    return `${hours} ${
      hours === 1
        ? "hour"
        : "hours"
    }`;
  }

  return `${hours} ${
    hours === 1
      ? "hour"
      : "hours"
  } ${remainingMinutes} minutes`;
}
