-- AT STRUCTURA Verified Member Access
-- Software dan Jasa hanya bisa dibaca oleh user yang emailnya sudah terverifikasi.

create schema if not exists private;

create or replace function private.is_verified_member()
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_verified_member() to authenticated;

drop policy if exists "Software visible to signed in users or resource admins" on public.software_items;
drop policy if exists "Software visible to verified users or resource admins" on public.software_items;
create policy "Software visible to verified users or resource admins"
on public.software_items
for select
to authenticated
using (
  (
    status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
    and (select private.is_verified_member())
  )
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Active services visible to signed in users" on public.technical_services;
drop policy if exists "Active services visible to verified users" on public.technical_services;
create policy "Active services visible to verified users"
on public.technical_services
for select
to authenticated
using (
  (
    is_active = true
    and status = 'Aktif'
    and (select private.is_verified_member())
  )
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);
