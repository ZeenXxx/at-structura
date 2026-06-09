-- AT STRUCTURA payment proof details
-- Menyimpan metode pembayaran user dan rekening/e-wallet tujuan AT STRUCTURA.

alter table public.orders
  add column if not exists payment_source_type text,
  add column if not exists payment_source_name text,
  add column if not exists payment_account_number text,
  add column if not exists payment_account_name text,
  add column if not exists payment_destination text,
  add column if not exists payment_note text;

drop function if exists public.submit_payment_proof(uuid, text, text, text);
drop function if exists private.submit_payment_proof(uuid, text, text, text);

create or replace function private.submit_payment_proof(
  p_order_id uuid,
  p_bucket text,
  p_path text,
  p_file_name text,
  p_payment_source_type text default null,
  p_payment_source_name text default null,
  p_payment_account_number text default null,
  p_payment_account_name text default null,
  p_payment_destination text default null,
  p_payment_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user is null then
    raise exception 'Login dibutuhkan.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and user_id = v_user;

  if v_order.id is null then
    raise exception 'Order tidak ditemukan.';
  end if;

  if v_order.status not in ('pending_payment', 'rejected', 'payment_review') then
    raise exception 'Bukti pembayaran tidak bisa diubah untuk status order ini.';
  end if;

  if p_bucket <> 'at-structura-storage'
    or split_part(p_path, '/', 1) <> 'proofs'
    or split_part(p_path, '/', 2) <> v_user::text then
    raise exception 'Path bukti pembayaran tidak valid.';
  end if;

  update public.orders
  set
    proof_bucket = p_bucket,
    proof_path = p_path,
    proof_file_name = p_file_name,
    proof_uploaded_at = now(),
    status = 'payment_review',
    payment_source_type = nullif(trim(p_payment_source_type), ''),
    payment_source_name = nullif(trim(p_payment_source_name), ''),
    payment_account_number = nullif(trim(p_payment_account_number), ''),
    payment_account_name = nullif(trim(p_payment_account_name), ''),
    payment_destination = nullif(trim(p_payment_destination), ''),
    payment_note = nullif(trim(p_payment_note), '')
  where id = p_order_id;

  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_bucket text,
  p_path text,
  p_file_name text,
  p_payment_source_type text default null,
  p_payment_source_name text default null,
  p_payment_account_number text default null,
  p_payment_account_name text default null,
  p_payment_destination text default null,
  p_payment_note text default null
)
returns jsonb
language sql
set search_path to 'public', 'private'
as $function$
  select private.submit_payment_proof(
    p_order_id,
    p_bucket,
    p_path,
    p_file_name,
    p_payment_source_type,
    p_payment_source_name,
    p_payment_account_number,
    p_payment_account_name,
    p_payment_destination,
    p_payment_note
  );
$function$;
