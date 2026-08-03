/*
 * Clean Curb OS
 *
 * Atomically opens, reopens, or increments a booking
 * exception without creating duplicate dashboard entries.
 */

create or replace function public.open_booking_exception(
  p_booking_id uuid,
  p_customer_id uuid,
  p_source_event_id uuid,
  p_request_id text,
  p_source text,
  p_exception_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_dedupe_key text,
  p_metadata jsonb
)
returns public.booking_exceptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_customer_id uuid;
  v_customer_id uuid;
  v_exception public.booking_exceptions%rowtype;
begin
  if
    p_booking_id is null or
    nullif(trim(p_source), '') is null or
    nullif(trim(p_exception_type), '') is null or
    nullif(trim(p_title), '') is null or
    nullif(trim(p_message), '') is null or
    nullif(trim(p_dedupe_key), '') is null
  then
    raise exception 'INVALID_EXCEPTION_INPUT';
  end if;

  if p_severity not in (
    'info',
    'warning',
    'urgent'
  ) then
    raise exception 'INVALID_EXCEPTION_SEVERITY';
  end if;

  /*
   * Confirm the booking exists and use its linked customer
   * when the caller does not provide one.
   */
  select customer_id
  into v_booking_customer_id
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if
    p_customer_id is not null and
    v_booking_customer_id is not null and
    p_customer_id <> v_booking_customer_id
  then
    raise exception 'EXCEPTION_CUSTOMER_MISMATCH';
  end if;

  v_customer_id := coalesce(
    p_customer_id,
    v_booking_customer_id
  );

  /*
   * A source event may only support an exception for its own
   * booking.
   */
  if
    p_source_event_id is not null and
    not exists (
      select 1
      from public.booking_events
      where id = p_source_event_id
        and booking_id = p_booking_id
    )
  then
    raise exception 'SOURCE_EVENT_BOOKING_MISMATCH';
  end if;

  insert into public.booking_exceptions as existing (
    booking_id,
    customer_id,
    source_event_id,
    request_id,
    source,
    exception_type,
    severity,
    status,
    title,
    message,
    dedupe_key,
    occurrence_count,
    metadata
  )
  values (
    p_booking_id,
    v_customer_id,
    p_source_event_id,
    nullif(trim(p_request_id), ''),
    trim(p_source),
    trim(p_exception_type),
    p_severity,
    'open',
    trim(p_title),
    trim(p_message),
    trim(p_dedupe_key),
    1,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedupe_key)
  do update
  set
    customer_id = coalesce(
      excluded.customer_id,
      existing.customer_id
    ),
    source_event_id = coalesce(
      excluded.source_event_id,
      existing.source_event_id
    ),
    request_id = coalesce(
      excluded.request_id,
      existing.request_id
    ),
    source = excluded.source,
    exception_type = excluded.exception_type,

    /*
     * Do not downgrade an unresolved exception. A previously
     * resolved or dismissed exception starts fresh at the
     * incoming severity when it happens again.
     */
    severity = case
      when existing.status in (
        'resolved',
        'dismissed'
      ) then excluded.severity
      when
        existing.severity = 'urgent' or
        excluded.severity = 'urgent'
      then 'urgent'
      when
        existing.severity = 'warning' or
        excluded.severity = 'warning'
      then 'warning'
      else 'info'
    end,

    status = 'open',
    title = excluded.title,
    message = excluded.message,
    occurrence_count =
      existing.occurrence_count + 1,
    last_seen_at = now(),

    /*
     * A new occurrence requires fresh acknowledgment even
     * when the previous occurrence had been handled.
     */
    acknowledged_at = null,
    acknowledged_by_profile_id = null,
    resolved_at = null,
    resolved_by_profile_id = null,
    resolution_note = null,

    metadata =
      existing.metadata || excluded.metadata

  /*
   * A dedupe key may never silently connect two different
   * bookings.
   */
  where
    existing.booking_id =
      excluded.booking_id

  returning *
  into v_exception;

  if not found then
    raise exception
      'EXCEPTION_DEDUPE_BOOKING_CONFLICT';
  end if;

  return v_exception;
end;
$$;

revoke all
on function public.open_booking_exception(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public;

revoke execute
on function public.open_booking_exception(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from anon, authenticated;

grant execute
on function public.open_booking_exception(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;

comment on function public.open_booking_exception(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Atomically opens, reopens, or increments a deduplicated Clean Curb OS booking exception.';
