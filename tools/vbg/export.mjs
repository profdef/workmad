// Ekspor virtual background Zoom (1920×1080 JPG) dari tools/vbg/vbg.html → assets/vbg/
// Pakai: python3 -m http.server 8765 (di root repo), lalu node tools/vbg/export.mjs
import { spawn } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const OUT = new URL("../../assets/vbg/", import.meta.url).pathname;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "vbg-"));
const ch = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9399", "--user-data-dir=" + prof, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 80; i++) { try { t = await (await fetch("http://127.0.0.1:9399/json")).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let mid = 0; const pend = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
const send = (method, params = {}) => new Promise((r) => { const i = ++mid; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
for (const p of ["full", "free"]) for (const d of [1, 2, 3, 4]) {
  await send("Page.navigate", { url: `http://localhost:8765/tools/vbg/vbg.html?d=${d}&p=${p}` });
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev("window.READY && document.fonts.status==='loaded' && [...document.images].every(i=>i.complete && i.naturalWidth>0)")) break; }
  await sleep(500);
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  const f = `${OUT}vbg-${p}-${d}.jpg`; fs.writeFileSync(f, Buffer.from(r.result.data, "base64"));
  console.log("✓", path.basename(f), Math.round(fs.statSync(f).size / 1024) + " KB");
}
ws.close(); ch.kill(); await sleep(300); fs.rmSync(prof, { recursive: true, force: true });
