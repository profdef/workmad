/**
 * BACKEND PELATIHAN ONLINE — Google Apps Script + Google Sheets + Drive + Gmail
 * "Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat Menggunakan R, RStudio & Quarto"
 *
 * Cara pasang (ringkas, detail di README.md):
 * 1. Buat Google Sheet baru → Extensions → Apps Script → tempel file ini.
 * 2. Project Settings → Script Properties → tambah:
 *      ADMIN_KEY     = kunci rahasia dashboard admin
 *      MATERI_KEY    = isi file .materi-key (hasil node tools/build-materi.mjs)
 *      ZOOM_LINK     = tautan Zoom pelatihan            (opsional)
 *      WA_GROUP_LINK = tautan grup WhatsApp peserta     (opsional)
 * 3. Jalankan fungsi setup() sekali (beri izin Sheets, Drive, Gmail).
 * 4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * 4b. Pengingat email otomatis: pilih fungsi pasangPengingat → Run (sekali; beri izin).
 * 5. Salin URL /exec ke assets/config.js (API_URL).
 *
 * PENTING: samakan CONFIG di bawah dengan assets/config.js.
 * File ini ikut ter-publish di repo GitHub — JANGAN menulis kunci/tautan rahasia di sini.
 */

var CONFIG = {
  TRAINING: "Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat Menggunakan R, RStudio & Quarto",
  BATCH: "Angkatan I · Desember 2026",
  CATEGORIES: {
    "Mahasiswa (S1/S2/S3)": 350000,
    "Dosen / Peneliti / Tenaga Kesehatan": 500000,
    "Umum / Instansi": 650000
  },
  STUDENT_CATEGORY: "Mahasiswa (S1/S2/S3)", // kategori yang wajib unggah KTM
  QUOTA: 100,
  CLOSE_DATE: "2026-12-03",                 // pendaftaran ditutup setelah tanggal ini (WIB)
  UNIQUE_CODE: { MIN: 101, MAX: 499 },
  // Kelas pra-pelatihan GRATIS khusus pembeli buku (samakan dengan FREE_CLASS di assets/config.js)
  FREE_CLASS: { ENABLED: true, CATEGORY: "Kelas Gratis (Pembeli Buku)", QUOTA: 300, CLOSE_DATE: "2026-11-28" },
  // Potongan biaya pelatihan penuh bagi pembeli buku (Rp)
  BOOK_DISCOUNT: 100000,
  // Status pesanan buku (aplikasi orderbuku) yang dianggap sudah membeli
  BOOK_PAID_STATUSES: ["Dibayar", "Diproses", "Dikirim", "Selesai"],      // 3 digit kode unik ditambahkan ke tagihan
  SITE_URL: "https://pelatihan.publichealth.id/", // alamat situs pelatihan (untuk tautan di email)
  PAYMENT: "Bank BNI 46 · 0214815784 · a.n. Defriman Djafri",
  ADMIN_WA: "6281310603106",
  CONTACT_EMAIL: "info@publichealth.id",    // email resmi: Reply-To & kontak di email otomatis
  ORGANIZER: "publichealth.id",
  MOTTO: "Better Health, Brighter Future",
  CERT_PREFIX: "MAD-R/2026/",
  CERT_JP: 18,
  PROOF_MAX_MB: 5,
  PROOF_FOLDER: "Bukti Pembayaran Pelatihan MAD-R",
  TASK_MAX_MB: 10,                            // ukuran maksimum file tugas akhir (PDF/HTML/ZIP)
  RECEIPT_PREFIX: "KW/MAD-R/2026/",          // nomor kuitansi (terbit saat pembayaran diverifikasi)
  EVAL_OPEN: true,                            // bawaan; dapat diubah dari dashboard admin → Pengaturan
  EVAL_REQUIRED_FOR_CERT: true,               // sertifikat baru dapat diunduh setelah evaluasi diisi
  // Jadwal sesi live (WIB) untuk pengingat email H-1. Samakan dengan SESSIONS & FREE_CLASS di assets/config.js.
  SESSIONS: [
    ["1", "2026-12-05 09:00", "Sabtu, 5 Desember 2026 · 09.00–12.00 WIB", "Pengantar & Konsep Dasar Data"],
    ["2", "2026-12-06 09:00", "Minggu, 6 Desember 2026 · 09.00–12.00 WIB", "R, RStudio & Quarto"],
    ["3", "2026-12-06 13:00", "Minggu, 6 Desember 2026 · 13.00–16.00 WIB", "Manajemen Data di R"],
    ["4", "2026-12-13 09:00", "Minggu, 13 Desember 2026 · 09.00–12.00 WIB", "Analisis Univariat & Bivariat"],
    ["5", "2026-12-20 09:00", "Minggu, 20 Desember 2026 · 09.00–12.00 WIB", "Tabel 2×2, Ukuran Asosiasi & Multivariat"],
    ["6", "2026-12-20 13:00", "Minggu, 20 Desember 2026 · 13.00–16.00 WIB", "Studi Kasus & Laporan Otomatis Quarto"],
    ["G", "2026-11-28 09:00", "Sabtu, 28 November 2026 · 09.00–11.30 WIB", "Kelas Pengenalan R, RStudio & Quarto"]
  ],
  REMIND_PAY_AFTER_HOURS: 48,                 // pengingat tagihan dikirim sekali, setelah N jam belum membayar
  MAIL_RESERVE: 10,                           // sisakan kuota email harian untuk kode akses & notifikasi penting
  SEND_EMAIL: true,     // kirim email tagihan & kode akses ke peserta
  NOTIFY_EMAIL: ""      // email admin untuk notifikasi pendaftaran/bukti baru ("" = mati)
};

var SHEET_NAME = "Peserta";
var HEADERS = ["id", "createdAt", "status", "name", "email", "phone", "gender", "institution", "profession",
  "category", "province", "city", "source", "note", "price", "uniqueCode", "total",
  "payerName", "paidAmount", "proofAt", "proofUrl", "proofFileId", "ktmFileId",
  "accessCode", "activatedAt", "lastLogin", "loginCount", "progress", "certNo", "certDate", "adminNote",
  "receiptNo", "evalAt", "program", "bookOrderId", "bookVerified", "bookProofFileId", "discount",
  "attendance", "taskUrl", "taskFileId", "taskNote", "taskAt", "taskStatus", "taskFeedback"];
var FREE = "Gratis", FULL = "Penuh";
var STATUSES = ["Menunggu Pembayaran", "Menunggu Verifikasi", "Aktif", "Lulus", "Dibatalkan"];
var ACTIVE = ["Aktif", "Lulus"];

// Butir evaluasi (samakan kunci dengan EVALUATION di assets/config.js)
var EVAL_SHEET = "Evaluasi";
var EVAL = {
  likert: ["a1", "a2", "a3", "a4", "a5", "b1", "b2", "b3", "b4", "b5", "c1", "c2", "c3", "c4", "o1"], // 1–5
  session: ["s1", "s2", "s3", "s4", "s5", "s6"],                                                      // 0 = tidak hadir, 1–5
  competency: ["k1", "k2", "k3", "k4", "k5", "k6"],                                                  // pre_kX & post_kX, 1–5
  nps: ["nps"],                                                                                       // 0–10
  text: ["t1", "t2", "t3", "t4"],
  flag: ["pub"]                                                                                       // izin publikasi testimoni
};
function evalHeaders() {
  var h = ["id", "submittedAt", "name", "email", "category", "institution"];
  h = h.concat(EVAL.likert, EVAL.session);
  EVAL.competency.forEach(function (k) { h.push("pre_" + k, "post_" + k); });
  return h.concat(EVAL.nps, EVAL.text, EVAL.flag);
}

function setup() {
  getSheet();
  var folder = getFolder();
  Logger.log("Siap. Folder bukti pembayaran: " + folder.getUrl());
  var p = PropertiesService.getScriptProperties();
  ["ADMIN_KEY", "MATERI_KEY"].forEach(function (k) {
    if (!p.getProperty(k)) Logger.log("PERINGATAN: " + k + " belum diatur di Script Properties.");
  });
  if (CONFIG.SEND_EMAIL) Logger.log("Sisa kuota email hari ini: " + MailApp.getRemainingDailyQuota() + " · pengirim: " + Session.getEffectiveUser().getEmail() + " · Reply-To: " + CONFIG.CONTACT_EMAIL);
  try { materiKey(); Logger.log("MATERI_KEY valid (format OK)."); } catch (e) { Logger.log("PERINGATAN: " + e.message); }
  try { if (materiKey("MATERI_KEY_FREE")) Logger.log("MATERI_KEY_FREE valid (format OK)."); else Logger.log("Info: MATERI_KEY_FREE kosong (kelas gratis tidak bisa membuka materi)."); } catch (e) { Logger.log("PERINGATAN: " + e.message); }
}

// Ambil MATERI_KEY: buang spasi/baris baru/tanda kutip yang ikut tertempel, lalu periksa formatnya
function materiKey(prop) {
  prop = prop || "MATERI_KEY";
  var raw = PropertiesService.getScriptProperties().getProperty(prop);
  if (!raw) {
    if (prop === "MATERI_KEY_FREE") return "";
    throw new Error("Materi belum disiapkan admin (MATERI_KEY kosong)");
  }
  var key = String(raw).replace(/\s+|["'`]/g, "");
  if (!/^[A-Za-z0-9+\/]{43}=$/.test(key))
    throw new Error(prop + " di server tidak valid. Admin: salin ulang seluruh isi file " + (prop === "MATERI_KEY" ? ".materi-key" : ".materi-key-free") + " (44 karakter, diakhiri '=') ke Script Properties.");
  return key;
}

function doGet() {
  return json({ ok: true, message: "API Pelatihan MAD-R aktif" });
}

var ACTOR = "admin"; // nama admin pelaku aksi (dicatat di Riwayat); diisi dari dashboard
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    ACTOR = body.key ? String(body.by || "").replace(/[\r\n\t]/g, " ").trim().slice(0, 40) || "admin" : "sistem";
    switch (body.action) {
      case "stats":    return json(stats());
      case "register": return json(register(body.reg || {}));
      case "registerFree": return json(registerFree(body.reg || {}));
      case "checkBook": return json(checkBookPublic(body));
      case "confirm":  return json(confirmPayment(body));
      case "status":   return json(checkStatus(body));
      case "login":    return json(login(body));
      case "forgot":   return json(forgot(body));
      case "track":    return json(track(body));
      case "verify":   return json(verifyCert(body.no));
      case "invoice":  return json(invoice(body));
      case "evalGet":  return json(evalGet(body));
      case "evalSubmit": return json(evalSubmit(body));
      case "evalList": requireAdmin(body.key); return json(evalList());
      case "list":     requireAdmin(body.key); return json({ ok: true, regs: readAll(), stats: stats() });
      case "update":   requireAdmin(body.key); return json(updateReg(body.id, body.fields || {}));
      case "resend":   requireAdmin(body.key); return json(resendAccess(body.id));
      case "file":     requireAdmin(body.key); return json(getFile(body.id, body.kind));
      case "delete":   requireAdmin(body.key); return json(deleteReg(body.id));
      case "bulk":     requireAdmin(body.key); return json(bulkUpdate(body.ids, body.op));
      case "annList":  requireAdmin(body.key); return json({ ok: true, list: annRead() });
      case "annSave":  requireAdmin(body.key); return json(annSave(body));
      case "annDelete": requireAdmin(body.key); return json(annDelete(body.id));
      case "attend":   return json(attend(body));
      case "taskSubmit": return json(taskSubmit(body));
      case "settingsGet": requireAdmin(body.key); return json(settingsGet());
      case "settingsSave": requireAdmin(body.key); return json(settingsSave(body.settings || {}));
      case "remindRun": requireAdmin(body.key); return json(kirimPengingat(new Date()));
      case "logList":  requireAdmin(body.key); return json({ ok: true, list: logRead(400) });
      default: throw new Error("Aksi tidak dikenal");
    }
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

/* ======================= Aksi publik ======================= */

// Hanya angka — tanpa data pribadi
function isFree(r) { return r.program === FREE; }

function stats(rows) {
  rows = rows || readAll();
  var active = rows.filter(function (r) { return r.status !== "Dibatalkan" && !isFree(r); });
  var free = rows.filter(function (r) { return r.status !== "Dibatalkan" && isFree(r); });
  var today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var remaining = Math.max(0, CONFIG.QUOTA - active.length);
  var F = CONFIG.FREE_CLASS, freeRemaining = Math.max(0, F.QUOTA - free.length);
  return {
    ok: true, quota: CONFIG.QUOTA, registered: active.length, remaining: remaining,
    closed: remaining <= 0 || today > CONFIG.CLOSE_DATE,
    free: { enabled: F.ENABLED, quota: F.QUOTA, registered: free.length, remaining: freeRemaining,
      closed: !F.ENABLED || freeRemaining <= 0 || today > F.CLOSE_DATE },
    bookDiscount: CONFIG.BOOK_DISCOUNT
  };
}

function register(o) {
  var s = function (v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); };
  var reg = {
    name: s(o.name, 100), email: s(o.email, 120).toLowerCase(), phone: s(o.phone, 20).replace(/[^\d+]/g, ""),
    gender: s(o.gender, 20), institution: s(o.institution, 150), profession: s(o.profession, 60),
    category: s(o.category, 60), province: s(o.province, 60), city: s(o.city, 80),
    source: s(o.source, 60), note: s(o.note, 500), bookOrderId: s(o.bookOrderId, 40).toUpperCase()
  };
  if (!reg.name || !reg.institution || !reg.city) throw new Error("Data pendaftaran belum lengkap");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reg.email)) throw new Error("Alamat email tidak valid");
  if (!/^(\+?62|0)8\d{7,12}$/.test(reg.phone)) throw new Error("Nomor WhatsApp tidak valid");
  if (!(reg.category in CONFIG.CATEGORIES)) throw new Error("Kategori peserta tidak valid");
  // Pembeli buku: cek no. pesanan (atau keikutsertaan kelas gratis terverifikasi) → potongan
  var book = reg.bookOrderId ? checkBookOrder(reg.bookOrderId, reg.phone) : null;
  if (reg.bookOrderId && !book.ok) throw new Error(book.reason + " Kosongkan kolom no. pesanan buku bila tidak memilikinya.");
  var ktm = null;
  if (o.ktm && o.ktm.data) ktm = checkFile(o.ktm);
  if (reg.category === CONFIG.STUDENT_CATEGORY && !ktm) throw new Error("Mahasiswa wajib mengunggah foto KTM aktif");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var rows = readAll(sheet);
    var st = stats(rows);
    if (st.closed) throw new Error(st.remaining <= 0 ? "Maaf, kuota peserta sudah penuh." : "Maaf, pendaftaran sudah ditutup.");
    var dup = rows.filter(function (r) { return r.status !== "Dibatalkan" && !isFree(r) && String(r.email).toLowerCase() === reg.email; })[0];
    var freeVerified = rows.filter(function (r) { return isFree(r) && r.bookVerified === "Ya" && r.status !== "Dibatalkan" && String(r.email).toLowerCase() === reg.email; })[0];
    if (dup) throw new Error("Email ini sudah terdaftar dengan no. pendaftaran " + dup.id +
      " (status: " + dup.status + "). Gunakan halaman Konfirmasi Pembayaran atau Portal Peserta.");

    reg.id = newId();
    reg.createdAt = new Date().toISOString();
    reg.status = STATUSES[0];
    reg.price = CONFIG.CATEGORIES[reg.category];
    reg.program = FULL;
    if (book && book.ok) { reg.bookVerified = "Ya"; }
    else if (freeVerified) { reg.bookOrderId = freeVerified.bookOrderId || "Kelas Gratis " + freeVerified.id; reg.bookVerified = "Ya"; }
    reg.discount = reg.bookVerified === "Ya" ? Math.min(CONFIG.BOOK_DISCOUNT, reg.price) : 0;
    // Kode unik yang belum dipakai pendaftar lain yang belum membayar dengan tarif sama
    var used = {};
    rows.forEach(function (r) { if (r.status === STATUSES[0] || r.status === STATUSES[1]) used[Number(r.total)] = 1; });
    var U = CONFIG.UNIQUE_CODE, code = 0;
    for (var i = 0; i < 50; i++) {
      code = U.MIN + Math.floor(Math.random() * (U.MAX - U.MIN + 1));
      if (!used[reg.price - reg.discount + code]) break;
    }
    reg.uniqueCode = code;
    reg.total = reg.price - reg.discount + code;
    reg.loginCount = 0;
    if (ktm) {
      var f = saveFile(ktm, reg.id + "_KTM");
      reg.ktmFileId = f.getId();
    }
    writeRow(sheet, sheet.getLastRow() + 1, reg);
  } finally {
    lock.releaseLock();
  }

  sendMail(reg.email, "Tagihan Pendaftaran " + reg.id + " — Pelatihan " + shortName(),
    mailTemplate("Pendaftaran berhasil", "Halo <b>" + h(reg.name) + "</b>, terima kasih telah mendaftar.",
      [["No. pendaftaran", reg.id], ["Kategori", reg.category], ["Biaya", rp(reg.price)]].concat(reg.discount ? [["Potongan pembeli buku", "− " + rp(reg.discount)]] : []).concat([["Kode unik", rp(reg.uniqueCode)],
       ["<b>Total transfer</b>", "<b style='font-size:18px;color:#e879f9'>" + rp(reg.total) + "</b>"], ["Rekening", CONFIG.PAYMENT]]),
      "Mohon transfer <b>tepat " + rp(reg.total) + "</b> (termasuk kode unik agar mudah diverifikasi), lalu unggah bukti transfer di:",
      CONFIG.SITE_URL + "konfirmasi.html?id=" + encodeURIComponent(reg.id), "Konfirmasi Pembayaran"));
  notifyAdmin("Pendaftar baru: " + reg.id, reg.name + " · " + reg.institution + "\n" + reg.category + " · " + rp(reg.total), {
    icon: "🎓", title: "Pendaftar baru · Pelatihan Penuh", id: reg.id,
    rows: [["Nama", reg.name], ["Instansi", reg.institution], ["Domisili", reg.city + ", " + reg.province], ["WhatsApp", reg.phone], ["Email", reg.email],
      ["Kategori", reg.category], ["Tagihan", rp(reg.total) + (reg.discount ? " (potongan buku " + rp(reg.discount) + ")" : "")]],
    footer: "Status: Menunggu Pembayaran" });

  return { ok: true, reg: publicReg(reg) };
}

/* ------- Kelas pra-pelatihan gratis (pembeli buku) ------- */
function registerFree(o) {
  var F = CONFIG.FREE_CLASS;
  var s = function (v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); };
  var reg = {
    name: s(o.name, 100), email: s(o.email, 120).toLowerCase(), phone: s(o.phone, 20).replace(/[^\d+]/g, ""),
    institution: s(o.institution, 150), profession: s(o.profession, 60), province: s(o.province, 60), city: s(o.city, 80),
    source: s(o.source, 60), note: s(o.note, 500), bookOrderId: s(o.bookOrderId, 40).toUpperCase()
  };
  if (!reg.name || !reg.institution || !reg.city) throw new Error("Data pendaftaran belum lengkap");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reg.email)) throw new Error("Alamat email tidak valid");
  if (!/^(\+?62|0)8\d{7,12}$/.test(reg.phone)) throw new Error("Nomor WhatsApp tidak valid");
  var proof = (o.bookProof && o.bookProof.data) ? checkFile(o.bookProof) : null;
  var book = reg.bookOrderId ? checkBookOrder(reg.bookOrderId, reg.phone) : null;
  if (reg.bookOrderId && !book.ok && !proof) throw new Error(book.reason + " Atau unggah foto bukti pembelian buku.");
  if (!reg.bookOrderId && !proof) throw new Error("Masukkan no. pesanan buku, atau unggah foto bukti pembelian buku.");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var verified;
  try {
    var sheet = getSheet(), rows = readAll(sheet), st = stats(rows).free;
    if (st.closed) throw new Error(!F.ENABLED ? "Kelas gratis belum dibuka." : st.remaining <= 0 ? "Maaf, kuota kelas gratis sudah penuh." : "Maaf, pendaftaran kelas gratis sudah ditutup.");
    var dup = rows.filter(function (r) { return r.status !== "Dibatalkan" && isFree(r) && String(r.email).toLowerCase() === reg.email; })[0];
    if (dup) throw new Error("Email ini sudah terdaftar di kelas gratis (no. " + dup.id + ", status: " + dup.status + "). Cek email Anda atau gunakan Lupa kode akses di halaman Masuk.");
    var usedOrder = reg.bookOrderId && rows.filter(function (r) { return isFree(r) && r.status !== "Dibatalkan" && r.bookOrderId === reg.bookOrderId; })[0];
    if (usedOrder) throw new Error("No. pesanan buku ini sudah dipakai untuk mendaftar kelas gratis.");

    verified = !!(book && book.ok);
    reg.id = newId();
    reg.createdAt = new Date().toISOString();
    reg.program = FREE;
    reg.category = F.CATEGORY;
    reg.price = 0; reg.uniqueCode = 0; reg.total = 0; reg.discount = 0; reg.loginCount = 0;
    reg.bookVerified = verified ? "Ya" : "";
    if (proof) reg.bookProofFileId = saveFile(proof, reg.id + "_BUKU").getId();
    if (verified) { reg.status = "Aktif"; reg.accessCode = newAccessCode(); reg.activatedAt = new Date().toISOString(); }
    else reg.status = "Menunggu Verifikasi";
    writeRow(sheet, sheet.getLastRow() + 1, reg);
  } finally {
    lock.releaseLock();
  }
  var mailed = verified ? sendAccessMail(reg) : sendMail(reg.email, "Pendaftaran Kelas Gratis " + reg.id + " — publichealth.id",
    mailTemplate("Pendaftaran kelas gratis diterima", "Halo <b>" + h(reg.name) + "</b>, terima kasih telah mendaftar kelas pra-pelatihan gratis.",
      [["No. pendaftaran", reg.id], ["Status", "Menunggu verifikasi bukti pembelian buku"]],
      "Admin akan memverifikasi bukti pembelian buku Anda (umumnya 1×24 jam). Kode akses dikirim ke email ini setelah diverifikasi.",
      CONFIG.SITE_URL + "kelas-gratis.html", "Info Kelas Gratis"));
  notifyAdmin("Pendaftar kelas gratis: " + reg.id, reg.name + " · " + reg.institution + (verified ? " (pesanan buku terverifikasi otomatis)" : " (perlu verifikasi bukti buku)"), {
    icon: "🎁", title: "Pendaftar baru · Kelas Gratis", id: reg.id,
    rows: [["Nama", reg.name], ["Instansi", reg.institution], ["Domisili", reg.city + ", " + reg.province], ["WhatsApp", reg.phone], ["Email", reg.email],
      ["Bukti buku", reg.bookOrderId ? "Pesanan " + reg.bookOrderId : "Foto bukti pembelian"]],
    footer: verified ? "✅ Pesanan buku terverifikasi — akses langsung aktif" : "⚠️ Perlu verifikasi bukti buku di dashboard" });
  // Pembeli terverifikasi otomatis: kode akses langsung ditampilkan ke pendaftar (yang mengetahui no. pesanan + no. WA)
  return { ok: true, reg: { id: reg.id, name: reg.name, status: reg.status, verified: verified,
    accessCode: verified ? reg.accessCode : "", email: verified ? reg.email : "", phone: verified ? reg.phone : "" }, mailed: mailed };
}

// Verifikasi pesanan buku ke Google Sheet aplikasi orderbuku (Script Property BOOK_SHEET_ID)
function checkBookOrder(orderId, phone) {
  var sid = PropertiesService.getScriptProperties().getProperty("BOOK_SHEET_ID");
  if (!sid) return { ok: false, reason: "Verifikasi otomatis no. pesanan belum tersedia." };
  var ss;
  try { ss = SpreadsheetApp.openById(sid); } catch (e) { return { ok: false, reason: "Data pesanan buku tidak dapat dibaca." }; }
  var sh = ss.getSheetByName("Orders");
  if (!sh || sh.getLastRow() < 2) return { ok: false, reason: "No. pesanan buku tidak ditemukan." };
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var H = vals[0].map(String), iId = H.indexOf("id"), iSt = H.indexOf("status"), iPh = H.indexOf("phone");
  var id = String(orderId || "").trim().toUpperCase();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][iId]).toUpperCase() !== id) continue;
    if (normPhone(vals[i][iPh]) !== normPhone(phone)) { Utilities.sleep(600); return { ok: false, reason: "No. pesanan dan no. WhatsApp tidak cocok dengan data pesanan buku." }; }
    if (CONFIG.BOOK_PAID_STATUSES.indexOf(String(vals[i][iSt])) < 0) return { ok: false, reason: "Pesanan buku " + id + " belum lunas (status: " + vals[i][iSt] + ")." };
    return { ok: true, status: vals[i][iSt] };
  }
  Utilities.sleep(600);
  return { ok: false, reason: "No. pesanan buku " + id + " tidak ditemukan." };
}

// Cek publik (untuk pratinjau potongan di formulir): hanya ya/tidak, tanpa data pribadi
function checkBookPublic(b) {
  var r = checkBookOrder(b.orderId, b.phone);
  return { ok: true, valid: r.ok, reason: r.ok ? "" : r.reason, discount: r.ok ? CONFIG.BOOK_DISCOUNT : 0 };
}

function confirmPayment(b) {
  var id = String(b.id || "").trim().toUpperCase();
  var payerName = String(b.payerName || "").trim().slice(0, 100);
  var paidAmount = Math.max(0, Math.round(Number(b.paidAmount) || 0));
  if (!id || !payerName || !paidAmount) throw new Error("Data konfirmasi belum lengkap");
  var file = checkFile(b.file || {});

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var rec;
  try {
    var sheet = getSheet();
    var found = findOwned(sheet, id, b.contact);
    rec = found.rec;
    if (rec.status !== STATUSES[0] && rec.status !== STATUSES[1])
      throw new Error('Pendaftaran ini berstatus "' + rec.status + '" dan tidak memerlukan konfirmasi');
    var f = saveFile(file, id + "_BUKTI");
    f.setDescription(rec.name + " · " + payerName + " · " + rp(paidAmount));
    rec.payerName = payerName;
    rec.paidAmount = paidAmount;
    rec.proofAt = new Date().toISOString();
    rec.proofUrl = f.getUrl();
    rec.proofFileId = f.getId();
    rec.status = STATUSES[1];
    writeRow(sheet, found.row, rec);
  } finally {
    lock.releaseLock();
  }
  notifyAdmin("Bukti transfer masuk: " + id, rec.name + " — transfer " + rp(paidAmount) + " a.n. " + payerName +
    " (tagihan " + rp(rec.total) + ")\n" + rec.proofUrl, {
    icon: "💳", title: "Bukti transfer masuk", id: id,
    rows: [["Nama", rec.name], ["Pengirim", payerName], ["Transfer", rp(paidAmount)], ["Tagihan", rp(rec.total)]],
    footer: Number(paidAmount) === Number(rec.total) ? "✅ Nominal sesuai tagihan — silakan verifikasi" : "⚠️ Nominal BERBEDA dari tagihan — cek mutasi rekening" });
  return { ok: true, reg: publicReg(rec) };
}

function checkStatus(b) {
  var sheet = getSheet();
  var rec = findOwned(sheet, String(b.id || "").trim().toUpperCase(), b.contact).rec;
  return { ok: true, reg: publicReg(rec) };
}

function login(b) {
  var email = String(b.email || "").trim().toLowerCase();
  var code = normCode(b.code);
  if (!email || !code) throw new Error("Masukkan email dan kode akses");
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var hit = findByEmailCode(sheet, email, code);
    if (!hit) {
      Utilities.sleep(1000);
      throw new Error("Email atau kode akses salah");
    }
    var rec = hit.rec;
    if (ACTIVE.indexOf(rec.status) < 0) throw new Error('Akses belum aktif (status: ' + rec.status + ')');
    if (!b.silent) {
      rec.lastLogin = new Date().toISOString();
      rec.loginCount = (Number(rec.loginCount) || 0) + 1;
      writeRow(sheet, hit.row, rec);
    }
    var P = PropertiesService.getScriptProperties(), free = isFree(rec);
    var keyFree = materiKey("MATERI_KEY_FREE");
    return {
      ok: true, key: free ? "" : materiKey(), keyFree: keyFree,
      zoom: P.getProperty(free ? "ZOOM_LINK_FREE" : "ZOOM_LINK") || "", waGroup: P.getProperty(free ? "WA_GROUP_LINK_FREE" : "WA_GROUP_LINK") || "",
      announcements: annFor(free ? FREE : FULL),
      participant: participantView(rec)
    };
  } finally {
    lock.releaseLock();
  }
}

function forgot(b) {
  var email = String(b.email || "").trim().toLowerCase();
  if (email) readAll().forEach(function (r) {
    if (String(r.email).toLowerCase() === email && ACTIVE.indexOf(r.status) >= 0 && r.accessCode) sendAccessMail(r);
  });
  Utilities.sleep(600);
  // Jawaban sama untuk semua kasus agar email terdaftar tidak bisa ditebak
  return { ok: true, message: "Jika email terdaftar dan akses sudah aktif, kode akses telah dikirim ulang ke email tersebut." };
}

function track(b) {
  var slug = String(b.slug || "").replace(/[^\w-]/g, "").slice(0, 60);
  if (!slug) return { ok: true };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var hit = findByEmailCode(sheet, String(b.email || "").trim().toLowerCase(), normCode(b.code));
    if (!hit || ACTIVE.indexOf(hit.rec.status) < 0) return { ok: false, error: "Sesi tidak valid" };
    var list = String(hit.rec.progress || "").split(",").filter(String);
    if (list.indexOf(slug) < 0) {
      list.push(slug);
      hit.rec.progress = list.join(",");
      writeRow(sheet, hit.row, hit.rec);
    }
    return { ok: true, progress: list };
  } finally {
    lock.releaseLock();
  }
}

function verifyCert(no) {
  no = String(no || "").trim().toUpperCase();
  if (!no) throw new Error("Masukkan nomor sertifikat");
  var r = readAll().filter(function (x) { return String(x.certNo).toUpperCase() === no && x.status === "Lulus"; })[0];
  if (!r) { Utilities.sleep(600); return { ok: true, valid: false }; }
  return { ok: true, valid: true, cert: { no: r.certNo, name: r.name, institution: r.institution, date: r.certDate, jp: CONFIG.CERT_JP, batch: CONFIG.BATCH } };
}

/* ------- Invoice & kuitansi (pemilik: no. pendaftaran + email/WA; atau admin) ------- */
function invoice(b) {
  var sheet = getSheet(), id = String(b.id || "").trim().toUpperCase(), rec;
  if (b.key) { requireAdmin(b.key); rec = readRow(sheet, findRow(sheet, id)); }
  else rec = findOwned(sheet, id, b.contact).rec;
  if (isFree(rec)) throw new Error("Kelas gratis tidak memiliki invoice/kuitansi.");
  var paid = ACTIVE.indexOf(rec.status) >= 0;
  return { ok: true, doc: {
    id: rec.id, invoiceNo: "INV/" + rec.id, receiptNo: paid ? rec.receiptNo : "", status: rec.status, paid: paid,
    createdAt: rec.createdAt, paidAt: paid ? rec.activatedAt : "", name: rec.name, email: rec.email, phone: rec.phone,
    institution: rec.institution, city: rec.city, province: rec.province, category: rec.category,
    price: Number(rec.price), uniqueCode: Number(rec.uniqueCode), total: Number(rec.total), discount: Number(rec.discount) || 0, bookOrderId: rec.bookOrderId,
    payerName: rec.payerName, paidAmount: Number(rec.paidAmount) || 0, proofAt: rec.proofAt,
    training: CONFIG.TRAINING, batch: CONFIG.BATCH, payment: CONFIG.PAYMENT
  } };
}

/* ------- Evaluasi pelatihan ------- */
function sessionRec(b) {
  var sheet = getSheet();
  var hit = findByEmailCode(sheet, String(b.email || "").trim().toLowerCase(), normCode(b.code));
  if (!hit || ACTIVE.indexOf(hit.rec.status) < 0) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
  if (isFree(hit.rec)) throw new Error("Evaluasi hanya untuk peserta pelatihan penuh.");
  return { sheet: sheet, row: hit.row, rec: hit.rec };
}

function getEvalSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), H = evalHeaders();
  var sh = ss.getSheetByName(EVAL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(EVAL_SHEET);
    sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function evalGet(b) {
  var s = sessionRec(b), sh = getEvalSheet(), H = evalHeaders();
  var n = sh.getLastRow() - 1, answers = null;
  if (n > 0) sh.getRange(2, 1, n, H.length).getValues().forEach(function (r) {
    if (r[0] === s.rec.id) { answers = {}; H.forEach(function (k, i) { answers[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); }
  });
  return { ok: true, open: settingsRead().evalOpen, answers: answers };
}

function evalSubmit(b) {
  if (!settingsRead().evalOpen) throw new Error("Formulir evaluasi sedang ditutup");
  var a = b.answers || {}, row = {}, miss = [];
  var int = function (v, lo, hi, k) {
    var x = parseInt(v, 10);
    if (isNaN(x) || x < lo || x > hi) { miss.push(k); return ""; }
    return x;
  };
  EVAL.likert.forEach(function (k) { row[k] = int(a[k], 1, 5, k); });
  EVAL.session.forEach(function (k) { row[k] = int(a[k], 0, 5, k); });
  EVAL.competency.forEach(function (k) { row["pre_" + k] = int(a["pre_" + k], 1, 5, "pre_" + k); row["post_" + k] = int(a["post_" + k], 1, 5, "post_" + k); });
  row.nps = int(a.nps, 0, 10, "nps");
  if (miss.length) throw new Error("Masih ada " + miss.length + " pertanyaan wajib yang belum dijawab");
  EVAL.text.forEach(function (k) { row[k] = String(a[k] == null ? "" : a[k]).trim().slice(0, 1500); });
  row.pub = a.pub ? "Ya" : "Tidak";

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = sessionRec(b), sh = getEvalSheet(), H = evalHeaders();
    row.id = s.rec.id; row.submittedAt = new Date().toISOString();
    row.name = s.rec.name; row.email = s.rec.email; row.category = s.rec.category; row.institution = s.rec.institution;
    var n = sh.getLastRow() - 1, target = sh.getLastRow() + 1;
    if (n > 0) {
      var ids = sh.getRange(2, 1, n, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === row.id) { target = i + 2; break; }
    }
    sh.getRange(target, 1, 1, H.length).setValues([H.map(function (k) { return row[k] == null ? "" : row[k]; })]);
    s.rec.evalAt = row.submittedAt;
    writeRow(s.sheet, s.row, s.rec);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, submittedAt: row.submittedAt };
}

function evalList() {
  var sh = getEvalSheet(), H = evalHeaders(), n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, H.length).getValues().map(function (r) {
    var o = {}; H.forEach(function (k, i) { o[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o;
  }) : [];
  var eligible = readAll().filter(function (r) { return ACTIVE.indexOf(r.status) >= 0; }).length;
  return { ok: true, evals: rows, eligible: eligible };
}

/* ======================= Aksi admin ======================= */

function updateReg(id, fields) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var rec, becameActive = false, taskReviewed = false, log = [];
  try {
    var sheet = getSheet();
    var row = findRow(sheet, id);
    rec = readRow(sheet, row);
    var old = JSON.parse(JSON.stringify(rec));
    if ("status" in fields) {
      if (STATUSES.indexOf(fields.status) < 0) throw new Error("Status tidak valid");
      if (ACTIVE.indexOf(fields.status) >= 0 && !rec.accessCode) {
        rec.accessCode = newAccessCode();
        rec.activatedAt = new Date().toISOString();
        becameActive = true;
      }
      if (ACTIVE.indexOf(fields.status) >= 0 && !rec.receiptNo && !isFree(rec)) rec.receiptNo = newSeqNo("RECEIPT_SEQ", CONFIG.RECEIPT_PREFIX);
      if (fields.status === "Lulus" && isFree(rec)) throw new Error("Peserta kelas gratis tidak memiliki status Lulus/sertifikat pelatihan penuh");
      if (ACTIVE.indexOf(fields.status) >= 0 && isFree(rec) && !rec.bookVerified) rec.bookVerified = "Ya";
      if (fields.status === "Lulus" && !rec.certNo) {
        rec.certNo = newCertNo();
        rec.certDate = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
      }
      rec.status = fields.status;
    }
    if ("adminNote" in fields) rec.adminNote = String(fields.adminNote).slice(0, 500);
    if ("name" in fields && String(fields.name).trim()) rec.name = String(fields.name).trim().slice(0, 100); // koreksi nama di sertifikat
    if ("certDate" in fields && /^\d{4}-\d{2}-\d{2}$/.test(fields.certDate)) rec.certDate = fields.certDate;
    if (fields.resetCode) { rec.accessCode = newAccessCode(); becameActive = ACTIVE.indexOf(rec.status) >= 0; }
    if ("attendance" in fields) rec.attendance = attList(fields.attendance).filter(function (k) { return sessionKeys(isFree(rec)).indexOf(k) >= 0; }).sort().join(",");
    if ("taskStatus" in fields) {
      if (["Diterima", "Perlu Revisi"].indexOf(fields.taskStatus) < 0) throw new Error("Status tugas tidak valid");
      if (!rec.taskAt) throw new Error("Peserta belum mengumpulkan tugas akhir");
      rec.taskStatus = fields.taskStatus;
      rec.taskFeedback = String(fields.taskFeedback || "").trim().slice(0, 600);
      taskReviewed = true;
    }
    writeRow(sheet, row, rec);
    if (old.status !== rec.status) log.push("status " + old.status + " → " + rec.status + (rec.certNo && !old.certNo ? " (sertifikat " + rec.certNo + ")" : ""));
    if (old.name !== rec.name) log.push("nama \"" + old.name + "\" → \"" + rec.name + "\"");
    if (old.adminNote !== rec.adminNote) log.push("catatan admin diubah");
    if (String(old.attendance || "") !== String(rec.attendance || "")) log.push("kehadiran [" + (old.attendance || "-") + "] → [" + (rec.attendance || "-") + "]");
    if (taskReviewed) log.push("tugas akhir: " + rec.taskStatus + (rec.taskFeedback ? " (\"" + rec.taskFeedback.slice(0, 80) + "\")" : ""));
    if (fields.resetCode) log.push("kode akses diganti");
    if (log.length) logAct("Ubah peserta", id, rec.name + ": " + log.join("; "));
  } finally {
    lock.releaseLock();
  }
  var mailed = false;
  if (becameActive && fields.notify !== false) mailed = sendAccessMail(rec);
  if (taskReviewed && fields.notify !== false) mailed = sendMail(rec.email, "Tugas Akhir: " + rec.taskStatus + " — " + rec.id, mailTemplate(
    rec.taskStatus === "Diterima" ? "Tugas akhir diterima ✅" : "Tugas akhir perlu revisi ✏️",
    "Halo <b>" + h(rec.name) + "</b>, tugas akhir Anda telah diperiksa.",
    [["Status", "<b>" + h(rec.taskStatus) + "</b>"]].concat(rec.taskFeedback ? [["Catatan", h(rec.taskFeedback)]] : []),
    rec.taskStatus === "Diterima" ? "Terima kasih. Pantau status kelulusan & sertifikat di Portal Peserta:" : "Silakan perbaiki lalu kumpulkan kembali melalui tab Tugas Akhir di Portal Peserta:",
    CONFIG.SITE_URL + "portal.html#tugas", "Buka Portal Peserta"));
  return { ok: true, reg: rec, mailed: mailed };
}

function resendAccess(id) {
  var sheet = getSheet();
  var rec = readRow(sheet, findRow(sheet, id));
  if (ACTIVE.indexOf(rec.status) < 0 || !rec.accessCode) throw new Error("Peserta belum berstatus Aktif");
  var mailed = sendAccessMail(rec);
  if (!mailed) throw new Error("Email tidak terkirim (SEND_EMAIL mati atau kuota habis)");
  logAct("Kirim ulang kode", id, rec.name + " · " + rec.email);
  return { ok: true, mailed: true };
}

function getFile(id, kind) {
  var sheet = getSheet();
  var rec = readRow(sheet, findRow(sheet, id));
  var fid = kind === "ktm" ? rec.ktmFileId : kind === "book" ? rec.bookProofFileId : kind === "task" ? rec.taskFileId : rec.proofFileId;
  if (!fid) throw new Error("File tidak ditemukan");
  var file = DriveApp.getFileById(fid);
  var blob = file.getBlob();
  // Tugas peserta (HTML/ZIP) tidak ditampilkan di dalam dashboard — dibuka lewat Google Drive saja
  if (kind === "task" && blob.getContentType() !== "application/pdf") return { ok: true, mimeType: blob.getContentType(), url: file.getUrl(), name: file.getName(), dataUrl: "" };
  return {
    ok: true, mimeType: blob.getContentType(), url: file.getUrl(),
    dataUrl: "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes())
  };
}

function deleteReg(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet(), row = findRow(sheet, id), rec = readRow(sheet, row);
    sheet.deleteRow(row);
    // Arsip ringkas data yang dihapus (tanpa kode akses) agar masih bisa ditelusuri dari Riwayat / sheet Log
    logAct("Hapus peserta", id, JSON.stringify({ name: rec.name, email: rec.email, phone: rec.phone, institution: rec.institution, program: rec.program || FULL,
      category: rec.category, status: rec.status, total: rec.total, paidAmount: rec.paidAmount, createdAt: rec.createdAt, proofUrl: rec.proofUrl, certNo: rec.certNo }));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ======================= Pengaturan (dashboard admin) ======================= */

// Tautan disimpan di Script Property masing-masing (sama dengan cara lama); lainnya di Script Property SETTINGS (JSON).
var LINK_PROPS = { zoom: "ZOOM_LINK", waGroup: "WA_GROUP_LINK", zoomFree: "ZOOM_LINK_FREE", waGroupFree: "WA_GROUP_LINK_FREE" };
var LINK_LABELS = { zoom: "Zoom pelatihan penuh", waGroup: "grup WhatsApp pelatihan penuh", zoomFree: "Zoom kelas gratis", waGroupFree: "grup WhatsApp kelas gratis" };
// Kunci sesi untuk kehadiran: "1"–"6" = sesi pelatihan penuh, "G" = kelas gratis
function sessionKeys(free) { return free ? ["G"] : ["1", "2", "3", "4", "5", "6"]; }
function attList(v) {
  var seen = {};
  return String(v == null ? "" : v).split(",").map(function (x) { return x.trim().toUpperCase(); })
    .filter(function (k) { return /^[1-6G]$/.test(k) && !seen[k] && (seen[k] = true); });
}
function settingsRead() {
  var s = {};
  try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty("SETTINGS") || "{}") || {}; } catch (e) { s = {}; }
  return { evalOpen: "evalOpen" in s ? !!s.evalOpen : CONFIG.EVAL_OPEN, taskOpen: "taskOpen" in s ? !!s.taskOpen : true,
    taskDue: s.taskDue || "", taskInfo: s.taskInfo || "", attend: s.attend || {}, rec: s.rec || {},
    remindSession: "remindSession" in s ? !!s.remindSession : true, remindPay: "remindPay" in s ? !!s.remindPay : true };
}
function settingsGet() {
  var P = PropertiesService.getScriptProperties(), links = {};
  Object.keys(LINK_PROPS).forEach(function (k) { links[k] = P.getProperty(LINK_PROPS[k]) || ""; });
  var st = {};
  try { st = JSON.parse(P.getProperty("REMIND_STATUS") || "{}"); } catch (e) { st = {}; }
  return { ok: true, settings: settingsRead(), links: links, remind: { trigger: triggerOn(), last: st } };
}
function settingsSave(o) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var P = PropertiesService.getScriptProperties(), cur = settingsRead(), changedLinks = {};
    Object.keys(LINK_PROPS).forEach(function (k) {
      if (!(k in (o.links || {}))) return;
      var u = String(o.links[k] || "").trim().slice(0, 500);
      if (u === (P.getProperty(LINK_PROPS[k]) || "")) return; // tidak diubah → biarkan (nilai lama tidak ikut divalidasi)
      if (u && !/^https:\/\/\S+$/.test(u)) throw new Error("Tautan " + LINK_LABELS[k] + " harus diawali https:// dan tanpa spasi");
      P.setProperty(LINK_PROPS[k], u);
      changedLinks[k] = true;
    });
    if ("evalOpen" in o) cur.evalOpen = !!o.evalOpen;
    if ("taskOpen" in o) cur.taskOpen = !!o.taskOpen;
    if ("taskDue" in o) {
      var d = String(o.taskDue || "").trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Batas tugas harus berformat tanggal (YYYY-MM-DD)");
      cur.taskDue = d;
    }
    if ("taskInfo" in o) cur.taskInfo = String(o.taskInfo || "").trim().slice(0, 1500);
    if ("rec" in o) {
      var rec = {};
      ["1", "2", "3", "4", "5", "6", "G"].forEach(function (k) {
        var u = String((o.rec || {})[k] || "").trim().slice(0, 500);
        if (!u) return;
        if (!/^https:\/\/\S+$/.test(u)) throw new Error("Tautan rekaman " + (k === "G" ? "kelas gratis" : "sesi " + k) + " harus diawali https:// dan tanpa spasi");
        rec[k] = u;
      });
      cur.rec = rec;
    }
    if ("remindSession" in o) cur.remindSession = !!o.remindSession;
    if ("remindPay" in o) cur.remindPay = !!o.remindPay;
    if ("attend" in o) {
      var att = {};
      ["1", "2", "3", "4", "5", "6", "G"].forEach(function (k) {
        var c = normCode((o.attend || {})[k]).slice(0, 12); // kosong = presensi sesi itu ditutup
        if (c) att[k] = c;
      });
      cur.attend = att;
    }
    var before = settingsRead();
    P.setProperty("SETTINGS", JSON.stringify(cur));
    var ch = [];
    Object.keys(LINK_PROPS).forEach(function (k) { if (k in (o.links || {}) && changedLinks[k]) ch.push("tautan " + LINK_LABELS[k] + " diubah"); });
    if (before.evalOpen !== cur.evalOpen) ch.push("evaluasi " + (cur.evalOpen ? "dibuka" : "ditutup"));
    if (before.taskOpen !== cur.taskOpen) ch.push("pengumpulan tugas " + (cur.taskOpen ? "dibuka" : "ditutup"));
    if (before.taskDue !== cur.taskDue) ch.push("batas tugas → " + (cur.taskDue || "kosong"));
    if (before.taskInfo !== cur.taskInfo) ch.push("ketentuan tugas diubah");
    ["1", "2", "3", "4", "5", "6", "G"].forEach(function (k) {
      var nm = k === "G" ? "kelas gratis" : "sesi " + k;
      if (!!before.attend[k] !== !!cur.attend[k]) ch.push("presensi " + nm + (cur.attend[k] ? " dibuka" : " ditutup"));
      else if (before.attend[k] !== cur.attend[k]) ch.push("kode hadir " + nm + " diganti");
      if ((before.rec[k] || "") !== (cur.rec[k] || "")) ch.push("rekaman " + nm + (cur.rec[k] ? " dipasang" : " dihapus"));
    });
    if (before.remindSession !== cur.remindSession) ch.push("pengingat sesi " + (cur.remindSession ? "aktif" : "mati"));
    if (before.remindPay !== cur.remindPay) ch.push("pengingat tagihan " + (cur.remindPay ? "aktif" : "mati"));
    if (ch.length) logAct("Pengaturan", "", ch.join("; "));
  } finally {
    lock.releaseLock();
  }
  return settingsGet();
}

/* ======================= Kehadiran & tugas akhir (peserta) ======================= */

// Peserta mencatat kehadiran dengan kode hadir yang dibacakan narasumber saat sesi berlangsung.
function attend(b) {
  var key = String(b.session || "").trim().toUpperCase(), code = normCode(b.attendCode);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var hit = findByEmailCode(sheet, String(b.email || "").trim().toLowerCase(), normCode(b.code));
    if (!hit || ACTIVE.indexOf(hit.rec.status) < 0) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
    var rec = hit.rec;
    if (sessionKeys(isFree(rec)).indexOf(key) < 0) throw new Error("Sesi tidak dikenal");
    var real = settingsRead().attend[key];
    if (!real) throw new Error("Presensi sesi ini belum dibuka atau sudah ditutup");
    if (!code || code !== real) { Utilities.sleep(800); throw new Error("Kode hadir salah. Periksa kode yang dibacakan narasumber."); }
    var list = attList(rec.attendance);
    if (list.indexOf(key) < 0) { list.push(key); list.sort(); rec.attendance = list.join(","); writeRow(sheet, hit.row, rec); }
    return { ok: true, participant: participantView(rec) };
  } finally {
    lock.releaseLock();
  }
}

// Pengumpulan tugas akhir: tautan (Quarto Pub/RPubs/GitHub/Drive) dan/atau file PDF, HTML, ZIP. Bisa dikumpulkan ulang.
function taskSubmit(b) {
  var url = String(b.url || "").trim().slice(0, 500), note = String(b.note || "").trim().slice(0, 600);
  if (url && !/^https?:\/\/\S+$/.test(url)) throw new Error("Tautan tugas harus diawali https://");
  var hasFile = !!(b.file && b.file.data);
  if (!url && !hasFile) throw new Error("Isi tautan tugas atau unggah file tugas");
  var file = hasFile ? checkFile(b.file, { "application/pdf": "pdf", "text/html": "html", "application/zip": "zip", "application/x-zip-compressed": "zip" },
    CONFIG.TASK_MAX_MB, "File tugas harus PDF, HTML, atau ZIP") : null;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var rec;
  try {
    var sheet = getSheet();
    var hit = findByEmailCode(sheet, String(b.email || "").trim().toLowerCase(), normCode(b.code));
    if (!hit || ACTIVE.indexOf(hit.rec.status) < 0) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
    rec = hit.rec;
    if (isFree(rec)) throw new Error("Tugas akhir hanya untuk peserta pelatihan penuh");
    if (!settingsRead().taskOpen) throw new Error("Pengumpulan tugas akhir sedang ditutup");
    if (rec.taskStatus === "Diterima") throw new Error("Tugas akhir Anda sudah diterima");
    if (file) {
      var f = saveFile(file, rec.id + "_TUGAS");
      f.setDescription("Tugas akhir · " + rec.name);
      rec.taskFileId = f.getId();
    }
    rec.taskUrl = url;
    rec.taskNote = note;
    rec.taskAt = new Date().toISOString();
    rec.taskStatus = "Dikirim";
    rec.taskFeedback = "";
    writeRow(sheet, hit.row, rec);
  } finally {
    lock.releaseLock();
  }
  notifyAdmin("Tugas akhir masuk: " + rec.id, rec.name + (url ? "\n" + url : ""), {
    icon: "📝", title: "Tugas akhir masuk", id: rec.id, rows: [["Nama", rec.name], ["Tautan", url || "(file diunggah)"]], footer: "Periksa & nilai di dashboard admin" });
  return { ok: true, participant: participantView(rec) };
}

/* ======================= Riwayat aksi admin (sheet "Log") ======================= */

var LOG_SHEET = "Log", LOG_HEADERS = ["at", "by", "action", "id", "detail"];
function logSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
// Catat tanpa pernah menggagalkan aksi utamanya
function logAct(action, id, detail) {
  try {
    var sh = logSheet(), n = sh.getLastRow() + 1;
    sh.getRange(n, 1, 1, LOG_HEADERS.length).setNumberFormat("@")
      .setValues([[new Date().toISOString(), ACTOR, action, id || "", String(detail || "").slice(0, 2000)]]);
  } catch (e) { Logger.log("Log gagal: " + e); }
}
function logRead(max) {
  var sh = logSheet(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var k = Math.min(n, max || 400);
  return sh.getRange(sh.getLastRow() - k + 1, 1, k, LOG_HEADERS.length).getValues().reverse().map(function (r) {
    return { at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), by: String(r[1]), action: String(r[2]), id: String(r[3]), detail: String(r[4]) };
  });
}

/* ======================= Pengingat email otomatis ======================= */
// Dijalankan pemicu per jam (pasang sekali: jalankan pasangPengingat() dari editor Apps Script).
//  • H-1 sesi: dalam 26 jam sebelum sesi dimulai, kirim pengingat ke peserta Aktif/Lulus program terkait.
//  • Tagihan: sekali per pendaftar pelatihan penuh yang belum membayar > REMIND_PAY_AFTER_HOURS jam (sebelum pendaftaran ditutup).
// Penerima dicatat agar tidak dobel; bila kuota email harian menipis, sisanya dikirim pada jam berikutnya.
function sesStart(s) { var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/); return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], m[4] - 7, +m[5])); }
function propList(k) { return String(PropertiesService.getScriptProperties().getProperty(k) || "").split(",").filter(String); }
function kirimPengingat(now) {
  now = now instanceof Date ? now : new Date(); // pemicu mengirim objek event → pakai waktu sekarang
  if (!(now instanceof Date) || isNaN(now)) now = new Date();
  var S = settingsRead(), P = PropertiesService.getScriptProperties(), rows = null;
  var budget = Math.max(0, (CONFIG.SEND_EMAIL ? MailApp.getRemainingDailyQuota() : 0) - CONFIG.MAIL_RESERVE);
  var out = { ok: true, at: now.toISOString(), session: 0, pay: 0, pending: 0, notes: [] };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Sesi pada tanggal yang sama (mis. pagi & siang) digabung dalam satu email agar kuota tidak terpakai dua kali
    var groups = [];
    CONFIG.SESSIONS.forEach(function (x) {
      var g = groups.filter(function (y) { return y.free === (x[0] === "G") && y.day === x[1].slice(0, 10); })[0];
      if (g) g.items.push(x); else groups.push({ free: x[0] === "G", day: x[1].slice(0, 10), items: [x] });
    });
    if (S.remindSession) groups.forEach(function (gr) {
      var free = gr.free, key = gr.items.map(function (x) { return x[0]; }).join("-"), start = sesStart(gr.items[0][1]);
      var label = free ? "Kelas Gratis" : "Sesi " + gr.items.map(function (x) { return x[0]; }).join(" & ");
      if (now >= start || now < new Date(start.getTime() - 26 * 3600e3)) return;
      rows = rows || readAll();
      var done = propList("REMIND_SES_" + key), add = [];
      var pool = rows.filter(function (r) { return ACTIVE.indexOf(r.status) >= 0 && isFree(r) === free && r.email && done.indexOf(r.id) < 0; });
      var zoom = P.getProperty(free ? "ZOOM_LINK_FREE" : "ZOOM_LINK") || "";
      pool.forEach(function (r) {
        if (budget < 1) { out.pending++; return; }
        var rowsMail = [];
        gr.items.forEach(function (x) { rowsMail.push([free ? "Topik" : "Sesi " + x[0], "<b>" + h(x[3]) + "</b><br>" + h(x[2])]); });
        var ok = sendMail(r.email, "Pengingat: " + label + " besok · " + gr.items[0][2].split(" · ")[0], mailTemplate(
          label + (gr.items.length > 1 ? " berlangsung besok ⏰" : " dimulai besok ⏰"),
          "Halo <b>" + h(r.name) + "</b>, kami ingatkan sesi live berikut:",
          rowsMail.concat(zoom ? [["Zoom", "<a href='" + h(zoom) + "' style='color:#38bdf8'>" + h(zoom) + "</a>"]] : []),
          "Siapkan laptop dengan R, RStudio & Quarto. Tautan Zoom, materi, virtual background, dan presensi ada di Portal Peserta:",
          CONFIG.SITE_URL + "portal.html#jadwal", "Buka Portal Peserta"));
        budget--;
        if (ok) { add.push(r.id); out.session++; }
      });
      if (add.length) P.setProperty("REMIND_SES_" + key, done.concat(add).join(","));
    });
    var today = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");
    if (S.remindPay && today <= CONFIG.CLOSE_DATE) {
      rows = rows || readAll();
      var paid = propList("REMIND_PAY"), addp = [];
      rows.filter(function (r) {
        return r.status === STATUSES[0] && !isFree(r) && r.email && paid.indexOf(r.id) < 0 &&
          now - new Date(r.createdAt) >= CONFIG.REMIND_PAY_AFTER_HOURS * 3600e3;
      }).forEach(function (r) {
        if (budget < 1) { out.pending++; return; }
        var ok = sendMail(r.email, "Pengingat pembayaran pelatihan — " + r.id, mailTemplate("Tagihan Anda menunggu pembayaran",
          "Halo <b>" + h(r.name) + "</b>, terima kasih telah mendaftar. Kursi Anda belum terkonfirmasi karena pembayaran belum kami terima.",
          [["No. pendaftaran", r.id], ["<b>Jumlah transfer</b>", "<b style='font-size:18px;color:#e879f9'>" + rp(r.total) + "</b> (termasuk 3 digit kode unik)"],
           ["Rekening", h(CONFIG.PAYMENT)], ["Batas pendaftaran", h(CONFIG.CLOSE_DATE)]],
          "Setelah transfer, unggah bukti pembayaran agar akses segera aktif. Abaikan email ini jika Anda sudah membayar.",
          CONFIG.SITE_URL + "konfirmasi.html?id=" + encodeURIComponent(r.id), "Unggah Bukti Transfer"));
        budget--;
        if (ok) { addp.push(r.id); out.pay++; }
      });
      if (addp.length) P.setProperty("REMIND_PAY", paid.concat(addp).join(","));
    }
    if (out.pending) out.notes.push(out.pending + " email ditunda karena kuota harian — dikirim otomatis pada jam berikutnya");
    P.setProperty("REMIND_STATUS", JSON.stringify(out));
  } finally {
    lock.releaseLock();
  }
  if (out.session || out.pay) { var a = ACTOR; ACTOR = "sistem"; logAct("Pengingat email", "", out.session + " pengingat sesi, " + out.pay + " pengingat tagihan" + (out.pending ? ", " + out.pending + " ditunda" : "")); ACTOR = a; }
  return out;
}
// Jalankan SEKALI dari editor Apps Script (pilih fungsi → Run) untuk memasang pemicu per jam
function pasangPengingat() {
  hapusPengingat();
  ScriptApp.newTrigger("kirimPengingat").timeBased().everyHours(1).create();
  return "Pemicu pengingat per jam terpasang";
}
function hapusPengingat() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "kirimPengingat") ScriptApp.deleteTrigger(t); });
}
function triggerOn() {
  try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "kirimPengingat"; }); }
  catch (e) { return null; } // izin ScriptApp belum diberikan → jalankan pasangPengingat() dari editor
}

/* ======================= Aksi massal ======================= */

// Satu aksi untuk banyak peserta (maks. 25 per panggilan agar tidak melewati batas waktu Apps Script).
// op: "Aktif" (verifikasi & aktifkan), "Lulus" (terbitkan sertifikat), "resend" (kirim ulang email kode akses).
// Peserta yang tidak memenuhi syarat dilewati dengan alasannya — tidak menggagalkan yang lain.
function bulkUpdate(ids, op) {
  if (["Aktif", "Lulus", "resend"].indexOf(op) < 0) throw new Error("Aksi massal tidak dikenal");
  ids = (ids || []).slice(0, 25);
  var results = ids.map(function (id) {
    try {
      var sheet = getSheet(), rec = readRow(sheet, findRow(sheet, id));
      if (op === "resend") { resendAccess(id); return { id: id, ok: true, mailed: true }; }
      if (op === "Aktif") {
        if (rec.status !== "Menunggu Verifikasi") throw new Error("Status bukan Menunggu Verifikasi");
        if (!isFree(rec) && Number(rec.paidAmount) !== Number(rec.total)) throw new Error("Jumlah transfer tidak sama dengan tagihan (periksa satu per satu)");
      }
      if (op === "Lulus" && rec.status !== "Aktif") throw new Error("Status bukan Aktif");
      var res = updateReg(id, { status: op });
      return { id: id, ok: true, mailed: res.mailed };
    } catch (e) {
      return { id: id, ok: false, error: e.message };
    }
  });
  return { ok: true, results: results };
}

/* ======================= Pengumuman ======================= */

// Pengumuman portal disimpan di Script Property ANNOUNCEMENTS (JSON, terbaru di depan, maks. 12).
// target: "Semua" | "Penuh" | "Gratis". Teks polos — portal yang menampilkannya dengan aman.
var ANN_TARGETS = ["Semua", FULL, FREE];
function annRead() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("ANNOUNCEMENTS") || "[]"); } catch (e) { return []; }
}
function annFor(program) {
  return annRead().filter(function (a) { return a.target === "Semua" || a.target === program; });
}
function annWrite(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var list = fn(annRead()).slice(0, 12);
    PropertiesService.getScriptProperties().setProperty("ANNOUNCEMENTS", JSON.stringify(list));
    return { ok: true, list: list };
  } finally {
    lock.releaseLock();
  }
}
function annSave(b) {
  var text = String(b.text || "").trim().slice(0, 600);
  if (!text) throw new Error("Tulis isi pengumuman");
  var target = ANN_TARGETS.indexOf(b.target) >= 0 ? b.target : "Semua";
  return annWrite(function (list) {
    list.unshift({ id: "A" + new Date().getTime() + Math.floor(Math.random() * 1000), at: new Date().toISOString(), target: target, text: text });
    logAct("Pengumuman terbit", "", "[" + target + "] " + text.slice(0, 200));
    return list;
  });
}
function annDelete(id) {
  return annWrite(function (list) {
    var gone = list.filter(function (a) { return a.id === id; })[0];
    if (gone) logAct("Pengumuman dihapus", "", "[" + gone.target + "] " + gone.text.slice(0, 200));
    return list.filter(function (a) { return a.id !== id; });
  });
}

/* ======================= Email ======================= */

function sendAccessMail(rec) {
  if (isFree(rec)) {
    return sendMail(rec.email, "Kode Akses Kelas Gratis — publichealth.id · " + rec.id, mailTemplate("Akses kelas gratis aktif 🎉",
      "Halo <b>" + h(rec.name) + "</b>, terima kasih telah membeli buku kami. Selamat bergabung di kelas pra-pelatihan gratis!",
      [["No. pendaftaran", rec.id], ["Email login", rec.email],
       ["<b>Kode akses</b>", "<b style='font-family:monospace;font-size:20px;letter-spacing:2px;color:#e879f9'>" + h(rec.accessCode) + "</b>"]],
      "Masuk ke Portal Peserta untuk membuka 5 modul pengenalan R, RStudio & Quarto, mengunduh bahan PDF & data latihan, serta tautan Zoom kelas gratis:",
      CONFIG.SITE_URL + "masuk.html?email=" + encodeURIComponent(rec.email), "Buka Portal Peserta"));
  }
  var body = mailTemplate("Akses pelatihan aktif 🎉",
    "Halo <b>" + h(rec.name) + "</b>, pembayaran Anda telah kami verifikasi. Selamat bergabung!",
    [["No. pendaftaran", rec.id], ["Email login", rec.email],
     ["<b>Kode akses</b>", "<b style='font-family:monospace;font-size:20px;letter-spacing:2px;color:#e879f9'>" + h(rec.accessCode) + "</b>"]],
    "Masuk ke Portal Peserta untuk membuka 20 modul presentasi, mengunduh bahan presentasi PDF & data latihan, serta melihat jadwal & tautan Zoom:",
    CONFIG.SITE_URL + "masuk.html?email=" + encodeURIComponent(rec.email), "Buka Portal Peserta");
  return sendMail(rec.email, "Kode Akses Pelatihan " + shortName() + " — " + rec.id, body);
}

// Email dikirim dari akun Gmail pemilik Apps Script (publichealth.id.portal@gmail.com) dengan nama
// "Pelatihan MAD-R · publichealth.id"; balasan peserta diarahkan ke info@publichealth.id (Reply-To, diteruskan forwarding).
function sendMail(to, subject, html) {
  if (!CONFIG.SEND_EMAIL || !to) return false;
  try {
    if (MailApp.getRemainingDailyQuota() < 1) { Logger.log("Kuota email harian habis"); return false; }
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: "Pelatihan MAD-R · publichealth.id", replyTo: CONFIG.CONTACT_EMAIL });
    return true;
  } catch (e) { Logger.log("Email gagal: " + e); return false; }
}

// Jalankan dari editor: kirim email uji (contoh email kode akses) ke alamat di TES_EMAIL_KE, atau ke akun ini
function tesEmail() {
  var to = PropertiesService.getScriptProperties().getProperty("TES_EMAIL_KE") || Session.getEffectiveUser().getEmail();
  var ok = sendMail(to, "Tes email · Kode Akses Pelatihan MAD-R",
    mailTemplate("Tes email berhasil ✅", "Ini email uji dari sistem pelatihan publichealth.id. Tampilan ini sama dengan email kode akses peserta.",
      [["Pengirim", Session.getEffectiveUser().getEmail()], ["Balas ke", CONFIG.CONTACT_EMAIL],
       ["<b>Kode akses (contoh)</b>", "<b style='font-family:monospace;font-size:20px;letter-spacing:2px;color:#e879f9'>ABCD-2345</b>"]],
      "Coba tekan Balas: alamat tujuan harus " + CONFIG.CONTACT_EMAIL + ".", CONFIG.SITE_URL + "masuk.html", "Buka Portal Peserta"));
  Logger.log((ok ? "✓ Terkirim ke " + to : "✗ GAGAL kirim ke " + to) + " · sisa kuota hari ini: " + MailApp.getRemainingDailyQuota());
}

function notifyAdmin(subject, text, tg) {
  if (CONFIG.NOTIFY_EMAIL) { try { MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, text); } catch (e) { /* abaikan */ } }
  if (tg) notifyTelegram(tg);
}

/* ======================= Notifikasi Telegram =======================
 * Script Properties: TELEGRAM_BOT_TOKEN (dari @BotFather) dan TELEGRAM_CHAT_ID
 * (satu atau beberapa chat/grup, pisahkan dengan koma). Jalankan cariChatIdTelegram()
 * untuk menemukan chat ID, lalu tesTelegram() untuk mengirim pesan uji. */
function notifyTelegram(m) {
  var P = PropertiesService.getScriptProperties();
  var token = String(P.getProperty("TELEGRAM_BOT_TOKEN") || "").trim(), chats = String(P.getProperty("TELEGRAM_CHAT_ID") || "").trim();
  if (!token || !chats) return false;
  var lines = ["<b>" + h(m.icon || "🔔") + " " + h(m.title) + "</b>"];
  if (m.id) lines.push("<code>" + h(m.id) + "</code>");
  lines.push("");
  (m.rows || []).forEach(function (r) { if (r[1]) lines.push("<b>" + h(r[0]) + ":</b> " + h(r[1])); });
  if (m.footer) { lines.push(""); lines.push(h(m.footer)); }
  lines.push(""); lines.push('<a href="' + CONFIG.SITE_URL + 'admin.html">Buka dashboard admin</a>');
  var ok = false;
  chats.split(",").forEach(function (chat) {
    chat = chat.trim(); if (!chat) return;
    try {
      var r = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "post", contentType: "application/json", muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: chat, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true })
      });
      ok = r.getResponseCode() === 200 || ok;
      if (r.getResponseCode() !== 200) Logger.log("Telegram gagal (" + chat + "): " + r.getContentText());
    } catch (e) { Logger.log("Telegram error: " + e); }
  });
  return ok;
}

// Jalankan dari editor setelah mengirim pesan apa saja ke bot (atau ke grup yang berisi bot)
function cariChatIdTelegram() {
  var token = String(PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN") || "").trim();
  if (!token) { Logger.log("Isi dulu TELEGRAM_BOT_TOKEN di Script Properties."); return; }
  var r = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getUpdates", { muteHttpExceptions: true }).getContentText());
  if (!r.ok) { Logger.log("Token tidak valid: " + JSON.stringify(r)); return; }
  var seen = {};
  (r.result || []).forEach(function (u) {
    var c = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (c && !seen[c.id]) { seen[c.id] = 1; Logger.log("Chat ID: " + c.id + "  ·  " + (c.title || [c.first_name, c.last_name].join(" ")) + "  (" + c.type + ")"); }
  });
  if (!Object.keys(seen).length) Logger.log("Belum ada pesan. Kirim pesan (mis. /start) ke bot Anda di Telegram, lalu jalankan fungsi ini lagi.");
}

function tesTelegram() {
  var ok = notifyTelegram({ icon: "✅", title: "Tes notifikasi Pelatihan MAD-R", rows: [["Waktu", Utilities.formatDate(new Date(), "Asia/Jakarta", "dd-MM-yyyy HH:mm") + " WIB"]],
    footer: "Bot Telegram terhubung. Notifikasi pendaftar baru akan muncul di sini." });
  Logger.log(ok ? "Terkirim — cek Telegram Anda." : "Gagal. Periksa TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID (lihat log di atas).");
}

function mailTemplate(title, intro, rows, ctaText, ctaUrl, ctaLabel) {
  var tr = rows.map(function (r) {
    return "<tr><td style='padding:6px 12px 6px 0;color:#a9acd9'>" + r[0] + "</td><td style='padding:6px 0;color:#fff'>" + r[1] + "</td></tr>";
  }).join("");
  return "<div style='background:#070b2b;padding:28px 12px;font-family:Arial,Helvetica,sans-serif'>" +
    "<div style='max-width:560px;margin:0 auto;background:#0d1340;border:1px solid #5b2bd6;border-radius:16px;padding:28px;color:#e9e8ff'>" +
    "<img src='" + CONFIG.SITE_URL + "assets/brand/logo-full-dark.png' alt='publichealth.id — " + h(CONFIG.MOTTO) + "' width='200' style='display:block;width:200px;height:auto;margin-bottom:18px'>" +
    "<div style='font-size:11px;letter-spacing:3px;color:#38bdf8;text-transform:uppercase;font-weight:bold'>Pelatihan Online · " + h(CONFIG.BATCH) + "</div>" +
    "<div style='font-size:15px;font-weight:bold;color:#fff;margin:6px 0 18px'>" + h(CONFIG.TRAINING) + "</div>" +
    "<h2 style='color:#fff;margin:0 0 8px;font-size:22px'>" + title + "</h2><p style='line-height:1.6'>" + intro + "</p>" +
    "<table style='border-collapse:collapse;font-size:14px;margin:12px 0'>" + tr + "</table>" +
    "<p style='line-height:1.6'>" + ctaText + "</p>" +
    "<p><a href='" + ctaUrl + "' style='display:inline-block;background:linear-gradient(90deg,#a855f7,#e879f9);color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px'>" + ctaLabel + "</a></p>" +
    "<p style='font-size:12px;color:#a9acd9;margin-top:24px'>Pertanyaan? Email <a href='mailto:" + CONFIG.CONTACT_EMAIL + "' style='color:#38bdf8'>" + CONFIG.CONTACT_EMAIL + "</a> · WhatsApp admin: +" + CONFIG.ADMIN_WA + "<br>" +
    "Diselenggarakan oleh <a href='https://publichealth.id' style='color:#38bdf8'>publichealth.id</a> · <i>" + h(CONFIG.MOTTO) + "</i></p></div></div>";
}

/* ======================= Helper ======================= */

function publicReg(r) {
  // Data minimal untuk publik (tanpa kontak & kode akses)
  return { id: r.id, name: r.name, category: r.category, status: r.status, price: Number(r.price), discount: Number(r.discount) || 0, program: r.program || FULL,
    uniqueCode: Number(r.uniqueCode), total: Number(r.total), createdAt: r.createdAt };
}

function participantView(r) {
  var S = settingsRead(), free = isFree(r);
  return { program: free ? FREE : FULL, bookDiscount: CONFIG.BOOK_DISCOUNT, id: r.id, name: r.name, email: r.email, institution: r.institution, category: r.category, status: r.status,
    evalDone: !!r.evalAt, evalOpen: S.evalOpen, evalRequired: CONFIG.EVAL_REQUIRED_FOR_CERT,
    // Kehadiran: sesi yang sudah tercatat + sesi yang kode hadirnya sedang dibuka admin (kodenya sendiri tidak dikirim)
    attendance: attList(r.attendance), attendOpen: sessionKeys(free).filter(function (k) { return !!S.attend[k]; }),
    recordings: sessionKeys(free).reduce(function (m, k) { if (S.rec[k]) m[k] = S.rec[k]; return m; }, {}),
    task: free ? null : { open: S.taskOpen, due: S.taskDue, info: S.taskInfo, status: r.taskStatus || "", url: r.taskUrl || "", hasFile: !!r.taskFileId,
      note: r.taskNote || "", at: r.taskAt || "", feedback: r.taskFeedback || "", maxMb: CONFIG.TASK_MAX_MB },
    // Sertifikat ditahan sampai evaluasi diisi (bila diwajibkan)
    certIssued: r.status === "Lulus" && !!r.certNo,
    certNo: certAllowed(r) ? r.certNo : "", certDate: certAllowed(r) ? r.certDate : "",
    progress: String(r.progress || "").split(",").filter(String), batch: CONFIG.BATCH, jp: CONFIG.CERT_JP };
}

function certAllowed(r) {
  return r.status === "Lulus" && !!r.certNo && (!CONFIG.EVAL_REQUIRED_FOR_CERT || !!r.evalAt);
}

function checkFile(f, allowed, maxMb, msg) {
  allowed = allowed || { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  maxMb = maxMb || CONFIG.PROOF_MAX_MB;
  if (!allowed[f.mimeType] || !f.data) throw new Error(msg || "File harus JPG, PNG, WEBP, atau PDF");
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > maxMb * 1048576) throw new Error("Ukuran file melebihi " + maxMb + " MB");
  return { bytes: bytes, mimeType: f.mimeType, ext: allowed[f.mimeType] };
}

function saveFile(f, base) {
  var stamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss");
  return getFolder().createFile(Utilities.newBlob(f.bytes, f.mimeType, base + "_" + stamp + "." + f.ext));
}

// Cocokkan no. pendaftaran dengan email ATAU no. WhatsApp pendaftar
function findOwned(sheet, id, contact) {
  var row = 0;
  try { row = findRow(sheet, id); } catch (e) { row = 0; }
  var rec = row ? readRow(sheet, row) : null;
  var c = String(contact || "").trim().toLowerCase();
  var okContact = rec && c && (c.indexOf("@") > 0 ? String(rec.email).toLowerCase() === c : normPhone(rec.phone) === normPhone(c));
  if (!okContact) {
    Utilities.sleep(800);
    throw new Error("No. pendaftaran dan email/WhatsApp tidak cocok");
  }
  return { row: row, rec: rec };
}

// Baris peserta dengan email & kode akses yang cocok (satu email bisa terdaftar di kelas gratis & pelatihan penuh)
function findByEmailCode(sheet, email, code) {
  var n = sheet.getLastRow() - 1;
  if (n < 1 || !email || !code) return null;
  var iEmail = HEADERS.indexOf("email"), iCode = HEADERS.indexOf("accessCode"), iStatus = HEADERS.indexOf("status");
  var vals = sheet.getRange(2, 1, n, HEADERS.length).getValues();
  for (var i = vals.length - 1; i >= 0; i--)
    if (String(vals[i][iEmail]).toLowerCase() === email && vals[i][iCode] && normCode(vals[i][iCode]) === code && vals[i][iStatus] !== "Dibatalkan")
      return { row: i + 2, rec: rowToObj(vals[i]) };
  return null;
}

function findByEmail(sheet, email) {
  var n = sheet.getLastRow() - 1;
  if (n < 1 || !email) return null;
  var iEmail = HEADERS.indexOf("email"), iStatus = HEADERS.indexOf("status");
  var vals = sheet.getRange(2, 1, n, HEADERS.length).getValues();
  for (var i = vals.length - 1; i >= 0; i--)
    if (String(vals[i][iEmail]).toLowerCase() === email && vals[i][iStatus] !== "Dibatalkan") return { row: i + 2, rec: rowToObj(vals[i]) };
  return null;
}

function requireAdmin(key) {
  var real = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!real) throw new Error("ADMIN_KEY belum diatur di Script Properties");
  if (!key || key !== real) {
    Utilities.sleep(800);
    throw new Error("Kunci admin salah");
  }
}

function getFolder() {
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty("PROOF_FOLDER_ID");
  if (fid) {
    try { return DriveApp.getFolderById(fid); } catch (e) { /* folder terhapus → buat baru */ }
  }
  var folder = DriveApp.createFolder(CONFIG.PROOF_FOLDER);
  props.setProperty("PROOF_FOLDER_ID", folder.getId());
  return folder;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat("@");
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat("@");
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  }
  return sheet;
}

function readAll(sheet) {
  sheet = sheet || getSheet();
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, HEADERS.length).getValues().map(rowToObj);
}

function readRow(sheet, row) {
  return rowToObj(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
}

// Tulis sebagai teks agar no. WhatsApp tetap diawali 0
function writeRow(sheet, row, rec) {
  sheet.getRange(row, 1, 1, HEADERS.length).setNumberFormat("@")
    .setValues([HEADERS.map(function (k) { return rec[k] == null ? "" : String(rec[k]); })]);
}

function findRow(sheet, id) {
  var n = sheet.getLastRow() - 1;
  if (n < 1 || !id) throw new Error("Pendaftaran tidak ditemukan");
  var ids = sheet.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  throw new Error("Pendaftaran tidak ditemukan");
}

function rowToObj(r) {
  var o = {};
  HEADERS.forEach(function (k, i) { var v = r[i]; o[k] = v instanceof Date ? v.toISOString() : v; });
  return o;
}

function newId() {
  var props = PropertiesService.getScriptProperties();
  var seq = (parseInt(props.getProperty("REG_SEQ"), 10) || 0) + 1;
  props.setProperty("REG_SEQ", String(seq));
  return "MAD-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyMMdd") + "-" + ("000" + seq).slice(-4);
}

function newCertNo() { return newSeqNo("CERT_SEQ", CONFIG.CERT_PREFIX); }

function newSeqNo(prop, prefix) {
  var props = PropertiesService.getScriptProperties();
  var seq = (parseInt(props.getProperty(prop), 10) || 0) + 1;
  props.setProperty(prop, String(seq));
  return prefix + ("000" + seq).slice(-4);
}

// 8 karakter tanpa huruf/angka yang mirip (0/O, 1/I/L)
function newAccessCode() {
  var A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  for (var i = 0; i < 8; i++) s += A.charAt(((bytes[i] % 256) + 256) % 256 % A.length);
  return s.slice(0, 4) + "-" + s.slice(4);
}

function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function normPhone(p) { return String(p || "").replace(/\D/g, "").replace(/^(62|0)+/, ""); }
function rp(n) { return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID"); }
function h(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function shortName() { return "Manajemen & Analisis Data Epidemiologi (R, RStudio & Quarto)"; }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
