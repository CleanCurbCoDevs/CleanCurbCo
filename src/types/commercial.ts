export const commercialPreferredContactMethods = [
  "email",
  "phone",
  "text",
] as const;

export type CommercialPreferredContactMethod =
  (typeof commercialPreferredContactMethods)[number];

export const commercialPreferredContactMethodLabels: Record<
  CommercialPreferredContactMethod,
  string
> = {
  email: "Email",
  phone: "Phone call",
  text: "Text message",
};

export const commercialPropertyTypes = [
  "hoa_community",
  "apartment_community",
  "property_management",
  "restaurant_food_service",
  "office",
  "retail_small_business",
  "municipal_public",
  "other",
] as const;

export type CommercialPropertyType =
  (typeof commercialPropertyTypes)[number];

export const commercialPropertyTypeLabels: Record<
  CommercialPropertyType,
  string
> = {
  hoa_community: "HOA or community",
  apartment_community: "Apartment community",
  property_management: "Property management company",
  restaurant_food_service: "Restaurant or food service",
  office: "Office",
  retail_small_business: "Retail or small business",
  municipal_public: "Municipal or public property",
  other: "Other",
};

export const commercialServiceInterests = [
  "commercial_trash_bins",
  "commercial_recycling_bins",
  "dumpsters",
  "trash_enclosures",
  "concrete_pads",
  "hoa_community_routes",
  "other_exterior_cleaning",
] as const;

export type CommercialServiceInterest =
  (typeof commercialServiceInterests)[number];

export const commercialServiceInterestLabels: Record<
  CommercialServiceInterest,
  string
> = {
  commercial_trash_bins: "Commercial trash bins",
  commercial_recycling_bins: "Commercial recycling bins",
  dumpsters: "Dumpsters",
  trash_enclosures: "Trash enclosures",
  concrete_pads: "Concrete pads",
  hoa_community_routes: "HOA or community bin routes",
  other_exterior_cleaning: "Other exterior cleaning",
};

export const commercialSiteConditions = [
  "light",
  "moderate",
  "heavy",
  "not_sure",
] as const;

export type CommercialSiteCondition =
  (typeof commercialSiteConditions)[number];

export const commercialSiteConditionLabels: Record<
  CommercialSiteCondition,
  string
> = {
  light: "Light buildup",
  moderate: "Moderate grime or odor",
  heavy: "Heavy buildup or recurring mess",
  not_sure: "Not sure",
};

export const commercialWaterAvailabilityValues = [
  "yes",
  "no",
  "not_sure",
] as const;

export type CommercialWaterAvailability =
  (typeof commercialWaterAvailabilityValues)[number];

export const commercialWaterAvailabilityLabels: Record<
  CommercialWaterAvailability,
  string
> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
};

export const commercialServicePlans = [
  "one_time",
  "recurring",
  "not_sure",
] as const;

export type CommercialServicePlan =
  (typeof commercialServicePlans)[number];

export const commercialServicePlanLabels: Record<
  CommercialServicePlan,
  string
> = {
  one_time: "One-time service",
  recurring: "Recurring service",
  not_sure: "Not sure yet",
};

export const commercialDesiredFrequencies = [
  "weekly",
  "every_other_week",
  "monthly",
  "quarterly",
  "seasonal",
  "custom",
  "not_sure",
] as const;

export type CommercialDesiredFrequency =
  (typeof commercialDesiredFrequencies)[number];

export const commercialDesiredFrequencyLabels: Record<
  CommercialDesiredFrequency,
  string
> = {
  weekly: "Weekly",
  every_other_week: "Every other week",
  monthly: "Monthly",
  quarterly: "Quarterly",
  seasonal: "Seasonal",
  custom: "Custom schedule",
  not_sure: "Not sure yet",
};

export const commercialStartTimeframes = [
  "as_soon_as_possible",
  "within_30_days",
  "within_90_days",
  "planning_ahead",
  "not_sure",
] as const;

export type CommercialStartTimeframe =
  (typeof commercialStartTimeframes)[number];

export const commercialStartTimeframeLabels: Record<
  CommercialStartTimeframe,
  string
> = {
  as_soon_as_possible: "As soon as possible",
  within_30_days: "Within 30 days",
  within_90_days: "Within 90 days",
  planning_ahead: "Planning ahead",
  not_sure: "Not sure yet",
};

export type CommercialQuoteSubmission = {
  website: string;
  turnstileToken: string;
  analytics: {
    clientId: string;
    sessionId: string | null;
  } | null;

  contact: {
    businessName: string;
    contactName: string;
    role: string;
    email: string;
    phone: string;
    preferredContactMethod: CommercialPreferredContactMethod;
  };

  property: {
    propertyType: CommercialPropertyType;
    propertyTypeOther: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    locationCount: number;
    accessRestrictions: string;
  };

  service: {
    interests: CommercialServiceInterest[];
    serviceOther: string;
    containerCount: number | null;
    containerSizes: string;
    siteCondition: CommercialSiteCondition;
    waterSpigotAvailable: CommercialWaterAvailability;
    servicePlan: CommercialServicePlan;
    desiredFrequency: CommercialDesiredFrequency;
    collectionSchedule: string;
  };

  details: {
    startTimeframe: CommercialStartTimeframe;
    description: string;
    additionalNotes: string;
    acknowledgment: boolean;
  };
};
