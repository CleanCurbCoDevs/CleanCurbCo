-- Finish the atomic field lifecycle conversion.
--
-- 1. Add needs_follow_up to the service-visit status constraint.
-- 2. Reconcile known terminal stop/visit states that may have split under
--    the former unchecked multi-write actions.
-- 3. Make follow-up and reschedule workflows fully transactional.
-- 4. Require a route-linked break to resume the same route.

alter table public.service_visits
  drop constraint if exists service_visits_status_check;

alter table public.service_visits
  add constraint service_visits_status_check
  check (
    status in (
      'scheduled',
      'on_the_way',
      'arrived',
      'in_progress',
      'completed',
      'skipped',
      'needs_follow_up',
      'rescheduled',
      'cancelled'
    )
  );

-- Repair the specific split state the previous follow-up action could
-- create: route stop updated, service visit rejected by its constraint.
update public.service_visits as visit
set
  status = stop.status,
  completed_at = coalesce(
    visit.completed_at,
    stop.completed_at,
    now()
  ),
  technician_notes = coalesce(
    stop.technician_notes,
    visit.technician_notes
  )
from public.route_stops as stop
where stop.service_visit_id = visit.id
  and stop.status in (
    'needs_follow_up',
    'rescheduled'
  )
  and visit.status not in (
    'completed',
    'cancelled'
  )
  and visit.status is distinct from stop.status;

update public.bookings as booking
set
  status = 'needs_follow_up',
  last_customer_change_request_at = coalesce(
    booking.last_customer_change_request_at,
    stop.completed_at,
    now()
  )
from public.route_stops as stop
where stop.booking_id = booking.id
  and stop.status in (
    'needs_follow_up',
    'rescheduled'
  )
  and booking.status not in (
    'completed',
    'cancelled'
  )
  and booking.status is distinct from 'needs_follow_up';


create or replace function public.field_mark_follow_up_atomic(
  p_route_stop_id uuid,
  p_actor_profile_id uuid,
  p_reason text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;
  v_booking public.bookings%rowtype;

  v_reason text :=
    nullif(trim(p_reason), '');

  v_notes text :=
    nullif(trim(p_notes), '');

  v_transition_at timestamptz :=
    now();

  v_follow_up_note text;
  v_next_notes text;
  v_next_flags text[];
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
    or v_reason is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_input';
  end if;

  if v_reason not in (
    'payment_not_confirmed',
    'access_issue',
    'customer_issue',
    'equipment_issue',
    'safety_concern',
    'weather_delay',
    'vehicle_issue',
    'other'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_follow_up_reason';
  end if;

  if v_reason in (
    'access_issue',
    'customer_issue',
    'equipment_issue',
    'safety_concern',
    'weather_delay',
    'vehicle_issue',
    'other'
  )
  and v_notes is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:follow_up_notes_required';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id = p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:missing_relationship';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id = v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:visit_missing';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = v_stop.booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:booking_missing';
  end if;

  if v_visit.booking_id is distinct from
    v_booking.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:booking_mismatch';
  end if;

  if v_stop.status is distinct from
    v_visit.status
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:inconsistent_status';
  end if;

  if v_stop.status = 'needs_follow_up' then
    update public.bookings
    set
      status = 'needs_follow_up',
      last_customer_change_request_at =
        coalesce(
          last_customer_change_request_at,
          v_transition_at
        )
    where id = v_booking.id;

    return jsonb_build_object(
      'changed', false,
      'status', 'needs_follow_up',
      'routeStopId', v_stop.id,
      'visitId', v_visit.id,
      'bookingId', v_booking.id
    );
  end if;

  if v_stop.status not in (
    'on_the_way',
    'arrived',
    'in_progress'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_transition:'
        || coalesce(v_stop.status, 'null')
        || ':needs_follow_up';
  end if;

  v_follow_up_note =
    'Follow-up reason: '
    || initcap(
      replace(v_reason, '_', ' ')
    )
    || '.'
    || case
      when v_notes is null
        then ''
      else ' Notes: ' || v_notes
    end;

  v_next_notes = concat_ws(
    E'\n\n',
    nullif(
      trim(
        coalesce(
          v_stop.technician_notes,
          ''
        )
      ),
      ''
    ),
    v_follow_up_note
  );

  select coalesce(
    array_agg(
      distinct flags.value
    ),
    '{}'::text[]
  )
  into v_next_flags
  from unnest(
    coalesce(
      v_stop.issue_flags,
      '{}'::text[]
    )
    || array[
      'needs_follow_up',
      v_reason
    ]::text[]
  ) as flags(value);

  update public.route_stops
  set
    status = 'needs_follow_up',
    completed_at = v_transition_at,
    technician_notes = v_next_notes,
    issue_flags = v_next_flags
  where id = v_stop.id;

  update public.service_visits
  set
    status = 'needs_follow_up',
    completed_at = v_transition_at,
    technician_notes = v_next_notes
  where id = v_visit.id;

  update public.bookings
  set
    status = 'needs_follow_up',
    last_customer_change_request_at =
      v_transition_at
  where id = v_booking.id;

  insert into public.service_events (
    actor_profile_id,
    booking_id,
    service_visit_id,
    route_stop_id,
    event_type,
    message,
    metadata
  )
  values (
    p_actor_profile_id,
    v_booking.id,
    v_visit.id,
    v_stop.id,
    'stop_follow_up_required',
    'Stop marked for follow-up: '
      || initcap(
        replace(v_reason, '_', ' ')
      )
      || '.',
    jsonb_build_object(
      'reason', v_reason,
      'notes', v_notes,
      'transitionAt', v_transition_at
    )
  );

  insert into public.admin_notifications (
    type,
    title,
    message,
    href,
    customer_id,
    booking_id,
    severity,
    metadata
  )
  values (
    'field_follow_up_required',
    'Field follow-up required',
    trim(
      v_booking.first_name
      || ' '
      || v_booking.last_name
    )
      || ': '
      || initcap(
        replace(v_reason, '_', ' ')
      )
      || '.',
    '/admin/routes',
    v_booking.customer_id,
    v_booking.id,
    case
      when v_reason = 'safety_concern'
        then 'urgent'
      else 'warning'
    end,
    jsonb_build_object(
      'reason', v_reason,
      'notes', v_notes,
      'visitId', v_visit.id,
      'routeStopId', v_stop.id
    )
  );

  return jsonb_build_object(
    'changed', true,
    'status', 'needs_follow_up',
    'transitionAt', v_transition_at,
    'routeStopId', v_stop.id,
    'visitId', v_visit.id,
    'bookingId', v_booking.id
  );
end;
$$;

revoke all on function
  public.field_mark_follow_up_atomic(
    uuid,
    uuid,
    text,
    text
  )
  from public, anon, authenticated;

grant execute on function
  public.field_mark_follow_up_atomic(
    uuid,
    uuid,
    text,
    text
  )
  to service_role;


create or replace function public.field_request_reschedule_atomic(
  p_route_stop_id uuid,
  p_actor_profile_id uuid,
  p_requested_route_day date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;
  v_booking public.bookings%rowtype;

  v_notes text :=
    nullif(trim(p_notes), '');

  v_transition_at timestamptz :=
    now();

  v_request_id uuid;
  v_request_created boolean :=
    false;

  v_reschedule_note text;
  v_next_notes text;
  v_next_flags text[];
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_input';
  end if;

  if p_requested_route_day is null
    and v_notes is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:reschedule_details_required';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id = p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:missing_relationship';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id = v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:visit_missing';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = v_stop.booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:booking_missing';
  end if;

  if v_visit.booking_id is distinct from
    v_booking.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:booking_mismatch';
  end if;

  if v_stop.status is distinct from
    v_visit.status
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:inconsistent_status';
  end if;

  select request.id
  into v_request_id
  from public.customer_requests as request
  where request.booking_id =
      v_booking.id
    and request.request_type =
      'reschedule_service'
    and request.metadata_json
      ->> 'routeStopId' =
      v_stop.id::text
  order by request.created_at desc
  limit 1;

  if v_stop.status <> 'rescheduled'
    and v_stop.status not in (
      'scheduled',
      'on_the_way',
      'arrived',
      'in_progress'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_transition:'
        || coalesce(v_stop.status, 'null')
        || ':rescheduled';
  end if;

  if v_request_id is null then
    insert into public.customer_requests (
      customer_id,
      booking_id,
      request_type,
      status,
      policy_window,
      policy_acknowledged,
      requested_route_day,
      message,
      metadata_json
    )
    values (
      v_booking.customer_id,
      v_booking.id,
      'reschedule_service',
      'new',
      'standard',
      false,
      p_requested_route_day,
      coalesce(
        v_notes,
        'Field tech requested reschedule from stop '
          || v_stop.stop_order
          || '.'
      ),
      jsonb_build_object(
        'source', 'field_app',
        'visitId', v_visit.id,
        'routeStopId', v_stop.id,
        'routeDayId', v_stop.route_day_id
      )
    )
    returning id
    into v_request_id;

    v_request_created = true;
  end if;

  if v_stop.status <> 'rescheduled' then
    v_reschedule_note =
      'Reschedule requested'
      || case
        when p_requested_route_day is null
          then ''
        else
          ' for '
          || p_requested_route_day::text
      end
      || '.'
      || case
        when v_notes is null
          then ''
        else ' Notes: ' || v_notes
      end;

    v_next_notes = concat_ws(
      E'\n\n',
      nullif(
        trim(
          coalesce(
            v_stop.technician_notes,
            ''
          )
        ),
        ''
      ),
      v_reschedule_note
    );

    select coalesce(
      array_agg(
        distinct flags.value
      ),
      '{}'::text[]
    )
    into v_next_flags
    from unnest(
      coalesce(
        v_stop.issue_flags,
        '{}'::text[]
      )
      || array[
        'reschedule_requested'
      ]::text[]
    ) as flags(value);

    update public.route_stops
    set
      status = 'rescheduled',
      completed_at = v_transition_at,
      technician_notes = v_next_notes,
      issue_flags = v_next_flags
    where id = v_stop.id;

    update public.service_visits
    set
      status = 'rescheduled',
      completed_at = v_transition_at,
      technician_notes = v_next_notes
    where id = v_visit.id;

    insert into public.service_events (
      actor_profile_id,
      booking_id,
      service_visit_id,
      route_stop_id,
      event_type,
      message,
      metadata
    )
    values (
      p_actor_profile_id,
      v_booking.id,
      v_visit.id,
      v_stop.id,
      'field_reschedule_requested',
      'Field technician requested reschedule review.',
      jsonb_build_object(
        'requestedRouteDay',
          p_requested_route_day,
        'notes', v_notes,
        'requestId', v_request_id,
        'transitionAt', v_transition_at
      )
    );
  end if;

  update public.bookings
  set
    status = 'needs_follow_up',
    last_customer_change_request_at =
      coalesce(
        last_customer_change_request_at,
        v_transition_at
      )
  where id = v_booking.id;

  insert into public.admin_notifications (
    type,
    title,
    message,
    href,
    customer_id,
    booking_id,
    customer_request_id,
    severity,
    metadata
  )
  select
    'field_reschedule_requested',
    'Field reschedule request',
    trim(
      v_booking.first_name
      || ' '
      || v_booking.last_name
    )
      || ' needs admin reschedule review.',
    '/admin/requests?q='
      || v_request_id::text,
    v_booking.customer_id,
    v_booking.id,
    v_request_id,
    'warning',
    jsonb_build_object(
      'requestedRouteDay',
        p_requested_route_day,
      'visitId', v_visit.id,
      'routeStopId', v_stop.id
    )
  where not exists (
    select 1
    from public.admin_notifications
    where type =
        'field_reschedule_requested'
      and customer_request_id =
        v_request_id
  );

  return jsonb_build_object(
    'changed',
      v_stop.status <> 'rescheduled',
    'requestCreated',
      v_request_created,
    'requestId', v_request_id,
    'status', 'rescheduled',
    'transitionAt', v_transition_at,
    'routeStopId', v_stop.id,
    'visitId', v_visit.id,
    'bookingId', v_booking.id
  );
end;
$$;

revoke all on function
  public.field_request_reschedule_atomic(
    uuid,
    uuid,
    date,
    text
  )
  from public, anon, authenticated;

grant execute on function
  public.field_request_reschedule_atomic(
    uuid,
    uuid,
    date,
    text
  )
  to service_role;


create or replace function public.field_end_break_and_prepare_next_stop_atomic(
  p_break_id uuid,
  p_current_route_stop_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_break public.route_breaks%rowtype;
  v_current public.route_stops%rowtype;
  v_next_result jsonb;
begin
  if p_break_id is null
    or p_current_route_stop_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_input';
  end if;

  select *
  into v_break
  from public.route_breaks
  where id = p_break_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:break_missing';
  end if;

  if v_break.technician_id is distinct from
    p_actor_profile_id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:break_not_owned';
  end if;

  if v_break.ended_at is not null then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:break_already_ended';
  end if;

  select *
  into v_current
  from public.route_stops
  where id = p_current_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:stop_missing';
  end if;

  if v_break.route_day_id is not null
    and v_break.route_day_id is distinct from
      v_current.route_day_id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:break_route_mismatch';
  end if;

  update public.route_breaks
  set ended_at = now()
  where id = v_break.id;

  select public.field_prepare_next_stop_atomic(
    p_current_route_stop_id,
    p_actor_profile_id
  )
  into v_next_result;

  return v_next_result
    || jsonb_build_object(
      'breakEnded', true,
      'breakId', v_break.id
    );
end;
$$;

revoke all on function
  public.field_end_break_and_prepare_next_stop_atomic(
    uuid,
    uuid,
    uuid
  )
  from public, anon, authenticated;

grant execute on function
  public.field_end_break_and_prepare_next_stop_atomic(
    uuid,
    uuid,
    uuid
  )
  to service_role;
