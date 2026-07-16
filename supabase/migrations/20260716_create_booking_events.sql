create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  customer_id uuid
    references public.profiles(id)
    on delete set null,

  actor_profile_id uuid
    references public.profiles(id)
    on delete set null,

  request_id text,
  source text not null default 'system',
  event_type text not null,

  outcome text not null default 'info'
    check (
      outcome in (
        'info',
        'success',
        'warning',
        'failure'
      )
    ),

  message text not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists booking_events_booking_created_idx
  on public.booking_events (booking_id, created_at desc);

create index if not exists booking_events_customer_created_idx
  on public.booking_events (customer_id, created_at desc);

create index if not exists booking_events_event_type_idx
  on public.booking_events (event_type);

create index if not exists booking_events_request_id_idx
  on public.booking_events (request_id)
  where request_id is not null;

create unique index if not exists booking_events_idempotency_key_idx
  on public.booking_events (idempotency_key)
  where idempotency_key is not null;

alter table public.booking_events enable row level security;

comment on table public.booking_events is
  'Permanent lifecycle timeline for Clean Curb Co. bookings.';
