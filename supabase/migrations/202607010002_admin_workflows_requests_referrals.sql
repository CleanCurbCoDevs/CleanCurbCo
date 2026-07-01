alter table public.profiles
add column if not exists referral_code text unique,
add column if not exists referred_by_profile_id uuid references public.profiles(id) on delete set null,
add column if not exists internal_notes text;

alter table public.bookings
add column if not exists referral_code text,
add column if not exists referred_by_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  request_type text not null
    check (request_type in (
      'pause_service',
      'cancel_service',
      'change_frequency',
      'update_address',
      'request_add_on',
      'billing_question',
      'general_help'
    )),
  status text not null default 'new'
    check (status in (
      'new',
      'reviewing',
      'approved',
      'completed',
      'denied',
      'cancelled'
    )),
  requested_frequency text
    check (requested_frequency in ('one_time', 'monthly', 'every_other_month', 'quarterly')),
  requested_pause_start date,
  requested_pause_end date,
  message text,
  admin_notes text
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  referrer_profile_id uuid references public.profiles(id) on delete set null,
  referred_profile_id uuid references public.profiles(id) on delete set null,
  referred_booking_id uuid references public.bookings(id) on delete set null,
  referral_code text,
  referred_email text,
  status text not null default 'pending'
    check (status in (
      'pending',
      'qualified',
      'reward_ready',
      'reward_sent',
      'cancelled'
    )),
  reward_type text default 'service_credit',
  reward_value integer default 5,
  admin_notes text
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  request_id uuid references public.customer_requests(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_customer_requests_updated_at on public.customer_requests;
create trigger set_customer_requests_updated_at
before update on public.customer_requests
for each row execute function public.set_updated_at();

alter table public.customer_requests enable row level security;
alter table public.referrals enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "Customer requests readable by owner or admin" on public.customer_requests;
create policy "Customer requests readable by owner or admin"
on public.customer_requests for select
to authenticated
using (customer_id = auth.uid() or public.is_admin_or_owner());

drop policy if exists "Customer requests insertable by owner or admin" on public.customer_requests;
create policy "Customer requests insertable by owner or admin"
on public.customer_requests for insert
to authenticated
with check (customer_id = auth.uid() or public.is_admin_or_owner());

drop policy if exists "Customer requests managed by admin" on public.customer_requests;
create policy "Customer requests managed by admin"
on public.customer_requests for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "Referrals readable by related customer or admin" on public.referrals;
create policy "Referrals readable by related customer or admin"
on public.referrals for select
to authenticated
using (
  referrer_profile_id = auth.uid()
  or referred_profile_id = auth.uid()
  or public.is_admin_or_owner()
);

drop policy if exists "Referrals managed by admin" on public.referrals;
create policy "Referrals managed by admin"
on public.referrals for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "Activity readable by related customer or admin" on public.activity_events;
create policy "Activity readable by related customer or admin"
on public.activity_events for select
to authenticated
using (
  customer_id = auth.uid()
  or actor_profile_id = auth.uid()
  or public.is_admin_or_owner()
);

drop policy if exists "Activity insertable by admin" on public.activity_events;
create policy "Activity insertable by admin"
on public.activity_events for insert
to authenticated
with check (public.is_admin_or_owner());

create index if not exists profiles_referral_code_idx on public.profiles(referral_code);
create index if not exists bookings_referral_code_idx on public.bookings(referral_code);
create index if not exists bookings_referred_by_profile_id_idx on public.bookings(referred_by_profile_id);
create index if not exists customer_requests_customer_id_idx on public.customer_requests(customer_id);
create index if not exists customer_requests_status_idx on public.customer_requests(status);
create index if not exists customer_requests_type_idx on public.customer_requests(request_type);
create index if not exists referrals_referrer_profile_id_idx on public.referrals(referrer_profile_id);
create index if not exists referrals_referred_booking_id_idx on public.referrals(referred_booking_id);
create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists activity_events_customer_id_idx on public.activity_events(customer_id);
create index if not exists activity_events_booking_id_idx on public.activity_events(booking_id);
create index if not exists activity_events_request_id_idx on public.activity_events(request_id);

grant select, insert, update on public.customer_requests to authenticated;
grant select, insert, update, delete on public.referrals to authenticated;
grant select, insert on public.activity_events to authenticated;
