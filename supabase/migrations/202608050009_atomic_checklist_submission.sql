-- Atomic checklist submission and immutable PDF archival.
--
-- Checklist item updates and submission reservation happen in one
-- PostgreSQL transaction. PDF generation and storage occur afterward,
-- followed by one atomic finalization transaction.
--
-- Authenticated field users retain assignment-scoped read access.
-- Checklist and archive mutations occur through service-role-only RPCs.

alter table public.service_checklists
  add column if not exists
    submission_generation integer
      not null default 0,

  add column if not exists
    submission_state text
      not null default 'draft',

  add column if not exists
    submission_started_at timestamptz,

  add column if not exists
    submission_finalized_at timestamptz,

  add column if not exists
    submission_error text;

alter table public.service_checklists
  drop constraint if exists
    service_checklists_submission_state_check;

alter table public.service_checklists
  add constraint
    service_checklists_submission_state_check
  check (
    submission_state in (
      'draft',
      'creating',
      'ready',
      'failed'
    )
  );

alter table public.service_checklist_documents
  add column if not exists
    submission_generation integer
      not null default 1;

update public.service_checklists
set
  submission_generation =
    case
      when status = 'submitted'
        or pdf_storage_path is not null
      then greatest(
        submission_generation,
        1
      )
      else submission_generation
    end,

  submission_state =
    case
      when status = 'submitted'
        and pdf_storage_bucket is not null
        and pdf_storage_path is not null
      then 'ready'

      when submission_state = 'creating'
        and submission_started_at <
          now() - interval '15 minutes'
      then 'failed'

      else submission_state
    end,

  submission_started_at =
    case
      when status = 'submitted'
      then coalesce(
        submission_started_at,
        pdf_generated_at,
        submitted_at,
        updated_at,
        created_at
      )
      else submission_started_at
    end,

  submission_finalized_at =
    case
      when status = 'submitted'
        and pdf_storage_path is not null
      then coalesce(
        submission_finalized_at,
        pdf_generated_at,
        submitted_at,
        updated_at,
        created_at
      )
      else submission_finalized_at
    end,

  submission_error =
    case
      when status = 'submitted'
        and pdf_storage_path is not null
      then null

      when submission_state = 'creating'
        and submission_started_at <
          now() - interval '15 minutes'
      then coalesce(
        submission_error,
        'Legacy checklist submission timed out.'
      )

      else submission_error
    end;

-- Create a document row for any legacy submitted checklist that has
-- a saved PDF path but no archive row.

insert into public.service_checklist_documents (
  checklist_id,
  service_visit_id,
  booking_id,
  customer_id,
  document_type,
  storage_bucket,
  storage_path,
  is_customer_visible,
  generated_by,
  generated_at,
  notes,
  submission_generation
)
select
  checklist.id,
  checklist.service_visit_id,
  checklist.booking_id,
  checklist.customer_id,
  'checklist_pdf',
  checklist.pdf_storage_bucket,
  checklist.pdf_storage_path,
  true,
  checklist.submitted_by,
  coalesce(
    checklist.pdf_generated_at,
    checklist.submitted_at,
    checklist.updated_at,
    checklist.created_at
  ),
  'Recovered final service checklist report.',
  greatest(
    checklist.submission_generation,
    1
  )
from public.service_checklists as checklist
where checklist.status = 'submitted'
  and checklist.pdf_storage_bucket is not null
  and checklist.pdf_storage_path is not null
  and not exists (
    select 1
    from public.service_checklist_documents as document
    where document.checklist_id =
        checklist.id
      and document.document_type =
        'checklist_pdf'
  );

-- Retain one final PDF archive row per checklist.

with ranked_documents as (
  select
    document.id,

    row_number() over (
      partition by
        document.checklist_id
      order by
        (
          document.storage_path =
          checklist.pdf_storage_path
        ) desc,
        document.generated_at desc,
        document.created_at desc,
        document.id desc
    ) as duplicate_rank

  from public.service_checklist_documents
    as document

  left join public.service_checklists
    as checklist
    on checklist.id =
      document.checklist_id

  where document.document_type =
    'checklist_pdf'
)
delete from public.service_checklist_documents
  as document
using ranked_documents as ranked
where document.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists
  service_checklist_final_pdf_unique_idx
on public.service_checklist_documents (
  checklist_id
)
where document_type =
  'checklist_pdf';


-- Remove browser-level checklist mutations.
-- The server uses service_role and the RPC functions below.

drop policy if exists
  "Field users manage service checklists"
  on public.service_checklists;

drop policy if exists
  "Assigned field users create service checklists"
  on public.service_checklists;

drop policy if exists
  "Assigned field users update service checklists"
  on public.service_checklists;

drop policy if exists
  "Field users manage service checklist items"
  on public.service_checklist_items;

drop policy if exists
  "Assigned field users create checklist items"
  on public.service_checklist_items;

drop policy if exists
  "Assigned field users update checklist items"
  on public.service_checklist_items;

drop policy if exists
  "Field users manage service checklist documents"
  on public.service_checklist_documents;

drop policy if exists
  "Assigned field users create checklist documents"
  on public.service_checklist_documents;

-- PDF objects are written only through the server-side service-role client.

drop policy if exists
  "Field users insert service document objects"
  on storage.objects;

drop policy if exists
  "Field users update service document objects"
  on storage.objects;

drop policy if exists
  "Field users delete service document objects"
  on storage.objects;

drop policy if exists
  "Assigned field users insert service document objects"
  on storage.objects;

drop policy if exists
  "Assigned field users update service document objects"
  on storage.objects;

drop policy if exists
  "Assigned field users delete service document objects"
  on storage.objects;


create or replace function
  public.field_save_checklist_work_atomic(
    p_route_stop_id uuid,
    p_actor_profile_id uuid,
    p_items jsonb,
    p_overall_notes text,
    p_prepare_submission boolean
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

  v_input_count integer := 0;
  v_distinct_count integer := 0;
  v_expected_count integer := 0;
  v_unresolved_count integer := 0;

  v_generation integer := 0;
  v_prepared_at timestamptz :=
    now();

  v_overall_notes text :=
    nullif(
      btrim(
        coalesce(
          p_overall_notes,
          ''
        )
      ),
      ''
    );
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_input';
  end if;

  if length(
    coalesce(
      v_overall_notes,
      ''
    )
  ) > 3000
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:notes_too_long';
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
        'checklist_submission:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:missing_relationship';
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
        'checklist_submission:visit_missing';
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
        'checklist_submission:booking_missing';
  end if;

  if v_visit.booking_id is distinct from
    v_booking.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:booking_mismatch';
  end if;

  select *
  into v_checklist
  from public.service_checklists
  where
    route_stop_id =
      v_stop.id
    or (
      route_stop_id is null
      and service_visit_id =
        v_visit.id
    )
  order by
    updated_at desc
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:checklist_missing';
  end if;

  if v_checklist.service_visit_id
      is distinct from v_visit.id
    or (
      v_checklist.route_stop_id
        is not null
      and v_checklist.route_stop_id
        is distinct from v_stop.id
    )
    or (
      v_checklist.booking_id
        is not null
      and v_checklist.booking_id
        is distinct from v_booking.id
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:relationship_mismatch';
  end if;

  if v_checklist.status =
    'submitted'
  then
    return jsonb_build_object(
      'checklistId',
        v_checklist.id,
      'visitId',
        v_visit.id,
      'routeStopId',
        v_stop.id,
      'bookingId',
        v_booking.id,
      'customerId',
        v_booking.customer_id,
      'generation',
        v_checklist.submission_generation,
      'unresolvedCount',
        0,
      'inProgress',
        false,
      'alreadySubmitted',
        true,
      'storageBucket',
        v_checklist.pdf_storage_bucket,
      'storagePath',
        v_checklist.pdf_storage_path
    );
  end if;

  if v_checklist.submission_state =
      'creating'
    and v_checklist.submission_started_at >
      now() - interval '2 minutes'
  then
    return jsonb_build_object(
      'checklistId',
        v_checklist.id,
      'visitId',
        v_visit.id,
      'routeStopId',
        v_stop.id,
      'bookingId',
        v_booking.id,
      'customerId',
        v_booking.customer_id,
      'generation',
        v_checklist.submission_generation,
      'unresolvedCount',
        0,
      'inProgress',
        true,
      'alreadySubmitted',
        false
    );
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
        'checklist_submission:proof_locked';
  end if;

  if coalesce(
      p_prepare_submission,
      false
    )
    and v_stop.status <>
      'in_progress'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:not_in_progress';
  end if;

  if not coalesce(
      p_prepare_submission,
      false
    )
    and v_stop.status not in (
      'arrived',
      'in_progress'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_stage';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      p_items
    ) as submitted(value)
    where jsonb_typeof(
        submitted.value
      ) <> 'object'
      or coalesce(
        submitted.value ->> 'id',
        ''
      ) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(
        submitted.value ->> 'status',
        ''
      ) not in (
        'pending',
        'completed',
        'not_applicable',
        'issue_found'
      )
      or length(
        coalesce(
          submitted.value ->> 'notes',
          ''
        )
      ) > 1500
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_items';
  end if;

  select
    count(*)::integer,
    count(
      distinct
      submitted.value ->> 'id'
    )::integer
  into
    v_input_count,
    v_distinct_count
  from jsonb_array_elements(
    p_items
  ) as submitted(value);

  select count(*)::integer
  into v_expected_count
  from public.service_checklist_items
  where checklist_id =
    v_checklist.id;

  if v_input_count <>
      v_expected_count
    or v_distinct_count <>
      v_input_count
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:stale_items';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      p_items
    ) as submitted(value)

    left join public.service_checklist_items
      as item
      on item.id =
        (
          submitted.value ->> 'id'
        )::uuid
      and item.checklist_id =
        v_checklist.id

    where item.id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_items';
  end if;

  with submitted_items as (
    select
      (
        submitted.value ->> 'id'
      )::uuid as id,

      submitted.value ->>
        'status' as status,

      nullif(
        btrim(
          submitted.value ->>
            'notes'
        ),
        ''
      ) as notes

    from jsonb_array_elements(
      p_items
    ) as submitted(value)
  )
  update public.service_checklist_items
    as item
  set
    status =
      submitted.status,

    notes =
      submitted.notes,

    resolved_at =
      case
        when submitted.status =
          'pending'
        then null
        else v_prepared_at
      end,

    resolved_by =
      case
        when submitted.status =
          'pending'
        then null
        else p_actor_profile_id
      end

  from submitted_items as submitted
  where item.id =
      submitted.id
    and item.checklist_id =
      v_checklist.id;

  update public.service_checklists
  set
    overall_notes =
      v_overall_notes,

    booking_id =
      v_booking.id,

    customer_id =
      v_booking.customer_id,

    route_stop_id =
      v_stop.id,

    submission_state =
      'draft',

    submission_error =
      null

  where id =
    v_checklist.id;

  if not coalesce(
    p_prepare_submission,
    false
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
      'service_checklist_saved',
      'Service checklist draft saved.',
      jsonb_build_object(
        'checklistId',
          v_checklist.id,
        'savedAt',
          v_prepared_at
      )
    );

    return jsonb_build_object(
      'checklistId',
        v_checklist.id,
      'visitId',
        v_visit.id,
      'routeStopId',
        v_stop.id,
      'bookingId',
        v_booking.id,
      'customerId',
        v_booking.customer_id,
      'generation',
        v_checklist.submission_generation,
      'unresolvedCount',
        0,
      'inProgress',
        false,
      'alreadySubmitted',
        false,
      'preparedAt',
        v_prepared_at
    );
  end if;

  select count(*)::integer
  into v_unresolved_count
  from public.service_checklist_items
  where checklist_id =
      v_checklist.id
    and is_required
    and status =
      'pending';

  if v_unresolved_count > 0 then
    return jsonb_build_object(
      'checklistId',
        v_checklist.id,
      'visitId',
        v_visit.id,
      'routeStopId',
        v_stop.id,
      'bookingId',
        v_booking.id,
      'customerId',
        v_booking.customer_id,
      'generation',
        v_checklist.submission_generation,
      'unresolvedCount',
        v_unresolved_count,
      'inProgress',
        false,
      'alreadySubmitted',
        false,
      'preparedAt',
        v_prepared_at
    );
  end if;

  v_generation =
    greatest(
      v_checklist.submission_generation,
      0
    ) + 1;

  update public.service_checklists
  set
    submission_generation =
      v_generation,

    submission_state =
      'creating',

    submission_started_at =
      v_prepared_at,

    submission_finalized_at =
      null,

    submission_error =
      null

  where id =
    v_checklist.id;

  return jsonb_build_object(
    'checklistId',
      v_checklist.id,
    'visitId',
      v_visit.id,
    'routeStopId',
      v_stop.id,
    'bookingId',
      v_booking.id,
    'customerId',
      v_booking.customer_id,
    'generation',
      v_generation,
    'unresolvedCount',
      0,
    'inProgress',
      false,
    'alreadySubmitted',
      false,
    'preparedAt',
      v_prepared_at
  );
end;
$$;


create or replace function
  public.field_finalize_checklist_submission_atomic(
    p_checklist_id uuid,
    p_actor_profile_id uuid,
    p_generation integer,
    p_storage_bucket text,
    p_storage_path text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist public.service_checklists%rowtype;
  v_stop public.route_stops%rowtype;

  v_submitted_at timestamptz :=
    now();

  v_expected_path text;
begin
  if p_checklist_id is null
    or p_actor_profile_id is null
    or p_generation is null
    or p_generation < 1
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_input';
  end if;

  select *
  into v_checklist
  from public.service_checklists
  where id =
    p_checklist_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:checklist_missing';
  end if;

  select *
  into v_stop
  from public.route_stops
  where
    id =
      v_checklist.route_stop_id
    or (
      v_checklist.route_stop_id
        is null
      and service_visit_id =
        v_checklist.service_visit_id
    )
  order by
    case
      when id =
        v_checklist.route_stop_id
      then 0
      else 1
    end
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:not_assigned';
  end if;

  if v_checklist.status =
      'submitted'
    and v_checklist.submission_generation =
      p_generation
    and v_checklist.pdf_storage_bucket =
      p_storage_bucket
    and v_checklist.pdf_storage_path =
      p_storage_path
  then
    return jsonb_build_object(
      'alreadyFinalized',
        true,
      'checklistId',
        v_checklist.id,
      'submittedAt',
        v_checklist.submitted_at,
      'storageBucket',
        v_checklist.pdf_storage_bucket,
      'storagePath',
        v_checklist.pdf_storage_path
    );
  end if;

  if v_checklist.status =
    'submitted'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:proof_locked';
  end if;

  if v_checklist.submission_generation <>
      p_generation
    or v_checklist.submission_state <>
      'creating'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:stale_generation';
  end if;

  if p_storage_bucket <>
    'service-documents'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_archive';
  end if;

  v_expected_path =
    'checklists/'
    || v_checklist.service_visit_id::text
    || '/'
    || v_checklist.id::text
    || '-'
    || p_generation::text
    || '.pdf';

  if p_storage_path <>
    v_expected_path
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:invalid_archive';
  end if;

  if exists (
    select 1
    from public.service_checklist_items
    where checklist_id =
        v_checklist.id
      and is_required
      and status =
        'pending'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:unresolved';
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
        'checklist_submission:archive_missing';
  end if;

  update public.service_checklists
  set
    status =
      'submitted',

    submitted_at =
      v_submitted_at,

    submitted_by =
      p_actor_profile_id,

    pdf_storage_bucket =
      p_storage_bucket,

    pdf_storage_path =
      p_storage_path,

    pdf_generated_at =
      v_submitted_at,

    submission_state =
      'ready',

    submission_finalized_at =
      v_submitted_at,

    submission_error =
      null

  where id =
    v_checklist.id;

  insert into public.service_checklist_documents (
    checklist_id,
    service_visit_id,
    booking_id,
    customer_id,
    document_type,
    storage_bucket,
    storage_path,
    is_customer_visible,
    generated_by,
    generated_at,
    notes,
    submission_generation
  )
  values (
    v_checklist.id,
    v_checklist.service_visit_id,
    v_checklist.booking_id,
    v_checklist.customer_id,
    'checklist_pdf',
    p_storage_bucket,
    p_storage_path,
    true,
    p_actor_profile_id,
    v_submitted_at,
    'Final service checklist report.',
    p_generation
  )
  on conflict (
    checklist_id
  )
  where document_type =
    'checklist_pdf'
  do update
  set
    service_visit_id =
      excluded.service_visit_id,

    booking_id =
      excluded.booking_id,

    customer_id =
      excluded.customer_id,

    storage_bucket =
      excluded.storage_bucket,

    storage_path =
      excluded.storage_path,

    is_customer_visible =
      true,

    generated_by =
      excluded.generated_by,

    generated_at =
      excluded.generated_at,

    notes =
      excluded.notes,

    submission_generation =
      excluded.submission_generation;

  if not exists (
    select 1
    from public.service_events
    where route_stop_id =
        v_stop.id
      and event_type =
        'service_checklist_submitted'
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
      v_checklist.booking_id,
      v_checklist.service_visit_id,
      v_stop.id,
      'service_checklist_submitted',
      'Service checklist submitted and PDF archived.',
      jsonb_build_object(
        'checklistId',
          v_checklist.id,
        'submissionGeneration',
          p_generation,
        'storageBucket',
          p_storage_bucket,
        'storagePath',
          p_storage_path,
        'submittedAt',
          v_submitted_at
      )
    );
  end if;

  return jsonb_build_object(
    'alreadyFinalized',
      false,
    'checklistId',
      v_checklist.id,
    'submittedAt',
      v_submitted_at,
    'storageBucket',
      p_storage_bucket,
    'storagePath',
      p_storage_path
  );
end;
$$;


create or replace function
  public.field_fail_checklist_submission_atomic(
    p_checklist_id uuid,
    p_actor_profile_id uuid,
    p_generation integer,
    p_error text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist public.service_checklists%rowtype;
  v_stop public.route_stops%rowtype;
begin
  select *
  into v_checklist
  from public.service_checklists
  where id =
    p_checklist_id
  for update;

  if not found then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'missing'
    );
  end if;

  select *
  into v_stop
  from public.route_stops
  where
    id =
      v_checklist.route_stop_id
    or (
      v_checklist.route_stop_id
        is null
      and service_visit_id =
        v_checklist.service_visit_id
    )
  order by
    case
      when id =
        v_checklist.route_stop_id
      then 0
      else 1
    end
  limit 1
  for update;

  if not found
    or not public.field_actor_can_manage_route(
      v_stop.route_day_id,
      p_actor_profile_id
    )
  then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'not_authorized'
    );
  end if;

  if v_checklist.status =
      'submitted'
    or v_checklist.submission_generation <>
      p_generation
  then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'stale_or_finalized'
    );
  end if;

  update public.service_checklists
  set
    submission_state =
      'failed',

    submission_error =
      left(
        coalesce(
          p_error,
          'Checklist PDF generation or archival failed.'
        ),
        1500
      )

  where id =
    v_checklist.id;

  return jsonb_build_object(
    'changed',
      true,
    'checklistId',
      v_checklist.id
  );
end;
$$;


-- Submitted checklist items are immutable.

create or replace function
  public.protect_submitted_checklist_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist_id uuid;
begin
  v_checklist_id =
    case
      when tg_op = 'DELETE'
      then old.checklist_id
      else new.checklist_id
    end;

  if exists (
    select 1
    from public.service_checklists
    where id =
        v_checklist_id
      and status =
        'submitted'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:proof_locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists
  protect_submitted_checklist_items_trigger
  on public.service_checklist_items;

create trigger
  protect_submitted_checklist_items_trigger
before insert or update or delete
on public.service_checklist_items
for each row
execute function
  public.protect_submitted_checklist_items();


-- Preserve the final submitted checklist snapshot.
--
-- Admin correction notes and the legacy stop-completion fields may still
-- be appended after submission. The customer-facing checklist content,
-- relationships, generation, and archive may not be rewritten.

create or replace function
  public.protect_submitted_checklist_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'submitted'
    and (
      new.service_visit_id is distinct from
        old.service_visit_id
      or new.route_stop_id is distinct from
        old.route_stop_id
      or new.booking_id is distinct from
        old.booking_id
      or new.customer_id is distinct from
        old.customer_id
      or new.status is distinct from
        old.status
      or new.services_performed is distinct from
        old.services_performed
      or new.overall_notes is distinct from
        old.overall_notes
      or new.submitted_at is distinct from
        old.submitted_at
      or new.submitted_by is distinct from
        old.submitted_by
      or new.pdf_storage_bucket is distinct from
        old.pdf_storage_bucket
      or new.pdf_storage_path is distinct from
        old.pdf_storage_path
      or new.pdf_generated_at is distinct from
        old.pdf_generated_at
      or new.submission_generation is distinct from
        old.submission_generation
      or new.submission_state is distinct from
        old.submission_state
      or new.submission_started_at is distinct from
        old.submission_started_at
      or new.submission_finalized_at is distinct from
        old.submission_finalized_at
      or new.submission_error is distinct from
        old.submission_error
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'checklist_submission:proof_locked';
  end if;

  return new;
end;
$$;

drop trigger if exists
  protect_submitted_checklist_row_trigger
  on public.service_checklists;

create trigger
  protect_submitted_checklist_row_trigger
before update
on public.service_checklists
for each row
execute function
  public.protect_submitted_checklist_row();


-- A stop cannot transition to completed unless the checklist status,
-- archive row, and private storage object all agree.

create or replace function
  public.require_checklist_archive_for_completion()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_checklist public.service_checklists%rowtype;
begin
  if new.status = 'completed'
    and old.status is distinct from
      'completed'
  then
    select *
    into v_checklist
    from public.service_checklists
    where
      route_stop_id =
        new.id
      or (
        route_stop_id is null
        and service_visit_id =
          new.service_visit_id
      )
    order by
      updated_at desc
    limit 1;

    if not found
      or v_checklist.status <>
        'submitted'
      or v_checklist.submission_state <>
        'ready'
      or v_checklist.pdf_storage_bucket
        is null
      or v_checklist.pdf_storage_path
        is null
      or not exists (
        select 1
        from public.service_checklist_documents
          as document
        where document.checklist_id =
            v_checklist.id
          and document.document_type =
            'checklist_pdf'
          and document.storage_bucket =
            v_checklist.pdf_storage_bucket
          and document.storage_path =
            v_checklist.pdf_storage_path
          and document.is_customer_visible
      )
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id =
            v_checklist.pdf_storage_bucket
          and object.name =
            v_checklist.pdf_storage_path
      )
    then
      raise exception using
        errcode = 'P0001',
        message =
          'field_lifecycle:checklist_archive_required';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
  require_checklist_archive_for_completion_trigger
  on public.route_stops;

create trigger
  require_checklist_archive_for_completion_trigger
before update of status
on public.route_stops
for each row
execute function
  public.require_checklist_archive_for_completion();


revoke all on function
  public.field_save_checklist_work_atomic(
    uuid,
    uuid,
    jsonb,
    text,
    boolean
  )
  from public, anon, authenticated;

revoke all on function
  public.field_finalize_checklist_submission_atomic(
    uuid,
    uuid,
    integer,
    text,
    text
  )
  from public, anon, authenticated;

revoke all on function
  public.field_fail_checklist_submission_atomic(
    uuid,
    uuid,
    integer,
    text
  )
  from public, anon, authenticated;

grant execute on function
  public.field_save_checklist_work_atomic(
    uuid,
    uuid,
    jsonb,
    text,
    boolean
  )
  to service_role;

grant execute on function
  public.field_finalize_checklist_submission_atomic(
    uuid,
    uuid,
    integer,
    text,
    text
  )
  to service_role;

grant execute on function
  public.field_fail_checklist_submission_atomic(
    uuid,
    uuid,
    integer,
    text
  )
  to service_role;
