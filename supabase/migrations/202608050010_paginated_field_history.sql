-- Database-filtered, paginated field service history.
--
-- The field history page previously loaded the complete operational
-- archive into application memory before applying permissions, search,
-- filters, proof calculations, totals, and sorting.
--
-- This RPC applies the authorization boundary and all history filtering
-- in PostgreSQL, then returns one bounded page plus archive metrics.

create index if not exists
  route_stops_history_status_event_idx
on public.route_stops (
  status,
  completed_at desc,
  updated_at desc
);

create index if not exists
  service_checklists_route_stop_updated_idx
on public.service_checklists (
  route_stop_id,
  updated_at desc
);

create index if not exists
  service_checklists_visit_updated_idx
on public.service_checklists (
  service_visit_id,
  updated_at desc
);

create index if not exists
  service_photos_route_stop_type_idx
on public.service_photos (
  route_stop_id,
  photo_type
);

create index if not exists
  service_photos_visit_type_idx
on public.service_photos (
  service_visit_id,
  photo_type
);

create index if not exists
  payments_booking_created_idx
on public.payments (
  booking_id,
  created_at desc
);

create index if not exists
  payments_visit_created_idx
on public.payments (
  service_visit_id,
  created_at desc
);


create or replace function
  public.field_service_history_page(
    p_actor_profile_id uuid,
    p_search text default null,
    p_year integer default null,
    p_month integer default null,
    p_day date default null,
    p_status text default null,
    p_technician_id uuid default null,
    p_time_of_day text default null,
    p_proof text default null,
    p_issues_only boolean default false,
    p_sort text default 'newest',
    p_page integer default 1,
    p_page_size integer default 25
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;

  v_search text :=
    nullif(
      left(
        btrim(
          coalesce(
            p_search,
            ''
          )
        ),
        120
      ),
      ''
    );

  v_status text :=
    nullif(
      btrim(
        coalesce(
          p_status,
          ''
        )
      ),
      ''
    );

  v_time_of_day text :=
    nullif(
      btrim(
        coalesce(
          p_time_of_day,
          ''
        )
      ),
      ''
    );

  v_proof text :=
    nullif(
      btrim(
        coalesce(
          p_proof,
          ''
        )
      ),
      ''
    );

  v_sort text :=
    coalesce(
      nullif(
        btrim(
          p_sort
        ),
        ''
      ),
      'newest'
    );

  v_requested_page integer :=
    greatest(
      coalesce(
        p_page,
        1
      ),
      1
    );

  v_page_size integer :=
    least(
      greatest(
        coalesce(
          p_page_size,
          25
        ),
        1
      ),
      50
    );
begin
  if p_actor_profile_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_actor';
  end if;

  select profile.role::text
  into v_actor_role
  from public.profiles
    as profile
  where profile.id =
    p_actor_profile_id;

  if not found
    or v_actor_role not in (
      'technician',
      'admin',
      'owner'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_actor';
  end if;

  if p_year is not null
    and (
      p_year < 2000
      or p_year > 2100
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  if p_month is not null
    and (
      p_month < 1
      or p_month > 12
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  if v_status is not null
    and v_status not in (
      'completed',
      'needs_follow_up',
      'skipped'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  if v_time_of_day is not null
    and v_time_of_day not in (
      'morning',
      'afternoon',
      'evening'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  if v_proof is not null
    and v_proof not in (
      'complete',
      'missing_before',
      'missing_checklist',
      'missing_after'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  if v_sort not in (
    'newest',
    'oldest',
    'customer_asc',
    'customer_desc',
    'time_asc',
    'time_desc'
  )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'field_history:invalid_filter';
  end if;

  -- Technicians cannot expand their archive by supplying another
  -- technician's profile ID.
  if v_actor_role =
      'technician'
  then
    p_technician_id :=
      null;
  end if;

  return (
    with base_records as materialized (
      select
        stop.id
          as stop_id,

        to_jsonb(
          stop
        )
          as stop_json,

        case
          when visit.id is null
          then null
          else to_jsonb(
            visit
          )
        end
          as visit_json,

        case
          when booking.id is null
          then null
          else to_jsonb(
            booking
          )
        end
          as booking_json,

        case
          when route_day.id is null
          then null
          else to_jsonb(
            route_day
          )
        end
          as route_day_json,

        case
          when checklist.id is null
          then null
          else to_jsonb(
            checklist
          )
        end
          as checklist_json,

        case
          when payment.id is null
          then null
          else to_jsonb(
            payment
          )
        end
          as payment_json,

        case
          when technician.id is null
          then null
          else to_jsonb(
            technician
          )
        end
          as technician_json,

        stop.status,

        stop.issue_flags,

        stop.technician_notes,

        booking.id
          as booking_id,

        booking.first_name,

        booking.last_name,

        booking.email,

        booking.phone,

        booking.street_address,

        booking.city,

        booking.state,

        booking.zip_code,

        booking.estimated_price,

        route_day.route_name,

        route_day.service_area,

        route_day.assigned_technician_id,

        coalesce(
          checklist.completed_by,
          checklist.submitted_by
        )
          as completed_by,

        coalesce(
          checklist.completed_by,
          checklist.submitted_by,
          route_day.assigned_technician_id
        )
          as technician_id,

        coalesce(
          nullif(
            btrim(
              concat_ws(
                ' ',
                technician.first_name,
                technician.last_name
              )
            ),
            ''
          ),
          technician.email,
          'Technician'
        )
          as technician_name,

        lower(
          concat_ws(
            ' ',
            booking.last_name,
            booking.first_name
          )
        )
          as customer_sort,

        coalesce(
          stop.completed_at,
          checklist.completed_at,
          checklist.submitted_at,
          stop.updated_at
        )
          as event_at,

        (
          coalesce(
            stop.completed_at,
            checklist.completed_at,
            checklist.submitted_at,
            stop.updated_at
          )
          at time zone
            'America/New_York'
        )::date
          as eastern_date,

        (
          coalesce(
            stop.completed_at,
            checklist.completed_at,
            checklist.submitted_at,
            stop.updated_at
          )
          at time zone
            'America/New_York'
        )::time
          as eastern_time,

        extract(
          year from
          (
            coalesce(
              stop.completed_at,
              checklist.completed_at,
              checklist.submitted_at,
              stop.updated_at
            )
            at time zone
              'America/New_York'
          )
        )::integer
          as eastern_year,

        extract(
          month from
          (
            coalesce(
              stop.completed_at,
              checklist.completed_at,
              checklist.submitted_at,
              stop.updated_at
            )
            at time zone
              'America/New_York'
          )
        )::integer
          as eastern_month,

        extract(
          hour from
          (
            coalesce(
              stop.completed_at,
              checklist.completed_at,
              checklist.submitted_at,
              stop.updated_at
            )
            at time zone
              'America/New_York'
          )
        )::integer
          as eastern_hour,

        coalesce(
          photo_counts.before_count,
          0
        )
          as before_photo_count,

        coalesce(
          photo_counts.after_count,
          0
        )
          as after_photo_count,

        coalesce(
          photo_counts.issue_count,
          0
        )
          as issue_photo_count,

        (
          coalesce(
            photo_counts.before_count,
            0
          ) > 0
          or (
            nullif(
              btrim(
                coalesce(
                  stop.before_photo_exception_reason,
                  ''
                )
              ),
              ''
            ) is not null
            and
            'before_photo_exception' =
              any(
                coalesce(
                  stop.issue_flags,
                  '{}'::text[]
                )
              )
          )
        )
          as before_proof_complete,

        (
          coalesce(
            photo_counts.after_count,
            0
          ) > 0
          or (
            nullif(
              btrim(
                coalesce(
                  stop.after_photo_exception_reason,
                  ''
                )
              ),
              ''
            ) is not null
            and
            'after_photo_exception' =
              any(
                coalesce(
                  stop.issue_flags,
                  '{}'::text[]
                )
              )
          )
        )
          as after_proof_complete,

        checklist.status =
          'submitted'
          as checklist_complete,

        (
          stop.status =
            'needs_follow_up'
          or cardinality(
            coalesce(
              stop.issue_flags,
              '{}'::text[]
            )
          ) > 0
          or coalesce(
            photo_counts.issue_count,
            0
          ) > 0
        )
          as has_issue,

        payment.status
          as payment_status,

        payment.amount
          as payment_amount

      from public.route_stops
        as stop

      left join public.service_visits
        as visit
        on visit.id =
          stop.service_visit_id

      left join public.bookings
        as booking
        on booking.id =
          coalesce(
            stop.booking_id,
            visit.booking_id
          )

      left join public.route_days
        as route_day
        on route_day.id =
          stop.route_day_id

      left join lateral (
        select
          candidate.*
        from public.service_checklists
          as candidate
        where
          candidate.route_stop_id =
            stop.id
          or (
            candidate.route_stop_id is null
            and candidate.service_visit_id =
              stop.service_visit_id
          )
        order by
          candidate.updated_at desc,
          candidate.id desc
        limit 1
      )
        as checklist
        on true

      left join lateral (
        select
          count(*) filter (
            where photo.photo_type =
              'before'
          )::integer
            as before_count,

          count(*) filter (
            where photo.photo_type =
              'after'
          )::integer
            as after_count,

          count(*) filter (
            where photo.photo_type in (
              'issue',
              'other'
            )
          )::integer
            as issue_count

        from public.service_photos
          as photo

        where
          photo.route_stop_id =
            stop.id
          or photo.service_visit_id =
            stop.service_visit_id
      )
        as photo_counts
        on true

      left join lateral (
        select
          candidate.*
        from public.payments
          as candidate
        where
          candidate.booking_id =
            booking.id
          or candidate.service_visit_id =
            visit.id
        order by
          candidate.created_at desc,
          candidate.id desc
        limit 1
      )
        as payment
        on true

      left join public.profiles
        as technician
        on technician.id =
          coalesce(
            checklist.completed_by,
            checklist.submitted_by,
            route_day.assigned_technician_id
          )

      where stop.status in (
        'completed',
        'needs_follow_up',
        'skipped'
      )
    ),

    scoped_records as materialized (
      select *
      from base_records
      where
        v_actor_role in (
          'admin',
          'owner'
        )
        or completed_by =
          p_actor_profile_id
        or (
          completed_by is null
          and assigned_technician_id =
            p_actor_profile_id
        )
    ),

    filtered_records as materialized (
      select *
      from scoped_records
      where
        (
          v_search is null
          or coalesce(
            first_name,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            last_name,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            email,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            phone,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            street_address,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            city,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            state,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            zip_code,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            route_name,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            service_area,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            technician_name,
            ''
          ) ilike
            '%' || v_search || '%'
          or coalesce(
            technician_notes,
            ''
          ) ilike
            '%' || v_search || '%'
        )

        and (
          p_year is null
          or eastern_year =
            p_year
        )

        and (
          p_month is null
          or eastern_month =
            p_month
        )

        and (
          p_day is null
          or eastern_date =
            p_day
        )

        and (
          v_status is null
          or status =
            v_status
        )

        and (
          p_technician_id is null
          or technician_id =
            p_technician_id
        )

        and (
          v_time_of_day is null

          or (
            v_time_of_day =
              'morning'
            and eastern_hour < 12
          )

          or (
            v_time_of_day =
              'afternoon'
            and eastern_hour >= 12
            and eastern_hour < 17
          )

          or (
            v_time_of_day =
              'evening'
            and eastern_hour >= 17
          )
        )

        and (
          v_proof is null

          or (
            v_proof =
              'complete'
            and before_proof_complete
            and checklist_complete
            and after_proof_complete
          )

          or (
            v_proof =
              'missing_before'
            and not
              before_proof_complete
          )

          or (
            v_proof =
              'missing_checklist'
            and not
              checklist_complete
          )

          or (
            v_proof =
              'missing_after'
            and not
              after_proof_complete
          )
        )

        and (
          not coalesce(
            p_issues_only,
            false
          )
          or has_issue
        )
    ),

    filtered_count as (
      select
        count(*)::integer
          as total_count
      from filtered_records
    ),

    page_meta as (
      select
        total_count,

        greatest(
          1,
          ceil(
            total_count::numeric /
            v_page_size::numeric
          )::integer
        )
          as page_count

      from filtered_count
    ),

    resolved_page as (
      select
        total_count,

        page_count,

        least(
          v_requested_page,
          page_count
        )
          as page

      from page_meta
    ),

    ordered_records as (
      select
        filtered_records.*,

        row_number() over (
          order by
            case
              when v_sort =
                'oldest'
              then event_at
            end asc nulls last,

            case
              when v_sort =
                'newest'
              then event_at
            end desc nulls last,

            case
              when v_sort =
                'customer_asc'
              then customer_sort
            end asc nulls last,

            case
              when v_sort =
                'customer_desc'
              then customer_sort
            end desc nulls last,

            case
              when v_sort =
                'time_asc'
              then eastern_time
            end asc nulls last,

            case
              when v_sort =
                'time_desc'
              then eastern_time
            end desc nulls last,

            case
              when v_sort in (
                'customer_asc',
                'customer_desc',
                'time_asc',
                'time_desc'
              )
              then event_at
            end desc nulls last,

            stop_id desc
        )::integer
          as result_order

      from filtered_records
    ),

    page_records as (
      select
        ordered_records.*
      from ordered_records
      cross join resolved_page
      where result_order >
        (
          resolved_page.page - 1
        ) * v_page_size
        and result_order <=
          resolved_page.page *
          v_page_size
      order by
        result_order
    ),

    scope_metrics as (
      select
        count(*)::integer
          as scope_count,

        count(*) filter (
          where status =
            'completed'
        )::integer
          as completed_count,

        count(*) filter (
          where status =
            'needs_follow_up'
        )::integer
          as follow_up_count,

        count(*) filter (
          where
            status =
              'completed'
            and before_proof_complete
            and checklist_complete
            and after_proof_complete
        )::integer
          as proof_complete_count,

        coalesce(
          sum(
            case
              when status <>
                'completed'
              then 0

              when payment_status =
                'paid'
              then coalesce(
                payment_amount,
                0
              )

              else coalesce(
                estimated_price,
                0
              )
            end
          ),
          0
        )
          as serviced_revenue

      from scoped_records
    ),

    available_years as (
      select
        coalesce(
          jsonb_agg(
            year_value
            order by
              year_value desc
          ),
          '[]'::jsonb
        )
          as values

      from (
        select distinct
          eastern_year
            as year_value
        from scoped_records
        where eastern_year
          is not null
      )
        as years
    ),

    available_technicians as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',
                technician_id,
              'name',
                technician_name
            )
            order by
              technician_name,
              technician_id
          ),
          '[]'::jsonb
        )
          as values

      from (
        select distinct
          technician_id,
          technician_name

        from scoped_records

        where technician_id
          is not null
      )
        as technicians
    ),

    record_payload as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'stop',
                stop_json,

              'visit',
                visit_json,

              'booking',
                booking_json,

              'routeDay',
                route_day_json,

              'checklist',
                checklist_json,

              'payment',
                payment_json,

              'technician',
                technician_json,

              'beforePhotoCount',
                before_photo_count,

              'afterPhotoCount',
                after_photo_count,

              'issuePhotoCount',
                issue_photo_count,

              'beforeProofComplete',
                before_proof_complete,

              'afterProofComplete',
                after_proof_complete,

              'completedBy',
                completed_by,

              'eventDate',
                event_at
            )
            order by
              result_order
          ),
          '[]'::jsonb
        )
          as records

      from page_records
    )

    select jsonb_build_object(
      'records',
        record_payload.records,

      'metrics',
        jsonb_build_object(
          'scopeCount',
            scope_metrics.scope_count,

          'completedCount',
            scope_metrics.completed_count,

          'followUpCount',
            scope_metrics.follow_up_count,

          'proofCompleteCount',
            scope_metrics.proof_complete_count,

          'servicedRevenue',
            scope_metrics.serviced_revenue
        ),

      'pagination',
        jsonb_build_object(
          'page',
            resolved_page.page,

          'pageSize',
            v_page_size,

          'totalCount',
            resolved_page.total_count,

          'pageCount',
            resolved_page.page_count
        ),

      'availableYears',
        available_years.values,

      'technicians',
        available_technicians.values
    )

    from record_payload
    cross join scope_metrics
    cross join resolved_page
    cross join available_years
    cross join available_technicians
  );
end;
$$;


revoke all on function
  public.field_service_history_page(
    uuid,
    text,
    integer,
    integer,
    date,
    text,
    uuid,
    text,
    text,
    boolean,
    text,
    integer,
    integer
  )
  from public, anon, authenticated;

grant execute on function
  public.field_service_history_page(
    uuid,
    text,
    integer,
    integer,
    date,
    text,
    uuid,
    text,
    text,
    boolean,
    text,
    integer,
    integer
  )
  to service_role;
