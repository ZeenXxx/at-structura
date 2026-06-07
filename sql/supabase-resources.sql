-- AT STRUCTURA Resource Catalog (Opsi 1: file besar di MEGA, metadata di Supabase)
-- Jalankan di Supabase SQL Editor.
-- Setelah membuat user admin di Supabase Auth, masukkan user_id admin ke tabel resource_admins.

create extension if not exists pgcrypto;

create table if not exists public.resource_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  category text not null,
  type text not null,
  author text not null default 'AT STRUCTURA',
  description text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Tersedia', 'Link Eksternal', 'Coming Soon', 'Archived')),
  source_type text not null default 'mega_link' check (source_type in ('mega_link', 'external_link', 'official_link')),
  link text,
  mega_url text,
  external_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists resources_status_idx on public.resources(status);
create index if not exists resources_category_idx on public.resources(category);
create index if not exists resources_created_at_idx on public.resources(created_at desc);
create index if not exists resources_created_by_idx on public.resources(created_by);

create or replace function public.set_resources_updated_at()
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

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
before insert or update on public.resources
for each row execute function public.set_resources_updated_at();

alter table public.resources enable row level security;
alter table public.resource_admins enable row level security;

drop policy if exists "Admins can read all resources" on public.resources;
drop policy if exists "Published resources are public" on public.resources;
drop policy if exists "Resources visible to public or resource admins" on public.resources;
create policy "Resources visible to public or resource admins"
on public.resources
for select
to anon, authenticated
using (
  status in ('Tersedia', 'Link Eksternal', 'Coming Soon')
  or exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can insert resources" on public.resources;
drop policy if exists "Resource admins can insert resources" on public.resources;
create policy "Resource admins can insert resources"
on public.resources
for insert
to authenticated
with check (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can update resources" on public.resources;
drop policy if exists "Resource admins can update resources" on public.resources;
create policy "Resource admins can update resources"
on public.resources
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

drop policy if exists "Admins can delete resources" on public.resources;
drop policy if exists "Resource admins can delete resources" on public.resources;
create policy "Resource admins can delete resources"
on public.resources
for delete
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can read admin list" on public.resource_admins;
drop policy if exists "Resource admins can read own admin row" on public.resource_admins;
create policy "Resource admins can read own admin row"
on public.resource_admins
for select
to authenticated
using (user_id = (select auth.uid()));

-- Contoh setelah membuat akun admin di Supabase Auth:
-- insert into public.resource_admins (user_id) values ('ISI_USER_ID_ADMIN_DI_SINI');

-- Contoh seed dari resources lama:
-- insert into public.resources (title, category, type, author, description, status, source_type, link, external_url)
-- values ('Judul Resource', 'SNI', 'PDF', 'AT STRUCTURA', 'Deskripsi resource.', 'Link Eksternal', 'mega_link', 'https://mega.nz/file/...', 'https://mega.nz/file/...');
