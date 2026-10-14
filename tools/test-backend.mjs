#!/usr/bin/env node
/**
 * Uji otomatis backend apps-script/Code.gs (dijalankan di atas tiruan layanan Google).
 *   node tools/test-backend.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const GasMock = require(path.join(ROOT, "assets", "gas-mock.js"));
let mem = null;
const be = GasMock.loadBackend(fs.readFileSync(path.join(ROOT, "apps-script", "Code.gs"), "utf8"), { load: () => mem, save: (db) => (mem = db) });
const props = be.gas.db().props;
props.ADMIN_KEY = "rahasia-admin";
props.MATERI_KEY = '"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoxMjM0NTY="\n'; // sengaja dengan kutip & baris baru (salah tempel)
props.ZOOM_LINK = "https://zoom.us/j/123";

let pass = 0, fail = 0;
const call = (b) => be.call(b);
function ok(cond, name, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (extra ? " → " + JSON.stringify(extra) : "")); }
}
const img = { name: "a.png", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
const base = { name: "Siti Rahma", email: "Siti@Contoh.id", phone: "081234567890", institution: "FKM Unand", profession: "Dosen",
  category: "Dosen / Peneliti / Tenaga Kesehatan", province: "Sumatera Barat", city: "Padang" };

console.log("Statistik & pendaftaran");
let r = call({ action: "stats" });
ok(r.ok && r.registered === 0 && r.remaining === 100, "stats awal", r);
r = call({ action: "register", reg: Object.assign({}, base, { email: "salah" }) });
ok(!r.ok && /email/i.test(r.error), "tolak email tidak valid");
r = call({ action: "register", reg: Object.assign({}, base, { phone: "12345" }) });
ok(!r.ok && /WhatsApp/.test(r.error), "tolak nomor WA tidak valid");
r = call({ action: "register", reg: Object.assign({}, base, { category: "Gratis" }) });
ok(!r.ok && /Kategori/.test(r.error), "tolak kategori palsu (harga tidak bisa dimanipulasi)");
r = call({ action: "register", reg: Object.assign({}, base, { category: "Mahasiswa (S1/S2/S3)", email: "mhs@contoh.id" }) });
ok(!r.ok && /KTM/.test(r.error), "mahasiswa wajib KTM");
r = call({ action: "register", reg: Object.assign({}, base, { price: 1 }) });
ok(r.ok && r.reg.price === 500000 && r.reg.uniqueCode >= 101 && r.reg.uniqueCode <= 499 && r.reg.total === 500000 + r.reg.uniqueCode, "daftar: harga dari server + kode unik", r);
ok(/^MAD-\d{6}-0001$/.test(r.reg.id), "format no. pendaftaran", r.reg.id);
ok(!("email" in r.reg) && !("accessCode" in r.reg), "respons publik tanpa data pribadi");
const reg = r.reg;
ok(be.gas.db().mails[0] && /Tagihan/.test(be.gas.db().mails[0].subject) && be.gas.db().mails[0].to === "siti@contoh.id", "email tagihan terkirim (email dinormalkan huruf kecil)");
r = call({ action: "register", reg: base });
ok(!r.ok && /sudah terdaftar/.test(r.error), "tolak email ganda");
const rm = call({ action: "register", reg: Object.assign({}, base, { name: "Budi", email: "budi@contoh.id", category: "Mahasiswa (S1/S2/S3)", ktm: img }) });
ok(rm.ok && rm.reg.total - rm.reg.uniqueCode === 350000, "mahasiswa dengan KTM", rm);
ok(rm.reg.total !== reg.total || rm.reg.price !== reg.price, "nominal unik berbeda");

console.log("Konfirmasi pembayaran & status");
r = call({ action: "confirm", id: reg.id, contact: "089999999999", payerName: "Siti", paidAmount: reg.total, file: img });
ok(!r.ok && /tidak cocok/.test(r.error), "tolak kontak yang salah");
r = call({ action: "confirm", id: reg.id, contact: "6281234567890", payerName: "Siti", paidAmount: reg.total, file: { mimeType: "text/html", data: "PGgxPg==" } });
ok(!r.ok && /JPG/.test(r.error), "tolak tipe file berbahaya");
r = call({ action: "confirm", id: reg.id.toLowerCase(), contact: "6281234567890", payerName: "Siti", paidAmount: reg.total, file: img });
ok(r.ok && r.reg.status === "Menunggu Verifikasi", "unggah bukti (cocok via WA 62…)", r);
r = call({ action: "invoice", id: reg.id, contact: "siti@contoh.id" });
ok(r.ok && r.doc.invoiceNo === "INV/" + reg.id && !r.doc.paid && !r.doc.receiptNo && r.doc.total === reg.total, "invoice (belum lunas) untuk pemilik");
ok(!call({ action: "invoice", id: reg.id, contact: "orang@lain.id" }).ok, "invoice ditolak untuk kontak lain");
r = call({ action: "status", id: reg.id, contact: "SITI@contoh.id" });
ok(r.ok && r.reg.status === "Menunggu Verifikasi", "cek status via email");

console.log("Login sebelum aktif");
r = call({ action: "login", email: "siti@contoh.id", code: "XXXX-XXXX" });
ok(!r.ok, "login ditolak sebelum aktif");

console.log("Admin");
r = call({ action: "list", key: "salah" });
ok(!r.ok && /Kunci admin/.test(r.error), "admin: kunci salah ditolak");
r = call({ action: "list", key: "rahasia-admin" });
ok(r.ok && r.regs.length === 2 && r.stats.registered === 2, "admin: daftar peserta");
r = call({ action: "file", key: "rahasia-admin", id: reg.id, kind: "proof" });
ok(r.ok && /^data:image\/png;base64,/.test(r.dataUrl), "admin: lihat bukti");
r = call({ action: "file", key: "rahasia-admin", id: rm.reg.id, kind: "ktm" });
ok(r.ok, "admin: lihat KTM");
r = call({ action: "update", key: "rahasia-admin", id: reg.id, fields: { status: "Aktif" } });
ok(r.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.reg.accessCode) && r.mailed, "aktifkan → kode akses + email", r);
const code = r.reg.accessCode;
ok(r.reg.receiptNo === "KW/MAD-R/2026/0001", "nomor kuitansi terbit saat diverifikasi", r.reg.receiptNo);
r = call({ action: "invoice", id: reg.id, contact: "081234567890" });
ok(r.ok && r.doc.paid && r.doc.receiptNo === "KW/MAD-R/2026/0001" && r.doc.paidAt && r.doc.paidAmount === reg.total, "kuitansi lunas");
r = call({ action: "invoice", id: reg.id, key: "rahasia-admin" });
ok(r.ok && r.doc.paid, "admin dapat mencetak kuitansi tanpa kontak");
ok(!call({ action: "invoice", id: reg.id, key: "salah" }).ok, "kunci admin salah ditolak pada invoice");
ok(/Kode Akses/.test(be.gas.db().mails[0].subject) && be.gas.db().mails[0].html.includes(code), "email kode akses berisi kode");
r = call({ action: "update", key: "rahasia-admin", id: reg.id, fields: { status: "Hacker" } });
ok(!r.ok, "tolak status tidak valid");

console.log("Login peserta, materi & progres");
r = call({ action: "login", email: "siti@contoh.id", code: "ZZZZ-ZZZZ" });
ok(!r.ok && /salah/.test(r.error), "kode salah ditolak");
r = call({ action: "login", email: " SITI@contoh.id ", code: code.toLowerCase().replace("-", "") });
ok(r.ok && r.key === "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoxMjM0NTY=" && r.zoom === "https://zoom.us/j/123" && r.participant.status === "Aktif" && !r.participant.certNo, "login berhasil (format kode longgar) → kunci materi + Zoom", r);
const goodKey = props.MATERI_KEY;
props.MATERI_KEY = "MATERI_KEY = abc";
r = call({ action: "login", email: "siti@contoh.id", code, silent: true });
ok(!r.ok && /MATERI_KEY di server tidak valid/.test(r.error), "MATERI_KEY rusak → pesan jelas untuk admin", r);
props.MATERI_KEY = goodKey;
r = call({ action: "track", email: "siti@contoh.id", code, slug: "bab-01-konsep-dasar-data" });
call({ action: "track", email: "siti@contoh.id", code, slug: "bab-01-konsep-dasar-data" });
r = call({ action: "track", email: "siti@contoh.id", code, slug: "bab-02-siklus-hidup-data" });
ok(r.ok && r.progress.length === 2, "progres modul tercatat tanpa duplikat", r);
r = call({ action: "track", email: "siti@contoh.id", code: "SALAH", slug: "bab-03" });
ok(!r.ok, "track ditolak tanpa kode valid");
r = call({ action: "forgot", email: "siti@contoh.id" });
const r2 = call({ action: "forgot", email: "tidakada@contoh.id" });
ok(r.ok && r2.ok && r.message === r2.message, "lupa kode: jawaban seragam (tidak membocorkan email terdaftar)");

console.log("Kelulusan & sertifikat");
r = call({ action: "update", key: "rahasia-admin", id: reg.id, fields: { status: "Lulus", name: "Dr. Siti Rahma, M.Epid" } });
ok(r.ok && r.reg.certNo === "MAD-R/2026/0001" && /^\d{4}-\d{2}-\d{2}$/.test(r.reg.certDate) && r.reg.accessCode === code, "lulus → no. sertifikat, kode akses tetap");
r = call({ action: "verify", no: "mad-r/2026/0001" });
ok(r.ok && r.valid && r.cert.name === "Dr. Siti Rahma, M.Epid", "verifikasi sertifikat publik");
r = call({ action: "verify", no: "MAD-R/2026/9999" });
ok(r.ok && !r.valid, "sertifikat palsu tidak valid");
r = call({ action: "login", email: "siti@contoh.id", code, silent: true });
ok(r.ok && r.participant.certIssued && r.participant.certNo === "" && !r.participant.evalDone, "sertifikat ditahan sebelum evaluasi");

console.log("Evaluasi");
r = call({ action: "evalGet", email: "siti@contoh.id", code });
ok(r.ok && r.answers === null && r.open, "evaluasi belum diisi");
const ans = { nps: 9, t1: "Studi kasus surveilans", t2: "Tambah waktu praktik", t3: "Analisis spasial", t4: "Sangat bermanfaat!", pub: true };
["a1","a2","a3","a4","a5","b1","b2","b3","b4","b5","c1","c2","c3","c4","o1"].forEach((k, i) => (ans[k] = 3 + (i % 3)));
["s1","s2","s3","s4","s5","s6"].forEach((k, i) => (ans[k] = i === 2 ? 0 : 5));
["k1","k2","k3","k4","k5","k6"].forEach((k) => { ans["pre_" + k] = 2; ans["post_" + k] = 4; });
r = call({ action: "evalSubmit", email: "siti@contoh.id", code, answers: Object.assign({}, ans, { a1: 9, nps: "" }) });
ok(!r.ok && /2 pertanyaan/.test(r.error), "tolak jawaban di luar skala / kosong", r);
ok(!call({ action: "evalSubmit", email: "siti@contoh.id", code: "SALAH", answers: ans }).ok, "evaluasi butuh sesi valid");
r = call({ action: "evalSubmit", email: "siti@contoh.id", code, answers: ans });
ok(r.ok, "kirim evaluasi");
r = call({ action: "evalSubmit", email: "siti@contoh.id", code, answers: Object.assign({}, ans, { nps: 10 }) });
r = call({ action: "evalList", key: "rahasia-admin" });
ok(r.ok && r.evals.length === 1 && r.evals[0].nps === 10 && r.evals[0].post_k1 === 4 && r.evals[0].pub === "Ya" && r.eligible === 1, "evaluasi diperbarui (bukan ganda) & terbaca admin", r);
r = call({ action: "evalGet", email: "siti@contoh.id", code });
ok(r.ok && r.answers && r.answers.t1 === "Studi kasus surveilans", "jawaban lama dapat dimuat ulang");
r = call({ action: "login", email: "siti@contoh.id", code, silent: true });
ok(r.ok && r.participant.evalDone && r.participant.certNo === "MAD-R/2026/0001", "portal melihat sertifikat setelah evaluasi");

console.log("Ganti kode, pembatalan, kuota");
r = call({ action: "update", key: "rahasia-admin", id: reg.id, fields: { resetCode: true } });
ok(r.ok && r.reg.accessCode !== code, "ganti kode akses");
ok(!call({ action: "login", email: "siti@contoh.id", code }).ok, "kode lama tidak berlaku");
r = call({ action: "update", key: "rahasia-admin", id: rm.reg.id, fields: { status: "Dibatalkan" } });
ok(r.ok && call({ action: "stats" }).registered === 1, "pembatalan membebaskan kuota");
r = call({ action: "register", reg: Object.assign({}, base, { name: "Budi lagi", email: "budi@contoh.id", ktm: img }) });
ok(r.ok, "email dari pendaftaran yang dibatalkan boleh mendaftar ulang", r);
const savedQuota = be.CONFIG.QUOTA;
be.CONFIG.QUOTA = 2;
r = call({ action: "register", reg: Object.assign({}, base, { email: "penuh@contoh.id" }) });
ok(!r.ok && /kuota/i.test(r.error), "kuota penuh ditolak");
be.CONFIG.QUOTA = savedQuota;
const savedClose = be.CONFIG.CLOSE_DATE;
be.CONFIG.CLOSE_DATE = "2000-01-01";
ok(call({ action: "stats" }).closed && !call({ action: "register", reg: Object.assign({}, base, { email: "telat@contoh.id" }) }).ok, "pendaftaran tutup setelah tanggal");
be.CONFIG.CLOSE_DATE = savedClose;
r = call({ action: "delete", key: "rahasia-admin", id: rm.reg.id });
ok(r.ok && call({ action: "list", key: "rahasia-admin" }).regs.length === 2, "hapus pendaftaran");
ok(!call({ action: "apa" }).ok, "aksi tidak dikenal ditolak");

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
