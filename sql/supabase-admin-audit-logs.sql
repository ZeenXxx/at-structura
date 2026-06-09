-- AT STRUCTURA admin audit log
-- Jalankan di Supabase SQL Editor setelah tabel admin/resource_admins sudah ada.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_table text,
  target_id text,
  target_title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs (action);
create index if not exists admin_audit_logs_admin_user_id_idx on public.admin_audit_logs (admin_user_id);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_table, target_id);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
on public.admin_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.resource_admins admins
    where admins.user_id = auth.uid()
  )
);

drop policy if exists "Admins can insert audit logs" on public.admin_audit_logs;
create policy "Admins can insert audit logs"
on public.admin_audit_logs
for insert
to authenticated
with check (
  admin_user_id = auth.uid()
  and exists (
    select 1
    from public.resource_admins admins
    where admins.user_id = auth.uid()
  )
);

grant select, insert on public.admin_audit_logs to authenticated;
