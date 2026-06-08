-- AT STRUCTURA - Member account status controls
-- Migration ini sudah diterapkan ke Supabase project xpruvhfuyhnhdvlwiyye
-- dengan nama: member_account_status_controls
--
-- Tujuan:
-- 1. Menyimpan status suspend akun member.
-- 2. Menyimpan catatan soft-delete profil bila diperlukan.
-- 3. Dipakai oleh admin dashboard dan Edge Function admin-account-action.

alter table public.member_profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid,
  add column if not exists suspend_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists member_profiles_suspended_at_idx
  on public.member_profiles (suspended_at)
  where suspended_at is not null;

create index if not exists member_profiles_deleted_at_idx
  on public.member_profiles (deleted_at)
  where deleted_at is not null;
