# Backend Resources AT STRUCTURA - Opsi 1

Opsi ini memakai MEGA untuk menyimpan file besar dan Supabase untuk menyimpan metadata resource.

## Alur Kerja

1. Upload file besar secara manual ke MEGA.
2. Ambil share link dari MEGA.
3. Buka `http://localhost:5500/pages/resource-upload/` saat menjalankan lokal.
4. Login memakai akun admin Supabase.
5. Isi metadata resource dan tempel link MEGA.
6. Klik `Simpan ke Supabase`.
7. Halaman `http://localhost:5500/pages/resources/` membaca data dari Supabase.

## Status Setup Saat Ini

- Project Supabase aktif: `AT STRUCTURA`.
- URL project: `https://xpruvhfuyhnhdvlwiyye.supabase.co`.
- Tabel `resources` dan `resource_admins` sudah tersedia.
- Email admin resource sudah aktif: `arieftediansyah0@gmail.com`.
- Metadata awal dari `data/resources.json` sudah dipindahkan ke Supabase.
- Firebase tidak digunakan pada opsi ini.

## File Penting

- `sql/supabase-resources.sql`: schema database, RLS, dan policy admin.
- `js/supabase-config.js`: konfigurasi public Supabase untuk frontend.
- `js/resources.js`: membaca resources dari Supabase, fallback ke JSON lokal.
- `js/resource-upload.js`: Resource Manager untuk simpan metadata link MEGA ke Supabase.

## Setup Supabase

Langkah ini sudah dikerjakan untuk project `AT STRUCTURA`. Simpan sebagai catatan jika suatu saat ingin membuat ulang dari awal:

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `sql/supabase-resources.sql`.
4. Buka Authentication, buat user admin dengan email dan password.
5. Ambil `user_id` dari user admin.
6. Jalankan SQL berikut:

```sql
insert into public.resource_admins (user_id)
values ('USER_ID_ADMIN_DI_SINI');
```

7. Buka Project Settings > API Keys.
8. Salin Project URL dan publishable key.
9. Isi `js/supabase-config.js`:

```js
window.AT_SUPABASE = {
  enabled: true,
  url: 'https://xpruvhfuyhnhdvlwiyye.supabase.co',
  anonKey: 'PUBLISHABLE_KEY',
  resourcesTable: 'resources'
};
```

## Catatan Keamanan

- Jangan pernah memasukkan service role key ke frontend.
- Publishable key boleh ada di frontend karena akses dibatasi oleh RLS.
- User umum hanya bisa membaca resource dengan status `Coming Soon`, `Tersedia`, atau `Link Eksternal`.
- Hanya user yang ada di tabel `resource_admins` yang bisa insert, update, atau delete resource.
- File SNI atau dokumen berlisensi jangan diupload ilegal ke MEGA.

## Status Resource

- `Draft`: belum tampil untuk user umum.
- `Coming Soon`: tampil untuk user umum sebagai penanda rencana/menunggu link.
- `Tersedia`: tampil untuk user umum.
- `Link Eksternal`: tampil untuk user umum.
- `Archived`: tidak tampil untuk user umum.
