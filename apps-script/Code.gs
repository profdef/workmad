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
 * 5. Salin URL /exec ke assets/config.js (API_URL).
 *
 * PENTING: samakan CONFIG di bawah dengan assets/config.js.
 * File ini ikut ter-publish di repo GitHub — JANGAN menulis kunci/tautan rahasia di sini.
 */

var CONFIG = {
  TRAINING: "Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat Menggunakan R, RStudio & Quarto",
  BATCH: "Angkatan I · November 2026",
  CATEGORIES: {
    "Mahasiswa (S1/S2/S3)": 350000,
    "Dosen / Peneliti / Tenaga Kesehatan": 500000,
    "Umum / Instansi": 650000
  },
  STUDENT_CATEGORY: "Mahasiswa (S1/S2/S3)", // kategori yang wajib unggah KTM
  QUOTA: 100,
  CLOSE_DATE: "2026-11-05",                 // pendaftaran ditutup setelah tanggal ini (WIB)
  UNIQUE_CODE: { MIN: 101, MAX: 499 },      // 3 digit kode unik ditambahkan ke tagihan
  SITE_URL: "https://profdef.github.io/workmad/", // alamat GitHub Pages (untuk tautan di email)
  PAYMENT: "Bank BNI 46 · 0214815784 · a.n. Defriman Djafri",
  ADMIN_WA: "6281310603106",
  CERT_PREFIX: "MAD-R/2026/",
  CERT_JP: 18,
  PROOF_MAX_MB: 5,
  PROOF_FOLDER: "Bukti Pembayaran Pelatihan MAD-R",
  SEND_EMAIL: true,     // kirim email tagihan & kode akses ke peserta
  NOTIFY_EMAIL: ""      // email admin untuk notifikasi pendaftaran/bukti baru ("" = mati)
};

var SHEET_NAME = "Peserta";
var HEADERS = ["id", "createdAt", "status", "name", "email", "phone", "gender", "institution", "profession",
  "category", "province", "city", "source", "note", "price", "uniqueCode", "total",
  "payerName", "paidAmount", "proofAt", "proofUrl", "proofFileId", "ktmFileId",
  "accessCode", "activatedAt", "lastLogin", "loginCount", "progress", "certNo", "certDate", "adminNote"];
var STATUSES = ["Menunggu Pembayaran", "Menunggu Verifikasi", "Aktif", "Lulus", "Dibatalkan"];
var ACTIVE = ["Aktif", "Lulus"];

function setup() {
  getSheet();
  var folder = getFolder();
  Logger.log("Siap. Folder bukti pembayaran: " + folder.getUrl());
  var p = PropertiesService.getScriptProperties();
  ["ADMIN_KEY", "MATERI_KEY"].forEach(function (k) {
    if (!p.getProperty(k)) Logger.log("PERINGATAN: " + k + " belum diatur di Script Properties.");
  });
  if (CONFIG.SEND_EMAIL) Logger.log("Sisa kuota email hari ini: " + MailApp.getRemainingDailyQuota());
}

function doGet() {
  return json({ ok: true, message: "API Pelatihan MAD-R aktif" });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    switch (body.action) {
      case "stats":    return json(stats());
      case "register": return json(register(body.reg || {}));
      case "confirm":  return json(confirmPayment(body));
      case "status":   return json(checkStatus(body));
      case "login":    return json(login(body));
      case "forgot":   return json(forgot(body));
      case "track":    return json(track(body));
      case "verify":   return json(verifyCert(body.no));
      case "list":     requireAdmin(body.key); return json({ ok: true, regs: readAll(), stats: stats() });
      case "update":   requireAdmin(body.key); return json(updateReg(body.id, body.fields || {}));
      case "resend":   requireAdmin(body.key); return json(resendAccess(body.id));
      case "file":     requireAdmin(body.key); return json(getFile(body.id, body.kind));
      case "delete":   requireAdmin(body.key); return json(deleteReg(body.id));
      default: throw new Error("Aksi tidak dikenal");
    }
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

/* ======================= Aksi publik ======================= */

// Hanya angka — tanpa data pribadi
function stats(rows) {
  rows = rows || readAll();
  var active = rows.filter(function (r) { return r.status !== "Dibatalkan"; });
  var today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var remaining = Math.max(0, CONFIG.QUOTA - active.length);
  return {
    ok: true, quota: CONFIG.QUOTA, registered: active.length, remaining: remaining,
    closed: remaining <= 0 || today > CONFIG.CLOSE_DATE
  };
}

function register(o) {
  var s = function (v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); };
  var reg = {
    name: s(o.name, 100), email: s(o.email, 120).toLowerCase(), phone: s(o.phone, 20).replace(/[^\d+]/g, ""),
    gender: s(o.gender, 20), institution: s(o.institution, 150), profession: s(o.profession, 60),
    category: s(o.category, 60), province: s(o.province, 60), city: s(o.city, 80),
    source: s(o.source, 60), note: s(o.note, 500)
  };
  if (!reg.name || !reg.institution || !reg.city) throw new Error("Data pendaftaran belum lengkap");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reg.email)) throw new Error("Alamat email tidak valid");
  if (!/^(\+?62|0)8\d{7,12}$/.test(reg.phone)) throw new Error("Nomor WhatsApp tidak valid");
  if (!(reg.category in CONFIG.CATEGORIES)) throw new Error("Kategori peserta tidak valid");
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
    var dup = rows.filter(function (r) { return r.status !== "Dibatalkan" && String(r.email).toLowerCase() === reg.email; })[0];
    if (dup) throw new Error("Email ini sudah terdaftar dengan no. pendaftaran " + dup.id +
      " (status: " + dup.status + "). Gunakan halaman Konfirmasi Pembayaran atau Portal Peserta.");

    reg.id = newId();
    reg.createdAt = new Date().toISOString();
    reg.status = STATUSES[0];
    reg.price = CONFIG.CATEGORIES[reg.category];
    // Kode unik yang belum dipakai pendaftar lain yang belum membayar dengan tarif sama
    var used = {};
    rows.forEach(function (r) { if (r.status === STATUSES[0] || r.status === STATUSES[1]) used[Number(r.total)] = 1; });
    var U = CONFIG.UNIQUE_CODE, code = 0;
    for (var i = 0; i < 50; i++) {
      code = U.MIN + Math.floor(Math.random() * (U.MAX - U.MIN + 1));
      if (!used[reg.price + code]) break;
    }
    reg.uniqueCode = code;
    reg.total = reg.price + code;
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
      [["No. pendaftaran", reg.id], ["Kategori", reg.category], ["Biaya", rp(reg.price)], ["Kode unik", rp(reg.uniqueCode)],
       ["<b>Total transfer</b>", "<b style='font-size:18px;color:#e879f9'>" + rp(reg.total) + "</b>"], ["Rekening", CONFIG.PAYMENT]],
      "Mohon transfer <b>tepat " + rp(reg.total) + "</b> (termasuk kode unik agar mudah diverifikasi), lalu unggah bukti transfer di:",
      CONFIG.SITE_URL + "konfirmasi.html?id=" + encodeURIComponent(reg.id), "Konfirmasi Pembayaran"));
  notifyAdmin("Pendaftar baru: " + reg.id, reg.name + " · " + reg.institution + "\n" + reg.category + " · " + rp(reg.total));

  return { ok: true, reg: publicReg(reg) };
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
    " (tagihan " + rp(rec.total) + ")\n" + rec.proofUrl);
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
    var hit = findByEmail(sheet, email);
    if (!hit || !hit.rec.accessCode || normCode(hit.rec.accessCode) !== code) {
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
    var P = PropertiesService.getScriptProperties();
    var key = P.getProperty("MATERI_KEY");
    if (!key) throw new Error("Materi belum disiapkan admin (MATERI_KEY kosong)");
    return {
      ok: true, key: key,
      zoom: P.getProperty("ZOOM_LINK") || "", waGroup: P.getProperty("WA_GROUP_LINK") || "",
      participant: participantView(rec)
    };
  } finally {
    lock.releaseLock();
  }
}

function forgot(b) {
  var email = String(b.email || "").trim().toLowerCase();
  var hit = email ? findByEmail(getSheet(), email) : null;
  if (hit && ACTIVE.indexOf(hit.rec.status) >= 0 && hit.rec.accessCode) sendAccessMail(hit.rec);
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
    var hit = findByEmail(sheet, String(b.email || "").trim().toLowerCase());
    if (!hit || normCode(hit.rec.accessCode) !== normCode(b.code) || ACTIVE.indexOf(hit.rec.status) < 0) return { ok: false, error: "Sesi tidak valid" };
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

/* ======================= Aksi admin ======================= */

function updateReg(id, fields) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var rec, becameActive = false;
  try {
    var sheet = getSheet();
    var row = findRow(sheet, id);
    rec = readRow(sheet, row);
    if ("status" in fields) {
      if (STATUSES.indexOf(fields.status) < 0) throw new Error("Status tidak valid");
      if (ACTIVE.indexOf(fields.status) >= 0 && !rec.accessCode) {
        rec.accessCode = newAccessCode();
        rec.activatedAt = new Date().toISOString();
        becameActive = true;
      }
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
    writeRow(sheet, row, rec);
  } finally {
    lock.releaseLock();
  }
  var mailed = false;
  if (becameActive && fields.notify !== false) mailed = sendAccessMail(rec);
  return { ok: true, reg: rec, mailed: mailed };
}

function resendAccess(id) {
  var sheet = getSheet();
  var rec = readRow(sheet, findRow(sheet, id));
  if (ACTIVE.indexOf(rec.status) < 0 || !rec.accessCode) throw new Error("Peserta belum berstatus Aktif");
  var mailed = sendAccessMail(rec);
  if (!mailed) throw new Error("Email tidak terkirim (SEND_EMAIL mati atau kuota habis)");
  return { ok: true, mailed: true };
}

function getFile(id, kind) {
  var sheet = getSheet();
  var rec = readRow(sheet, findRow(sheet, id));
  var fid = kind === "ktm" ? rec.ktmFileId : rec.proofFileId;
  if (!fid) throw new Error("File tidak ditemukan");
  var file = DriveApp.getFileById(fid);
  var blob = file.getBlob();
  return {
    ok: true, mimeType: blob.getContentType(), url: file.getUrl(),
    dataUrl: "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes())
  };
}

function deleteReg(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    sheet.deleteRow(findRow(sheet, id));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ======================= Email ======================= */

function sendAccessMail(rec) {
  var body = mailTemplate("Akses pelatihan aktif 🎉",
    "Halo <b>" + h(rec.name) + "</b>, pembayaran Anda telah kami verifikasi. Selamat bergabung!",
    [["No. pendaftaran", rec.id], ["Email login", rec.email],
     ["<b>Kode akses</b>", "<b style='font-family:monospace;font-size:20px;letter-spacing:2px;color:#e879f9'>" + h(rec.accessCode) + "</b>"]],
    "Masuk ke Portal Peserta untuk membuka 20 modul presentasi, paket latihan RStudio, jadwal & tautan Zoom:",
    CONFIG.SITE_URL + "masuk.html?email=" + encodeURIComponent(rec.email), "Buka Portal Peserta");
  return sendMail(rec.email, "Kode Akses Pelatihan " + shortName() + " — " + rec.id, body);
}

function sendMail(to, subject, html) {
  if (!CONFIG.SEND_EMAIL || !to) return false;
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return false;
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: "Pelatihan MAD-R · Prof. Defriman Djafri" });
    return true;
  } catch (e) { return false; }
}

function notifyAdmin(subject, text) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  try { MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, text); } catch (e) { /* abaikan */ }
}

function mailTemplate(title, intro, rows, ctaText, ctaUrl, ctaLabel) {
  var tr = rows.map(function (r) {
    return "<tr><td style='padding:6px 12px 6px 0;color:#a9acd9'>" + r[0] + "</td><td style='padding:6px 0;color:#fff'>" + r[1] + "</td></tr>";
  }).join("");
  return "<div style='background:#070b2b;padding:28px 12px;font-family:Arial,Helvetica,sans-serif'>" +
    "<div style='max-width:560px;margin:0 auto;background:#0d1340;border:1px solid #5b2bd6;border-radius:16px;padding:28px;color:#e9e8ff'>" +
    "<div style='font-size:11px;letter-spacing:3px;color:#38bdf8;text-transform:uppercase;font-weight:bold'>Pelatihan Online · " + h(CONFIG.BATCH) + "</div>" +
    "<div style='font-size:15px;font-weight:bold;color:#fff;margin:6px 0 18px'>" + h(CONFIG.TRAINING) + "</div>" +
    "<h2 style='color:#fff;margin:0 0 8px;font-size:22px'>" + title + "</h2><p style='line-height:1.6'>" + intro + "</p>" +
    "<table style='border-collapse:collapse;font-size:14px;margin:12px 0'>" + tr + "</table>" +
    "<p style='line-height:1.6'>" + ctaText + "</p>" +
    "<p><a href='" + ctaUrl + "' style='display:inline-block;background:linear-gradient(90deg,#a855f7,#e879f9);color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px'>" + ctaLabel + "</a></p>" +
    "<p style='font-size:12px;color:#a9acd9;margin-top:24px'>Pertanyaan? WhatsApp admin: +" + CONFIG.ADMIN_WA + "</p></div></div>";
}

/* ======================= Helper ======================= */

function publicReg(r) {
  // Data minimal untuk publik (tanpa kontak & kode akses)
  return { id: r.id, name: r.name, category: r.category, status: r.status, price: Number(r.price),
    uniqueCode: Number(r.uniqueCode), total: Number(r.total), createdAt: r.createdAt };
}

function participantView(r) {
  return { id: r.id, name: r.name, email: r.email, institution: r.institution, category: r.category, status: r.status,
    certNo: r.status === "Lulus" ? r.certNo : "", certDate: r.status === "Lulus" ? r.certDate : "",
    progress: String(r.progress || "").split(",").filter(String), batch: CONFIG.BATCH, jp: CONFIG.CERT_JP };
}

function checkFile(f) {
  var allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  if (!allowed[f.mimeType] || !f.data) throw new Error("File harus JPG, PNG, WEBP, atau PDF");
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > CONFIG.PROOF_MAX_MB * 1048576) throw new Error("Ukuran file melebihi " + CONFIG.PROOF_MAX_MB + " MB");
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

function newCertNo() {
  var props = PropertiesService.getScriptProperties();
  var seq = (parseInt(props.getProperty("CERT_SEQ"), 10) || 0) + 1;
  props.setProperty("CERT_SEQ", String(seq));
  return CONFIG.CERT_PREFIX + ("000" + seq).slice(-4);
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
