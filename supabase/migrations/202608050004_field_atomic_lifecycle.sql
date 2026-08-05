-- Atomic field-stop lifecycle operations.
--
-- All lifecycle mutations occur through service-role-only RPC functions.
-- Technicians retain assignment-scoped read access, but cannot bypass
-- lifecycle validation through direct table updates.

create or replace function public.field_actor_can_manage_route(
  target_route_day_id uuid,
  actor_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_route_day_id is not null
    and actor_profile_id is not null
    and (
      exists (
        select 1
        from public.profiles
        where id = actor_profile_id
          and role in ('admin', 'owner')
      )
      or exists (
        select 1
        from public.route_days
        where id = target_route_day_id
          and assigned_technician_id =
            actor_profile_id
      )
    );
$$;

revoke all on function
  public.field_actor_can_manage_route(uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.field_actor_can_manage_route(uuid, uuid)
  to service_role;


create or replace function public.field_transition_stop_atomic(
  p_route_stop_id uuid,
  p_actor_profile_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;
  v_previous_status text;
  v_transition_at timestamptz := now();
  v_completed_at timestamptz;
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
    or nullif(trim(p_next_status), '') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:invalid_input';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id = p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:not_assigned';
  end if;

  if v_stop.service_visit_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:visit_missing';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id = v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:visit_missing';
  end if;

  if v_visit.booking_id is distinct from v_stop.booking_id then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:booking_mismatch';
  end if;

  if v_stop.status is distinct from v_visit.status then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:inconsistent_status';
  end if;

  v_previous_status := v_stop.status;

  if v_previous_status = p_next_status then
    return jsonb_build_object(
      'changed', false,
      'previousStatus', v_previous_status,
      'status', p_next_status,
      'routeStopId', v_stop.id,
      'visitId', v_visit.id,
      'bookingId', v_stop.booking_id
    );
  end if;

  if p_next_status = 'completed' then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:use_completion_action';
  end if;

  if not (
    (
      v_previous_status = 'scheduled'
      and p_next_status in (
        'on_the_way',
        'rescheduled',
        'cancelled'
      )
    )
    or (
      v_previous_status = 'on_the_way'
      and p_next_status in (
        'arrived',
        'needs_follow_up',
        'skipped',
        'rescheduled',
        'cancelled'
      )
    )
    or (
      v_previous_status = 'arrived'
      and p_next_status in (
        'in_progress',
        'needs_follow_up',
        'skipped',
        'rescheduled',
        'cancelled'
      )
    )
    or (
      v_previous_status = 'in_progress'
      and p_next_status in (
        'needs_follow_up',
        'skipped',
        'rescheduled',
        'cancelled'
      )
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_lifecycle:invalid_transition:'
        || coalesce(v_previous_status, 'null')
        || ':'
        || p_next_status;
  end if;

  if p_next_status in (
    'needs_follow_up',
    'skipped',
    'rescheduled',
    'cancelled'
  ) then
    v_completed_at := v_transition_at;
  else
    v_completed_at := null;
  end if;

  update public.route_stops
  set
    status = p_next_status,
    started_at = case
      when p_next_status = 'in_progress'
        then coalesce(started_at, v_transition_at)
      else started_at
    end,
    completed_at = v_completed_at
  where id = v_stop.id;

  update public.service_visits
  set
    status = p_next_status,
    completed_at = v_completed_at
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
    v_stop.booking_id,
    v_visit.id,
    v_stop.id,
    'stop_' || p_next_status,
    'Field stop marked '
      || replace(p_next_status, '_', ' ')
      || '.',
    jsonb_build_object(
      'previousStatus',
      v_previous_status,
      'status',
      p_next_status,
      'transitionAt',
      v_transition_at
    )
  );

  return jsonb_build_object(
    'changed', true,
    'previousStatus', v_previous_status,
    'status', p_next_status,
    'transitionAt', v_transition_at,
    'routeStopId', v_stop.id,
    'visitId', v_visit.id,
    'bookingId', v_stop.booking_id
  );
end;
$$;

revoke all on function
  public.field_transition_stop_atomic(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.field_transition_stop_atomic(uuid, uuid, text)
  to service_role;


create or replace function public.field_complete_stop_atomic(
  p_route_stop_id uuid,
  p_actor_profile_id uuid,
  p_before_exception_allowed boolean default false,
  p_after_exception_allowed boolean default false
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
  v_checklist public.service_checklists%rowtype;
  v_completed_at timestamptz := now();
  v_before_count integer := 0;
  v_after_count integer := 0;
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:invalid_input';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id = p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:missing_relationship';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id = v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:visit_missing';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = v_stop.booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:booking_missing';
  end if;

  if v_visit.booking_id is distinct from v_booking.id then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:booking_mismatch';
  end if;

  if (
    v_stop.status = 'completed'
    and v_visit.status = 'completed'
    and v_booking.status = 'completed'
  ) then
    return jsonb_build_object(
      'alreadyCompleted', true,
      'completedAt',
        coalesce(
          v_stop.completed_at,
          v_visit.completed_at
        ),
      'routeStopId', v_stop.id,
      'visitId', v_visit.id,
      'bookingId', v_booking.id
    );
  end if;

  if (
    v_stop.status = 'completed'
    or v_visit.status = 'completed'
    or v_booking.status = 'completed'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:partial_completion';
  end if;

  if v_stop.status <> 'in_progress'
    or v_visit.status <> 'in_progress'
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:not_in_progress';
  end if;

  if (
    v_booking.payment_due_at_service
    and v_booking.payment_status <> 'paid'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:payment_required';
  end if;

  select *
  into v_checklist
  from public.service_checklists
  where
    route_stop_id = v_stop.id
    or (
      route_stop_id is null
      and service_visit_id = v_visit.id
    )
  order by updated_at desc
  limit 1
  for update;

  if not found
    or v_checklist.status <> 'submitted'
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:checklist_required';
  end if;

  select count(*)::integer
  into v_before_count
  from public.service_photos
  where route_stop_id = v_stop.id
    and photo_type = 'before';

  select count(*)::integer
  into v_after_count
  from public.service_photos
  where route_stop_id = v_stop.id
    and photo_type = 'after';

  if v_before_count < 1
    and not p_before_exception_allowed
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:before_photo_required';
  end if;

  if v_after_count < 1
    and not p_after_exception_allowed
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:after_photo_required';
  end if;

  update public.service_checklists
  set
    before_photos_taken =
      v_before_count > 0,
    after_photos_taken =
      v_after_count > 0,
    service_completed = true,
    completed_by =
      p_actor_profile_id,
    completed_at =
      v_completed_at,
    booking_id =
      v_booking.id,
    customer_id =
      v_booking.customer_id,
    route_stop_id =
      v_stop.id
  where id = v_checklist.id;

  update public.route_stops
  set
    status = 'completed',
    completed_at = v_completed_at
  where id = v_stop.id;

  update public.service_visits
  set
    status = 'completed',
    completed_at = v_completed_at
  where id = v_visit.id;

  update public.bookings
  set status = 'completed'
  where id = v_booking.id;

  if not exists (
    select 1
    from public.service_events
    where route_stop_id = v_stop.id
      and event_type = 'stop_completed'
  ) then
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
      'stop_completed',
      'Field stop completed.',
      jsonb_build_object(
        'beforeCount',
        v_before_count,
        'afterCount',
        v_after_count,
        'beforePhotoException',
        p_before_exception_allowed,
        'afterPhotoException',
        p_after_exception_allowed,
        'completedAt',
        v_completed_at
      )
    );
  end if;

  return jsonb_build_object(
    'alreadyCompleted', false,
    'completedAt', v_completed_at,
    'beforeCount', v_before_count,
    'afterCount', v_after_count,
    'routeStopId', v_stop.id,
    'visitId', v_visit.id,
    'bookingId', v_booking.id
  );
end;
$$;

revoke all on function
  public.field_complete_stop_atomic(
    uuid,
    uuid,
    boolean,
    boolean
  )
  from public, anon, authenticated;

grant execute on function
  public.field_complete_stop_atomic(
    uuid,
    uuid,
    boolean,
    boolean
  )
  to service_role;


create or replace function public.field_prepare_next_stop_atomic(
  p_current_route_stop_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.route_stops%rowtype;
  v_next public.route_stops%rowtype;
  v_next_visit public.service_visits%rowtype;
  v_changed boolean := false;
  v_transition_at timestamptz := now();
begin
  select *
  into v_current
  from public.route_stops
  where id = p_current_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_current.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:not_assigned';
  end if;

  if v_current.status <> 'completed' then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:current_stop_incomplete';
  end if;

  if exists (
    select 1
    from public.route_breaks
    where technician_id =
      p_actor_profile_id
      and ended_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:active_break';
  end if;

  select *
  into v_next
  from public.route_stops
  where route_day_id =
      v_current.route_day_id
    and stop_order >
      v_current.stop_order
    and status not in (
      'completed',
      'skipped',
      'needs_follow_up',
      'rescheduled',
      'cancelled'
    )
  order by stop_order asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'routeComplete', true,
      'changed', false
    );
  end if;

  if v_next.service_visit_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:next_visit_missing';
  end if;

  select *
  into v_next_visit
  from public.service_visits
  where id = v_next.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:next_visit_missing';
  end if;

  if v_next.status is distinct from
    v_next_visit.status
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:inconsistent_status';
  end if;

  if v_next.status = 'scheduled' then
    update public.route_stops
    set status = 'on_the_way'
    where id = v_next.id;

    update public.service_visits
    set status = 'on_the_way'
    where id = v_next_visit.id;

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
      v_next.booking_id,
      v_next_visit.id,
      v_next.id,
      'next_stop_on_the_way',
      'Technician moved to the next stop.',
      jsonb_build_object(
        'previousStopId',
        v_current.id,
        'transitionAt',
        v_transition_at
      )
    );

    v_changed := true;
  elsif v_next.status = 'on_the_way' then
    v_changed := false;
  else
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:next_stop_already_started';
  end if;

  return jsonb_build_object(
    'routeComplete', false,
    'changed', v_changed,
    'nextStopId', v_next.id,
    'nextVisitId', v_next_visit.id,
    'nextBookingId', v_next.booking_id
  );
end;
$$;

revoke all on function
  public.field_prepare_next_stop_atomic(uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.field_prepare_next_stop_atomic(uuid, uuid)
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
  v_next_result jsonb;
begin
  select *
  into v_break
  from public.route_breaks
  where id = p_break_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:break_missing';
  end if;

  if v_break.technician_id <>
    p_actor_profile_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:break_not_owned';
  end if;

  if v_break.ended_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'field_lifecycle:break_already_ended';
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


-- Field mutations are performed by protected server actions through the
-- service role. Remove direct technician update policies so an
-- authenticated browser cannot bypass the lifecycle RPCs.

drop policy if exists
  "Assigned field users update route stops"
  on public.route_stops;

drop policy if exists
  "Assigned field users update service visits"
  on public.service_visits;

drop policy if exists
  "Assigned field users update bookings"
  on public.bookings;
