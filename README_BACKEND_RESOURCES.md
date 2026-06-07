# Backend Resources AT STRUCTURA - Opsi 1

Opsi ini memakai MEGA untuk menyimpan file besar dan Supabase untuk menyimpan metadata resource.

## Alur Kerja

1. Upload file besar secara manual ke MEGA.
2. Ambil share link dari MEGA.
3. Buka `http://localhost:5500/pages/resource-login/` saat menjalankan lokal.
4. Login memakai akun admin Supabase.
5. Setelah berhasil, halaman akan masuk ke `http://localhost:5500/pages/resource-upload/`.
6. Isi metadata resource dan tempel link MEGA.
7. Pastikan status `Tersedia`, `Link Eksternal`, atau `Coming Soon` jika ingin langsung tampil di halaman Resources.
8. Klik `Simpan Resource`.
9. Halaman `http://localhost:5500/pages/resources/` membaca data dari Supabase.

Di Resource Manager, resource yang sudah ada bisa diedit atau dihapus. Jika membuat resource baru dengan judul yang sama, data akan diperbarui berdasarkan `slug`, bukan dibuat ganda.

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
- `js/resource-login.js`: login admin Supabase sebelum masuk Resource Manager.
- `js/resource-upload.js`: Resource Manager untuk tambah, edit, hapus, dan simpan metadata link MEGA ke Supabase.

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
- Halaman login dan manager diberi `noindex` dan diblokir dari `robots.txt`, tetapi keamanan utama tetap berasal dari Supabase Auth dan RLS.
- File SNI atau dokumen berlisensi jangan diupload ilegal ke MEGA.

## Status Resource

- `Draft`: belum tampil untuk user umum.
- `Coming Soon`: tampil untuk user umum sebagai penanda rencana/menunggu link.
- `Tersedia`: tampil untuk user umum.
- `Link Eksternal`: tampil untuk user umum.
- `Archived`: tidak tampil untuk user umum.
