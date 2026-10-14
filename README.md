# Aplikasi Pelatihan Online MAD-R

**Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat Menggunakan R, RStudio & Quarto**

Frontend statis di **GitHub Pages**, backend **Google Apps Script** (Google Sheets + Drive + Gmail): gratis, tanpa server.
Desain mengikuti template slide `../ppt/theme/mad-theme.scss` (navy–nila, ungu–magenta–cyan, Poppins + Plus Jakarta Sans).

| Halaman | Untuk | Fungsi |
|---|---|---|
| `index.html` | Publik | Landing: hero, kuota kursi live, alur, fasilitas, kurikulum 20 modul, jadwal 6 sesi, biaya per kategori, FAQ |
| `daftar.html` | Calon peserta | Formulir pendaftaran (unggah KTM untuk mahasiswa) → tagihan dengan **3 digit kode unik** → rekening → unggah bukti transfer |
| `konfirmasi.html` | Calon peserta | Unggah bukti transfer belakangan & cek status (no. pendaftaran + email/WA) |
| `masuk.html` | Peserta | Login dengan email + **kode akses**; kirim ulang kode ke email |
| `portal.html` | Peserta aktif | 20 modul slide, progres belajar, jadwal + tautan Zoom & grup WA, unduh Paket Latihan, sertifikat, profil |
| `materi/view.html` | Peserta aktif | Membuka slide Quarto yang **terenkripsi** |
| `sertifikat.html` | Peserta / publik | Cetak e-sertifikat (PDF) & **verifikasi keaslian** berdasarkan nomor |
| `admin.html` | Admin | KPI, grafik harian/kategori/provinsi, filter & cari, lihat bukti transfer & KTM, verifikasi → kode akses otomatis terkirim, tandai lulus → nomor sertifikat, kirim kode/pengingat via WA, ekspor CSV |

### Alur status peserta
```
Menunggu Pembayaran → (unggah bukti) → Menunggu Verifikasi → (admin verifikasi) → Aktif → (admin) → Lulus
                                                                              ↘ Dibatalkan
```
- **Aktif**: server membuat kode akses `XXXX-XXXX` dan mengirim email berisi kode + tautan portal.
- **Lulus**: server memberi nomor sertifikat `MAD-R/2026/0001`, dst.
- Dashboard menandai ⚠ bila jumlah transfer berbeda dari tagihan.

### Bagaimana materi dilindungi
Situs GitHub Pages bersifat publik, jadi slide **tidak** disalin apa adanya. `tools/build-materi.mjs` mengenkripsi setiap deck
(AES-256-GCM, gambar & grafik ditanam di dalamnya) dan Paket Latihan (.zip). Kuncinya hanya ada di file lokal `.materi-key`
(tidak di-commit) dan di Script Properties Apps Script. Server memberikan kunci hanya kepada peserta berstatus **Aktif/Lulus**
yang login dengan kode akses benar; browser peserta lalu mendekripsi materi. Pustaka revealjs (publik) disimpan biasa di `materi/libs/`.

> Catatan: peserta yang sudah memiliki akses secara teknis tetap bisa menyimpan isi slide (sama seperti PDF). Nama & email peserta
> ditampilkan samar di pojok slide sebagai pengingat. Untuk mencabut akses semua orang sekaligus: hapus `.materi-key`, build ulang,
> lalu perbarui `MATERI_KEY` — peserta aktif cukup keluar-masuk lagi.

```
├── index.html, daftar.html, konfirmasi.html, masuk.html, portal.html, sertifikat.html, admin.html
├── assets/
│   ├── config.js      ← BIAYA, KUOTA, JADWAL, REKENING, WA, FAQ — edit di sini
│   ├── style.css      ← tema MAD (dari template ppt)
│   ├── api.js         ← koneksi Apps Script / mode demo
│   ├── common.js      ← header, footer, unggah bukti
│   ├── materi.js      ← dekripsi materi di browser
│   ├── admin.js       ← dashboard
│   ├── gas-mock.js    ← tiruan layanan Google (mode demo & uji)
│   └── cover.jpg
├── materi/            ← HASIL BUILD (jangan diedit manual)
│   ├── enc/*.bin      ← 20 deck + paket latihan terenkripsi
│   ├── libs/          ← revealjs
│   ├── catalog.js     ← judul modul (dibaca dari ppt/index.qmd)
│   └── view.html
├── apps-script/Code.gs  ← backend (ditempel ke Google Apps Script)
└── tools/
    ├── build-materi.mjs ← build & enkripsi materi dari ../ppt
    ├── test-backend.mjs ← 41 uji otomatis backend
    └── view.html        ← sumber materi/view.html
```

---

## Langkah 1 — Coba di komputer (mode demo)

Selama `API_URL` di `assets/config.js` kosong, aplikasi berjalan dalam **mode demo**: `apps-script/Code.gs` yang asli dijalankan
di browser dengan data tersimpan di localStorage — jadi perilakunya sama dengan server sungguhan.

```bash
cd ~/Github/workmad
node tools/build-materi.mjs ../ppt
python3 -m http.server 8765
```
Buka <http://localhost:8765>. Di `admin.html` klik **Isi data contoh**, masuk dengan **`admin123`**.
Tombol **✉ Kotak email (demo)** menampilkan email yang "terkirim" (tagihan & kode akses) — pakai kode akses dari sana untuk mencoba portal.

Uji backend otomatis:
```bash
node tools/test-backend.mjs
```

## Langkah 2 — Build materi dari folder ppt

Setiap kali slide di `~/Github/ppt` diubah: render di RStudio/Quarto dulu, lalu
```bash
node tools/build-materi.mjs ../ppt
```
Build pertama membuat `.materi-key` (simpan baik-baik; jangan di-commit). Kunci tetap sama di build berikutnya.

## Langkah 3 — Siapkan backend Google Apps Script

1. Buka <https://sheets.new> → beri nama, mis. *Peserta Pelatihan MAD-R*.
2. **Extensions → Apps Script**. Hapus isi `Code.gs`, tempel isi `apps-script/Code.gs`, simpan.
3. Sesuaikan bagian `CONFIG` di atas file (biaya, kuota, `CLOSE_DATE`, `SITE_URL` = alamat GitHub Pages Anda, `NOTIFY_EMAIL`).
4. **Project Settings (⚙) → Script Properties → Add property**:

   | Property | Nilai |
   |---|---|
   | `ADMIN_KEY` | kunci rahasia dashboard (panjang & sulit ditebak) |
   | `MATERI_KEY` | isi file `.materi-key` (`cat .materi-key`) |
   | `ZOOM_LINK` | tautan Zoom pelatihan (opsional, hanya terlihat oleh peserta aktif) |
   | `WA_GROUP_LINK` | tautan grup WhatsApp peserta (opsional) |

5. Pilih fungsi **`setup`** → **▶ Run** → *Review permissions* → pilih akun → *Advanced* → *Go to … (unsafe)* → **Allow**
   (izin Sheets, Drive, Gmail). Folder Drive **"Bukti Pembayaran Pelatihan MAD-R"** dibuat otomatis (privat).
6. **Deploy → New deployment** → tipe **Web app** → *Execute as*: **Me**, *Who has access*: **Anyone** → **Deploy** → salin **Web app URL** (`…/exec`).
7. Tempel ke `assets/config.js`:
   ```js
   API_URL: "https://script.google.com/macros/s/XXXX/exec",
   ```

> Setiap kali `Code.gs` diubah: **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy** (URL tetap).
> Kuota email gratis Gmail ±100 email/hari (akun biasa). Bila habis, kirim kode via tombol **💬 Kirim kode via WA** di dashboard.

## Langkah 4 — Sesuaikan isi

`assets/config.js`: `TRAINING` (angkatan, tanggal tutup), `CATEGORIES` (biaya), `QUOTA`, `SESSIONS` (jadwal), `BENEFITS`, `FAQ`,
`PAYMENT` (rekening), `ADMIN_WA`. **Samakan** `CATEGORIES`, `QUOTA`, `CLOSE_DATE` dengan `CONFIG` di `Code.gs` — server menghitung
ulang tagihan sehingga harga tidak bisa dimanipulasi dari browser.

## Langkah 5 — Publikasikan di GitHub Pages

```bash
git add .
git commit -m "Aplikasi pelatihan online MAD-R"
git branch -M main
git remote add origin https://github.com/profdef/workmad.git
git push -u origin main
```
Di GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
Situs aktif di `https://profdef.github.io/workmad/`, dashboard di `…/workmad/admin.html`. Pastikan `CONFIG.SITE_URL` di `Code.gs` sama.

## Langkah 6 — Uji coba produksi sebelum promosi

1. Daftar sebagai peserta uji di situs → cek email tagihan.
2. Unggah bukti (screenshot apa saja) → cek file muncul di folder Drive.
3. Di `admin.html`: **Detail → Lihat bukti → ✓ Verifikasi & aktifkan akses** → cek email kode akses.
4. Login di `masuk.html` → buka beberapa modul & unduh Paket Latihan → kolom *Modul* di dashboard bertambah.
5. **🎓 Tandai Lulus** → unduh sertifikat di portal → cek nomor di `sertifikat.html`.
6. Hapus peserta uji (🗑) agar kuota kembali penuh.

## Operasional harian

- Chip merah **Perlu verifikasi** di dashboard → **Detail → Lihat bukti** → cocokkan dengan mutasi rekening (nominal unik) → **✓ Verifikasi & aktifkan akses**.
- Peserta belum bayar → **💬 Ingatkan pembayaran via WA**.
- Peserta lupa kode → mereka klik *Kirim ulang ke email* di halaman masuk, atau Anda kirim via WA.
- Selesai pelatihan → **🎓 Tandai Lulus** (perbaiki dulu *Nama di sertifikat* bila perlu).
- **⬇ Ekspor CSV** untuk daftar hadir/laporan keuangan.

## Keamanan

- Data peserta hanya di Google Sheet Anda; bukti transfer & KTM di folder Drive privat — **tidak** di repo GitHub.
- `Code.gs` ikut ter-publish di repo, jadi **jangan** menulis kunci, tautan Zoom, atau rahasia lain di dalamnya — pakai Script Properties.
- Dashboard hanya menampilkan data bila `ADMIN_KEY` benar (dicek di server; tebakan salah diperlambat).
- Halaman publik tidak pernah mengembalikan email/WA/kode akses; *lupa kode* memberi jawaban yang sama untuk email terdaftar maupun tidak.
- Jangan commit `.materi-key` dan `assets/demo-key.js` (sudah di `.gitignore`).
