-- Scope field access to the technician assigned to a route.
-- Owners and admins retain company-wide field access.

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
    exists (
      select 1
      from public.profiles
      where id = user_id
        and role in ('admin', 'owner')
    )
    or exists (
      select 1
      from public.route_days
      where id = target_route_day_id
        and assigned_technician_id = user_id
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
  select exists (
    select 1
    from public.route_stops rs
    join public.route_days rd
      on rd.id = rs.route_day_id
    where rs.id = target_route_stop_id
      and (
        rd.assigned_technician_id = user_id
        or exists (
          select 1
          from public.profiles
          where id = user_id
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
  select exists (
    select 1
    from public.route_stops rs
    join public.route_days rd
      on rd.id = rs.route_day_id
    where rs.service_visit_id = target_visit_id
      and (
        rd.assigned_technician_id = user_id
        or exists (
          select 1
          from public.profiles
          where id = user_id
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
  select exists (
    select 1
    from public.route_stops rs
    join public.route_days rd
      on rd.id = rs.route_day_id
    where rs.booking_id = target_booking_id
      and (
        rd.assigned_technician_id = user_id
        or exists (
          select 1
          from public.profiles
          where id = user_id
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
  select exists (
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
        rd.assigned_technician_id = user_id
        or exists (
          select 1
          from public.profiles
          where id = user_id
            and role in ('admin', 'owner')
        )
      )
  );
$$;

create or replace function public.safe_uuid_path_segment(
  object_name text,
  segment_number integer
)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if object_name is null or segment_number < 1 then
    return null;
  end if;

  return split_part(
    object_name,
    '/',
    segment_number
  )::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

grant execute on function
  public.field_user_can_access_route_day(uuid, uuid)
  to authenticated;

grant execute on function
  public.field_user_can_access_stop(uuid, uuid)
  to authenticated;

grant execute on function
  public.field_user_can_access_visit(uuid, uuid)
  to authenticated;

grant execute on function
  public.field_user_can_access_booking(uuid, uuid)
  to authenticated;

grant execute on function
  public.field_user_can_access_checklist(uuid, uuid)
  to authenticated;

grant execute on function
  public.safe_uuid_path_segment(text, integer)
  to authenticated;

-- Route days

drop policy if exists
  "Field users read route days"
  on public.route_days;

drop policy if exists
  "Assigned field users read route days"
  on public.route_days;

create policy
  "Assigned field users read route days"
on public.route_days
for select
to authenticated
using (
  public.field_user_can_access_route_day(id)
);

-- Route stops

drop policy if exists
  "Field users manage route stops"
  on public.route_stops;

drop policy if exists
  "Assigned field users read route stops"
  on public.route_stops;

create policy
  "Assigned field users read route stops"
on public.route_stops
for select
to authenticated
using (
  public.field_user_can_access_stop(id)
);

drop policy if exists
  "Assigned field users update route stops"
  on public.route_stops;

create policy
  "Assigned field users update route stops"
on public.route_stops
for update
to authenticated
using (
  public.field_user_can_access_stop(id)
)
with check (
  public.field_user_can_access_route_day(
    route_day_id
  )
);

-- Bookings

drop policy if exists
  "Assigned field users read bookings"
  on public.bookings;

create policy
  "Assigned field users read bookings"
on public.bookings
for select
to authenticated
using (
  public.field_user_can_access_booking(id)
);

drop policy if exists
  "Assigned field users update bookings"
  on public.bookings;

create policy
  "Assigned field users update bookings"
on public.bookings
for update
to authenticated
using (
  public.field_user_can_access_booking(id)
)
with check (
  public.field_user_can_access_booking(id)
);

-- Service visits

drop policy if exists
  "Assigned field users read service visits"
  on public.service_visits;

create policy
  "Assigned field users read service visits"
on public.service_visits
for select
to authenticated
using (
  public.field_user_can_access_visit(id)
);

drop policy if exists
  "Assigned field users update service visits"
  on public.service_visits;

create policy
  "Assigned field users update service visits"
on public.service_visits
for update
to authenticated
using (
  public.field_user_can_access_visit(id)
)
with check (
  public.field_user_can_access_visit(id)
);

-- Saved addresses

drop policy if exists
  "Assigned field users read service addresses"
  on public.service_addresses;

create policy
  "Assigned field users read service addresses"
on public.service_addresses
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.route_stops rs
      on rs.booking_id = b.id
    where (
      b.service_address_id =
        service_addresses.id
      or (
        b.service_address_id is null
        and b.customer_id =
          service_addresses.customer_id
        and service_addresses.is_primary
      )
    )
      and public.field_user_can_access_stop(
        rs.id
      )
  )
);

-- Checklists

drop policy if exists
  "Field users manage service checklists"
  on public.service_checklists;

drop policy if exists
  "Assigned field users read service checklists"
  on public.service_checklists;

create policy
  "Assigned field users read service checklists"
on public.service_checklists
for select
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

drop policy if exists
  "Assigned field users create service checklists"
  on public.service_checklists;

create policy
  "Assigned field users create service checklists"
on public.service_checklists
for insert
to authenticated
with check (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

drop policy if exists
  "Assigned field users update service checklists"
  on public.service_checklists;

create policy
  "Assigned field users update service checklists"
on public.service_checklists
for update
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
)
with check (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

-- Checklist items

drop policy if exists
  "Field users manage service checklist items"
  on public.service_checklist_items;

drop policy if exists
  "Assigned field users read checklist items"
  on public.service_checklist_items;

create policy
  "Assigned field users read checklist items"
on public.service_checklist_items
for select
to authenticated
using (
  public.field_user_can_access_checklist(
    checklist_id
  )
);

drop policy if exists
  "Assigned field users create checklist items"
  on public.service_checklist_items;

create policy
  "Assigned field users create checklist items"
on public.service_checklist_items
for insert
to authenticated
with check (
  public.field_user_can_access_checklist(
    checklist_id
  )
);

drop policy if exists
  "Assigned field users update checklist items"
  on public.service_checklist_items;

create policy
  "Assigned field users update checklist items"
on public.service_checklist_items
for update
to authenticated
using (
  public.field_user_can_access_checklist(
    checklist_id
  )
)
with check (
  public.field_user_can_access_checklist(
    checklist_id
  )
);

-- Checklist documents

drop policy if exists
  "Field users manage service checklist documents"
  on public.service_checklist_documents;

drop policy if exists
  "Assigned field users read checklist documents"
  on public.service_checklist_documents;

create policy
  "Assigned field users read checklist documents"
on public.service_checklist_documents
for select
to authenticated
using (
  public.field_user_can_access_checklist(
    checklist_id
  )
);

drop policy if exists
  "Assigned field users create checklist documents"
  on public.service_checklist_documents;

create policy
  "Assigned field users create checklist documents"
on public.service_checklist_documents
for insert
to authenticated
with check (
  public.field_user_can_access_checklist(
    checklist_id
  )
);

-- Service photos

drop policy if exists
  "Field users manage service photos"
  on public.service_photos;

drop policy if exists
  "Assigned field users read service photos"
  on public.service_photos;

create policy
  "Assigned field users read service photos"
on public.service_photos
for select
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

drop policy if exists
  "Assigned field users create service photos"
  on public.service_photos;

create policy
  "Assigned field users create service photos"
on public.service_photos
for insert
to authenticated
with check (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

drop policy if exists
  "Assigned field users update service photos"
  on public.service_photos;

create policy
  "Assigned field users update service photos"
on public.service_photos
for update
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
)
with check (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

drop policy if exists
  "Assigned field users delete service photos"
  on public.service_photos;

create policy
  "Assigned field users delete service photos"
on public.service_photos
for delete
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
);

-- Service events

drop policy if exists
  "Field users create and read service events"
  on public.service_events;

drop policy if exists
  "Assigned field users read service events"
  on public.service_events;

create policy
  "Assigned field users read service events"
on public.service_events
for select
to authenticated
using (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
  or public.field_user_can_access_booking(
    booking_id
  )
);

drop policy if exists
  "Assigned field users create service events"
  on public.service_events;

create policy
  "Assigned field users create service events"
on public.service_events
for insert
to authenticated
with check (
  public.field_user_can_access_stop(
    route_stop_id
  )
  or public.field_user_can_access_visit(
    service_visit_id
  )
  or public.field_user_can_access_booking(
    booking_id
  )
);

-- Notification events

drop policy if exists
  "Field users create notification events"
  on public.notification_events;

drop policy if exists
  "Assigned field users create notification events"
  on public.notification_events;

create policy
  "Assigned field users create notification events"
on public.notification_events
for insert
to authenticated
with check (
  public.field_user_can_access_stop(
    related_route_stop_id
  )
  or public.field_user_can_access_visit(
    related_visit_id
  )
  or public.field_user_can_access_booking(
    related_booking_id
  )
);

-- Payments

drop policy if exists
  "Field users read payments"
  on public.payments;

drop policy if exists
  "Assigned field users read payments"
  on public.payments;

create policy
  "Assigned field users read payments"
on public.payments
for select
to authenticated
using (
  public.field_user_can_access_visit(
    service_visit_id
  )
  or public.field_user_can_access_booking(
    booking_id
  )
);

-- Service-photo storage

drop policy if exists
  "Service photo objects readable by related users"
  on storage.objects;

create policy
  "Service photo objects readable by related users"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'service-photos'
  and (
    public.is_admin_or_owner()
    or public.field_user_can_access_visit(
      public.safe_uuid_path_segment(
        storage.objects.name,
        1
      )
    )
    or exists (
      select 1
      from public.service_photos sp
      where sp.storage_bucket =
          storage.objects.bucket_id
        and sp.storage_path =
          storage.objects.name
        and sp.customer_id =
          auth.uid()
        and sp.is_customer_visible
    )
  )
);

drop policy if exists
  "Field users insert service photo objects"
  on storage.objects;

create policy
  "Assigned field users insert service photo objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-photos'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      1
    )
  )
);

drop policy if exists
  "Field users update service photo objects"
  on storage.objects;

create policy
  "Assigned field users update service photo objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'service-photos'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      1
    )
  )
)
with check (
  bucket_id = 'service-photos'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      1
    )
  )
);

drop policy if exists
  "Field users delete service photo objects"
  on storage.objects;

create policy
  "Assigned field users delete service photo objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'service-photos'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      1
    )
  )
);

-- Checklist-document storage paths are:
-- checklists/<visit-id>/<file-name>.pdf

drop policy if exists
  "Service document objects readable by related users"
  on storage.objects;

create policy
  "Service document objects readable by related users"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'service-documents'
  and (
    public.is_admin_or_owner()
    or public.field_user_can_access_visit(
      public.safe_uuid_path_segment(
        storage.objects.name,
        2
      )
    )
    or exists (
      select 1
      from public.service_checklist_documents doc
      where doc.storage_bucket =
          storage.objects.bucket_id
        and doc.storage_path =
          storage.objects.name
        and doc.customer_id =
          auth.uid()
        and doc.is_customer_visible
    )
  )
);

drop policy if exists
  "Field users insert service document objects"
  on storage.objects;

create policy
  "Assigned field users insert service document objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-documents'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      2
    )
  )
);

drop policy if exists
  "Field users update service document objects"
  on storage.objects;

create policy
  "Assigned field users update service document objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'service-documents'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      2
    )
  )
)
with check (
  bucket_id = 'service-documents'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      2
    )
  )
);

drop policy if exists
  "Field users delete service document objects"
  on storage.objects;

create policy
  "Assigned field users delete service document objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'service-documents'
  and public.field_user_can_access_visit(
    public.safe_uuid_path_segment(
      storage.objects.name,
      2
    )
  )
);
