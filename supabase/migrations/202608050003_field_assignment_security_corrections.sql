-- Close the remaining field-assignment RLS gaps.
--
-- 1. Access helpers always evaluate the authenticated caller.
--    The legacy user_id argument is retained for compatibility with
--    policies already parsed against the original function signature.
--
-- 2. A technician may only attach a new or updated break to a route
--    currently assigned to that technician.

create or replace function public.field_user_can_access_route_day(
  target_route_day_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_route_day_id is not null
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role in ('admin', 'owner')
      )
      or exists (
        select 1
        from public.route_days
        where id = target_route_day_id
          and assigned_technician_id = auth.uid()
      )
    );
$$;

create or replace function public.field_user_can_access_stop(
  target_route_stop_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_route_stop_id is not null
    and exists (
      select 1
      from public.route_stops rs
      join public.route_days rd
        on rd.id = rs.route_day_id
      where rs.id = target_route_stop_id
        and (
          rd.assigned_technician_id = auth.uid()
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and role in ('admin', 'owner')
          )
        )
    );
$$;

create or replace function public.field_user_can_access_visit(
  target_visit_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_visit_id is not null
    and exists (
      select 1
      from public.route_stops rs
      join public.route_days rd
        on rd.id = rs.route_day_id
      where rs.service_visit_id = target_visit_id
        and (
          rd.assigned_technician_id = auth.uid()
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and role in ('admin', 'owner')
          )
        )
    );
$$;

create or replace function public.field_user_can_access_booking(
  target_booking_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_booking_id is not null
    and exists (
      select 1
      from public.route_stops rs
      join public.route_days rd
        on rd.id = rs.route_day_id
      where rs.booking_id = target_booking_id
        and (
          rd.assigned_technician_id = auth.uid()
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and role in ('admin', 'owner')
          )
        )
    );
$$;

create or replace function public.field_user_can_access_checklist(
  target_checklist_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_checklist_id is not null
    and exists (
      select 1
      from public.service_checklists sc
      left join public.route_stops rs
        on (
          rs.id = sc.route_stop_id
          or (
            sc.route_stop_id is null
            and rs.service_visit_id = sc.service_visit_id
          )
        )
      left join public.route_days rd
        on rd.id = rs.route_day_id
      where sc.id = target_checklist_id
        and (
          rd.assigned_technician_id = auth.uid()
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and role in ('admin', 'owner')
          )
        )
    );
$$;

-- Functions receive EXECUTE permission for PUBLIC by default.
-- Remove that broad default and allow only authenticated application
-- users and the Supabase service role.

revoke all on function
  public.field_user_can_access_route_day(uuid, uuid)
  from public;

revoke all on function
  public.field_user_can_access_stop(uuid, uuid)
  from public;

revoke all on function
  public.field_user_can_access_visit(uuid, uuid)
  from public;

revoke all on function
  public.field_user_can_access_booking(uuid, uuid)
  from public;

revoke all on function
  public.field_user_can_access_checklist(uuid, uuid)
  from public;

revoke all on function
  public.safe_uuid_path_segment(text, integer)
  from public;

grant execute on function
  public.field_user_can_access_route_day(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  public.field_user_can_access_stop(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  public.field_user_can_access_visit(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  public.field_user_can_access_booking(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  public.field_user_can_access_checklist(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  public.safe_uuid_path_segment(text, integer)
  to authenticated, service_role;

-- Technicians may view and manage their own historical break records,
-- but a new or updated break may only reference an assigned route.

drop policy if exists
  "Technicians manage own route breaks"
  on public.route_breaks;

create policy
  "Technicians manage own route breaks"
on public.route_breaks
for all
to authenticated
using (
  public.is_field_user()
  and technician_id = auth.uid()
)
with check (
  public.is_field_user()
  and technician_id = auth.uid()
  and (
    route_day_id is null
    or public.field_user_can_access_route_day(
      route_day_id
    )
  )
);
