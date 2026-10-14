/* =========================================================
   KONFIGURASI APLIKASI PELATIHAN ONLINE
   Ubah nilai-nilai di bawah ini sesuai kebutuhan Anda.
   PENTING: harga kategori, kuota, dan jadwal juga ada di
   apps-script/Code.gs (bagian CONFIG) — samakan keduanya,
   karena server menghitung ulang tagihan agar tidak bisa dimanipulasi.
   ========================================================= */
window.APP_CONFIG = {
  // URL Web App Google Apps Script (lihat README).
  // Biarkan kosong "" untuk MODE DEMO (data disimpan di browser saja).
  API_URL: "https://script.google.com/macros/s/AKfycbzwUaZ6NYVPwNe-A9OV_AilgujQLiwoVx-4we33sSWNGlGbk0sKDJcPU1R7--X1pkKCWw/exec",

  TRAINING: {
    title: "Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat",
    subtitle: "Menggunakan R, RStudio & Quarto",
    batch: "Angkatan I · November 2026",
    mode: "Online (Zoom) + akses materi mandiri",
    hours: "6 sesi × 3 jam (18 JP)",
    instructor: "Prof. Defriman Djafri, SKM, MKM, PhD",
    signature: "assets/brand/ttd-narasumber.png", // tanda tangan narasumber di sertifikat (PNG transparan)
    email: "info@publichealth.id",          // email resmi penyelenggara (footer, invoice, kuitansi)
    closeDate: "2026-11-05", // pendaftaran ditutup setelah tanggal ini (YYYY-MM-DD, WIB)
  },

  // Penyelenggara (logo & moto dari https://publichealth.id)
  ORGANIZER: {
    name: "publichealth.id",
    url: "https://publichealth.id/id/index.html",
    motto: "Better Health, Brighter Future",
    logo: "assets/brand/logo-full.png",          // untuk latar terang (sertifikat)
    logoDark: "assets/brand/logo-full-dark.png", // untuk latar gelap (web)
    icon: "assets/brand/favicon.png",
  },

  // Kategori peserta & biaya (Rp). Samakan dengan CONFIG.CATEGORIES di Code.gs.
  CATEGORIES: {
    "Mahasiswa (S1/S2/S3)":            { price: 350000, note: "Wajib unggah KTM aktif saat konfirmasi" },
    "Dosen / Peneliti / Tenaga Kesehatan": { price: 500000, note: "" },
    "Umum / Instansi":                 { price: 650000, note: "" },
  },

  // Kuota kursi. Samakan dengan CONFIG.QUOTA di Code.gs.
  QUOTA: 100,

  // Jadwal sesi live (tautan Zoom TIDAK ditulis di sini — hanya dikirim server ke peserta aktif).
  SESSIONS: [
    { date: "Sabtu, 7 November 2026",  time: "09.00–12.00 WIB", topic: "Pengantar & Konsep Dasar Data", decks: "Pengantar, Bab 1–5" },
    { date: "Minggu, 8 November 2026", time: "09.00–12.00 WIB", topic: "R, RStudio & Quarto", decks: "Bab 6–8" },
    { date: "Sabtu, 14 November 2026", time: "09.00–12.00 WIB", topic: "Manajemen Data di R", decks: "Bab 9–11" },
    { date: "Minggu, 15 November 2026", time: "09.00–12.00 WIB", topic: "Analisis Univariat & Bivariat", decks: "Bab 12–13" },
    { date: "Sabtu, 21 November 2026", time: "09.00–12.00 WIB", topic: "Tabel 2×2, Ukuran Asosiasi & Multivariat", decks: "Bab 14–15" },
    { date: "Minggu, 22 November 2026", time: "09.00–12.00 WIB", topic: "Studi Kasus & Laporan Otomatis Quarto", decks: "Bab 16–18" },
  ],

  BENEFITS: [
    "Akses 20 modul presentasi interaktif (slide Quarto revealjs)",
    "Paket latihan RStudio: dataset epidemiologi, R/setup.R & file .qmd",
    "6 sesi live via Zoom bersama narasumber",
    "E-sertifikat 18 JP dengan nomor verifikasi online",
    "Grup diskusi WhatsApp peserta",
    "Akses materi tetap terbuka setelah pelatihan selesai",
  ],

  FAQ: [
    ["Apakah perlu pengalaman pemrograman?", "Tidak. Pelatihan dimulai dari instalasi R & RStudio dan dasar pemrograman. Cukup terbiasa dengan Excel."],
    ["Perangkat apa yang dibutuhkan?", "Laptop (Windows/macOS/Linux) dengan RAM minimal 4 GB dan koneksi internet stabil. R, RStudio & Quarto gratis."],
    ["Bagaimana akses materi setelah membayar?", "Setelah bukti transfer diverifikasi, Anda menerima kode akses lewat email/WhatsApp. Masuk di halaman Portal Peserta dengan email + kode akses."],
    ["Berapa lama verifikasi pembayaran?", "Umumnya 1×24 jam pada hari kerja. Pastikan jumlah transfer sama persis dengan tagihan (termasuk 3 digit kode unik)."],
    ["Bagaimana mendapatkan sertifikat?", "Sertifikat terbit setelah peserta mengikuti sesi & menyelesaikan tugas akhir. Sertifikat dapat diunduh dari Portal Peserta dan diverifikasi online."],
    ["Bisakah instansi mendaftarkan beberapa peserta?", "Bisa. Setiap peserta mendaftar sendiri agar mendapat kode akses & sertifikat atas namanya. Hubungi admin untuk invoice kolektif."],
  ],

  // Formulir evaluasi pelatihan (model Kirkpatrick level 1–2). Kunci butir harus sama dengan EVAL di Code.gs.
  EVALUATION: {
    scale: ["Sangat kurang", "Kurang", "Cukup", "Baik", "Sangat baik"],
    sections: [
      { id: "a", title: "Penyelenggaraan", desc: "Proses pendaftaran, pembayaran, jadwal, dan platform pelatihan.", items: [
        ["a1", "Kejelasan informasi & kemudahan proses pendaftaran"],
        ["a2", "Kemudahan pembayaran & kecepatan verifikasi"],
        ["a3", "Ketepatan waktu & kesesuaian jadwal sesi"],
        ["a4", "Kualitas penyelenggaraan sesi live (Zoom, audio, visual)"],
        ["a5", "Kemudahan mengakses materi di Portal Peserta"] ] },
      { id: "b", title: "Materi Pelatihan", desc: "Isi, sistematika, dan kualitas modul.", items: [
        ["b1", "Relevansi materi dengan pekerjaan/studi saya"],
        ["b2", "Kedalaman & kelengkapan materi"],
        ["b3", "Sistematika & alur materi dari dasar ke lanjut"],
        ["b4", "Kualitas slide dan contoh kode R"],
        ["b5", "Kesesuaian dataset & studi kasus epidemiologi"] ] },
      { id: "c", title: "Narasumber", desc: "Prof. Defriman Djafri, SKM, MKM, PhD", items: [
        ["c1", "Penguasaan materi"],
        ["c2", "Kejelasan penyampaian & penjelasan konsep"],
        ["c3", "Interaksi & tanggapan terhadap pertanyaan peserta"],
        ["c4", "Pengelolaan waktu sesi"] ] },
      { id: "s", title: "Penilaian per Sesi", desc: "Pilih “Tidak hadir” bila Anda tidak mengikuti sesi tersebut secara live.", type: "session", items: [
        ["s1", "Sesi 1 · Pengantar & Konsep Dasar Data"],
        ["s2", "Sesi 2 · R, RStudio & Quarto"],
        ["s3", "Sesi 3 · Manajemen Data di R"],
        ["s4", "Sesi 4 · Analisis Univariat & Bivariat"],
        ["s5", "Sesi 5 · Tabel 2×2, Ukuran Asosiasi & Multivariat"],
        ["s6", "Sesi 6 · Studi Kasus & Laporan Otomatis Quarto"] ] },
    ],
    competencies: [
      ["k1", "Merancang manajemen & tata kelola data penelitian"],
      ["k2", "Mengimpor, membersihkan & mentransformasi data di R"],
      ["k3", "Melakukan analisis univariat & bivariat"],
      ["k4", "Menghitung ukuran asosiasi & regresi logistik"],
      ["k5", "Membuat visualisasi data epidemiologi (ggplot2)"],
      ["k6", "Menyusun laporan reproducible dengan Quarto"],
    ],
    competencyScale: ["Belum mampu", "Sedikit", "Cukup", "Mampu", "Sangat mampu"],
  },

  PROFESSIONS: ["Mahasiswa", "Dosen", "Peneliti", "Epidemiolog", "Tenaga Kesehatan (Puskesmas/RS)", "Dinas Kesehatan", "Analis Data", "Lainnya"],

  PROVINCES: ["Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi", "Bengkulu",
    "Sumatera Selatan", "Kepulauan Bangka Belitung", "Lampung", "Banten", "DKI Jakarta", "Jawa Barat",
    "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
    "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
    "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tenggara",
    "Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan",
    "Papua Selatan", "Luar Negeri"],

  // Rekening pembayaran
  PAYMENT: [
    { bank: "Bank BNI 46", number: "0214815784", name: "Defriman Djafri" },
  ],

  // Batas ukuran bukti transfer (MB). Gambar otomatis dikompres sebelum dikirim.
  PROOF_MAX_MB: 5,

  // Nomor WhatsApp admin (format 62xxxxxxxxxx)
  ADMIN_WA: "6281310603106",
};

window.rupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
window.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
window.fmtDate = (iso, withTime) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const o = { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" };
  if (withTime) Object.assign(o, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("id-ID", o);
};

// Uji lokal tanpa menyentuh server produksi: di localhost, buka …/?demo=1 untuk mode demo, …/?demo=0 untuk kembali.
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  try {
    const q = new URLSearchParams(location.search).get("demo");
    if (q === "1") localStorage.setItem("mad_force_demo", "1");
    if (q === "0") localStorage.removeItem("mad_force_demo");
    if (localStorage.getItem("mad_force_demo") === "1") window.APP_CONFIG.API_URL = "";
  } catch (e) {}
})();
