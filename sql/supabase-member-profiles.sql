-- AT STRUCTURA Member Profiles
-- Menyimpan ringkasan akun member untuk dashboard admin.

create schema if not exists private;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  institution text,
  source text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_profiles_email_idx on public.member_profiles(email);
create index if not exists member_profiles_created_at_idx on public.member_profiles(created_at desc);
create index if not exists member_profiles_email_confirmed_idx on public.member_profiles(email_confirmed_at);

create or replace function private.sync_member_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = auth, public, private
as $$
begin
  insert into public.member_profiles (
    user_id,
    email,
    full_name,
    phone,
    institution,
    source,
    email_confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'institution', ''),
    nullif(new.raw_user_meta_data ->> 'source', ''),
    new.email_confirmed_at,
    new.last_sign_in_at,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    institution = excluded.institution,
    source = excluded.source,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_member_profile_from_auth() from public, anon, authenticated;

drop trigger if exists auth_users_sync_member_profile on auth.users;
create trigger auth_users_sync_member_profile
after insert or update of email, raw_user_meta_data, email_confirmed_at, last_sign_in_at on auth.users
for each row execute function private.sync_member_profile_from_auth();

insert into public.member_profiles (
  user_id,
  email,
  full_name,
  phone,
  institution,
  source,
  email_confirmed_at,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  coalesce(email, ''),
  nullif(raw_user_meta_data ->> 'full_name', ''),
  nullif(raw_user_meta_data ->> 'phone', ''),
  nullif(raw_user_meta_data ->> 'institution', ''),
  nullif(raw_user_meta_data ->> 'source', ''),
  email_confirmed_at,
  last_sign_in_at,
  coalesce(created_at, now()),
  now()
from auth.users
on conflict (user_id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  phone = excluded.phone,
  institution = excluded.institution,
  source = excluded.source,
  email_confirmed_at = excluded.email_confirmed_at,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

alter table public.member_profiles enable row level security;

grant select on public.member_profiles to authenticated;

drop policy if exists "Members can read own profile" on public.member_profiles;
create policy "Members can read own profile"
on public.member_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Resource admins can read all member profiles" on public.member_profiles;
create policy "Resource admins can read all member profiles"
on public.member_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);
