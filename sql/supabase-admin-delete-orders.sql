-- AT STRUCTURA - Admin testing order cleanup
-- Migration ini sudah diterapkan ke Supabase project xpruvhfuyhnhdvlwiyye
-- dengan nama: admin_can_delete_testing_orders
--
-- Tujuan:
-- 1. Admin bisa menghapus order testing.
-- 2. Admin bisa menghapus item order terkait.
-- 3. Admin bisa mencabut akses member dari order testing.
--
-- Catatan:
-- File bukti pembayaran tetap harus dihapus melalui Supabase Storage API,
-- bukan SQL, agar objek storage tidak tertinggal sebagai orphan file.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Resource admins can delete orders'
  ) then
    create policy "Resource admins can delete orders"
      on public.orders
      for delete
      to authenticated
      using (private.is_resource_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'Resource admins can delete order items'
  ) then
    create policy "Resource admins can delete order items"
      on public.order_items
      for delete
      to authenticated
      using (private.is_resource_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_access'
      and policyname = 'Resource admins can delete member access'
  ) then
    create policy "Resource admins can delete member access"
      on public.member_access
      for delete
      to authenticated
      using (private.is_resource_admin());
  end if;
end $$;
