# Backend Resources dan Software AT STRUCTURA - Opsi 1

Opsi ini memakai MEGA untuk menyimpan file besar dan Supabase untuk menyimpan metadata resource serta software.

## Alur Kerja

1. Upload file besar secara manual ke MEGA atau siapkan link resmi/legal.
2. Ambil share link dari MEGA atau URL resmi.
3. Buka `http://localhost:5500/pages/resource-login/` saat menjalankan lokal.
4. Login memakai akun admin Supabase.
5. Setelah berhasil, halaman akan masuk ke `http://localhost:5500/pages/admin/`.
6. Pilih menu `Resources` atau `Software`.
7. Isi metadata dan tempel link.
8. Pastikan status `Tersedia`, `Link Eksternal`, atau `Coming Soon` jika ingin langsung tampil di halaman publik.
9. Klik `Simpan Resource` atau `Simpan Software`.
10. Halaman `http://localhost:5500/pages/resources/` membaca tabel `resources`, sedangkan `http://localhost:5500/pages/software/` membaca tabel `software_items`.

Di Admin Dashboard, resource dan software yang sudah ada bisa diedit atau dihapus. Jika membuat item baru dengan judul yang sama, data akan diperbarui berdasarkan `slug`, bukan dibuat ganda.

## Status Setup Saat Ini

- Project Supabase aktif: `AT STRUCTURA`.
- URL project: `https://xpruvhfuyhnhdvlwiyye.supabase.co`.
- Tabel `resources`, `software_items`, dan `resource_admins` sudah tersedia.
- Email admin resource sudah aktif: `atstructura@gmail.com`.
- Metadata awal dari `data/resources.json` sudah dipindahkan ke Supabase.
- Metadata awal software dari `data/software.json` sudah dipindahkan ke Supabase.
- Firebase tidak digunakan pada opsi ini.

## File Penting

- `sql/supabase-resources.sql`: schema database, RLS, dan policy admin untuk resources.
- `sql/supabase-software.sql`: schema database, RLS, dan policy admin untuk software.
- `js/supabase-config.js`: konfigurasi public Supabase untuk frontend.
- `js/resources.js`: membaca resources dari Supabase, fallback ke JSON lokal.
- `js/software.js`: membaca software dari Supabase, fallback ke JSON lokal.
- `js/resource-login.js`: login admin Supabase sebelum masuk Admin Dashboard.
- `js/admin.js`: Admin Dashboard untuk tambah, edit, hapus Resources dan Software.

## Setup Supabase

Langkah ini sudah dikerjakan untuk project `AT STRUCTURA`. Simpan sebagai catatan jika suatu saat ingin membuat ulang dari awal:

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `sql/supabase-resources.sql`.
4. Jalankan isi file `sql/supabase-software.sql`.
5. Buka Authentication, buat user admin dengan email dan password.
6. Ambil `user_id` dari user admin.
7. Jalankan SQL berikut:

```sql
insert into public.resource_admins (user_id)
values ('USER_ID_ADMIN_DI_SINI');
```

8. Buka Project Settings > API Keys.
9. Salin Project URL dan publishable key.
10. Isi `js/supabase-config.js`:

```js
window.AT_SUPABASE = {
  enabled: true,
  url: 'https://xpruvhfuyhnhdvlwiyye.supabase.co',
  anonKey: 'PUBLISHABLE_KEY',
  resourcesTable: 'resources',
  softwareTable: 'software_items'
};
```

## Catatan Keamanan

- Jangan pernah memasukkan service role key ke frontend.
- Publishable key boleh ada di frontend karena akses dibatasi oleh RLS.
- User umum hanya bisa membaca resource/software dengan status `Coming Soon`, `Tersedia`, atau `Link Eksternal`.
- Hanya user yang ada di tabel `resource_admins` yang bisa insert, update, atau delete resource/software.
- Halaman login dan dashboard admin diberi `noindex` dan diblokir dari `robots.txt`, tetapi keamanan utama tetap berasal dari Supabase Auth dan RLS.
- File SNI, installer software, atau dokumen berlisensi jangan diupload ilegal ke MEGA.

## Status Publik

- `Draft`: belum tampil untuk user umum.
- `Coming Soon`: tampil untuk user umum sebagai penanda rencana/menunggu link.
- `Tersedia`: tampil untuk user umum.
- `Link Eksternal`: tampil untuk user umum.
- `Archived`: tidak tampil untuk user umum.
