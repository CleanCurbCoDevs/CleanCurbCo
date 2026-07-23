"use client";

import {
  BadgeDollarSign,
  MapPin,
  Plus,
  Ruler,
  Trash2,
} from "lucide-react";

import {
  calculateCommercialAssessmentInternalCost,
  calculateCommercialSurfaceSquareFeet,
  calculateCommercialTotalSquareFeet,
} from "@/lib/commercial-measurements";

import {
  commercialMeasurementConfidenceLabels,
  commercialMeasurementConfidences,
  commercialMeasurementSourceLabels,
  commercialMeasurementSources,
  commercialQuoteAssessmentMethods,
  commercialSurfaceTypeLabels,
  commercialSurfaceTypes,
  type CommercialQuoteAssessment,
  type CommercialSurfaceMeasurement,
} from "@/types/commercial-measurement";

import type {
  CommercialPricingInput,
  CommercialPricingProfileValues,
} from "@/types/commercial-pricing";

type CommercialMeasurementEditorProps = {
  input: CommercialPricingInput;

  pricingProfile:
    CommercialPricingProfileValues;

  onChange: (
    nextInput: CommercialPricingInput,
  ) => void;
};

export function CommercialMeasurementEditor({
  input,
  pricingProfile,
  onChange,
}: CommercialMeasurementEditorProps) {
  const measurements =
    input.surfaceMeasurements;

  const totalSquareFeet =
    calculateCommercialTotalSquareFeet(
      measurements,
    );

  const assessmentCost =
    calculateCommercialAssessmentInternalCost(
      pricingProfile,
      input.quoteAssessment,
    );

  function updateMeasurements(
    nextMeasurements:
      CommercialSurfaceMeasurement[],
  ) {
    onChange({
      ...input,
      surfaceMeasurements:
        nextMeasurements,
    } as CommercialPricingInput);
  }

  function updateAssessment(
    patch:
      Partial<CommercialQuoteAssessment>,
  ) {
    onChange({
      ...input,

      quoteAssessment: {
        ...input.quoteAssessment,
        ...patch,
      },
    } as CommercialPricingInput);
  }

  function addMeasurement() {
    const fallbackId =
      `measurement-${Date.now()}-${measurements.length + 1}`;

    const id =
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto
        ? crypto.randomUUID()
        : fallbackId;

    updateMeasurements([
      ...measurements,

      {
        id,

        label:
          `Area ${measurements.length + 1}`,

        surfaceType:
          "concrete_pad",

        quantity: 1,

        dimensionMode:
          "dimensions",

        dimensionAFeet: 0,
        dimensionBFeet: 0,

        manualSquareFeet: 0,

        source:
          "customer_dimensions",

        confidence:
          "preliminary",
      },
    ]);
  }

  function updateMeasurement(
    id: string,
    patch:
      Partial<CommercialSurfaceMeasurement>,
  ) {
    updateMeasurements(
      measurements.map(
        (measurement) =>
          measurement.id === id
            ? {
                ...measurement,
                ...patch,
              }
            : measurement,
      ),
    );
  }

  function removeMeasurement(
    id: string,
  ) {
    updateMeasurements(
      measurements.filter(
        (measurement) =>
          measurement.id !== id,
      ),
    );
  }

  return (
    <>
      <section className="commercial-measurement-editor">
        <header className="commercial-measurement-heading">
          <div>
            <p className="commercial-builder-subheading">
              Surface measurements
            </p>

            <h4>
              Measure what actually gets
              cleaned.
            </h4>

            <p>
              Add each pad, wall, floor,
              lane, or exterior area.
              Square footage affects both
              expected labor and the
              market-price comparison.
            </p>
          </div>

          <div className="commercial-measurement-total">
            <Ruler
              size={22}
              aria-hidden="true"
            />

            <span>
              <small>
                Total measured area
              </small>

              <strong>
                {formatNumber(
                  totalSquareFeet,
                )}{" "}
                sq. ft.
              </strong>
            </span>
          </div>
        </header>

        {measurements.length ? (
          <div className="commercial-measurement-list">
            {measurements.map(
              (
                measurement,
                index,
              ) => (
                <MeasurementRow
                  index={index}
                  key={measurement.id}
                  measurement={
                    measurement
                  }
                  pricingProfile={
                    pricingProfile
                  }
                  onChange={(patch) =>
                    updateMeasurement(
                      measurement.id,
                      patch,
                    )
                  }
                  onRemove={() =>
                    removeMeasurement(
                      measurement.id,
                    )
                  }
                />
              ),
            )}
          </div>
        ) : (
          <div className="commercial-measurement-empty">
            <Ruler
              size={31}
              aria-hidden="true"
            />

            <div>
              <strong>
                No measured surfaces yet.
              </strong>

              <p>
                Unit-based pricing still
                works, but pads, walls,
                and exterior areas will
                be more accurate after
                dimensions are entered.
              </p>
            </div>
          </div>
        )}

        <button
          className="button button-outline commercial-measurement-add"
          type="button"
          onClick={addMeasurement}
        >
          <Plus
            size={18}
            aria-hidden="true"
          />

          Add Measured Area
        </button>
      </section>

      <section className="commercial-assessment-editor">
        <header className="commercial-measurement-heading">
          <div>
            <p className="commercial-builder-subheading">
              Free quote assessment
            </p>

            <h4>
              Free to them. Accounted for
              by us.
            </h4>

            <p>
              Clean Curb Co. commercial
              quotes are always free,
              whether prepared remotely
              or after an onsite
              walkthrough.
            </p>
          </div>

          <div className="commercial-free-quote-badge">
            <BadgeDollarSign
              size={22}
              aria-hidden="true"
            />

            <span>
              <small>
                Customer quote fee
              </small>

              <strong>$0.00</strong>
            </span>
          </div>
        </header>

        {input.visitType ===
        "recurring" ? (
          <div className="commercial-assessment-recurring-note">
            Quote-preparation and
            walkthrough costs are
            recovered through the initial
            service price—not charged
            again on recurring
            maintenance.
          </div>
        ) : (
          <>
            <div className="commercial-builder-input-grid">
              <label className="commercial-builder-field">
                <span>
                  Assessment method
                </span>

                <select
                  value={
                    input.quoteAssessment
                      .method
                  }
                  onChange={(event) =>
                    updateAssessment({
                      method:
                        event.target
                          .value as CommercialQuoteAssessment["method"],
                    })
                  }
                >
                  {commercialQuoteAssessmentMethods.map(
                    (method) => (
                      <option
                        key={method}
                        value={method}
                      >
                        {method ===
                        "online"
                          ? "Remote / online quote"
                          : "Free onsite assessment"}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {input.quoteAssessment
                .method === "onsite" ? (
                <NumberInput
                  label="Assessors attending"
                  minimum={1}
                  value={
                    input.quoteAssessment
                      .assessorCount
                  }
                  onChange={(value) =>
                    updateAssessment({
                      assessorCount:
                        Math.max(
                          1,
                          value,
                        ),
                    })
                  }
                />
              ) : null}

              {input.quoteAssessment
                .method === "onsite" ? (
                <>
                  <NumberInput
                    label="Round-trip travel minutes"
                    value={
                      input
                        .quoteAssessment
                        .travelMinutes
                    }
                    onChange={(value) =>
                      updateAssessment({
                        travelMinutes:
                          value,
                      })
                    }
                  />

                  <NumberInput
                    label="Onsite assessment minutes"
                    value={
                      input
                        .quoteAssessment
                        .onsiteMinutes
                    }
                    onChange={(value) =>
                      updateAssessment({
                        onsiteMinutes:
                          value,
                      })
                    }
                  />

                  <NumberInput
                    label="Round-trip miles"
                    step={0.1}
                    value={
                      input
                        .quoteAssessment
                        .roundTripMiles
                    }
                    onChange={(value) =>
                      updateAssessment({
                        roundTripMiles:
                          value,
                      })
                    }
                  />
                </>
              ) : null}

              <NumberInput
                label="Quote preparation minutes"
                value={
                  input.quoteAssessment
                    .adminMinutes
                }
                onChange={(value) =>
                  updateAssessment({
                    adminMinutes: value,
                  })
                }
              />

              <MoneyInput
                label="Other assessment costs"
                cents={
                  input.quoteAssessment
                    .otherCostsCents
                }
                onChange={(value) =>
                  updateAssessment({
                    otherCostsCents:
                      value,
                  })
                }
              />
            </div>

            <label className="commercial-builder-field">
              <span>
                Assessment notes
              </span>

              <textarea
                value={
                  input.quoteAssessment
                    .notes
                }
                placeholder="Measurements needed, who is meeting us, gate instructions, drainage questions, online imagery limitations..."
                onChange={(event) =>
                  updateAssessment({
                    notes:
                      event.target.value,
                  })
                }
              />
            </label>

            <div className="commercial-assessment-summary">
              <div>
                <MapPin
                  size={20}
                  aria-hidden="true"
                />

                <span>
                  <small>
                    Internal assessment
                    time
                  </small>

                  <strong>
                    {formatDuration(
                      assessmentCost
                        .totalPersonMinutes,
                    )}
                  </strong>
                </span>
              </div>

              <div>
                <BadgeDollarSign
                  size={20}
                  aria-hidden="true"
                />

                <span>
                  <small>
                    Internal acquisition
                    cost
                  </small>

                  <strong>
                    {formatCurrency(
                      assessmentCost
                        .totalCents,
                    )}
                  </strong>
                </span>
              </div>

              <p>
                This amount is recovered
                inside the suggested
                initial service price.
                The customer’s quote fee
                remains $0.
              </p>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function MeasurementRow({
  measurement,
  index,
  pricingProfile,
  onChange,
  onRemove,
}: {
  measurement:
    CommercialSurfaceMeasurement;

  index: number;

  pricingProfile:
    CommercialPricingProfileValues;

  onChange: (
    patch:
      Partial<CommercialSurfaceMeasurement>,
  ) => void;

  onRemove: () => void;
}) {
  const squareFeet =
    calculateCommercialSurfaceSquareFeet(
      measurement,
    );

  const isWall =
    measurement.surfaceType ===
    "enclosure_walls";

  const rateCents =
    pricingProfile.surfaceRatesCents[
      measurement.surfaceType
    ] ?? 0;

  return (
    <article className="commercial-measurement-card">
      <div className="commercial-measurement-card-header">
        <strong>
          Area {index + 1}
        </strong>

        <button
          aria-label={`Remove ${
            measurement.label ||
            `area ${index + 1}`
          }`}
          className="commercial-measurement-remove"
          type="button"
          onClick={onRemove}
        >
          <Trash2
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="commercial-measurement-grid">
        <label className="commercial-builder-field commercial-measurement-label">
          <span>Area label</span>

          <input
            value={measurement.label}
            onChange={(event) =>
              onChange({
                label:
                  event.target.value,
              })
            }
          />
        </label>

        <label className="commercial-builder-field">
          <span>Surface type</span>

          <select
            value={
              measurement.surfaceType
            }
            onChange={(event) =>
              onChange({
                surfaceType:
                  event.target
                    .value as CommercialSurfaceMeasurement["surfaceType"],
              })
            }
          >
            {commercialSurfaceTypes.map(
              (surfaceType) => (
                <option
                  key={surfaceType}
                  value={surfaceType}
                >
                  {
                    commercialSurfaceTypeLabels[
                      surfaceType
                    ]
                  }
                </option>
              ),
            )}
          </select>
        </label>

        <NumberInput
          label="Quantity"
          minimum={0}
          value={measurement.quantity}
          onChange={(value) =>
            onChange({
              quantity: value,
            })
          }
        />

        <label className="commercial-builder-field">
          <span>Measurement method</span>

          <select
            value={
              measurement.dimensionMode
            }
            onChange={(event) =>
              onChange({
                dimensionMode:
                  event.target
                    .value as CommercialSurfaceMeasurement["dimensionMode"],
              })
            }
          >
            <option value="dimensions">
              Calculate from dimensions
            </option>

            <option value="manual_square_feet">
              Enter total square feet
            </option>
          </select>
        </label>

        {measurement.dimensionMode ===
        "dimensions" ? (
          <>
            <NumberInput
              label={
                isWall
                  ? "Wall width (ft.)"
                  : "Length (ft.)"
              }
              step={0.1}
              value={
                measurement.dimensionAFeet
              }
              onChange={(value) =>
                onChange({
                  dimensionAFeet:
                    value,
                })
              }
            />

            <NumberInput
              label={
                isWall
                  ? "Wall height (ft.)"
                  : "Width (ft.)"
              }
              step={0.1}
              value={
                measurement.dimensionBFeet
              }
              onChange={(value) =>
                onChange({
                  dimensionBFeet:
                    value,
                })
              }
            />
          </>
        ) : (
          <NumberInput
            label="Total square feet"
            step={0.1}
            value={
              measurement.manualSquareFeet
            }
            onChange={(value) =>
              onChange({
                manualSquareFeet:
                  value,
              })
            }
          />
        )}

        <label className="commercial-builder-field">
          <span>Measurement source</span>

          <select
            value={measurement.source}
            onChange={(event) =>
              onChange({
                source:
                  event.target
                    .value as CommercialSurfaceMeasurement["source"],
              })
            }
          >
            {commercialMeasurementSources.map(
              (source) => (
                <option
                  key={source}
                  value={source}
                >
                  {
                    commercialMeasurementSourceLabels[
                      source
                    ]
                  }
                </option>
              ),
            )}
          </select>
        </label>

        <label className="commercial-builder-field">
          <span>Confidence</span>

          <select
            value={
              measurement.confidence
            }
            onChange={(event) =>
              onChange({
                confidence:
                  event.target
                    .value as CommercialSurfaceMeasurement["confidence"],
              })
            }
          >
            {commercialMeasurementConfidences.map(
              (confidence) => (
                <option
                  key={confidence}
                  value={confidence}
                >
                  {
                    commercialMeasurementConfidenceLabels[
                      confidence
                    ]
                  }
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <footer className="commercial-measurement-result">
        <span>
          Calculated area
          <strong>
            {formatNumber(squareFeet)}{" "}
            sq. ft.
          </strong>
        </span>

        <span>
          Base market rate
          <strong>
            {formatCurrency(
              rateCents,
            )}
            /sq. ft.
          </strong>
        </span>
      </footer>
    </article>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  minimum = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  step?: number;
}) {
  return (
    <label className="commercial-builder-field">
      <span>{label}</span>

      <input
        min={minimum}
        step={step}
        type="number"
        value={value}
        onChange={(event) =>
          onChange(
            numberValue(
              event.target.value,
            ),
          )
        }
      />
    </label>
  );
}

function MoneyInput({
  label,
  cents,
  onChange,
}: {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
}) {
  return (
    <label className="commercial-builder-field">
      <span>{label}</span>

      <div className="commercial-money-input">
        <span>$</span>

        <input
          inputMode="decimal"
          value={
            cents
              ? (
                  cents / 100
                ).toFixed(2)
              : ""
          }
          onChange={(event) =>
            onChange(
              Math.max(
                0,
                Math.round(
                  numberValue(
                    event.target.value,
                  ) * 100,
                ),
              ),
            )
          }
        />
      </div>
    </label>
  );
}

function numberValue(
  value: string,
) {
  const parsed = Number(
    value
      .replaceAll(",", "")
      .replaceAll("$", ""),
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatCurrency(
  cents: number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    },
  ).format(cents / 100);
}

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatDuration(
  minutes: number,
) {
  const rounded =
    Math.round(minutes);

  const hours =
    Math.floor(rounded / 60);

  const remaining =
    rounded % 60;

  if (!hours) {
    return `${remaining} min`;
  }

  if (!remaining) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}
