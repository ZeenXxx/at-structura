-- AT STRUCTURA Member Access
-- Software dan Jasa hanya bisa dibaca user login, counter homepage tetap publik.

create schema if not exists private;

create table if not exists public.site_counters (
  key text primary key,
  value integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.site_counters enable row level security;

grant select on public.site_counters to anon, authenticated;

drop policy if exists "Site counters are public" on public.site_counters;
create policy "Site counters are public"
on public.site_counters
for select
to anon, authenticated
using (true);

create or replace function private.refresh_site_counters()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_counters (key, value, updated_at)
  values
    (
      'resources',
      (
        select count(*)::integer
        from public.resources
        where category <> 'Software'
          and status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
      ),
      now()
    ),
    (
      'software',
      (
        select count(*)::integer
        from public.software_items
        where status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
      ),
      now()
    ),
    (
      'services',
      (
        select count(*)::integer
        from public.technical_services
        where is_active = true
          and status = 'Aktif'
      ),
      now()
    )
  on conflict (key) do update set
    value = excluded.value,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function private.refresh_site_counters_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.refresh_site_counters();
  return coalesce(new, old);
end;
$$;

revoke all on function private.refresh_site_counters() from public, anon, authenticated;
revoke all on function private.refresh_site_counters_trigger() from public, anon, authenticated;

drop trigger if exists refresh_counters_after_resources on public.resources;
create trigger refresh_counters_after_resources
after insert or update or delete on public.resources
for each statement execute function private.refresh_site_counters_trigger();

drop trigger if exists refresh_counters_after_software on public.software_items;
create trigger refresh_counters_after_software
after insert or update or delete on public.software_items
for each statement execute function private.refresh_site_counters_trigger();

drop trigger if exists refresh_counters_after_services on public.technical_services;
create trigger refresh_counters_after_services
after insert or update or delete on public.technical_services
for each statement execute function private.refresh_site_counters_trigger();

select private.refresh_site_counters();

drop policy if exists "Software visible to public or resource admins" on public.software_items;
drop policy if exists "Software visible to signed in users or resource admins" on public.software_items;
create policy "Software visible to signed in users or resource admins"
on public.software_items
for select
to authenticated
using (
  status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Active services are public" on public.technical_services;
drop policy if exists "Active services visible to signed in users" on public.technical_services;
create policy "Active services visible to signed in users"
on public.technical_services
for select
to authenticated
using (
  (
    is_active = true
    and status = 'Aktif'
  )
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);
