-- First-pass OptimoRoute route optimization sync.
-- Clean Curb Co. remains the source of truth; these fields only cache
-- OptimoRoute order/planning/schedule metadata for admin review and field order.

alter table public.route_days
  add column if not exists optimoroute_planning_id integer,
  add column if not exists optimoroute_planning_status text,
  add column if not exists optimoroute_planning_error text,
  add column if not exists optimoroute_last_planned_at timestamptz,
  add column if not exists optimoroute_last_imported_at timestamptz;

alter table public.route_stops
  add column if not exists optimoroute_order_no text,
  add column if not exists optimoroute_order_id text,
  add column if not exists optimoroute_sync_status text not null default 'not_synced'
    check (
      optimoroute_sync_status in (
        'not_synced',
        'syncing',
        'synced',
        'sync_failed',
        'planning_pending',
        'planning_failed',
        'scheduled',
        'unscheduled',
        'imported'
      )
    ),
  add column if not exists optimoroute_sync_error text,
  add column if not exists optimoroute_last_synced_at timestamptz,
  add column if not exists optimoroute_planning_status text,
  add column if not exists optimoroute_scheduled_at timestamptz,
  add column if not exists optimoroute_stop_sequence integer,
  add column if not exists optimoroute_route_id text,
  add column if not exists optimoroute_driver_name text,
  add column if not exists optimoroute_eta timestamptz,
  add column if not exists optimoroute_travel_time_seconds integer,
  add column if not exists optimoroute_distance_meters integer;

create index if not exists route_days_optimoroute_planning_id_idx
  on public.route_days (optimoroute_planning_id);

create index if not exists route_stops_optimoroute_order_no_idx
  on public.route_stops (optimoroute_order_no);

create index if not exists route_stops_optimoroute_sequence_idx
  on public.route_stops (route_day_id, optimoroute_stop_sequence);
