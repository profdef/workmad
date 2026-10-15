#!/usr/bin/env node
/**
 * EKSPOR SLIDE KE PDF
 * Mencetak setiap deck Quarto revealjs (ppt/*.html) menjadi PDF (satu slide per halaman)
 * memakai Google Chrome headless dan mode cetak reveal.js (?print-pdf).
 *
 *   node tools/export-pdf.mjs [folder-ppt]        (default: ../ppt)
 *
 * Hasil: .cache-pdf/<slug>.pdf (diabaikan git). Dipakai tools/build-materi.mjs
 * untuk paket unduhan peserta (PDF + data). Jalankan ulang setiap slide berubah.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PPT = path.resolve(process.argv[2] || path.join(ROOT, "..", "ppt"));
const OUT = path.join(ROOT, ".cache-pdf");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const idx = fs.readFileSync(path.join(PPT, "index.qmd"), "utf8");
const slugs = [...idx.matchAll(/<a class="deck" href="([^"]+)\.html"/g)].map((m) => m[1]).filter((s) => fs.existsSync(path.join(PPT, s + ".html")));
if (!slugs.length) { console.error("Tidak ada deck di " + PPT); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// Server statis sementara untuk folder ppt
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".json": "application/json", ".geojson": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(PPT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(PPT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const prof = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "pdfchrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9334", "--user-data-dir=" + prof, "about:blank"], { stdio: "ignore" });
let tabs;
for (let i = 0; i < 60; i++) { try { tabs = await (await fetch("http://127.0.0.1:9334/json")).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable");
// Slide bertab (mis. "R Code" / "Output"): pecah menjadi satu slide per tab SEBELUM reveal.js menyusun halaman cetak,
// agar kode DAN hasil (grafik/tabel) sama-sama tercetak di PDF.
await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  function splitTabsets() {
    let uid = 0;
    document.querySelectorAll(".reveal .slides section").forEach((sec) => {
      if (sec.querySelector("section")) return; // lewati pembungkus slide vertikal
      const sets = sec.querySelectorAll(".panel-tabset");
      if (!sets.length) return;
      const n = Math.max(...[...sets].map((t) => t.querySelectorAll(":scope > .tab-content > div").length));
      if (n < 2) return;
      const clones = [];
      for (let k = 0; k < n; k++) {
        const c = sec.cloneNode(true);
        if (k > 0) c.removeAttribute("id");
        c.querySelectorAll(".panel-tabset").forEach((ts) => {
          const panes = [...ts.querySelectorAll(":scope > .tab-content > div")];
          const links = [...ts.querySelectorAll(":scope > ul a")];
          const j = Math.min(k, panes.length - 1), tag = "-p" + (uid++);
          links.forEach((a, i) => {
            a.removeAttribute("data-tabby-default");
            a.setAttribute("href", (a.getAttribute("href") || "#x") + tag);
            a.setAttribute("aria-selected", i === j ? "true" : "false");
            a.classList.toggle("active", i === j);
            if (i === j) a.setAttribute("data-tabby-default", "");
          });
          panes.forEach((p, i) => {
            p.id = (p.id || "pane") + tag;
            if (i === j) { p.classList.add("active"); p.removeAttribute("hidden"); p.style.display = "block"; } else p.remove();
          });
        });
        clones.push(c);
      }
      sec.replaceWith(...clones);
    });
  }
  let R;
  Object.defineProperty(window, "Reveal", { configurable: true, get: () => R, set: (v) => {
    R = v;
    if (v && v.initialize && !v.__split) { const init = v.initialize; v.__split = true; v.initialize = function (...a) { splitTabsets(); return init.apply(this, a); }; }
  } });
})();` });

let total = 0;
for (const slug of slugs) {
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${slug}.html?print-pdf` });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await ev("!!(window.Reveal && Reveal.isReady && Reveal.isReady()) && document.fonts.status === 'loaded' && !!document.querySelector('.pdf-page')")) break;
  }
  await sleep(1200); // biarkan gambar & MathJax selesai
  const pages = await ev("document.querySelectorAll('.pdf-page').length");
  const hiddenPanes = await ev("[...document.querySelectorAll('.pdf-page .panel-tabset .tab-content > div')].filter((p) => !p.offsetParent).length");
  if (hiddenPanes) console.log("  ⚠ " + slug + ": " + hiddenPanes + " panel tab tidak tampil");
  const r = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  if (!r.result) { console.error("✗ " + slug + ": " + JSON.stringify(r.error)); continue; }
  const buf = Buffer.from(r.result.data, "base64");
  fs.writeFileSync(path.join(OUT, slug + ".pdf"), buf);
  total += buf.length;
  console.log(`✓ ${slug}.pdf — ${pages} slide, ${(buf.length / 1048576).toFixed(1)} MB`);
}
ws.close(); chrome.kill(); server.close();
await sleep(500); fs.rmSync(prof, { recursive: true, force: true });
console.log(`\n${slugs.length} PDF → .cache-pdf/ (${(total / 1048576).toFixed(1)} MB)`);
