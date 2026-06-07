-- AT STRUCTURA Technical Services
-- Layanan teknis bisa ditampilkan/disembunyikan dari Admin Dashboard.

create extension if not exists pgcrypto;

create table if not exists public.technical_services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  icon text not null default 'JS',
  category text not null default 'Layanan Teknik Sipil',
  description text not null default '',
  status text not null default 'Aktif' check (status in ('Aktif', 'Nonaktif', 'Draft', 'Archived')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technical_services_status_idx on public.technical_services(status);
create index if not exists technical_services_active_idx on public.technical_services(is_active);
create index if not exists technical_services_sort_idx on public.technical_services(sort_order, created_at desc);
create index if not exists technical_services_created_by_idx on public.technical_services(created_by);

create or replace function public.set_technical_services_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists technical_services_set_updated_at on public.technical_services;
create trigger technical_services_set_updated_at
before insert or update on public.technical_services
for each row execute function public.set_technical_services_updated_at();

alter table public.technical_services enable row level security;

grant select on public.technical_services to anon;
grant select, insert, update, delete on public.technical_services to authenticated;

drop policy if exists "Active services are public" on public.technical_services;
create policy "Active services are public"
on public.technical_services
for select
to anon, authenticated
using (
  is_active = true
  and status = 'Aktif'
);

drop policy if exists "Resource admins can read all services" on public.technical_services;
create policy "Resource admins can read all services"
on public.technical_services
for select
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Resource admins can insert services" on public.technical_services;
create policy "Resource admins can insert services"
on public.technical_services
for insert
to authenticated
with check (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Resource admins can update services" on public.technical_services;
create policy "Resource admins can update services"
on public.technical_services
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

drop policy if exists "Resource admins can delete services" on public.technical_services;
create policy "Resource admins can delete services"
on public.technical_services
for delete
to authenticated
using (
  exists (
    select 1 from public.resource_admins
    where user_id = (select auth.uid())
  )
);

insert into public.technical_services (title, slug, icon, category, description, status, is_active, sort_order)
values
  ('Tutor Teknik Sipil', 'tutor-teknik-sipil', 'TU', 'Pembelajaran', 'Pendampingan konsep, penyelesaian soal, dan pembahasan bertahap agar pengguna paham prosesnya.', 'Aktif', true, 10),
  ('Drafting Gambar Teknik', 'drafting-gambar-teknik', 'DG', 'Drafting', 'Pembuatan dan perapian gambar teknis dengan layer, dimensi, layout, dan plotting yang konsisten.', 'Aktif', true, 20),
  ('Asistensi Software Teknik Sipil', 'asistensi-software-teknik-sipil', 'SW', 'Software', 'Pendampingan ETABS, SAP2000, AutoCAD, Civil 3D, HEC-RAS, QGIS, dan workflow output.', 'Aktif', true, 30),
  ('Pendampingan Akademik Teknik Sipil', 'pendampingan-akademik-teknik-sipil', 'PA', 'Akademik', 'Merapikan alur belajar, referensi, template, dan pemahaman teknis untuk kebutuhan akademik.', 'Aktif', true, 40),
  ('Template Akademik', 'template-akademik', 'TA', 'Template', 'Template perhitungan, rekap data, ringkasan materi, dan dokumen teknis yang mudah dipakai ulang.', 'Aktif', true, 50),
  ('Pembuatan Web Tools Teknik Sipil', 'pembuatan-web-tools-teknik-sipil', 'WT', 'Web Tools', 'Kalkulator, converter, tabel bantu, dan visualisasi berbasis browser untuk kebutuhan Teknik Sipil.', 'Aktif', true, 60),
  ('Konsultasi Perhitungan Dasar', 'konsultasi-perhitungan-dasar', 'KD', 'Konsultasi', 'Diskusi asumsi, satuan, alur hitung, dan interpretasi hasil tahap awal.', 'Aktif', true, 70),
  ('Visualisasi Gambar Teknik', 'visualisasi-gambar-teknik', 'VG', 'Visualisasi', 'Merapikan gambar, diagram, skema alur, dan visual teknis agar lebih mudah dipresentasikan.', 'Aktif', true, 80)
on conflict (slug) do update set
  title = excluded.title,
  icon = excluded.icon,
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order;
