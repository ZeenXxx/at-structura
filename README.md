# AT STRUCTURA

AT STRUCTURA adalah web pribadi Arief Tediansyah untuk belajar, tools, resources, portfolio, dan layanan pendukung Teknik Sipil.

## Fokus Project

- Tutorial dan learning path Teknik Sipil.
- Tools perhitungan dan pengelolaan file untuk bantuan awal.
- Resources SNI, regulasi, software, template, modul, video, dan website rujukan.
- Portfolio project pribadi dan dokumentasi proses.
- Layanan tutor, drafting, asistensi software, template, konsultasi perhitungan dasar, dan web tools Teknik Sipil.

## Struktur Folder

- `index.html` halaman utama.
- `pages/` halaman About, Tools, Resources, Jasa, Portfolio, Contact, dan halaman admin resource tersembunyi.
- `tools/` halaman tools mandiri hasil adaptasi.
- `css/` styling global, navbar, home, pages, dan tools.
- `js/` script interaksi lokal, resources, portfolio, kontak, dan tools.
- `data/` data JSON untuk resources, tools, video, dan portfolio.
- `assets/logo/` logo utama AT STRUCTURA.
- `assets/images/arief.png` foto profil Arief.

## Cara Menjalankan Lokal

1. Buka folder project ini di VS Code.
2. Install extension Live Server jika belum ada.
3. Klik kanan `index.html`.
4. Pilih `Open with Live Server`.

## Kontak

- WhatsApp: 081220032582
- Email: arieftediansyah0@gmail.com
- Instagram: arieftediansyah_
- YouTube: Arief Tediansyah dan ZeenXxx

## Catatan

Tahap ini adalah project web lokal statis. Tools bersifat bantuan awal dan hasilnya wajib diverifikasi kembali berdasarkan standar terbaru, asumsi desain, kombinasi beban, data lapangan, serta pertimbangan engineer.
## Resource Manager

Halaman `pages/resource-login/` adalah pintu login admin resource. Setelah login, admin masuk ke `pages/resource-upload/` untuk menambah, mengedit, menghapus, preview, copy JSON, dan download data resource.

Data resource disimpan di Supabase, sedangkan file besar disimpan di MEGA melalui link. Halaman admin diberi `noindex`, tetapi keamanan utamanya tetap berasal dari Supabase Auth dan RLS.
