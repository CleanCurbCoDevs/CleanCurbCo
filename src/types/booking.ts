export type BookingStatus =
  | "new"
  | "confirmed"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "paid"
  | "needs_follow_up"
  | "cancelled";

export type ServiceFrequency =
  | "one_time"
  | "monthly"
  | "every_other_month"
  | "quarterly";

export type SchedulingPreference =
  | "next_available_route_day"
  | "specific_day"
  | "urgent";

export type CollectionDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
  | "varies"
  | "not_sure";

export type PaymentStatus =
  | "not_sent"
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type BookingRequest = {
  id: string;
  createdAt: string;
  status: BookingStatus;

  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    serviceAddress: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode?: string;
    neighborhood?: string;
  };

  service: {
    binCount: number;
    binTypes: string[];
    frequency: ServiceFrequency;
    addOns: string[];
    estimatedPrice: number;
  };

  scheduling: {
    preference: SchedulingPreference;
    collectionDay?: CollectionDay;
    requestedDate?: string;
    confirmedRouteDay?: string;
  };

  instructions: {
    binLocation: string;
    waterSpigotAvailable: "yes" | "no" | "not_sure";
    notes?: string;
  };

  agreements: {
    waterUse: boolean;
    binCondition: boolean;
    wastewater: boolean;
    weatherAccess: boolean;
    photos: boolean;
    payment: boolean;
    launchBilling?: boolean;
  };

  payment: {
    status: PaymentStatus;
    method?: string;
    paymentLink?: string;
    provider?: string;
    reference?: string;
  };

  photos?: {
    before: string[];
    after: string[];
  };

  internalNotes?: string;
};
