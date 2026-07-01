-- Per-visit service checklist reports and customer/internal document archive.

alter table public.service_checklists
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade,
  add column if not exists customer_id uuid references public.profiles(id) on delete set null,
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'submitted', 'voided')),
  add column if not exists services_performed text[] not null default '{}',
  add column if not exists overall_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists pdf_storage_bucket text default 'service-documents',
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists correction_notes text;

update public.service_checklists sc
set booking_id = sv.booking_id,
    customer_id = sv.customer_id
from public.service_visits sv
where sc.service_visit_id = sv.id
  and (sc.booking_id is null or sc.customer_id is null);

create unique index if not exists service_checklists_visit_unique_idx
  on public.service_checklists(service_visit_id)
  where service_visit_id is not null;

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template_id uuid references public.checklist_templates(id) on delete cascade,
  section_key text not null,
  section_name text not null,
  item_key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  unique(template_id, item_key)
);

create table if not exists public.service_checklist_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checklist_id uuid not null references public.service_checklists(id) on delete cascade,
  service_visit_id uuid references public.service_visits(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  section_key text not null,
  section_name text not null,
  item_key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'not_applicable', 'issue_found')),
  notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique(checklist_id, item_key)
);

create table if not exists public.service_checklist_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  checklist_id uuid not null references public.service_checklists(id) on delete cascade,
  service_visit_id uuid references public.service_visits(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  document_type text not null default 'checklist_pdf'
    check (document_type in ('checklist_pdf', 'correction_note', 'other')),
  storage_bucket text not null default 'service-documents',
  storage_path text not null,
  is_customer_visible boolean not null default true,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  notes text
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create trigger set_checklist_templates_updated_at before update on public.checklist_templates
      for each row execute function public.set_updated_at();
    create trigger set_service_checklist_items_updated_at before update on public.service_checklist_items
      for each row execute function public.set_updated_at();
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists checklist_template_items_template_idx
  on public.checklist_template_items(template_id, sort_order);
create index if not exists service_checklist_items_checklist_idx
  on public.service_checklist_items(checklist_id, sort_order);
create index if not exists service_checklist_items_visit_idx
  on public.service_checklist_items(service_visit_id);
create index if not exists service_checklist_documents_customer_idx
  on public.service_checklist_documents(customer_id);
create index if not exists service_checklist_documents_visit_idx
  on public.service_checklist_documents(service_visit_id);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.service_checklist_items enable row level security;
alter table public.service_checklist_documents enable row level security;

drop policy if exists "Customers read own checklist summary" on public.service_checklists;
create policy "Customers read own checklist summary"
  on public.service_checklists for select
  using (
    status = 'submitted'
    and exists (
      select 1
      from public.service_visits sv
      where sv.id = service_checklists.service_visit_id
        and sv.customer_id = auth.uid()
    )
  );

drop policy if exists "Admins manage checklist templates" on public.checklist_templates;
create policy "Admins manage checklist templates"
  on public.checklist_templates for all
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

drop policy if exists "Field users read checklist templates" on public.checklist_templates;
create policy "Field users read checklist templates"
  on public.checklist_templates for select
  using (public.is_field_user());

drop policy if exists "Admins manage checklist template items" on public.checklist_template_items;
create policy "Admins manage checklist template items"
  on public.checklist_template_items for all
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

drop policy if exists "Field users read checklist template items" on public.checklist_template_items;
create policy "Field users read checklist template items"
  on public.checklist_template_items for select
  using (public.is_field_user());

drop policy if exists "Admins manage service checklist items" on public.service_checklist_items;
create policy "Admins manage service checklist items"
  on public.service_checklist_items for all
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

drop policy if exists "Field users manage service checklist items" on public.service_checklist_items;
create policy "Field users manage service checklist items"
  on public.service_checklist_items for all
  using (public.is_field_user())
  with check (public.is_field_user());

drop policy if exists "Customers read own submitted checklist items" on public.service_checklist_items;
create policy "Customers read own submitted checklist items"
  on public.service_checklist_items for select
  using (
    exists (
      select 1
      from public.service_checklists sc
      where sc.id = service_checklist_items.checklist_id
        and sc.customer_id = auth.uid()
        and sc.status = 'submitted'
    )
  );

drop policy if exists "Admins manage service checklist documents" on public.service_checklist_documents;
create policy "Admins manage service checklist documents"
  on public.service_checklist_documents for all
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

drop policy if exists "Field users manage service checklist documents" on public.service_checklist_documents;
create policy "Field users manage service checklist documents"
  on public.service_checklist_documents for all
  using (public.is_field_user())
  with check (public.is_field_user());

drop policy if exists "Customers read own visible checklist documents" on public.service_checklist_documents;
create policy "Customers read own visible checklist documents"
  on public.service_checklist_documents for select
  using (
    customer_id = auth.uid()
    and is_customer_visible = true
  );

insert into storage.buckets (id, name, public)
values ('service-documents', 'service-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Service document objects readable by related users" on storage.objects;
create policy "Service document objects readable by related users"
  on storage.objects for select
  using (
    bucket_id = 'service-documents'
    and (
      public.is_field_user()
      or exists (
        select 1
        from public.service_checklist_documents doc
        where doc.storage_bucket = storage.objects.bucket_id
          and doc.storage_path = storage.objects.name
          and doc.customer_id = auth.uid()
          and doc.is_customer_visible = true
      )
    )
  );

drop policy if exists "Field users insert service document objects" on storage.objects;
create policy "Field users insert service document objects"
  on storage.objects for insert
  with check (bucket_id = 'service-documents' and public.is_field_user());

drop policy if exists "Field users update service document objects" on storage.objects;
create policy "Field users update service document objects"
  on storage.objects for update
  using (bucket_id = 'service-documents' and public.is_field_user())
  with check (bucket_id = 'service-documents' and public.is_field_user());

drop policy if exists "Field users delete service document objects" on storage.objects;
create policy "Field users delete service document objects"
  on storage.objects for delete
  using (bucket_id = 'service-documents' and public.is_field_user());
