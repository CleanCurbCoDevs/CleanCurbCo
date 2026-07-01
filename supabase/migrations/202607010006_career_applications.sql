create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  city text,
  state text,
  zip text,
  role_interest text,
  availability text[] default '{}',
  has_valid_drivers_license boolean default false,
  comfortable_outdoors boolean default false,
  comfortable_lifting boolean default false,
  experience text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'contacted', 'not_now', 'hired', 'archived')),
  admin_notes text
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create trigger set_career_applications_updated_at before update on public.career_applications
      for each row execute function public.set_updated_at();
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists career_applications_created_at_idx on public.career_applications(created_at);
create index if not exists career_applications_status_idx on public.career_applications(status);
create index if not exists career_applications_role_interest_idx on public.career_applications(role_interest);

alter table public.career_applications enable row level security;

drop policy if exists "Anyone can submit career applications" on public.career_applications;
create policy "Anyone can submit career applications"
  on public.career_applications for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins manage career applications" on public.career_applications;
create policy "Admins manage career applications"
  on public.career_applications for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
