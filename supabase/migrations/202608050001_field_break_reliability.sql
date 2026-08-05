-- Keep the field-app break reasons aligned with the database and prevent
-- duplicate active breaks caused by double taps or repeated submissions.

alter table public.route_breaks
  drop constraint if exists route_breaks_reason_check;

alter table public.route_breaks
  add constraint route_breaks_reason_check
  check (
    reason in (
      'lunch',
      'bathroom',
      'tank_empty',
      'tank_refill',
      'equipment_issue',
      'vehicle_issue',
      'access_issue',
      'safety_concern',
      'customer_issue',
      'fuel_stop',
      'hydration_rest',
      'weather_pause',
      'customer_delay',
      'scheduled_break',
      'other'
    )
  );

-- Clean up any duplicate active rows before adding the unique guard.
-- The newest active break is retained. Older duplicate rows are treated
-- as accidental zero-duration submissions.
with ranked_active_breaks as (
  select
    id,
    row_number() over (
      partition by technician_id
      order by started_at desc, id desc
    ) as active_rank
  from public.route_breaks
  where ended_at is null
    and technician_id is not null
)
update public.route_breaks as route_break
set ended_at = route_break.started_at
from ranked_active_breaks
where route_break.id = ranked_active_breaks.id
  and ranked_active_breaks.active_rank > 1;

create unique index if not exists route_breaks_one_active_per_technician_idx
  on public.route_breaks (technician_id)
  where ended_at is null
    and technician_id is not null;
