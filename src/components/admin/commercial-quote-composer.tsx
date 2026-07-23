"use client";

import {
  Building2,
  Calculator,
  Copy,
  Home,
  Save,
  TriangleAlert,
  Users,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";

import {
  saveCommercialQuoteDraftAction,
} from "@/app/admin/actions";

import {
  calculateCommercialPricing,
} from "@/lib/commercial-pricing";

import {
  normalizeCommercialPricingInput,
} from "@/lib/commercial-pricing-input";

import {
  commercialDesiredFrequencies,
  commercialDesiredFrequencyLabels,
  commercialServiceInterestLabels,
  commercialSiteConditions,
  commercialSiteConditionLabels,
} from "@/types/commercial";

import {
  commercialAccessComplexities,
  commercialSupplyTiers,
  type CommercialAccessComplexity,
  type CommercialPricingCalculation,
  type CommercialPricingInput,
  type CommercialPricingModel,
  type CommercialPricingProfileValues,
  type CommercialSupplyTier,
  type CommercialVisitType,
} from "@/types/commercial-pricing";

import type {
  CommercialQuoteRequestRow,
  CommercialQuoteRow,
} from "@/types/database";

type CommercialQuoteComposerProps = {
  request: CommercialQuoteRequestRow;
  pricingProfile:
    CommercialPricingProfileValues;
  pricingProfileId: string | null;
  pricingProfileName: string;
  existingDraft: CommercialQuoteRow | null;
};

type EstimateKind =
  | "initial"
  | "recurring";

const pricingModelOptions = [
  {
    value: "commercial_site",
    label: "Commercial Site",
    description:
      "Restaurants, offices, retail properties, dumpsters, enclosures, pads, and similar sites.",
    icon: Building2,
  },
  {
    value: "hoa_route",
    label: "HOA Route",
    description:
      "Association-paid routes built around guaranteed bin count and route density.",
    icon: Home,
  },
  {
    value: "apartment_hybrid",
    label: "Apartment / Multifamily",
    description:
      "Central waste areas plus individual carts, buildings, or collection zones.",
    icon: Users,
  },
] satisfies Array<{
  value: CommercialPricingModel;
  label: string;
  description: string;
  icon: typeof Building2;
}>;

const accessLabels:
  Record<
    CommercialAccessComplexity,
    string
  > = {
    standard: "Standard access",
    limited: "Limited access",
    difficult: "Difficult access",
  };

const supplyLabels:
  Record<
    CommercialSupplyTier,
    string
  > = {
    light: "Light supplies",
    moderate: "Moderate supplies",
    heavy: "Heavy supplies",
    custom: "Custom supply cost",
  };

export function CommercialQuoteComposer({
  request,
  pricingProfile,
  pricingProfileId,
  pricingProfileName,
  existingDraft,
}: CommercialQuoteComposerProps) {
  const startingModel =
    existingDraft?.pricing_model ??
    getRecommendedPricingModel(
      request,
    );

  const savedInitial =
    getSavedPricingInput(
      existingDraft,
      "initial",
      startingModel,
      "initial",
    );

  const savedRecurring =
    getSavedPricingInput(
      existingDraft,
      "recurring",
      startingModel,
      "recurring",
    );

  const [
    pricingModel,
    setPricingModel,
  ] =
    useState<CommercialPricingModel>(
      startingModel,
    );

  const [
    initialInput,
    setInitialInput,
  ] =
    useState<CommercialPricingInput>(
      () =>
        savedInitial ??
        createDefaultPricingInput(
          request,
          startingModel,
          "initial",
        ),
    );

  const [
    recurringInput,
    setRecurringInput,
  ] =
    useState<CommercialPricingInput>(
      () =>
        savedRecurring ??
        createDefaultPricingInput(
          request,
          startingModel,
          "recurring",
        ),
    );

  const [
    includeRecurring,
    setIncludeRecurring,
  ] = useState(
    Boolean(
      savedRecurring ||
        existingDraft
          ?.final_recurring_price_cents !==
          null ||
        request.service_plan ===
          "recurring",
    ),
  );

  const [
    activeEstimate,
    setActiveEstimate,
  ] =
    useState<EstimateKind>(
      "initial",
    );

  const [
    initialPriceOverride,
    setInitialPriceOverride,
  ] = useState(
    existingDraft
      ? centsForInput(
          existingDraft
            .final_initial_price_cents,
        )
      : "",
  );

  const [
    recurringPriceOverride,
    setRecurringPriceOverride,
  ] = useState(
    existingDraft
      ?.final_recurring_price_cents !==
      null &&
      existingDraft
        ?.final_recurring_price_cents !==
        undefined
      ? centsForInput(
          existingDraft
            .final_recurring_price_cents,
        )
      : "",
  );

  const [
    scopeSummary,
    setScopeSummary,
  ] = useState(
    existingDraft?.scope_summary ||
      getDefaultScopeSummary(request),
  );

  const [
    includedServices,
    setIncludedServices,
  ] = useState(
    existingDraft
      ?.included_services.length
      ? existingDraft
          .included_services
          .join("\n")
      : getDefaultIncludedServices(
          request,
        ).join("\n"),
  );

  const [
    assumptions,
    setAssumptions,
  ] = useState(
    existingDraft?.assumptions.length
      ? existingDraft.assumptions.join(
          "\n",
        )
      : [
          "Pricing assumes the work areas are reasonably accessible during the confirmed service window.",
          "Container counts, site conditions, and service zones are based on the information currently available.",
          "Final scheduling remains subject to route, crew, equipment, and site-access confirmation.",
        ].join("\n"),
  );

  const [
    exclusions,
    setExclusions,
  ] = useState(
    existingDraft?.exclusions.length
      ? existingDraft.exclusions.join(
          "\n",
        )
      : [
          "Removal of hazardous, medical, chemical, or regulated waste is not included.",
          "Repairs, painting, waste hauling, and services outside the written scope are not included.",
        ].join("\n"),
  );

  const [
    paymentTerms,
    setPaymentTerms,
  ] = useState(
    existingDraft?.payment_terms ||
      "Payment terms will be confirmed before service is scheduled.",
  );

  const [
    internalNotes,
    setInternalNotes,
  ] = useState(
    existingDraft?.internal_notes ?? "",
  );

  const [
    recurringFrequency,
    setRecurringFrequency,
  ] = useState(
    existingDraft
      ?.recurring_frequency ||
      request.desired_frequency ||
      "monthly",
  );

  const [
    validUntil,
    setValidUntil,
  ] = useState(
    existingDraft?.valid_until ||
      getDefaultValidUntil(),
  );

  const initialCalculation =
    useMemo(
      () =>
        calculateCommercialPricing(
          pricingProfile,
          initialInput,
        ),
      [
        pricingProfile,
        initialInput,
      ],
    );

  const recurringCalculation =
    useMemo(
      () =>
        calculateCommercialPricing(
          pricingProfile,
          recurringInput,
        ),
      [
        pricingProfile,
        recurringInput,
      ],
    );

  const finalInitialPriceCents =
    getFinalPriceCents(
      initialPriceOverride,
      initialCalculation
        .suggestedPriceCents,
    );

  const finalRecurringPriceCents =
    includeRecurring
      ? getFinalPriceCents(
          recurringPriceOverride,
          recurringCalculation
            .suggestedPriceCents,
        )
      : null;

  const activeInput =
    activeEstimate === "initial"
      ? initialInput
      : recurringInput;

  const activeCalculation =
    activeEstimate === "initial"
      ? initialCalculation
      : recurringCalculation;

  const activePriceValue =
    activeEstimate === "initial"
      ? initialPriceOverride ||
        centsForInput(
          initialCalculation
            .suggestedPriceCents,
        )
      : recurringPriceOverride ||
        centsForInput(
          recurringCalculation
            .suggestedPriceCents,
        );

  function replaceActiveInput(
    nextInput:
      CommercialPricingInput,
  ) {
    if (
      activeEstimate === "initial"
    ) {
      setInitialInput(nextInput);
      return;
    }

    setRecurringInput(nextInput);
  }

  function setActivePriceValue(
    value: string,
  ) {
    if (
      activeEstimate === "initial"
    ) {
      setInitialPriceOverride(value);
      return;
    }

    setRecurringPriceOverride(value);
  }

  function changePricingModel(
    nextModel:
      CommercialPricingModel,
  ) {
    setPricingModel(nextModel);

    setInitialInput(
      createDefaultPricingInput(
        request,
        nextModel,
        "initial",
      ),
    );

    setRecurringInput(
      createDefaultPricingInput(
        request,
        nextModel,
        "recurring",
      ),
    );

    setInitialPriceOverride("");
    setRecurringPriceOverride("");
    setActiveEstimate("initial");
  }

  function copyInitialToRecurring() {
    setRecurringInput(
      normalizeCommercialPricingInput(
        initialInput,
        pricingModel,
        "recurring",
      ),
    );

    setRecurringPriceOverride("");
    setIncludeRecurring(true);
    setActiveEstimate("recurring");
  }

  return (
    <section className="commercial-quote-builder">
      <header className="commercial-builder-header">
        <div>
          <p className="section-kicker">
            Commercial Pricing Engine
          </p>

          <h2>
            Build the quote without
            guessing in the dark.
          </h2>

          <p>
            The customer will see a
            fixed price. This workspace
            keeps the labor, supply,
            route, and uncertainty math
            behind the scenes.
          </p>
        </div>

        <div className="commercial-builder-profile">
          <Calculator
            size={24}
            aria-hidden="true"
          />

          <span>
            <small>
              Active pricing profile
            </small>

            <strong>
              {pricingProfileName}
            </strong>

            <small>
              {formatCurrency(
                pricingProfile
                  .laborRateCents,
              )}{" "}
              per person-hour
            </small>
          </span>
        </div>
      </header>

      <FeedbackForm
        action={
          saveCommercialQuoteDraftAction
        }
        className="commercial-builder-form"
        pendingMessage="Saving commercial quote draft..."
        successMessage="Commercial quote draft saved."
      >
        <input
          type="hidden"
          name="commercialQuoteRequestId"
          value={request.id}
        />

        <input
          type="hidden"
          name="commercialQuoteId"
          value={
            existingDraft?.id ?? ""
          }
        />

        <input
          type="hidden"
          name="pricingProfileId"
          value={
            pricingProfileId ?? ""
          }
        />

        <input
          type="hidden"
          name="pricingModel"
          value={pricingModel}
        />

        <input
          type="hidden"
          name="initialInputJson"
          value={JSON.stringify(
            initialInput,
          )}
        />

        <input
          type="hidden"
          name="recurringInputJson"
          value={
            includeRecurring
              ? JSON.stringify(
                  recurringInput,
                )
              : ""
          }
        />

        <input
          type="hidden"
          name="includeRecurring"
          value={
            includeRecurring
              ? "true"
              : "false"
          }
        />

        <input
          type="hidden"
          name="finalInitialPriceCents"
          value={String(
            finalInitialPriceCents,
          )}
        />

        <input
          type="hidden"
          name="finalRecurringPriceCents"
          value={
            finalRecurringPriceCents ===
            null
              ? ""
              : String(
                  finalRecurringPriceCents,
                )
          }
        />

        <section className="commercial-builder-section">
          <div className="commercial-builder-section-heading">
            <div>
              <p className="section-kicker">
                Step 1
              </p>

              <h3>
                Choose the pricing model.
              </h3>
            </div>

            {existingDraft ? (
              <span className="status-badge status-draft">
                Draft v
                {
                  existingDraft.version_number
                }
              </span>
            ) : (
              <span className="status-badge">
                New draft
              </span>
            )}
          </div>

          <div className="commercial-builder-model-grid">
            {pricingModelOptions.map(
              (option) => {
                const Icon =
                  option.icon;

                const isActive =
                  pricingModel ===
                  option.value;

                return (
                  <button
                    className={
                      isActive
                        ? "commercial-builder-model is-active"
                        : "commercial-builder-model"
                    }
                    key={
                      option.value
                    }
                    type="button"
                    onClick={() =>
                      changePricingModel(
                        option.value,
                      )
                    }
                  >
                    <Icon
                      size={24}
                      aria-hidden="true"
                    />

                    <span>
                      <strong>
                        {option.label}
                      </strong>

                      <small>
                        {
                          option.description
                        }
                      </small>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </section>

        <section className="commercial-builder-section">
          <div className="commercial-builder-estimate-toolbar">
            <div className="commercial-builder-tabs">
              <button
                className={
                  activeEstimate ===
                  "initial"
                    ? "commercial-builder-tab is-active"
                    : "commercial-builder-tab"
                }
                type="button"
                onClick={() =>
                  setActiveEstimate(
                    "initial",
                  )
                }
              >
                Initial reset
              </button>

              {includeRecurring ? (
                <button
                  className={
                    activeEstimate ===
                    "recurring"
                      ? "commercial-builder-tab is-active"
                      : "commercial-builder-tab"
                  }
                  type="button"
                  onClick={() =>
                    setActiveEstimate(
                      "recurring",
                    )
                  }
                >
                  Recurring maintenance
                </button>
              ) : null}
            </div>

            <label className="commercial-builder-recurring-toggle">
              <input
                checked={
                  includeRecurring
                }
                type="checkbox"
                onChange={(event) => {
                  const checked =
                    event.target.checked;

                  setIncludeRecurring(
                    checked,
                  );

                  if (!checked) {
                    setActiveEstimate(
                      "initial",
                    );
                  }
                }}
              />

              <span>
                Include recurring
                maintenance option
              </span>
            </label>
          </div>

          {activeEstimate ===
          "recurring" ? (
            <button
              className="button button-outline commercial-builder-copy-button"
              type="button"
              onClick={
                copyInitialToRecurring
              }
            >
              <Copy
                size={18}
                aria-hidden="true"
              />

              Copy initial assumptions
              into recurring
            </button>
          ) : null}

          <div className="commercial-builder-editor-layout">
            <div className="commercial-builder-input-panel">
              <p className="section-kicker">
                {activeEstimate ===
                "initial"
                  ? "Initial Cleaning Assumptions"
                  : "Maintenance Assumptions"}
              </p>

              <h3>
                {activeEstimate ===
                "initial"
                  ? "What will the first reset take?"
                  : "What should a normal maintenance visit take?"}
              </h3>

              {activeInput.model ===
              "commercial_site" ? (
                <div className="commercial-builder-input-grid">
                  <NumberField
                    label="Dumpster exteriors"
                    value={
                      activeInput
                        .workUnits
                        .dumpsterExteriors
                    }
                    onChange={(
                      value,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          workUnits: {
                            ...activeInput
                              .workUnits,

                            dumpsterExteriors:
                              value,
                          },
                        },
                      )
                    }
                  />

                  <NumberField
                    label="Trash enclosures"
                    value={
                      activeInput
                        .workUnits
                        .trashEnclosures
                    }
                    onChange={(
                      value,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          workUnits: {
                            ...activeInput
                              .workUnits,

                            trashEnclosures:
                              value,
                          },
                        },
                      )
                    }
                  />

                  <NumberField
                    label="Concrete pads"
                    value={
                      activeInput
                        .workUnits
                        .concretePads
                    }
                    onChange={(
                      value,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          workUnits: {
                            ...activeInput
                              .workUnits,

                            concretePads:
                              value,
                          },
                        },
                      )
                    }
                  />

                  <NumberField
                    label="Commercial carts"
                    value={
                      activeInput
                        .workUnits
                        .commercialCarts
                    }
                    onChange={(
                      value,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          workUnits: {
                            ...activeInput
                              .workUnits,

                            commercialCarts:
                              value,
                          },
                        },
                      )
                    }
                  />

                  <NumberField
                    label="Other person-minutes"
                    value={
                      activeInput
                        .workUnits
                        .customPersonMinutes
                    }
                    step={5}
                    onChange={(
                      value,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          workUnits: {
                            ...activeInput
                              .workUnits,

                            customPersonMinutes:
                              value,
                          },
                        },
                      )
                    }
                  />
                </div>
              ) : null}

              {activeInput.model ===
              "hoa_route" ? (
                <>
                  <div className="commercial-builder-input-grid">
                    <NumberField
                      label="Guaranteed bins"
                      value={
                        activeInput
                          .binCount
                      }
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,
                            binCount:
                              value,
                          },
                        )
                      }
                    />

                    <NullableNumberField
                      label="Person-minutes per bin"
                      value={
                        activeInput
                          .personMinutesPerBin
                      }
                      placeholder={String(
                        pricingProfile
                          .taskMinutes
                          .commercialCart,
                      )}
                      step={0.5}
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            personMinutesPerBin:
                              value,
                          },
                        )
                      }
                    />

                    <NumberField
                      label="Collection zones"
                      value={
                        activeInput
                          .collectionZoneCount
                      }
                      minimum={1}
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            collectionZoneCount:
                              Math.max(
                                1,
                                value,
                              ),
                          },
                        )
                      }
                    />
                  </div>

                  <div className="commercial-builder-check-grid">
                    <BooleanField
                      checked={
                        activeInput
                          .binsStagedTogether
                      }
                      label="Bins staged together"
                      description="Turn this off when the crew must walk or drive between bins."
                      onChange={(
                        checked,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            binsStagedTogether:
                              checked,
                          },
                        )
                      }
                    />

                    <BooleanField
                      checked={
                        activeInput
                          .residentCoordinationRequired
                      }
                      label="Resident coordination required"
                      description="Adds the profile’s administrative coordination allowance."
                      onChange={(
                        checked,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            residentCoordinationRequired:
                              checked,
                          },
                        )
                      }
                    />
                  </div>
                </>
              ) : null}

              {activeInput.model ===
              "apartment_hybrid" ? (
                <>
                  <p className="commercial-builder-subheading">
                    Central waste areas
                  </p>

                  <div className="commercial-builder-input-grid">
                    <NumberField
                      label="Dumpster exteriors"
                      value={
                        activeInput
                          .centralWorkUnits
                          .dumpsterExteriors
                      }
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            centralWorkUnits:
                              {
                                ...activeInput
                                  .centralWorkUnits,

                                dumpsterExteriors:
                                  value,
                              },
                          },
                        )
                      }
                    />

                    <NumberField
                      label="Trash enclosures"
                      value={
                        activeInput
                          .centralWorkUnits
                          .trashEnclosures
                      }
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            centralWorkUnits:
                              {
                                ...activeInput
                                  .centralWorkUnits,

                                trashEnclosures:
                                  value,
                              },
                          },
                        )
                      }
                    />

                    <NumberField
                      label="Concrete pads"
                      value={
                        activeInput
                          .centralWorkUnits
                          .concretePads
                      }
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            centralWorkUnits:
                              {
                                ...activeInput
                                  .centralWorkUnits,

                                concretePads:
                                  value,
                              },
                          },
                        )
                      }
                    />

                    <NumberField
                      label="Other person-minutes"
                      value={
                        activeInput
                          .centralWorkUnits
                          .customPersonMinutes
                      }
                      step={5}
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            centralWorkUnits:
                              {
                                ...activeInput
                                  .centralWorkUnits,

                                customPersonMinutes:
                                  value,
                              },
                          },
                        )
                      }
                    />
                  </div>

                  <p className="commercial-builder-subheading">
                    Individual carts
                  </p>

                  <div className="commercial-builder-input-grid">
                    <NumberField
                      label="Cart count"
                      value={
                        activeInput
                          .cartCount
                      }
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,
                            cartCount:
                              value,
                          },
                        )
                      }
                    />

                    <NullableNumberField
                      label="Person-minutes per cart"
                      value={
                        activeInput
                          .personMinutesPerCart
                      }
                      placeholder={String(
                        pricingProfile
                          .taskMinutes
                          .commercialCart,
                      )}
                      step={0.5}
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            personMinutesPerCart:
                              value,
                          },
                        )
                      }
                    />

                    <NumberField
                      label="Collection zones"
                      value={
                        activeInput
                          .collectionZoneCount
                      }
                      minimum={1}
                      onChange={(
                        value,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            collectionZoneCount:
                              Math.max(
                                1,
                                value,
                              ),
                          },
                        )
                      }
                    />
                  </div>

                  <div className="commercial-builder-check-grid">
                    <BooleanField
                      checked={
                        activeInput
                          .cartsStagedTogether
                      }
                      label="Carts staged together"
                      description="Turn this off when carts remain at buildings or individual units."
                      onChange={(
                        checked,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            cartsStagedTogether:
                              checked,
                          },
                        )
                      }
                    />

                    <BooleanField
                      checked={
                        activeInput
                          .residentCoordinationRequired
                      }
                      label="Resident coordination required"
                      description="Adds the profile’s administrative coordination allowance."
                      onChange={(
                        checked,
                      ) =>
                        replaceActiveInput(
                          {
                            ...activeInput,

                            residentCoordinationRequired:
                              checked,
                          },
                        )
                      }
                    />
                  </div>
                </>
              ) : null}

              <p className="commercial-builder-subheading">
                Labor and operating assumptions
              </p>

              <div className="commercial-builder-input-grid">
                <NumberField
                  label="Crew size"
                  value={
                    activeInput.crewSize
                  }
                  minimum={1}
                  maximum={20}
                  onChange={(
                    value,
                  ) =>
                    replaceActiveInput(
                      {
                        ...activeInput,

                        crewSize:
                          Math.max(
                            1,
                            value,
                          ),
                      },
                    )
                  }
                />

                <label className="commercial-builder-field">
                  <span>
                    Site condition
                  </span>

                  <select
                    value={
                      activeInput.condition
                    }
                    onChange={(
                      event,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          condition:
                            event
                              .target
                              .value as typeof activeInput.condition,
                        },
                      )
                    }
                  >
                    {commercialSiteConditions.map(
                      (
                        condition,
                      ) => (
                        <option
                          key={
                            condition
                          }
                          value={
                            condition
                          }
                        >
                          {
                            commercialSiteConditionLabels[
                              condition
                            ]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="commercial-builder-field">
                  <span>
                    Access complexity
                  </span>

                  <select
                    value={
                      activeInput
                        .accessComplexity
                    }
                    onChange={(
                      event,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          accessComplexity:
                            event
                              .target
                              .value as CommercialAccessComplexity,
                        },
                      )
                    }
                  >
                    {commercialAccessComplexities.map(
                      (
                        access,
                      ) => (
                        <option
                          key={access}
                          value={access}
                        >
                          {
                            accessLabels[
                              access
                            ]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="commercial-builder-field">
                  <span>
                    Supply tier
                  </span>

                  <select
                    value={
                      activeInput
                        .supplyTier
                    }
                    onChange={(
                      event,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          supplyTier:
                            event
                              .target
                              .value as CommercialSupplyTier,
                        },
                      )
                    }
                  >
                    {commercialSupplyTiers.map(
                      (tier) => (
                        <option
                          key={tier}
                          value={tier}
                        >
                          {
                            supplyLabels[
                              tier
                            ]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {activeInput.supplyTier ===
                "custom" ? (
                  <MoneyField
                    label="Custom supplies"
                    cents={
                      activeInput
                        .customSupplyCents
                    }
                    onChange={(
                      cents,
                    ) =>
                      replaceActiveInput(
                        {
                          ...activeInput,

                          customSupplyCents:
                            cents,
                        },
                      )
                    }
                  />
                ) : null}

                <MoneyField
                  label="Special direct costs"
                  cents={
                    activeInput
                      .specialCostsCents
                  }
                  onChange={(
                    cents,
                  ) =>
                    replaceActiveInput(
                      {
                        ...activeInput,

                        specialCostsCents:
                          cents,
                      },
                    )
                  }
                />

                <MoneyField
                  label="Manual price adjustment"
                  cents={
                    activeInput
                      .manualAdjustmentCents
                  }
                  allowNegative
                  onChange={(
                    cents,
                  ) =>
                    replaceActiveInput(
                      {
                        ...activeInput,

                        manualAdjustmentCents:
                          cents,
                      },
                    )
                  }
                />

                <NullableNumberField
                  label="Uncertainty percent"
                  value={
                    activeInput
                      .uncertaintyPercent
                  }
                  placeholder={String(
                    pricingProfile
                      .defaultUncertaintyPercent,
                  )}
                  step={0.5}
                  maximum={100}
                  onChange={(
                    value,
                  ) =>
                    replaceActiveInput(
                      {
                        ...activeInput,

                        uncertaintyPercent:
                          value,
                      },
                    )
                  }
                />
              </div>
            </div>

            <div className="commercial-builder-live-result">
              <p className="section-kicker">
                Live Estimate
              </p>

              <h3>
                Internal pricing result
              </h3>

              <CalculationSummary
                calculation={
                  activeCalculation
                }
                finalPriceCents={
                  activeEstimate ===
                  "initial"
                    ? finalInitialPriceCents
                    : finalRecurringPriceCents ??
                      recurringCalculation
                        .suggestedPriceCents
                }
              />

              <label className="commercial-builder-final-price">
                <span>
                  Final{" "}
                  {activeEstimate ===
                  "initial"
                    ? "initial"
                    : "recurring"}{" "}
                  price
                </span>

                <div className="commercial-money-input">
                  <span>$</span>

                  <input
                    inputMode="decimal"
                    value={
                      activePriceValue
                    }
                    onChange={(
                      event,
                    ) =>
                      setActivePriceValue(
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                <small>
                  Clear this field to
                  return to the current
                  suggested price.
                </small>
              </label>

              {activeCalculation
                .warnings.length ? (
                <div className="commercial-builder-warning-list">
                  {activeCalculation.warnings.map(
                    (warning) => (
                      <div
                        className="commercial-builder-warning"
                        key={
                          warning
                        }
                      >
                        <TriangleAlert
                          size={19}
                          aria-hidden="true"
                        />

                        <span>
                          {warning}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="commercial-builder-clear-message">
                  No calculator warnings
                  at the moment.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="commercial-builder-section">
          <div className="commercial-builder-section-heading">
            <div>
              <p className="section-kicker">
                Step 3
              </p>

              <h3>
                Review the proposed
                pricing.
              </h3>
            </div>
          </div>

          <div className="commercial-builder-results">
            <CalculationCard
              calculation={
                initialCalculation
              }
              finalPriceCents={
                finalInitialPriceCents
              }
              title="Initial Reset"
            />

            {includeRecurring ? (
              <CalculationCard
                calculation={
                  recurringCalculation
                }
                finalPriceCents={
                  finalRecurringPriceCents ??
                  recurringCalculation
                    .suggestedPriceCents
                }
                title="Recurring Maintenance"
              />
            ) : null}
          </div>

          {includeRecurring ? (
            <label className="commercial-builder-field commercial-builder-frequency">
              <span>
                Proposed recurring
                frequency
              </span>

              <select
                name="recurringFrequency"
                value={
                  recurringFrequency
                }
                onChange={(
                  event,
                ) =>
                  setRecurringFrequency(
                    event.target
                      .value,
                  )
                }
              >
                {commercialDesiredFrequencies.map(
                  (frequency) => (
                    <option
                      key={
                        frequency
                      }
                      value={
                        frequency
                      }
                    >
                      {
                        commercialDesiredFrequencyLabels[
                          frequency
                        ]
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : null}
        </section>

        <section className="commercial-builder-section">
          <div className="commercial-builder-section-heading">
            <div>
              <p className="section-kicker">
                Step 4
              </p>

              <h3>
                Build the customer-facing
                scope.
              </h3>
            </div>

            <span className="status-badge">
              Customer-facing
            </span>
          </div>

          <div className="commercial-builder-quote-grid">
            <label className="commercial-builder-field commercial-builder-wide">
              <span>
                Scope summary
              </span>

              <textarea
                name="scopeSummary"
                value={scopeSummary}
                required
                onChange={(
                  event,
                ) =>
                  setScopeSummary(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="commercial-builder-field">
              <span>
                Included services
              </span>

              <textarea
                name="includedServices"
                value={
                  includedServices
                }
                onChange={(
                  event,
                ) =>
                  setIncludedServices(
                    event.target.value,
                  )
                }
              />

              <small>
                One item per line.
              </small>
            </label>

            <label className="commercial-builder-field">
              <span>
                Assumptions
              </span>

              <textarea
                name="assumptions"
                value={assumptions}
                onChange={(
                  event,
                ) =>
                  setAssumptions(
                    event.target.value,
                  )
                }
              />

              <small>
                One item per line.
              </small>
            </label>

            <label className="commercial-builder-field">
              <span>
                Exclusions
              </span>

              <textarea
                name="exclusions"
                value={exclusions}
                onChange={(
                  event,
                ) =>
                  setExclusions(
                    event.target.value,
                  )
                }
              />

              <small>
                One item per line.
              </small>
            </label>

            <label className="commercial-builder-field">
              <span>
                Payment terms
              </span>

              <textarea
                name="paymentTerms"
                value={paymentTerms}
                onChange={(
                  event,
                ) =>
                  setPaymentTerms(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="commercial-builder-field">
              <span>
                Quote valid until
              </span>

              <input
                name="validUntil"
                type="date"
                value={validUntil}
                onChange={(
                  event,
                ) =>
                  setValidUntil(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="commercial-builder-field commercial-builder-wide">
              <span>
                Internal pricing notes
              </span>

              <textarea
                name="internalNotes"
                value={internalNotes}
                placeholder="Walkthrough details, why you overrode the suggested price, equipment needs, follow-up notes..."
                onChange={(
                  event,
                ) =>
                  setInternalNotes(
                    event.target.value,
                  )
                }
              />

              <small>
                Never shown to the
                customer.
              </small>
            </label>
          </div>
        </section>

        <footer className="commercial-builder-savebar">
          <div>
            <span>
              Draft total
            </span>

            <strong>
              Initial:{" "}
              {formatCurrency(
                finalInitialPriceCents,
              )}

              {includeRecurring &&
              finalRecurringPriceCents !==
                null
                ? ` • Recurring: ${formatCurrency(
                    finalRecurringPriceCents,
                  )}`
                : ""}
            </strong>

            <small>
              Saving does not email the
              customer or change this
              request to Quoted.
            </small>
          </div>

          <ActionSubmitButton
            className="button button-primary"
            pendingLabel="Saving Draft..."
          >
            <Save
              size={19}
              aria-hidden="true"
            />

            Save Quote Draft
          </ActionSubmitButton>
        </footer>
      </FeedbackForm>
    </section>
  );
}

function CalculationSummary({
  calculation,
  finalPriceCents,
}: {
  calculation:
    CommercialPricingCalculation;
  finalPriceCents: number;
}) {
  const estimatedContribution =
    finalPriceCents -
    calculation.laborCents -
    calculation.suppliesCents -
    calculation
      .mobilizationCents -
    calculation
      .specialCostsCents -
    calculation
      .routeAdjustmentsCents;

  return (
    <div className="commercial-builder-summary">
      <div>
        <span>
          Person-hours
        </span>

        <strong>
          {
            calculation
              .estimatedPersonHours
          }
        </strong>
      </div>

      <div>
        <span>
          Expected onsite
        </span>

        <strong>
          {formatDuration(
            calculation
              .estimatedOnsiteMinutes,
          )}
        </strong>
      </div>

      <div>
        <span>
          Labor recovery
        </span>

        <strong>
          {formatCurrency(
            calculation.laborCents,
          )}
        </strong>
      </div>

      <div>
        <span>
          Mobilization
        </span>

        <strong>
          {formatCurrency(
            calculation
              .mobilizationCents,
          )}
        </strong>
      </div>

      <div>
        <span>
          Supplies
        </span>

        <strong>
          {formatCurrency(
            calculation
              .suppliesCents,
          )}
        </strong>
      </div>

      <div>
        <span>
          Suggested
        </span>

        <strong>
          {formatCurrency(
            calculation
              .suggestedPriceCents,
          )}
        </strong>
      </div>

      <div className="commercial-builder-summary-wide">
        <span>
          Estimated contribution after
          tracked direct costs
        </span>

        <strong>
          {formatCurrency(
            estimatedContribution,
          )}
        </strong>
      </div>
    </div>
  );
}

function CalculationCard({
  calculation,
  finalPriceCents,
  title,
}: {
  calculation:
    CommercialPricingCalculation;
  finalPriceCents: number;
  title: string;
}) {
  const contribution =
    finalPriceCents -
    calculation.laborCents -
    calculation.suppliesCents -
    calculation
      .mobilizationCents -
    calculation
      .specialCostsCents -
    calculation
      .routeAdjustmentsCents;

  return (
    <article className="commercial-builder-result-card">
      <p className="section-kicker">
        {title}
      </p>

      <strong className="commercial-builder-result-price">
        {formatCurrency(
          finalPriceCents,
        )}
      </strong>

      <div className="commercial-builder-result-lines">
        <span>
          Suggested
          <strong>
            {formatCurrency(
              calculation
                .suggestedPriceCents,
            )}
          </strong>
        </span>

        <span>
          Cost model
          <strong>
            {formatCurrency(
              calculation
                .costModelCents,
            )}
          </strong>
        </span>

        {calculation
          .routeMarketCents > 0 ? (
          <span>
            Market route model
            <strong>
              {formatCurrency(
                calculation
                  .marketModelCents,
              )}
            </strong>
          </span>
        ) : null}

        <span>
          Person-hours
          <strong>
            {
              calculation
                .estimatedPersonHours
            }
          </strong>
        </span>

        <span>
          Expected onsite
          <strong>
            {formatDuration(
              calculation
                .estimatedOnsiteMinutes,
            )}
          </strong>
        </span>

        <span>
          Contribution
          <strong>
            {formatCurrency(
              contribution,
            )}
          </strong>
        </span>
      </div>

      {calculation.minimumApplied ? (
        <small className="commercial-builder-minimum-note">
          Minimum invoice protection
          was applied.
        </small>
      ) : null}
    </article>
  );
}

function NumberField({
  label,
  value,
  onChange,
  minimum = 0,
  maximum,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  step?: number;
}) {
  return (
    <label className="commercial-builder-field">
      <span>{label}</span>

      <input
        max={maximum}
        min={minimum}
        step={step}
        type="number"
        value={value}
        onChange={(event) =>
          onChange(
            inputNumber(
              event.target.value,
            ),
          )
        }
      />
    </label>
  );
}

function NullableNumberField({
  label,
  value,
  onChange,
  placeholder,
  minimum = 0,
  maximum,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (
    value: number | null,
  ) => void;
  placeholder?: string;
  minimum?: number;
  maximum?: number;
  step?: number;
}) {
  return (
    <label className="commercial-builder-field">
      <span>{label}</span>

      <input
        max={maximum}
        min={minimum}
        placeholder={placeholder}
        step={step}
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? null
              : inputNumber(
                  event.target.value,
                ),
          )
        }
      />
    </label>
  );
}

function MoneyField({
  label,
  cents,
  onChange,
  allowNegative = false,
}: {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
  allowNegative?: boolean;
}) {
  return (
    <label className="commercial-builder-field">
      <span>{label}</span>

      <div className="commercial-money-input">
        <span>$</span>

        <input
          inputMode="decimal"
          value={
            cents === 0
              ? ""
              : centsForInput(cents)
          }
          onChange={(event) =>
            onChange(
              dollarsToCents(
                event.target.value,
                allowNegative,
              ),
            )
          }
        />
      </div>
    </label>
  );
}

function BooleanField({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (
    checked: boolean,
  ) => void;
}) {
  return (
    <label className="commercial-builder-check">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <input
        checked={checked}
        type="checkbox"
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />
    </label>
  );
}

function getRecommendedPricingModel(
  request: CommercialQuoteRequestRow,
): CommercialPricingModel {
  if (
    request.property_type ===
      "hoa_community" ||
    request.service_interests.includes(
      "hoa_community_routes",
    )
  ) {
    return "hoa_route";
  }

  if (
    request.property_type ===
    "apartment_community"
  ) {
    return "apartment_hybrid";
  }

  return "commercial_site";
}

function createDefaultPricingInput(
  request: CommercialQuoteRequestRow,
  model: CommercialPricingModel,
  visitType: CommercialVisitType,
) {
  const count =
    request.container_count ?? 0;

  const rawBase = {
    crewSize: 2,

    condition:
      visitType === "initial"
        ? request.site_condition
        : "light",

    accessComplexity:
      request.access_restrictions
        ? "limited"
        : "standard",

    supplyTier:
      visitType === "initial"
        ? request.site_condition ===
          "heavy"
          ? "heavy"
          : "moderate"
        : "light",

    customSupplyCents: 0,
    specialCostsCents: 0,
    manualAdjustmentCents: 0,

    uncertaintyPercent:
      visitType === "initial"
        ? null
        : 5,
  };

  if (model === "hoa_route") {
    return normalizeCommercialPricingInput(
      {
        ...rawBase,
        model,

        binCount: count,

        personMinutesPerBin: null,

        binsStagedTogether: true,
        collectionZoneCount: 1,

        residentCoordinationRequired:
          false,
      },
      model,
      visitType,
    );
  }

  const centralWorkUnits = {
    dumpsterExteriors:
      request.service_interests.includes(
        "dumpsters",
      )
        ? 1
        : 0,

    trashEnclosures:
      request.service_interests.includes(
        "trash_enclosures",
      )
        ? 1
        : 0,

    concretePads:
      request.service_interests.includes(
        "concrete_pads",
      )
        ? 1
        : 0,

    commercialCarts: 0,
    customPersonMinutes: 0,
  };

  if (
    model === "apartment_hybrid"
  ) {
    return normalizeCommercialPricingInput(
      {
        ...rawBase,
        model,

        centralWorkUnits,

        cartCount:
          request.service_interests.includes(
            "commercial_trash_bins",
          ) ||
          request.service_interests.includes(
            "commercial_recycling_bins",
          )
            ? count
            : 0,

        personMinutesPerCart: null,

        cartsStagedTogether: true,
        collectionZoneCount: 1,

        residentCoordinationRequired:
          false,
      },
      model,
      visitType,
    );
  }

  return normalizeCommercialPricingInput(
    {
      ...rawBase,
      model,

      workUnits: {
        ...centralWorkUnits,

        commercialCarts:
          request.service_interests.includes(
            "commercial_trash_bins",
          ) ||
          request.service_interests.includes(
            "commercial_recycling_bins",
          )
            ? count
            : 0,
      },
    },
    model,
    visitType,
  );
}

function getSavedPricingInput(
  draft: CommercialQuoteRow | null,
  key: EstimateKind,
  model: CommercialPricingModel,
  visitType: CommercialVisitType,
) {
  if (!draft) {
    return null;
  }

  const calculatorInput =
    asRecord(
      draft.calculator_input,
    );

  if (!calculatorInput) {
    return null;
  }

  const savedValue =
    calculatorInput[key];

  if (!savedValue) {
    return null;
  }

  return normalizeCommercialPricingInput(
    savedValue,
    model,
    visitType,
  );
}

function getDefaultIncludedServices(
  request: CommercialQuoteRequestRow,
) {
  return request.service_interests.map(
    (service) =>
      commercialServiceInterestLabels[
        service
      ],
  );
}

function getDefaultScopeSummary(
  request: CommercialQuoteRequestRow,
) {
  const services =
    getDefaultIncludedServices(
      request,
    );

  const serviceText =
    services.length
      ? services.join(", ")
      : "Commercial cleaning services";

  return `${serviceText} for ${request.business_name} at ${request.street_address}, ${request.city}, ${request.state} ${request.zip_code}.`;
}

function getDefaultValidUntil() {
  const date = new Date();

  date.setDate(
    date.getDate() + 30,
  );

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function inputNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function dollarsToCents(
  value: string,
  allowNegative: boolean,
) {
  const parsed = Number(
    value
      .replaceAll(",", "")
      .replaceAll("$", ""),
  );

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const cents =
    Math.round(parsed * 100);

  return allowNegative
    ? cents
    : Math.max(0, cents);
}

function getFinalPriceCents(
  override: string,
  suggestedPriceCents: number,
) {
  if (!override.trim()) {
    return suggestedPriceCents;
  }

  return Math.max(
    0,
    dollarsToCents(
      override,
      false,
    ),
  );
}

function centsForInput(
  cents: number,
) {
  return (
    Number(cents) / 100
  ).toFixed(2);
}

function formatCurrency(
  cents: number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    },
  ).format(cents / 100);
}

function formatDuration(
  minutes: number,
) {
  const roundedMinutes =
    Math.max(
      0,
      Math.round(minutes),
    );

  const hours =
    Math.floor(
      roundedMinutes / 60,
    );

  const remainingMinutes =
    roundedMinutes % 60;

  if (!hours) {
    return `${remainingMinutes} min`;
  }

  if (!remainingMinutes) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}
