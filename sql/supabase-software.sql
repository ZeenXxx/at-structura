-- AT STRUCTURA Software Catalog
-- File besar tetap bisa berada di MEGA atau link resmi, Supabase menyimpan metadata software.

create extension if not exists pgcrypto;

create table if not exists public.software_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  category text not null default 'Software Teknik Sipil',
  type text not null default 'Software',
  platform text not null default 'Windows',
  license text not null default 'Catatan/Referensi',
  version text,
  author text not null default 'AT STRUCTURA',
  description text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Tersedia', 'Link Eksternal', 'Coming Soon', 'Archived')),
  source_type text not null default 'official_link' check (source_type in ('mega_link', 'external_link', 'official_link')),
  link text,
  official_url text,
  mega_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists software_items_status_idx on public.software_items(status);
create index if not exists software_items_category_idx on public.software_items(category);
create index if not exists software_items_created_at_idx on public.software_items(created_at desc);
create index if not exists software_items_created_by_idx on public.software_items(created_by);

create or replace function public.set_software_items_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status in ('Tersedia', 'Link Eksternal') and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists software_items_set_updated_at on public.software_items;
create trigger software_items_set_updated_at
before insert or update on public.software_items
for each row execute function public.set_software_items_updated_at();

alter table public.software_items enable row level security;

drop policy if exists "Software visible to public or resource admins" on public.software_items;
create policy "Software visible to public or resource admins"
on public.software_items
for select
to anon, authenticated
using (
  status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Resource admins can insert software" on public.software_items;
create policy "Resource admins can insert software"
on public.software_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Resource admins can update software" on public.software_items;
create policy "Resource admins can update software"
on public.software_items
for update
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Resource admins can delete software" on public.software_items;
create policy "Resource admins can delete software"
on public.software_items
for delete
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);
