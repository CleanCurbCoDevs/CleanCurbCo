export type AppRole = "customer" | "technician" | "admin" | "owner";
export type ServiceFrequency =
  | "one_time"
  | "monthly"
  | "every_other_month"
  | "quarterly";
export type RequestType =
  | "pause_service"
  | "cancel_service"
  | "reschedule_service"
  | "change_frequency"
  | "update_address"
  | "add_service"
  | "drop_service"
  | "request_add_on"
  | "billing_question"
  | "general_help";
export type PolicyWindow =
  | "standard"
  | "within_48_hours"
  | "within_24_hours";
export type CustomerRequestStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "completed"
  | "denied"
  | "cancelled";
export type ReferralStatus =
  | "pending"
  | "qualified"
  | "reward_ready"
  | "reward_sent"
  | "cancelled";

export type RouteDayStatus = "planned" | "active" | "completed" | "cancelled";
export type FieldStopStatus =
  | "scheduled"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "skipped"
  | "needs_follow_up"
  | "rescheduled"
  | "cancelled";
export type PhotoType = "before" | "after" | "issue" | "other";
export type BreakReason =
  | "lunch"
  | "bathroom"
  | "tank_empty"
  | "tank_refill"
  | "equipment_issue"
  | "fuel_stop"
  | "weather_pause"
  | "customer_delay"
  | "other";
export type PaymentStatus =
  | "not_sent"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";
export type CareerApplicationStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "not_now"
  | "hired"
  | "archived";

export type BookingRow = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  service_address_id: string | null;
  status:
    | "new"
    | "confirmed"
    | "scheduled"
    | "in_progress"
    | "completed"
    | "paid"
    | "needs_follow_up"
    | "cancelled";
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string | null;
  neighborhood: string | null;
  bin_count: number;
  bin_types: string[];
  frequency: ServiceFrequency;
  add_ons: string[];
  estimated_price: number;
  scheduling_preference:
    | "next_available_route_day"
    | "specific_day"
    | "urgent";
  requested_date: string | null;
  confirmed_route_day: string | null;
  bin_location: string | null;
  water_spigot_available: "yes" | "no" | "not_sure" | null;
  customer_notes: string | null;
  internal_notes: string | null;
  agreement_water_use: boolean;
  agreement_bin_condition: boolean;
  agreement_wastewater: boolean;
  agreement_weather_access: boolean;
  agreement_photos: boolean;
  agreement_payment: boolean;
  payment_status: "not_sent" | "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;
  payment_link: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  referral_code: string | null;
  referred_by_profile_id: string | null;
  last_customer_change_request_at: string | null;
  cancellation_policy_status:
    | "none"
    | "fee_may_apply"
    | "full_charge_may_apply"
    | null;
};

export type ProfileRow = {
  id: string;
  created_at: string;
  updated_at: string;
  role: AppRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  marketing_opt_in: boolean;
  sms_opt_in: boolean;
  preferred_contact_method: "email" | "phone" | "sms" | null;
  referral_code: string | null;
  referred_by_profile_id: string | null;
  stripe_customer_id: string | null;
  internal_notes: string | null;
};

export type ServiceAddressRow = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  label: string | null;
  street_address: string;
  city: string;
  state: string;
  zip_code: string | null;
  neighborhood: string | null;
  gate_code: string | null;
  notes: string | null;
  is_primary: boolean;
};

export type ServiceVisitRow = {
  id: string;
  created_at: string;
  updated_at: string;
  booking_id: string | null;
  customer_id: string | null;
  route_day: string | null;
  arrival_window_start: string | null;
  arrival_window_end: string | null;
  status: FieldStopStatus;
  before_photo_urls: string[] | null;
  after_photo_urls: string[] | null;
  technician_notes: string | null;
  completed_at: string | null;
};

export type RouteDayRow = {
  id: string;
  created_at: string;
  updated_at: string;
  route_date: string;
  route_name: string | null;
  service_area: string | null;
  status: RouteDayStatus;
  assigned_technician_id: string | null;
  notes: string | null;
};

export type RouteStopRow = {
  id: string;
  created_at: string;
  updated_at: string;
  route_day_id: string | null;
  booking_id: string | null;
  service_visit_id: string | null;
  stop_order: number;
  status: FieldStopStatus;
  started_at: string | null;
  completed_at: string | null;
  technician_notes: string | null;
  issue_flags: string[];
};

export type ServiceChecklistRow = {
  id: string;
  created_at: string;
  updated_at: string;
  service_visit_id: string | null;
  route_stop_id: string | null;
  arrived_at_property: boolean;
  bins_located: boolean;
  before_photos_taken: boolean;
  loose_debris_removed: boolean;
  cleaner_applied: boolean;
  bins_pressure_washed: boolean;
  scrubbed_if_needed: boolean;
  sanitized: boolean;
  deodorized: boolean;
  trash_pad_cleaned: boolean;
  add_ons_completed: boolean;
  after_photos_taken: boolean;
  bins_returned_neatly: boolean;
  work_area_checked: boolean;
  service_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
};

export type ServicePhotoRow = {
  id: string;
  created_at: string;
  service_visit_id: string | null;
  route_stop_id: string | null;
  booking_id: string | null;
  customer_id: string | null;
  photo_type: PhotoType;
  storage_bucket: string;
  storage_path: string;
  uploaded_by: string | null;
  caption: string | null;
  is_customer_visible: boolean;
};

export type RouteBreakRow = {
  id: string;
  created_at: string;
  route_day_id: string | null;
  technician_id: string | null;
  reason: BreakReason;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export type ServiceEventRow = {
  id: string;
  created_at: string;
  actor_profile_id: string | null;
  booking_id: string | null;
  service_visit_id: string | null;
  route_stop_id: string | null;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
};

export type NotificationEventRow = {
  id: string;
  created_at: string;
  recipient_profile_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  channel: "email" | "sms" | "manual";
  template_key: string;
  status: "queued" | "sent" | "failed" | "skipped";
  related_booking_id: string | null;
  related_visit_id: string | null;
  related_route_stop_id: string | null;
  resend_id: string | null;
  error_message: string | null;
};

export type PaymentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  booking_id: string | null;
  service_visit_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  checkout_url: string | null;
  description: string | null;
  payment_type: string | null;
  metadata: Record<string, unknown>;
};

export type CareerApplicationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role_interest: string | null;
  availability: string[];
  has_valid_drivers_license: boolean | null;
  comfortable_outdoors: boolean | null;
  comfortable_lifting: boolean | null;
  experience: string | null;
  message: string | null;
  status: CareerApplicationStatus;
  admin_notes: string | null;
};

export type ContactMessageRow = {
  id: string;
  created_at: string;
  name: string;
  phone: string | null;
  email: string;
  address_or_neighborhood: string | null;
  reason: string;
  message: string;
  status: "new" | "read" | "replied" | "closed";
};

export type CustomerRequestRow = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  booking_id: string | null;
  request_type: RequestType;
  status: CustomerRequestStatus;
  policy_window: PolicyWindow;
  policy_acknowledged: boolean;
  policy_acknowledged_at: string | null;
  policy_acknowledged_name: string | null;
  original_estimated_price: number | null;
  cancellation_fee: number | null;
  full_charge_applies: boolean;
  requested_frequency: ServiceFrequency | null;
  requested_pause_start: string | null;
  requested_pause_end: string | null;
  requested_route_day: string | null;
  requested_add_ons: string[];
  requested_removed_add_ons: string[];
  message: string | null;
  admin_notes: string | null;
};

export type ReferralRow = {
  id: string;
  created_at: string;
  referrer_profile_id: string | null;
  referred_profile_id: string | null;
  referred_booking_id: string | null;
  referral_code: string | null;
  referred_email: string | null;
  status: ReferralStatus;
  reward_type: string | null;
  reward_value: number | null;
  admin_notes: string | null;
};

export type ActivityEventRow = {
  id: string;
  created_at: string;
  actor_profile_id: string | null;
  customer_id: string | null;
  booking_id: string | null;
  request_id: string | null;
  referral_id: string | null;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      service_addresses: {
        Row: ServiceAddressRow;
        Insert: Partial<ServiceAddressRow> & {
          customer_id: string;
          street_address: string;
        };
        Update: Partial<ServiceAddressRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Partial<BookingRow> &
          Pick<
            BookingRow,
            | "first_name"
            | "last_name"
            | "phone"
            | "email"
            | "street_address"
            | "bin_count"
            | "frequency"
            | "estimated_price"
            | "scheduling_preference"
          >;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      booking_claims: {
        Row: {
          id: string;
          created_at: string;
          expires_at: string;
          booking_id: string;
          email: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          booking_id: string;
          email: string;
          token_hash: string;
          expires_at?: string;
        };
        Update: { used_at?: string | null };
        Relationships: [];
      };
      service_visits: {
        Row: ServiceVisitRow;
        Insert: Partial<ServiceVisitRow>;
        Update: Partial<ServiceVisitRow>;
        Relationships: [];
      };
      email_events: {
        Row: {
          id: string;
          created_at: string;
          recipient_email: string;
          subject: string;
          template_key: string;
          related_booking_id: string | null;
          related_visit_id: string | null;
          status: "queued" | "sent" | "failed";
          resend_id: string | null;
          error_message: string | null;
        };
        Insert: {
          recipient_email: string;
          subject: string;
          template_key: string;
          related_booking_id?: string | null;
          related_visit_id?: string | null;
          status?: "queued" | "sent" | "failed";
          resend_id?: string | null;
          error_message?: string | null;
        };
        Update: Partial<{
          status: "queued" | "sent" | "failed";
          resend_id: string | null;
          error_message: string | null;
        }>;
        Relationships: [];
      };
      contact_messages: {
        Row: ContactMessageRow;
        Insert: {
          name: string;
          phone?: string | null;
          email: string;
          address_or_neighborhood?: string | null;
          reason: string;
          message: string;
        };
        Update: Partial<ContactMessageRow>;
        Relationships: [];
      };
      customer_requests: {
        Row: CustomerRequestRow;
        Insert: Partial<CustomerRequestRow> &
          Pick<CustomerRequestRow, "request_type">;
        Update: Partial<CustomerRequestRow>;
        Relationships: [];
      };
      referrals: {
        Row: ReferralRow;
        Insert: Partial<ReferralRow>;
        Update: Partial<ReferralRow>;
        Relationships: [];
      };
      activity_events: {
        Row: ActivityEventRow;
        Insert: Partial<ActivityEventRow> &
          Pick<ActivityEventRow, "event_type" | "message">;
        Update: Partial<ActivityEventRow>;
        Relationships: [];
      };
      route_days: {
        Row: RouteDayRow;
        Insert: Partial<RouteDayRow> & Pick<RouteDayRow, "route_date">;
        Update: Partial<RouteDayRow>;
        Relationships: [];
      };
      route_stops: {
        Row: RouteStopRow;
        Insert: Partial<RouteStopRow>;
        Update: Partial<RouteStopRow>;
        Relationships: [];
      };
      service_checklists: {
        Row: ServiceChecklistRow;
        Insert: Partial<ServiceChecklistRow>;
        Update: Partial<ServiceChecklistRow>;
        Relationships: [];
      };
      service_photos: {
        Row: ServicePhotoRow;
        Insert: Partial<ServicePhotoRow> &
          Pick<ServicePhotoRow, "photo_type" | "storage_path">;
        Update: Partial<ServicePhotoRow>;
        Relationships: [];
      };
      route_breaks: {
        Row: RouteBreakRow;
        Insert: Partial<RouteBreakRow> & Pick<RouteBreakRow, "reason">;
        Update: Partial<RouteBreakRow>;
        Relationships: [];
      };
      service_events: {
        Row: ServiceEventRow;
        Insert: Partial<ServiceEventRow> &
          Pick<ServiceEventRow, "event_type" | "message">;
        Update: Partial<ServiceEventRow>;
        Relationships: [];
      };
      notification_events: {
        Row: NotificationEventRow;
        Insert: Partial<NotificationEventRow> &
          Pick<NotificationEventRow, "channel" | "template_key">;
        Update: Partial<NotificationEventRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Partial<PaymentRow> & Pick<PaymentRow, "amount">;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      career_applications: {
        Row: CareerApplicationRow;
        Insert: Partial<CareerApplicationRow> &
          Pick<CareerApplicationRow, "first_name" | "last_name" | "email">;
        Update: Partial<CareerApplicationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
