/*
 * Clean Curb OS
 *
 * Durable operational exception queue for booking-related
 * failures and conditions that require human attention.
 *
 * booking_events remains the permanent lifecycle timeline.
 * booking_exceptions tracks whether an operational problem is
 * still open, acknowledged, assigned, resolved, or dismissed.
 */

create table if not exists public.booking_exceptions (
  id uuid primary key default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  customer_id uuid
    references public.profiles(id)
    on delete set null,

  source_event_id uuid
    references public.booking_events(id)
    on delete set null,

  request_id text,
  source text not null default 'system',
  exception_type text not null,

  severity text not null default 'warning'
    check (
      severity in (
        'info',
        'warning',
        'urgent'
      )
    ),

  status text not null default 'open'
    check (
      status in (
        'open',
        'acknowledged',
        'resolved',
        'dismissed'
      )
    ),

  title text not null,
  message text not null,

  /*
   * One durable record per operational problem.
   * Repeated occurrences update this row rather than filling
   * the dashboard with duplicates.
   */
  dedupe_key text not null,
  occurrence_count integer not null default 1
    check (occurrence_count > 0),

  assigned_to_profile_id uuid
    references public.profiles(id)
    on delete set null,

  acknowledged_at timestamptz,
  acknowledged_by_profile_id uuid
    references public.profiles(id)
    on delete set null,

  resolved_at timestamptz,
  resolved_by_profile_id uuid
    references public.profiles(id)
    on delete set null,

  resolution_note text,

  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists
  booking_exceptions_dedupe_key_idx
on public.booking_exceptions (dedupe_key);

create index if not exists
  booking_exceptions_status_severity_idx
on public.booking_exceptions (
  status,
  severity,
  last_seen_at desc
);

create index if not exists
  booking_exceptions_booking_status_idx
on public.booking_exceptions (
  booking_id,
  status,
  last_seen_at desc
);

create index if not exists
  booking_exceptions_assigned_status_idx
on public.booking_exceptions (
  assigned_to_profile_id,
  status,
  last_seen_at desc
)
where assigned_to_profile_id is not null;

create index if not exists
  booking_exceptions_source_event_idx
on public.booking_exceptions (source_event_id)
where source_event_id is not null;

create or replace function
  public.touch_booking_exception_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists
  booking_exceptions_touch_updated_at
on public.booking_exceptions;

create trigger booking_exceptions_touch_updated_at
before update on public.booking_exceptions
for each row
execute function
  public.touch_booking_exception_updated_at();

alter table public.booking_exceptions
enable row level security;

drop policy if exists
  "Admins read booking exceptions"
on public.booking_exceptions;

create policy
  "Admins read booking exceptions"
on public.booking_exceptions
for select
to authenticated
using (public.is_admin_or_owner());

drop policy if exists
  "Admins update booking exceptions"
on public.booking_exceptions;

create policy
  "Admins update booking exceptions"
on public.booking_exceptions
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

revoke all
on public.booking_exceptions
from anon;

grant select, update
on public.booking_exceptions
to authenticated;

grant select, insert, update, delete
on public.booking_exceptions
to service_role;

comment on table public.booking_exceptions is
  'Durable Clean Curb OS exception queue for booking-related problems requiring human attention.';

comment on column
  public.booking_exceptions.dedupe_key is
  'Stable identity for one operational problem so repeated failures update rather than duplicate the exception.';

comment on column
  public.booking_exceptions.occurrence_count is
  'Number of times the same operational exception has occurred.';
