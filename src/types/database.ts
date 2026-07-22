import type {
  ApprovalStatus,
  AttentionStatus,
  CollectionDay,
  CollectionTimeWindow,
  PaymentPreference,
  PaymentVerificationStatus,
  SameDayPreference,
} from "@/types/booking";

import type {
  CommercialDesiredFrequency,
  CommercialPreferredContactMethod,
  CommercialPropertyType,
  CommercialServiceInterest,
  CommercialServicePlan,
  CommercialSiteCondition,
  CommercialStartTimeframe,
  CommercialWaterAvailability,
} from "@/types/commercial";

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
export type AccountStatus =
  | "active"
  | "portal_disabled"
  | "pending_deletion"
  | "deleted";
export type AccountDeletionStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "completed";
export type RouteOfferStatus =
  | "none"
  | "offered"
  | "customer_confirmed"
  | "customer_declined"
  | "admin_approved"
  | "admin_declined";
export type PaymentSetupStatus =
  | "not_started"
  | "link_sent"
  | "pending"
  | "completed"
  | "cancelled"
  | "failed";
export type ReferralStatus =
  | "pending"
  | "qualified"
  | "reward_ready"
  | "reward_sent"
  | "cancelled";

export type RouteDayStatus = "planned" | "active" | "completed" | "cancelled";
export type OptimoRouteSyncStatus =
  | "not_synced"
  | "syncing"
  | "synced"
  | "sync_failed"
  | "planning_pending"
  | "planning_failed"
  | "scheduled"
  | "unscheduled"
  | "imported";
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
  | "vehicle_issue"
  | "access_issue"
  | "safety_concern"
  | "customer_issue"
  | "fuel_stop"
  | "hydration_rest"
  | "weather_pause"
  | "customer_delay"
  | "scheduled_break"
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
export type ChecklistStatus = "draft" | "submitted" | "voided";
export type ChecklistItemStatus =
  | "pending"
  | "completed"
  | "not_applicable"
  | "issue_found";
export type ChecklistDocumentType = "checklist_pdf" | "correction_note" | "other";

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
  collection_day: CollectionDay | null;
  collection_time_window: CollectionTimeWindow | null;
  same_day_preference: SameDayPreference;
  earliest_safe_service_time: string | null;
  suggested_service_date: string | null;

  service_latitude: number | null;
  service_longitude: number | null;
  service_distance_miles: number | null;
  service_area_checked_at: string | null;

  approval_status: ApprovalStatus;
  attention_status: AttentionStatus;
  manual_review_reason: string | null;
  auto_approval_checked_at: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;

  assigned_route_day_id: string | null;
  assigned_route_stop_id: string | null;
  route_position: number | null;
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
  payment_preference: PaymentPreference;
  payment_due_at_service: boolean;
  payment_verification_status: PaymentVerificationStatus;
  payment_verified_at: string | null;
  payment_verified_by_user_id: string | null;
  in_person_payment_requested_at: string | null;
  checkout_started_at: string | null;
  paid_at: string | null;
  payment_failed_at: string | null;
  payment_failure_code: string | null;
  payment_failure_message: string | null;
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
  route_offer_status: RouteOfferStatus;
  proposed_route_day: string | null;
  route_offer_message: string | null;
  route_offer_sent_at: string | null;
  route_responded_at: string | null;
  route_response_note: string | null;
  customer_visible_admin_message: string | null;
  payment_setup_status: PaymentSetupStatus;
  stripe_customer_id: string | null;
  stripe_setup_session_id: string | null;
  payment_method_on_file: boolean;
  payment_setup_completed_at: string | null;
  route_confirmation_sent_at: string | null;
  route_confirmation_sent_by_user_id: string | null;
  review_request_sent_at: string | null;
  tip_request_sent_at: string | null;
};

export type BookingEventOutcome =
  | "info"
  | "success"
  | "warning"
  | "failure";

export type BookingEventRow = {
  id: string;
  created_at: string;
  booking_id: string;
  customer_id: string | null;
  actor_profile_id: string | null;
  request_id: string | null;
  source: string;
  event_type: string;
  outcome: BookingEventOutcome;
  message: string;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
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
  account_status: AccountStatus;
  portal_access_enabled: boolean;
  deletion_requested_at: string | null;
  deleted_at: string | null;
  payment_method_on_file: boolean;
  payment_setup_completed_at: string | null;
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
  collection_day: CollectionDay | null;
  collection_time_window: CollectionTimeWindow | null;
  same_day_preference: SameDayPreference;
  latitude: number | null;
  longitude: number | null;
  distance_from_hub_miles: number | null;
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
  collection_day: CollectionDay | null;
  route_start_time: string;
  max_stops: number;
  max_bins: number;
  max_service_minutes: number;
  max_added_drive_minutes: number;
  auto_accept_enabled: boolean;
  status: RouteDayStatus;
  assigned_technician_id: string | null;
  notes: string | null;
  optimoroute_planning_id: number | null;
  optimoroute_planning_status: string | null;
  optimoroute_planning_error: string | null;
  optimoroute_last_planned_at: string | null;
  optimoroute_last_imported_at: string | null;
};

export type RouteStopRow = {
  id: string;
  created_at: string;
  updated_at: string;
  route_day_id: string | null;
  booking_id: string | null;
  service_visit_id: string | null;
  stop_order: number;
  earliest_service_time: string | null;
  latest_service_time: string | null;
  route_score: number | null;
  attention_status: AttentionStatus;
  payment_collection_required: boolean;
  payment_collection_status:
    | "not_required"
    | "due"
    | "collected"
    | "customer_will_pay_electronically"
    | "waived"
    | "issue";
  payment_collected_at: string | null;
  payment_collected_by_user_id: string | null;
  payment_collected_amount: number | null;
  payment_collected_method:
    | "cash"
    | "stripe"
    | "venmo_business"
    | "zelle"
    | "other"
    | null;
  payment_collection_notes: string | null;
  tip_collected_amount: number;
  status: FieldStopStatus;
  started_at: string | null;
  completed_at: string | null;
  technician_notes: string | null;
  issue_flags: string[];
  optimoroute_order_no: string | null;
  optimoroute_order_id: string | null;
  optimoroute_sync_status: OptimoRouteSyncStatus;
  optimoroute_sync_error: string | null;
  optimoroute_last_synced_at: string | null;
  optimoroute_planning_status: string | null;
  optimoroute_scheduled_at: string | null;
  optimoroute_stop_sequence: number | null;
  optimoroute_route_id: string | null;
  optimoroute_driver_name: string | null;
  optimoroute_eta: string | null;
  optimoroute_travel_time_seconds: number | null;
  optimoroute_distance_meters: number | null;
};

export type ServiceChecklistRow = {
  id: string;
  created_at: string;
  updated_at: string;
  service_visit_id: string | null;
  route_stop_id: string | null;
  booking_id: string | null;
  customer_id: string | null;
  status: ChecklistStatus;
  services_performed: string[];
  overall_notes: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  correction_notes: string | null;
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

export type ChecklistTemplateRow = {
  id: string;
  created_at: string;
  updated_at: string;
  template_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type ChecklistTemplateItemRow = {
  id: string;
  created_at: string;
  template_id: string | null;
  section_key: string;
  section_name: string;
  item_key: string;
  label: string;
  sort_order: number;
  is_required: boolean;
};

export type ServiceChecklistItemRow = {
  id: string;
  created_at: string;
  updated_at: string;
  checklist_id: string;
  service_visit_id: string | null;
  booking_id: string | null;
  section_key: string;
  section_name: string;
  item_key: string;
  label: string;
  sort_order: number;
  is_required: boolean;
  status: ChecklistItemStatus;
  notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type ServiceChecklistDocumentRow = {
  id: string;
  created_at: string;
  checklist_id: string;
  service_visit_id: string | null;
  booking_id: string | null;
  customer_id: string | null;
  document_type: ChecklistDocumentType;
  storage_bucket: string;
  storage_path: string;
  is_customer_visible: boolean;
  generated_by: string | null;
  generated_at: string;
  notes: string | null;
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
  service_amount: number;
  tip_amount: number;
  total_amount: number;
  tip_source:
    | "checkout"
    | "follow_up"
    | "in_person"
    | "manual"
    | null;
  received_at: string | null;
  recorded_by_user_id: string | null;
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

export type CommercialQuoteRequestStatus =
  | "new"
  | "reviewing"
  | "site_visit_needed"
  | "quoted"
  | "won"
  | "lost"
  | "closed";

export type CommercialQuoteRequestRow = {
  id: string;
  created_at: string;
  updated_at: string;

  status: CommercialQuoteRequestStatus;

  business_name: string;
  contact_name: string;
  contact_role: string | null;
  email: string;
  phone: string;
  preferred_contact_method:
    CommercialPreferredContactMethod;

  property_type: CommercialPropertyType;
  property_type_other: string | null;

  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  location_count: number;
  access_restrictions: string | null;

  service_interests: CommercialServiceInterest[];
  service_other: string | null;
  container_count: number | null;
  container_sizes: string | null;
  site_condition: CommercialSiteCondition;
  water_spigot_available:
    CommercialWaterAvailability;
  service_plan: CommercialServicePlan;
  desired_frequency:
    CommercialDesiredFrequency | null;
  collection_schedule: string | null;

  desired_start_timeframe:
    CommercialStartTimeframe;
  project_description: string;
  additional_notes: string | null;
  acknowledgment_accepted: boolean;

  photo_paths: string[];

  source: string;
  submission_request_id: string | null;
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
  customer_visible_admin_message: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  requested_services: string[];
  metadata_json: Record<string, unknown>;
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

export type AdminAuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string;
  target_id: string;
  customer_id: string | null;
  booking_id: string | null;
  before_summary: Record<string, unknown>;
  after_summary: Record<string, unknown>;
  note: string | null;
  request_id: string | null;
  status: "success" | "failure";
  metadata: Record<string, unknown>;
};

export type AccountDeletionRequestRow = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  status: AccountDeletionStatus;
  requested_by_user_id: string | null;
  requested_by_role: string;
  request_reason: string | null;
  admin_note: string | null;
  customer_visible_admin_message: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  customer_id: string | null;
  booking_id: string | null;
  customer_request_id: string | null;
  account_deletion_request_id: string | null;
  severity: "info" | "warning" | "urgent";
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
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

      booking_events: {
        Row: BookingEventRow;
        Insert: Partial<BookingEventRow> &
          Pick<
            BookingEventRow,
            "booking_id" | "event_type" | "message"
          >;
        Update: Partial<BookingEventRow>;
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
        Update: Partial<{
          email: string;
          expires_at: string;
          token_hash: string;
          used_at: string | null;
        }>;
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

      commercial_quote_requests: {
        Row: CommercialQuoteRequestRow;
        Insert: Partial<CommercialQuoteRequestRow> &
          Pick<
            CommercialQuoteRequestRow,
            | "business_name"
            | "contact_name"
            | "email"
            | "phone"
            | "preferred_contact_method"
            | "property_type"
            | "street_address"
            | "city"
            | "state"
            | "zip_code"
            | "location_count"
            | "service_interests"
            | "site_condition"
            | "water_spigot_available"
            | "service_plan"
            | "desired_start_timeframe"
            | "project_description"
            | "acknowledgment_accepted"
          >;
        Update: Partial<CommercialQuoteRequestRow>;
        Relationships: [];
      };
    
      maintenance_waitlist: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          source: string;
          notified_at: string | null;
          notification_error: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          source?: string;
          notified_at?: string | null;
          notification_error?: string | null;
        };
        Update: Partial<{
          email: string;
          source: string;
          notified_at: string | null;
          notification_error: string | null;
        }>;
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
      admin_audit_logs: {
        Row: AdminAuditLogRow;
        Insert: Partial<AdminAuditLogRow> &
          Pick<AdminAuditLogRow, "action" | "target_type" | "target_id">;
        Update: Partial<AdminAuditLogRow>;
        Relationships: [];
      };
      account_deletion_requests: {
        Row: AccountDeletionRequestRow;
        Insert: Partial<AccountDeletionRequestRow>;
        Update: Partial<AccountDeletionRequestRow>;
        Relationships: [];
      };
      admin_notifications: {
        Row: AdminNotificationRow;
        Insert: Partial<AdminNotificationRow> &
          Pick<AdminNotificationRow, "type" | "title" | "message">;
        Update: Partial<AdminNotificationRow>;
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
      checklist_templates: {
        Row: ChecklistTemplateRow;
        Insert: Partial<ChecklistTemplateRow> &
          Pick<ChecklistTemplateRow, "template_key" | "name">;
        Update: Partial<ChecklistTemplateRow>;
        Relationships: [];
      };
      checklist_template_items: {
        Row: ChecklistTemplateItemRow;
        Insert: Partial<ChecklistTemplateItemRow> &
          Pick<
            ChecklistTemplateItemRow,
            "section_key" | "section_name" | "item_key" | "label"
          >;
        Update: Partial<ChecklistTemplateItemRow>;
        Relationships: [];
      };
      service_checklist_items: {
        Row: ServiceChecklistItemRow;
        Insert: Partial<ServiceChecklistItemRow> &
          Pick<
            ServiceChecklistItemRow,
            "checklist_id" | "section_key" | "section_name" | "item_key" | "label"
          >;
        Update: Partial<ServiceChecklistItemRow>;
        Relationships: [];
      };
      service_checklist_documents: {
        Row: ServiceChecklistDocumentRow;
        Insert: Partial<ServiceChecklistDocumentRow> &
          Pick<ServiceChecklistDocumentRow, "checklist_id" | "storage_path">;
        Update: Partial<ServiceChecklistDocumentRow>;
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
