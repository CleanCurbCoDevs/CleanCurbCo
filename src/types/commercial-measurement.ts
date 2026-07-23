import type {
  CommercialPropertyType,
  CommercialWaterAvailability,
} from "@/types/commercial";

export const commercialSurfaceTypes = [
  "concrete_pad",
  "enclosure_floor",
  "enclosure_walls",
  "general_exterior",
  "grease_area",
  "other",
] as const;

export type CommercialSurfaceType =
  (typeof commercialSurfaceTypes)[number];

export const commercialSurfaceTypeLabels:
  Record<CommercialSurfaceType, string> = {
    concrete_pad: "Concrete pad or apron",
    enclosure_floor: "Enclosure floor",
    enclosure_walls: "Enclosure walls",
    general_exterior: "General exterior surface",
    grease_area: "Grease or leachate area",
    other: "Other measured surface",
  };

export const commercialMeasurementModes = [
  "dimensions",
  "manual_square_feet",
] as const;

export type CommercialMeasurementMode =
  (typeof commercialMeasurementModes)[number];

export const commercialMeasurementSources = [
  "customer_dimensions",
  "customer_estimate",
  "online_imagery",
  "onsite_measured",
  "verified_walkthrough",
] as const;

export type CommercialMeasurementSource =
  (typeof commercialMeasurementSources)[number];

export const commercialMeasurementSourceLabels:
  Record<CommercialMeasurementSource, string> = {
    customer_dimensions: "Customer-provided dimensions",
    customer_estimate: "Customer square-foot estimate",
    online_imagery: "Estimated from online imagery",
    onsite_measured: "Measured onsite",
    verified_walkthrough: "Verified during walkthrough",
  };

export const commercialMeasurementConfidences = [
  "preliminary",
  "reasonable",
  "field_verified",
] as const;

export type CommercialMeasurementConfidence =
  (typeof commercialMeasurementConfidences)[number];

export const commercialMeasurementConfidenceLabels:
  Record<CommercialMeasurementConfidence, string> = {
    preliminary: "Preliminary",
    reasonable: "Reasonably confirmed",
    field_verified: "Field verified",
  };

export type CommercialSurfaceMeasurement = {
  id: string;
  label: string;

  surfaceType: CommercialSurfaceType;
  quantity: number;

  dimensionMode: CommercialMeasurementMode;

  /**
   * Horizontal surfaces use length × width.
   * Wall surfaces use width × height.
   */
  dimensionAFeet: number;
  dimensionBFeet: number;

  manualSquareFeet: number;

  source: CommercialMeasurementSource;
  confidence: CommercialMeasurementConfidence;
};

export const commercialQuoteAssessmentMethods = [
  "online",
  "onsite",
] as const;

export type CommercialQuoteAssessmentMethod =
  (typeof commercialQuoteAssessmentMethods)[number];

export type CommercialQuoteAssessment = {
  method: CommercialQuoteAssessmentMethod;

  /**
   * Number of Clean Curb people attending the assessment.
   */
  assessorCount: number;

  /**
   * Clock minutes. Travel and onsite time are multiplied
   * by assessorCount. Admin time is not.
   */
  travelMinutes: number;
  onsiteMinutes: number;
  adminMinutes: number;

  roundTripMiles: number;
  otherCostsCents: number;

  notes: string;
};

export type CommercialSiteContext = {
  propertyType: CommercialPropertyType;
  photoCount: number;
  waterAvailability: CommercialWaterAvailability;

  /**
   * True when the requested scope appears to include
   * pads, walls, floors, lanes, or exterior surfaces.
   */
  surfaceWorkExpected: boolean;
};

export type CommercialSurfaceRateMap =
  Record<CommercialSurfaceType, number>;

export type CommercialSurfaceProductivityMap =
  Record<CommercialSurfaceType, number>;
