alter table public.notification_events
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists provider_error_code text,
  add column if not exists delivered_at timestamptz;

create unique index if not exists notification_events_provider_message_id_idx
  on public.notification_events(provider_message_id)
  where provider_message_id is not null;

create table if not exists public.sms_contact_preferences (
  normalized_phone text primary key,
  status text not null default 'opted_in'
    check (status in ('opted_in', 'opted_out')),
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  source text,
  last_inbound_message_sid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sms_contact_preferences_updated_at
  on public.sms_contact_preferences;

create trigger set_sms_contact_preferences_updated_at
before update on public.sms_contact_preferences
for each row execute function public.set_updated_at();

alter table public.sms_contact_preferences enable row level security;

drop policy if exists "Admins manage SMS contact preferences"
  on public.sms_contact_preferences;

create policy "Admins manage SMS contact preferences"
on public.sms_contact_preferences
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());
