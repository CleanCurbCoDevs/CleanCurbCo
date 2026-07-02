create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  actor_role text,
  target_type text not null,
  target_id text not null,
  customer_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  before_summary jsonb not null default '{}'::jsonb,
  after_summary jsonb not null default '{}'::jsonb,
  note text,
  request_id text,
  status text not null default 'success' check (status in ('success', 'failure')),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_audit_logs enable row level security;

create policy "Admins can read audit logs"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_admin_or_owner());

grant select on public.admin_audit_logs to authenticated;

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_customer_id_idx
  on public.admin_audit_logs (customer_id);

create index if not exists admin_audit_logs_booking_id_idx
  on public.admin_audit_logs (booking_id);

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action);
