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

console.log("Kelas gratis pembeli buku");
const KF = "RlJFRUZSRUVGUkVFRlJFRUZSRUVGUkVFRlJFRUZSRUU=";
props.MATERI_KEY_FREE = KF;
props.ZOOM_LINK_FREE = "https://zoom.us/j/gratis";
props.BOOK_SHEET_ID = "book1";
be.gas.db().ext = { book1: { Orders: [["id", "createdAt", "status", "name", "phone"],
  ["ORD-20261010-0001", "", "Dibayar", "Ani", "081211112222"],
  ["ORD-20261010-0002", "", "Menunggu Pembayaran", "Beni", "081233334444"],
  ["ORD-20261010-0003", "", "Selesai", "Cici", "081255556666"]] } };
const fbase = { name: "Ani Lestari", email: "ani@contoh.id", phone: "081211112222", institution: "Puskesmas X", profession: "Tenaga Kesehatan", province: "Riau", city: "Pekanbaru" };
r = call({ action: "registerFree", reg: fbase });
ok(!r.ok && /no\. pesanan buku/.test(r.error), "tanpa no. pesanan & bukti → ditolak", r);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { bookOrderId: "ORD-20261010-0002", phone: "081233334444" }) });
ok(!r.ok && /belum lunas/.test(r.error), "pesanan belum lunas → ditolak", r);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { bookOrderId: "ord-20261010-0001", phone: "089900001111" }) });
ok(!r.ok && /tidak cocok/.test(r.error), "no. WA tidak cocok dengan pesanan → ditolak", r);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { bookOrderId: "ord-20261010-0001" }) });
ok(r.ok && r.reg.verified && r.reg.status === "Aktif" && r.mailed, "pesanan lunas → otomatis Aktif + email kode akses", r);
ok(/Kelas Gratis/.test(be.gas.db().mails[0].subject), "email akses kelas gratis");
const freeId = r.reg.id;
ok(!call({ action: "registerFree", reg: Object.assign({}, fbase, { bookOrderId: "ORD-20261010-0001" }) }).ok, "email yang sama tidak bisa daftar kelas gratis 2×");
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { email: "lain@contoh.id", bookOrderId: "ORD-20261010-0001" }) });
ok(!r.ok && /sudah dipakai/.test(r.error), "satu no. pesanan hanya untuk satu pendaftar", r);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { email: "dodi@contoh.id", name: "Dodi", phone: "081277778888", bookProof: img }) });
ok(r.ok && !r.reg.verified && r.reg.status === "Menunggu Verifikasi", "bukti foto buku → menunggu verifikasi admin", r);
const proofFreeId = r.reg.id;
ok(call({ action: "file", key: "rahasia-admin", id: proofFreeId, kind: "book" }).ok, "admin melihat bukti pembelian buku");
r = call({ action: "update", key: "rahasia-admin", id: proofFreeId, fields: { status: "Aktif" } });
ok(r.ok && r.reg.accessCode && !r.reg.receiptNo && r.reg.bookVerified === "Ya", "admin aktifkan → kode akses, tanpa kuitansi");
ok(!call({ action: "update", key: "rahasia-admin", id: proofFreeId, fields: { status: "Lulus" } }).ok, "peserta gratis tidak bisa Lulus/sertifikat");
const st2 = call({ action: "stats" });
ok(st2.free.registered === 2 && st2.registered === 2 && st2.bookDiscount === 100000, "kuota gratis & penuh dihitung terpisah", st2);
const freeRec = call({ action: "list", key: "rahasia-admin" }).regs.find((x) => x.id === freeId);
r = call({ action: "login", email: "ani@contoh.id", code: freeRec.accessCode });
ok(r.ok && r.key === "" && r.keyFree === KF && r.zoom === "https://zoom.us/j/gratis" && r.participant.program === "Gratis", "login kelas gratis: hanya kunci materi pengenalan + Zoom gratis", r);
ok(!call({ action: "evalGet", email: "ani@contoh.id", code: freeRec.accessCode }).ok, "evaluasi tidak untuk kelas gratis");

console.log("Potongan pembeli buku di pelatihan penuh");
r = call({ action: "register", reg: Object.assign({}, base, { name: "Ani Lestari", email: "ani@contoh.id", phone: "081211112222" }) });
ok(r.ok && r.reg.discount === 100000 && r.reg.total === 500000 - 100000 + r.reg.uniqueCode && r.reg.program === "Penuh", "peserta kelas gratis terverifikasi boleh daftar penuh + potongan", r);
const aniFull = r.reg.id;
r = call({ action: "register", reg: Object.assign({}, base, { name: "Cici", email: "cici@contoh.id", phone: "081255556666", bookOrderId: "ORD-20261010-0003" }) });
ok(r.ok && r.reg.discount === 100000, "no. pesanan buku valid → potongan");
r = call({ action: "register", reg: Object.assign({}, base, { email: "eko@contoh.id", bookOrderId: "ORD-XYZ" }) });
ok(!r.ok && /tidak ditemukan/.test(r.error), "no. pesanan palsu → ditolak (bukan diam-diam tanpa potongan)", r);
r = call({ action: "checkBook", orderId: "ORD-20261010-0003", phone: "6281255556666" });
ok(r.ok && r.valid && r.discount === 100000, "cek pesanan publik (pratinjau potongan)");
r = call({ action: "invoice", id: aniFull, contact: "ani@contoh.id" });
ok(r.ok && r.doc.discount === 100000, "invoice memuat potongan");
r = call({ action: "update", key: "rahasia-admin", id: aniFull, fields: { status: "Aktif" } });
const fullCode = r.reg.accessCode;
r = call({ action: "login", email: "ani@contoh.id", code: fullCode });
ok(r.ok && r.key && r.keyFree === KF && r.participant.program === "Penuh", "kode akses penuh → kedua kunci materi");
r = call({ action: "login", email: "ani@contoh.id", code: freeRec.accessCode });
ok(r.ok && r.participant.program === "Gratis", "kode kelas gratis tetap berfungsi terpisah");

console.log("Kode akses kelas gratis & alias pengirim");
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { email: "kode@contoh.id", name: "Kode", phone: "081255556666", bookOrderId: "ORD-20261010-0003" }) });
ok(r.ok && r.reg.verified && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.reg.accessCode), "pembeli terverifikasi → kode akses dikembalikan", r);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { email: "foto@contoh.id", name: "Foto", phone: "081244443333", bookProof: img }) });
ok(r.ok && !r.reg.verified && r.reg.accessCode === "", "bukti foto (belum diverifikasi) → kode TIDAK dikembalikan");
ok(!be.gas.db().mails[0].from, "alias belum terdaftar → kirim via MailApp (tanpa from)");
props.__aliases = "info@publichealth.id";
call({ action: "forgot", email: "kode@contoh.id" });
ok(be.gas.db().mails[0].from === "info@publichealth.id", "alias terdaftar → email dari info@publichealth.id", be.gas.db().mails[0]);
delete props.__aliases;

console.log("Notifikasi Telegram");
props.TELEGRAM_BOT_TOKEN = "123:ABC"; props.TELEGRAM_CHAT_ID = "111, -222";
const nTg = (be.gas.db().telegram || []).length;
r = call({ action: "register", reg: Object.assign({}, base, { name: "Tele <Uji>", email: "tele@contoh.id", phone: "081299998888" }) });
const tg = be.gas.db().telegram || [];
ok(r.ok && tg.length === nTg + 2 && tg[0].body.parse_mode === "HTML" && /Pendaftar baru · Pelatihan Penuh/.test(tg[0].body.text) && /Tele &lt;Uji&gt;/.test(tg[0].body.text), "pendaftar penuh → 2 chat Telegram, HTML aman", tg[0] && tg[0].body);
r = call({ action: "registerFree", reg: Object.assign({}, fbase, { email: "tele2@contoh.id", name: "Tele2", phone: "081277776666", bookProof: img }) });
ok(r.ok && /Kelas Gratis/.test(be.gas.db().telegram[0].body.text) && /Perlu verifikasi/.test(be.gas.db().telegram[0].body.text), "pendaftar kelas gratis → notifikasi Telegram");
delete props.TELEGRAM_BOT_TOKEN; const n2 = be.gas.db().telegram.length;
call({ action: "register", reg: Object.assign({}, base, { email: "tele3@contoh.id", phone: "081266665555" }) });
ok(be.gas.db().telegram.length === n2, "tanpa token → tidak mengirim, pendaftaran tetap jalan");

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
