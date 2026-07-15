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

export type CollectionTimeWindow =
  | "before_6_am"
  | "6_8_am"
  | "8_10_am"
  | "10_am_12_pm"
  | "12_2_pm"
  | "2_4_pm"
  | "4_6_pm"
  | "after_6_pm"
  | "varies"
  | "not_sure";

export type SameDayPreference =
  | "same_day_when_possible"
  | "next_day_preferred"
  | "no_preference";

export type ApprovalStatus =
  | "pending_review"
  | "auto_approved"
  | "manually_approved"
  | "needs_review"
  | "declined_internal";

export type AttentionStatus =
  | "ready"
  | "review"
  | "hold"
  | "do_not_service";

export type PaymentStatus =
  | "not_sent"
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type PaymentPreference =
  | "stripe"
  | "zelle"
  | "venmo_business"
  | "cash_in_person"
  | "manual_other";

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
    collectionTimeWindow?: CollectionTimeWindow;
    sameDayPreference?: SameDayPreference;
    requestedDate?: string;
    suggestedServiceDate?: string;
    earliestSafeServiceTime?: string;
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
    preference?: PaymentPreference;
    dueAtService?: boolean;
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
