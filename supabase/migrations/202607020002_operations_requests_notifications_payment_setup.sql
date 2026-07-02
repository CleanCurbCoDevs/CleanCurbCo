alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'portal_disabled', 'pending_deletion', 'deleted')),
  add column if not exists portal_access_enabled boolean not null default true,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists payment_method_on_file boolean not null default false,
  add column if not exists payment_setup_completed_at timestamptz;

alter table public.bookings
  add column if not exists route_offer_status text not null default 'none'
    check (route_offer_status in ('none', 'offered', 'customer_confirmed', 'customer_declined', 'admin_approved', 'admin_declined')),
  add column if not exists proposed_route_day date,
  add column if not exists route_offer_message text,
  add column if not exists route_offer_sent_at timestamptz,
  add column if not exists route_responded_at timestamptz,
  add column if not exists route_response_note text,
  add column if not exists customer_visible_admin_message text,
  add column if not exists payment_setup_status text not null default 'not_started'
    check (payment_setup_status in ('not_started', 'link_sent', 'pending', 'completed', 'cancelled', 'failed')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_setup_session_id text,
  add column if not exists payment_method_on_file boolean not null default false,
  add column if not exists payment_setup_completed_at timestamptz;

alter table public.customer_requests
  add column if not exists customer_visible_admin_message text,
  add column if not exists reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists requested_services text[] not null default '{}',
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled', 'completed')),
  requested_by_user_id uuid references public.profiles(id) on delete set null,
  requested_by_role text not null default 'customer',
  request_reason text,
  admin_note text,
  customer_visible_admin_message text,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  href text,
  customer_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_request_id uuid references public.customer_requests(id) on delete set null,
  account_deletion_request_id uuid references public.account_deletion_requests(id) on delete set null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profiles_account_status_idx
  on public.profiles (account_status);

create index if not exists profiles_payment_method_on_file_idx
  on public.profiles (payment_method_on_file);

create index if not exists bookings_route_offer_status_idx
  on public.bookings (route_offer_status);

create index if not exists bookings_payment_setup_status_idx
  on public.bookings (payment_setup_status);

create index if not exists account_deletion_requests_customer_idx
  on public.account_deletion_requests (customer_id);

create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status);

create index if not exists account_deletion_requests_created_idx
  on public.account_deletion_requests (created_at desc);

create index if not exists admin_notifications_read_idx
  on public.admin_notifications (read_at, created_at desc);

create index if not exists admin_notifications_customer_idx
  on public.admin_notifications (customer_id);

alter table public.account_deletion_requests enable row level security;
alter table public.admin_notifications enable row level security;

create policy "Customers read own deletion requests"
  on public.account_deletion_requests
  for select
  to authenticated
  using (customer_id = auth.uid() or requested_by_user_id = auth.uid());

create policy "Customers create own deletion requests"
  on public.account_deletion_requests
  for insert
  to authenticated
  with check (requested_by_user_id = auth.uid() and customer_id = auth.uid());

create policy "Admins read deletion requests"
  on public.account_deletion_requests
  for select
  to authenticated
  using (public.is_admin_or_owner());

create policy "Admins update deletion requests"
  on public.account_deletion_requests
  for update
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

create policy "Admins read admin notifications"
  on public.admin_notifications
  for select
  to authenticated
  using (public.is_admin_or_owner());

create policy "Admins update admin notifications"
  on public.admin_notifications
  for update
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

grant select, insert on public.account_deletion_requests to authenticated;
grant select, update on public.admin_notifications to authenticated;
