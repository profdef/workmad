#!/usr/bin/env node
/**
 * BUILD MATERI PELATIHAN
 * Menyalin deck Quarto (revealjs) dari folder ppt/ ke materi/, lalu MENGENKRIPSI
 * isinya (AES-256-GCM) agar hanya peserta berstatus Aktif/Lulus yang bisa membukanya.
 *
 *   node tools/build-materi.mjs [folder-ppt]        (default: ../ppt)
 *
 * - Gambar & grafik di dalam deck ditanam (data URI) lalu ikut terenkripsi.
 * - Pustaka revealjs (publik, bukan materi) digabung sekali di materi/libs/.
 * - Paket latihan (data, R, .qmd, tema) dikemas jadi zip terenkripsi.
 * - Daftar judul (publik) ditulis ke materi/catalog.js dari ppt/index.qmd.
 * - Kunci disimpan di .materi-key (JANGAN di-commit). Salin nilainya ke
 *   Script Properties Apps Script: MATERI_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PPT = path.resolve(process.argv[2] || path.join(ROOT, "..", "ppt"));
const OUT = path.join(ROOT, "materi");
const ENC = path.join(OUT, "enc");
const KEY_FILE = path.join(ROOT, ".materi-key");
const KEY_FREE_FILE = path.join(ROOT, ".materi-key-free");
// Deck pengenalan R, RStudio & Quarto yang terbuka untuk kelas gratis (pembeli buku).
// Dienkripsi dengan kunci terpisah (MATERI_KEY_FREE); peserta penuh menerima kedua kunci.
const FREE_DECKS = ["00-tentang-buku", "01-pendahuluan", "bab-06-mengenal-r-rstudio", "bab-07-dasar-pemrograman-r", "bab-08-reproducible-quarto"];

if (!fs.existsSync(path.join(PPT, "index.qmd"))) {
  console.error("Folder ppt tidak ditemukan / tidak berisi index.qmd: " + PPT);
  process.exit(1);
}

// ---------- Kunci ----------
function loadKey(file) {
  let b64;
  if (fs.existsSync(file)) b64 = fs.readFileSync(file, "utf8").trim();
  else {
    b64 = crypto.randomBytes(32).toString("base64");
    fs.writeFileSync(file, b64 + "\n", { mode: 0o600 });
    console.log("Kunci baru dibuat: " + path.basename(file));
  }
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error(path.basename(file) + " tidak valid (harus 32 byte base64)");
  return { b64, k };
}
const { b64: keyB64, k: KEY } = loadKey(KEY_FILE);
const { b64: keyFreeB64, k: KEY_FREE } = loadKey(KEY_FREE_FILE);
// Kunci untuk MODE DEMO lokal saja (file ini ada di .gitignore)
fs.writeFileSync(path.join(ROOT, "assets", "demo-key.js"),
  "// DIBUAT OTOMATIS — hanya untuk mode demo lokal. Jangan di-commit.\nwindow.DEMO_MATERI_KEY = " + JSON.stringify(keyB64) +
  ";\nwindow.DEMO_MATERI_KEY_FREE = " + JSON.stringify(keyFreeB64) + ";\n");

// Format file terenkripsi: "MAD1" + iv(12) + ciphertext + tag(16); isi = gzip(data)
function encrypt(buf, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key || KEY, iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(buf, { level: 9 })), c.final(), c.getAuthTag()]);
  return Buffer.concat([Buffer.from("MAD1"), iv, body]);
}

// ---------- Katalog dari index.qmd ----------
const idx = fs.readFileSync(path.join(PPT, "index.qmd"), "utf8");
const parts = [];
const re = /<h2 class="part"><span>([^<]*)<\/span>([^<]*)<\/h2>|<a class="deck" href="([^"]+)\.html"><div class="n">([^<]*)<\/div><div><div class="tt">([^<]*)<\/div><div class="ds">([^<]*)<\/div>/g;
for (let m; (m = re.exec(idx)); ) {
  const un = (s) => s.replace(/&amp;/g, "&").trim();
  if (m[1] !== undefined) parts.push({ label: un(m[1]), title: un(m[2]), decks: [] });
  else parts[parts.length - 1].decks.push({ slug: m[3], n: un(m[4]), title: un(m[5]), desc: un(m[6]) });
}
const decks = parts.flatMap((p) => p.decks);
if (!decks.length) throw new Error("Tidak ada deck terbaca dari index.qmd");

// ---------- Bersihkan output ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(ENC, { recursive: true });

// ---------- Pustaka bersama (gabungan semua *_files/libs) ----------
const LIBS = path.join(OUT, "libs");
for (const d of decks) {
  const src = path.join(PPT, d.slug + "_files", "libs");
  if (fs.existsSync(src)) fs.cpSync(src, LIBS, { recursive: true, force: false, errorOnExist: false });
}

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" };
const dataUri = (file) => "data:" + MIME[path.extname(file).slice(1).toLowerCase()] + ";base64," + fs.readFileSync(file).toString("base64");

let totalIn = 0, totalOut = 0;
const warnings = [];
for (const d of decks) {
  const file = path.join(PPT, d.slug + ".html");
  if (!fs.existsSync(file)) { warnings.push("Deck belum dirender: " + d.slug + ".html"); d.missing = true; continue; }
  let html = fs.readFileSync(file, "utf8");
  const libPrefix = d.slug + "_files/libs/";
  html = html.split(libPrefix).join("libs/");
  // Tanam gambar lokal (figure, images/, img/) sebagai data URI
  html = html.replace(/(["'(])((?:[\w.-]+_files\/figure-revealjs|images|img)\/[^"')\s]+\.(?:png|jpe?g|gif|svg|webp))(?=["')])/gi, (all, q, rel) => {
    const f = path.join(PPT, decodeURIComponent(rel));
    if (!fs.existsSync(f)) { warnings.push(d.slug + ": gambar tidak ada " + rel); return all; }
    return q + dataUri(f);
  });
  // Tautan antar-deck → lewat viewer
  html = html.replace(/href="((?:bab-\d+|0\d)-[\w-]+)\.html(#[^"]*)?"/g, (a, s, h) => 'href="view.html?d=' + s + (h || "") + '"');
  // Laporkan referensi lokal yang tersisa (selain libs/)
  for (const m of html.matchAll(/(?:src|href)="(?!https?:|data:|#|mailto:|libs\/|view\.html|javascript:)([^"]+)"/g))
    if (m[1]) warnings.push(d.slug + ": referensi lokal tidak ditangani " + m[1]);
  d.free = FREE_DECKS.includes(d.slug);
  const enc = encrypt(Buffer.from(html, "utf8"), d.free ? KEY_FREE : KEY);
  fs.writeFileSync(path.join(ENC, d.slug + ".bin"), enc);
  totalIn += html.length; totalOut += enc.length;
}

// ---------- Paket latihan (zip terenkripsi) ----------
const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "mad-"));
const kit = path.join(tmp, "paket-latihan-mad");
fs.mkdirSync(kit);
for (const item of ["data", "R", "theme", "images", "img", "_quarto.yml"])
  if (fs.existsSync(path.join(PPT, item))) fs.cpSync(path.join(PPT, item), path.join(kit, item), { recursive: true });
for (const f of fs.readdirSync(PPT)) if (/^(bab-|0\d-).*\.qmd$/.test(f)) fs.copyFileSync(path.join(PPT, f), path.join(kit, f));
fs.writeFileSync(path.join(kit, "BACA-SAYA.txt"),
  "Paket Latihan — Manajemen & Analisis Data Epidemiologi & Kesehatan Masyarakat\n" +
  "1. Ekstrak folder ini, buka di RStudio: File > New Project > Existing Directory.\n" +
  "2. Jalankan R/setup.R untuk memasang paket yang dibutuhkan.\n" +
  "3. Buka file bab-xx.qmd lalu klik Render untuk menghasilkan slide sendiri.\n" +
  "Data latihan ada di folder data/.\n\nHanya untuk peserta pelatihan. Mohon tidak disebarluaskan.\n");
const zipFile = path.join(tmp, "paket.zip");
execFileSync("zip", ["-qr", "-X", zipFile, "paket-latihan-mad"], { cwd: tmp });
const zipEnc = encrypt(fs.readFileSync(zipFile));
fs.writeFileSync(path.join(ENC, "paket-latihan.bin"), zipEnc);
const kitSize = fs.statSync(zipFile).size;
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- Katalog publik ----------
const catalog = {
  builtAt: new Date().toISOString(),
  parts: parts.map((p) => ({ label: p.label, title: p.title, decks: p.decks.filter((d) => !d.missing).map(({ missing, ...d }) => d) })),
  downloads: [{ id: "paket-latihan", file: "paket-latihan-mad.zip", title: "Paket Latihan RStudio", desc: "Dataset (CSV, Excel, SPSS, Stata, GeoJSON), R/setup.R, dan semua file .qmd untuk dirender sendiri", size: kitSize }],
};
fs.writeFileSync(path.join(OUT, "catalog.js"), "// DIBUAT OTOMATIS oleh tools/build-materi.mjs\nwindow.MATERI = " + JSON.stringify(catalog, null, 1) + ";\n");
fs.copyFileSync(path.join(ROOT, "tools", "view.html"), path.join(OUT, "view.html"));
if (fs.existsSync(path.join(PPT, "img", "cover.jpg"))) fs.copyFileSync(path.join(PPT, "img", "cover.jpg"), path.join(ROOT, "assets", "cover.jpg"));

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
console.log(`✓ ${decks.filter((d) => !d.missing).length} deck terenkripsi (${mb(totalIn)} → ${mb(totalOut)})`);
console.log(`✓ Paket latihan: ${mb(kitSize)} → ${mb(zipEnc.length)}`);
console.log(`✓ Output: ${path.relative(ROOT, OUT)}/`);
if (warnings.length) console.log("\nPeringatan:\n  " + [...new Set(warnings)].join("\n  "));
console.log(`✓ ${decks.filter((d) => d.free).length} deck pengenalan (kelas gratis) memakai kunci .materi-key-free`);
console.log("\nKunci enkripsi: .materi-key → Script Property MATERI_KEY; .materi-key-free → MATERI_KEY_FREE.\n" +
  "(Kunci tetap sama di setiap build selama .materi-key tidak dihapus.)");
