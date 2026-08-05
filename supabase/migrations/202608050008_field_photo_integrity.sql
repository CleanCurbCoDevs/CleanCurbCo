-- Field service-photo proof integrity.
--
-- Photo objects are uploaded through short-lived signed URLs, then attached
-- to a service stop through service-role-only transactional RPC functions.
--
-- Once the checklist is submitted or the stop reaches a terminal state,
-- field users may no longer delete proof photos.

alter table public.route_stops
  add column if not exists
    before_photo_exception_reason text,

  add column if not exists
    after_photo_exception_reason text,

  add column if not exists
    photo_exception_recorded_at timestamptz,

  add column if not exists
    photo_exception_recorded_by_user_id uuid
      references public.profiles(id)
      on delete set null;

alter table public.service_photos
  add column if not exists
    content_type text,

  add column if not exists
    file_size bigint,

  add column if not exists
    confirmed_at timestamptz;

update public.service_photos
set confirmed_at = coalesce(
  confirmed_at,
  created_at
);

update public.route_stops
set
  before_photo_exception_reason =
    case
      when
        before_photo_exception_reason is null
        and 'before_photo_exception' = any(
          coalesce(
            issue_flags,
            '{}'::text[]
          )
        )
      then coalesce(
        nullif(
          btrim(
            split_part(
              split_part(
                coalesce(
                  technician_notes,
                  ''
                ),
                '[Photo upload exception]',
                2
              ),
              E'\n',
              1
            )
          ),
          ''
        ),
        'Legacy photo-upload exception.'
      )
      else before_photo_exception_reason
    end,

  after_photo_exception_reason =
    case
      when
        after_photo_exception_reason is null
        and 'after_photo_exception' = any(
          coalesce(
            issue_flags,
            '{}'::text[]
          )
        )
      then coalesce(
        nullif(
          btrim(
            split_part(
              split_part(
                coalesce(
                  technician_notes,
                  ''
                ),
                '[Photo upload exception]',
                2
              ),
              E'\n',
              1
            )
          ),
          ''
        ),
        'Legacy photo-upload exception.'
      )
      else after_photo_exception_reason
    end,

  photo_exception_recorded_at =
    case
      when
        'before_photo_exception' = any(
          coalesce(
            issue_flags,
            '{}'::text[]
          )
        )
        or 'after_photo_exception' = any(
          coalesce(
            issue_flags,
            '{}'::text[]
          )
        )
      then coalesce(
        photo_exception_recorded_at,
        updated_at,
        now()
      )
      else photo_exception_recorded_at
    end;

alter table public.service_photos
  drop constraint if exists
    service_photos_content_type_check,

  drop constraint if exists
    service_photos_file_size_check;

alter table public.service_photos
  add constraint
    service_photos_content_type_check
  check (
    content_type is null
    or content_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    )
  ),

  add constraint
    service_photos_file_size_check
  check (
    file_size is null
    or (
      file_size > 0
      and file_size <=
        20 * 1024 * 1024
    )
  );

-- Remove duplicate attachment rows before enforcing path uniqueness.

with ranked_photos as (
  select
    id,
    row_number() over (
      partition by
        storage_bucket,
        storage_path
      order by
        created_at desc,
        id desc
    ) as duplicate_rank
  from public.service_photos
)
delete from public.service_photos as photo
using ranked_photos as ranked
where photo.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists
  service_photos_storage_object_unique_idx
on public.service_photos (
  storage_bucket,
  storage_path
);

-- Assigned technicians retain assignment-scoped reads.
-- Mutations now happen only through service-role RPC functions.

drop policy if exists
  "Field users manage service photos"
  on public.service_photos;

drop policy if exists
  "Assigned field users create service photos"
  on public.service_photos;

drop policy if exists
  "Assigned field users update service photos"
  on public.service_photos;

drop policy if exists
  "Assigned field users delete service photos"
  on public.service_photos;

-- Keep the insert policy used by signed uploads.
-- Remove direct authenticated overwrite/delete access to proof objects.

drop policy if exists
  "Field users update service photo objects"
  on storage.objects;

drop policy if exists
  "Field users delete service photo objects"
  on storage.objects;

drop policy if exists
  "Assigned field users update service photo objects"
  on storage.objects;

drop policy if exists
  "Assigned field users delete service photo objects"
  on storage.objects;


create or replace function
  public.field_attach_service_photo_atomic(
    p_route_stop_id uuid,
    p_actor_profile_id uuid,
    p_photo_type text,
    p_storage_bucket text,
    p_storage_path text,
    p_content_type text,
    p_file_size bigint
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
  v_existing public.service_photos%rowtype;
  v_photo public.service_photos%rowtype;

  v_confirmed_at timestamptz :=
    now();

  v_required_prefix text;
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
    or nullif(
      btrim(p_storage_path),
      ''
    ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_input';
  end if;

  if p_photo_type not in (
    'before',
    'after',
    'issue',
    'other'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_type';
  end if;

  if p_storage_bucket <>
    'service-photos'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_bucket';
  end if;

  if p_content_type not in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_type';
  end if;

  if p_file_size is null
    or p_file_size <= 0
    or p_file_size >
      20 * 1024 * 1024
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_size';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id =
    p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:missing_relationship';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id =
    v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:visit_missing';
  end if;

  select *
  into v_booking
  from public.bookings
  where id =
    v_stop.booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:booking_missing';
  end if;

  if v_visit.booking_id is distinct from
    v_booking.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:booking_mismatch';
  end if;

  if v_stop.status in (
    'completed',
    'skipped',
    'needs_follow_up',
    'rescheduled',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:proof_locked';
  end if;

  if
    (
      p_photo_type = 'before'
      and v_stop.status not in (
        'arrived',
        'in_progress'
      )
    )
    or (
      p_photo_type = 'after'
      and v_stop.status <>
        'in_progress'
    )
    or (
      p_photo_type in (
        'issue',
        'other'
      )
      and v_stop.status not in (
        'on_the_way',
        'arrived',
        'in_progress'
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_stage';
  end if;

  v_required_prefix =
    v_visit.id::text
    || '/'
    || p_photo_type
    || '/';

  if p_storage_path not like
      v_required_prefix || '%'
    or position(
      '..' in p_storage_path
    ) > 0
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_photo_path';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id =
        p_storage_bucket
      and name =
        p_storage_path
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:photo_object_missing';
  end if;

  select *
  into v_existing
  from public.service_photos
  where storage_bucket =
      p_storage_bucket
    and storage_path =
      p_storage_path
  for update;

  if found then
    if v_existing.route_stop_id is distinct from
        v_stop.id
      or v_existing.service_visit_id is distinct from
        v_visit.id
      or v_existing.photo_type is distinct from
        p_photo_type
    then
      raise exception using
        errcode = 'P0001',
        message =
          'field_proof:photo_relationship_mismatch';
    end if;

    return jsonb_build_object(
      'alreadyAttached', true,
      'photoId', v_existing.id,
      'visitId', v_visit.id,
      'routeStopId', v_stop.id,
      'photoType', v_existing.photo_type
    );
  end if;

  insert into public.service_photos (
    service_visit_id,
    route_stop_id,
    booking_id,
    customer_id,
    photo_type,
    storage_bucket,
    storage_path,
    uploaded_by,
    is_customer_visible,
    content_type,
    file_size,
    confirmed_at
  )
  values (
    v_visit.id,
    v_stop.id,
    v_booking.id,
    v_booking.customer_id,
    p_photo_type,
    p_storage_bucket,
    p_storage_path,
    p_actor_profile_id,
    p_photo_type in (
      'before',
      'after'
    ),
    p_content_type,
    p_file_size,
    v_confirmed_at
  )
  returning *
  into v_photo;

  if p_photo_type = 'before' then
    update public.service_visits
    set before_photo_urls =
      case
        when p_storage_path = any(
          coalesce(
            before_photo_urls,
            '{}'::text[]
          )
        )
        then coalesce(
          before_photo_urls,
          '{}'::text[]
        )
        else array_append(
          coalesce(
            before_photo_urls,
            '{}'::text[]
          ),
          p_storage_path
        )
      end
    where id =
      v_visit.id;

    update public.route_stops
    set
      before_photo_exception_reason =
        null,

      issue_flags =
        array_remove(
          coalesce(
            issue_flags,
            '{}'::text[]
          ),
          'before_photo_exception'
        )

    where id =
      v_stop.id;
  end if;

  if p_photo_type = 'after' then
    update public.service_visits
    set after_photo_urls =
      case
        when p_storage_path = any(
          coalesce(
            after_photo_urls,
            '{}'::text[]
          )
        )
        then coalesce(
          after_photo_urls,
          '{}'::text[]
        )
        else array_append(
          coalesce(
            after_photo_urls,
            '{}'::text[]
          ),
          p_storage_path
        )
      end
    where id =
      v_visit.id;

    update public.route_stops
    set
      after_photo_exception_reason =
        null,

      issue_flags =
        array_remove(
          coalesce(
            issue_flags,
            '{}'::text[]
          ),
          'after_photo_exception'
        )

    where id =
      v_stop.id;
  end if;

  update public.route_stops
  set
    photo_exception_recorded_at =
      case
        when
          before_photo_exception_reason is null
          and after_photo_exception_reason is null
        then null
        else photo_exception_recorded_at
      end,

    photo_exception_recorded_by_user_id =
      case
        when
          before_photo_exception_reason is null
          and after_photo_exception_reason is null
        then null
        else photo_exception_recorded_by_user_id
      end

  where id =
    v_stop.id;

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
    p_photo_type
      || '_photo_uploaded',
    '1 '
      || replace(
        p_photo_type,
        '_',
        ' '
      )
      || ' photo uploaded and confirmed.',
    jsonb_build_object(
      'photoId',
        v_photo.id,
      'storageBucket',
        p_storage_bucket,
      'storagePath',
        p_storage_path,
      'contentType',
        p_content_type,
      'fileSize',
        p_file_size,
      'confirmedAt',
        v_confirmed_at
    )
  );

  return jsonb_build_object(
    'alreadyAttached', false,
    'photoId', v_photo.id,
    'visitId', v_visit.id,
    'routeStopId', v_stop.id,
    'photoType', v_photo.photo_type
  );
end;
$$;


create or replace function
  public.field_delete_service_photo_atomic(
    p_photo_id uuid,
    p_actor_profile_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo public.service_photos%rowtype;
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;

  v_checklist_status text;
begin
  if p_photo_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_input';
  end if;

  select *
  into v_photo
  from public.service_photos
  where id =
    p_photo_id
  for update;

  if not found then
    return jsonb_build_object(
      'alreadyDeleted', true
    );
  end if;

  select *
  into v_stop
  from public.route_stops
  where
    id = v_photo.route_stop_id
    or (
      v_photo.route_stop_id is null
      and service_visit_id =
        v_photo.service_visit_id
    )
  order by
    case
      when id =
        v_photo.route_stop_id
      then 0
      else 1
    end
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:not_assigned';
  end if;

  if v_stop.service_visit_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:visit_missing';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id =
    v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:visit_missing';
  end if;

  if v_photo.route_stop_id is distinct from
      v_stop.id
    or v_photo.service_visit_id is distinct from
      v_visit.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:photo_relationship_mismatch';
  end if;

  select status
  into v_checklist_status
  from public.service_checklists
  where
    route_stop_id =
      v_stop.id
    or service_visit_id =
      v_visit.id
  order by updated_at desc
  limit 1
  for update;

  if v_stop.status in (
      'completed',
      'skipped',
      'needs_follow_up',
      'rescheduled',
      'cancelled'
    )
    or v_checklist_status =
      'submitted'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:proof_locked';
  end if;

  delete from public.service_photos
  where id =
    v_photo.id;

  if v_photo.photo_type = 'before' then
    update public.service_visits
    set before_photo_urls =
      array_remove(
        coalesce(
          before_photo_urls,
          '{}'::text[]
        ),
        v_photo.storage_path
      )
    where id =
      v_visit.id;
  end if;

  if v_photo.photo_type = 'after' then
    update public.service_visits
    set after_photo_urls =
      array_remove(
        coalesce(
          after_photo_urls,
          '{}'::text[]
        ),
        v_photo.storage_path
      )
    where id =
      v_visit.id;
  end if;

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
    v_photo.booking_id,
    v_visit.id,
    v_stop.id,
    'photo_deleted',
    'A service photo was deleted before proof was locked.',
    jsonb_build_object(
      'photoId',
        v_photo.id,
      'photoType',
        v_photo.photo_type,
      'storageBucket',
        v_photo.storage_bucket,
      'storagePath',
        v_photo.storage_path
    )
  );

  return jsonb_build_object(
    'alreadyDeleted', false,
    'photoId', v_photo.id,
    'visitId', v_visit.id,
    'routeStopId', v_stop.id,
    'photoType', v_photo.photo_type,
    'storageBucket', v_photo.storage_bucket,
    'storagePath', v_photo.storage_path
  );
end;
$$;


create or replace function
  public.field_set_photo_exception_atomic(
    p_route_stop_id uuid,
    p_actor_profile_id uuid,
    p_before_exception boolean,
    p_after_exception boolean,
    p_reason text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;
  v_reason text :=
    nullif(
      btrim(p_reason),
      ''
    );

  v_flags text[];
  v_before_count integer := 0;
  v_after_count integer := 0;
  v_recorded_at timestamptz :=
    now();
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:invalid_input';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id =
    p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:not_assigned';
  end if;

  if v_stop.status <>
    'in_progress'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:not_in_progress';
  end if;

  if v_stop.service_visit_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:visit_missing';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id =
    v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:visit_missing';
  end if;

  if (
    coalesce(
      p_before_exception,
      false
    )
    or coalesce(
      p_after_exception,
      false
    )
  )
  and length(
    coalesce(
      v_reason,
      ''
    )
  ) < 8
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:exception_reason_required';
  end if;

  select count(*)::integer
  into v_before_count
  from public.service_photos
  where route_stop_id =
      v_stop.id
    and photo_type =
      'before';

  select count(*)::integer
  into v_after_count
  from public.service_photos
  where route_stop_id =
      v_stop.id
    and photo_type =
      'after';

  if coalesce(
      p_before_exception,
      false
    )
    and v_before_count > 0
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:before_photo_exists';
  end if;

  if coalesce(
      p_after_exception,
      false
    )
    and v_after_count > 0
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_proof:after_photo_exists';
  end if;

  v_flags =
    array_remove(
      array_remove(
        coalesce(
          v_stop.issue_flags,
          '{}'::text[]
        ),
        'before_photo_exception'
      ),
      'after_photo_exception'
    );

  if coalesce(
    p_before_exception,
    false
  ) then
    v_flags =
      array_append(
        v_flags,
        'before_photo_exception'
      );
  end if;

  if coalesce(
    p_after_exception,
    false
  ) then
    v_flags =
      array_append(
        v_flags,
        'after_photo_exception'
      );
  end if;

  update public.route_stops
  set
    issue_flags =
      array(
        select distinct value
        from unnest(
          v_flags
        ) as values_list(value)
      ),

    before_photo_exception_reason =
      case
        when coalesce(
          p_before_exception,
          false
        )
        then left(
          v_reason,
          1200
        )
        else null
      end,

    after_photo_exception_reason =
      case
        when coalesce(
          p_after_exception,
          false
        )
        then left(
          v_reason,
          1200
        )
        else null
      end,

    photo_exception_recorded_at =
      case
        when
          coalesce(
            p_before_exception,
            false
          )
          or coalesce(
            p_after_exception,
            false
          )
        then v_recorded_at
        else null
      end,

    photo_exception_recorded_by_user_id =
      case
        when
          coalesce(
            p_before_exception,
            false
          )
          or coalesce(
            p_after_exception,
            false
          )
        then p_actor_profile_id
        else null
      end

  where id =
    v_stop.id;

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

    case
      when
        coalesce(
          p_before_exception,
          false
        )
        or coalesce(
          p_after_exception,
          false
        )
      then
        'photo_upload_exception_saved'
      else
        'photo_upload_exception_cleared'
    end,

    case
      when
        coalesce(
          p_before_exception,
          false
        )
        or coalesce(
          p_after_exception,
          false
        )
      then
        'A documented photo-upload exception was saved.'
      else
        'The photo-upload exception was cleared.'
    end,

    jsonb_build_object(
      'beforeException',
        coalesce(
          p_before_exception,
          false
        ),
      'afterException',
        coalesce(
          p_after_exception,
          false
        ),
      'reason',
        v_reason,
      'recordedAt',
        v_recorded_at
    )
  );

  return jsonb_build_object(
    'beforeException',
      coalesce(
        p_before_exception,
        false
      ),
    'afterException',
      coalesce(
        p_after_exception,
        false
      ),
    'reason',
      v_reason,
    'recordedAt',
      case
        when
          coalesce(
            p_before_exception,
            false
          )
          or coalesce(
            p_after_exception,
            false
          )
        then v_recorded_at
        else null
      end
  );
end;
$$;


revoke all on function
  public.field_attach_service_photo_atomic(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    bigint
  )
  from public, anon, authenticated;

revoke all on function
  public.field_delete_service_photo_atomic(
    uuid,
    uuid
  )
  from public, anon, authenticated;

revoke all on function
  public.field_set_photo_exception_atomic(
    uuid,
    uuid,
    boolean,
    boolean,
    text
  )
  from public, anon, authenticated;

grant execute on function
  public.field_attach_service_photo_atomic(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    bigint
  )
  to service_role;

grant execute on function
  public.field_delete_service_photo_atomic(
    uuid,
    uuid
  )
  to service_role;

grant execute on function
  public.field_set_photo_exception_atomic(
    uuid,
    uuid,
    boolean,
    boolean,
    text
  )
  to service_role;
