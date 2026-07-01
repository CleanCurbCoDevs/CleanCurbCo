export type AppRole = "customer" | "admin" | "owner";
export type ServiceFrequency =
  | "one_time"
  | "monthly"
  | "every_other_month"
  | "quarterly";
export type RequestType =
  | "pause_service"
  | "cancel_service"
  | "change_frequency"
  | "update_address"
  | "request_add_on"
  | "billing_question"
  | "general_help";
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
  referral_code: string | null;
  referred_by_profile_id: string | null;
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
  status:
    | "scheduled"
    | "on_the_way"
    | "arrived"
    | "in_progress"
    | "completed"
    | "skipped"
    | "rescheduled"
    | "cancelled";
  before_photo_urls: string[] | null;
  after_photo_urls: string[] | null;
  technician_notes: string | null;
  completed_at: string | null;
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
  requested_frequency: ServiceFrequency | null;
  requested_pause_start: string | null;
  requested_pause_end: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
