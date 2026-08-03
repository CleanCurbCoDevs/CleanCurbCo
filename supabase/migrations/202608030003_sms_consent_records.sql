alter table public.profiles
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_out_at timestamptz,
  add column if not exists sms_opt_in_source text,
  add column if not exists sms_consent_version text,
  add column if not exists sms_consent_text text;

alter table public.bookings
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_source text,
  add column if not exists sms_consent_version text,
  add column if not exists sms_consent_text text;

create index if not exists bookings_sms_opt_in_idx
  on public.bookings (sms_opt_in)
  where sms_opt_in = true;

comment on column public.profiles.sms_opt_in_at is
  'Timestamp of the customer most recently granting SMS consent.';

comment on column public.profiles.sms_opt_out_at is
  'Timestamp of the customer most recently withdrawing SMS consent.';

comment on column public.bookings.sms_consent_text is
  'Exact SMS disclosure accepted with this booking.';
