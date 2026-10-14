/* =========================================================
   Lapisan API: Google Apps Script (produksi) atau MODE DEMO
   (bila API_URL kosong) yang menjalankan apps-script/Code.gs
   asli di browser dengan penyimpanan localStorage.
   ========================================================= */
(function () {
  const C = window.APP_CONFIG;
  const DEMO = !C.API_URL;
  const BASE = new URL("..", document.currentScript.src).href; // akar situs
  const DB_KEY = "mad_demo_db";
  const SESSION_KEY = "mad_session";
  let backend = null;

  async function demoBackend() {
    if (backend) return backend;
    if (!window.GasMock) await loadScript(BASE + "assets/gas-mock.js");
    if (!("DEMO_MATERI_KEY" in window)) {
      try { await loadScript(BASE + "assets/demo-key.js"); } catch (e) { window.DEMO_MATERI_KEY = ""; }
    }
    const code = await (await fetch(BASE + "apps-script/Code.gs", { cache: "no-store" })).text();
    backend = GasMock.loadBackend(code, {
      load() { try { return JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) { return null; } },
      save(db) {
        try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
        catch (e) { throw new Error("Penyimpanan browser penuh (mode demo). Hapus data demo di dashboard admin."); }
      },
    });
    backend.CONFIG.SITE_URL = BASE;
    const props = backend.gas.db().props;
    if (!props.ADMIN_KEY) props.ADMIN_KEY = "admin123";
    props.MATERI_KEY = window.DEMO_MATERI_KEY || "A".repeat(43) + "="; // tanpa demo-key.js: login jalan, materi tidak terbuka
    props.ZOOM_LINK = props.ZOOM_LINK || "https://zoom.us/j/0000000000 (contoh)";
    props.WA_GROUP_LINK = props.WA_GROUP_LINK || "https://chat.whatsapp.com/contoh";
    backend.gas.save();
    return backend;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Gagal memuat " + src));
      document.head.appendChild(s);
    });
  }

  // POST memakai text/plain agar tidak memicu CORS preflight di Apps Script
  async function post(body) {
    let res;
    try {
      res = await fetch(C.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet, lalu coba lagi.");
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      const plain = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      console.error("Respons server bukan JSON:", text);
      if (/authoriz|otoris|izin/i.test(plain))
        throw new Error("Server Apps Script belum diberi izin. Admin: jalankan setup() lalu Deploy → Manage deployments → Edit → New version");
      throw new Error("Server mengirim respons tidak valid (HTTP " + res.status + "): " + (plain.slice(0, 160) || "kosong"));
    }
    return json;
  }

  async function call(body) {
    let json;
    if (DEMO) {
      const b = await demoBackend();
      await new Promise((r) => setTimeout(r, 250)); // simulasi jaringan
      json = b.call(body);
    } else json = await post(body);
    if (!json.ok) {
      if (json.error === "Aksi tidak dikenal")
        throw new Error("Server Apps Script masih versi lama. Admin: tempel Code.gs terbaru lalu deploy New version");
      throw new Error(json.error || "Gagal menghubungi server");
    }
    return json;
  }

  window.API = {
    isDemo: DEMO,
    base: BASE,
    stats: () => call({ action: "stats" }),
    register: (reg) => call({ action: "register", reg }),
    confirm: (p) => call(Object.assign({ action: "confirm" }, p)),
    status: (id, contact) => call({ action: "status", id, contact }),
    login: (email, code, silent) => call({ action: "login", email, code, silent: !!silent }),
    forgot: (email) => call({ action: "forgot", email }),
    verify: (no) => call({ action: "verify", no }),
    invoice: (id, contact) => call({ action: "invoice", id, contact }),
    invoiceAdmin: (key, id) => call({ action: "invoice", id, key }),
    evalGet() { const s = Session.get() || {}; return call({ action: "evalGet", email: s.email, code: s.code }); },
    evalSubmit(answers) { const s = Session.get() || {}; return call({ action: "evalSubmit", email: s.email, code: s.code, answers }); },
    evalList: (key) => call({ action: "evalList", key }),
    // Catat modul yang dibuka (tidak menunggu jawaban)
    track(slug) {
      const s = Session.get();
      if (!s) return;
      const body = { action: "track", email: s.email, code: s.code, slug };
      if (DEMO) return call(body).catch(() => {});
      try { navigator.sendBeacon(C.API_URL, new Blob([JSON.stringify(body)], { type: "text/plain;charset=utf-8" })); }
      catch (e) { post(body).catch(() => {}); }
      return Promise.resolve();
    },
    list: (key) => call({ action: "list", key }),
    update: (key, id, fields) => call({ action: "update", key, id, fields }),
    resend: (key, id) => call({ action: "resend", key, id }),
    file: (key, id, kind) => call({ action: "file", key, id, kind }),
    remove: (key, id) => call({ action: "delete", key, id }),

    // ----- khusus mode demo -----
    async demoMails() { return DEMO ? (await demoBackend()).gas.db().mails : []; },
    async demoReset() { if (DEMO) { (await demoBackend()).gas.reset(); backend = null; } },
    async seedDemo() {
      if (!DEMO) return;
      const b = await demoBackend();
      const names = ["Andi Pratama", "Siti Rahma", "Budi Santoso", "Dewi Lestari", "Rizky Maulana", "Nurul Hidayah",
        "Fajar Nugroho", "Intan Permata", "Hendra Wijaya", "Laila Sari", "Yusuf Hakim", "Maya Anggraini", "Rahmat Hidayat", "Putri Ayu"];
      const inst = ["Universitas Andalas", "Dinas Kesehatan Kota Padang", "Puskesmas Andalas", "Universitas Indonesia", "RSUP M. Djamil", "Poltekkes Padang", "BRIN"];
      const cats = Object.keys(C.CATEGORIES);
      const provs = ["Sumatera Barat", "DKI Jakarta", "Jawa Barat", "Riau", "Sumatera Utara", "Jawa Timur", "Sulawesi Selatan", "Aceh"];
      const ktm = { name: "ktm.png", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
      const key = b.gas.db().props.ADMIN_KEY;
      names.forEach((name, i) => {
        const email = name.toLowerCase().replace(/\s+/g, ".") + "@contoh.id";
        const category = cats[i % cats.length];
        const r = b.call({ action: "register", reg: {
          name, email, phone: "0812" + String(30000000 + i * 7391), gender: i % 2 ? "Perempuan" : "Laki-laki",
          institution: inst[i % inst.length], profession: C.PROFESSIONS[i % C.PROFESSIONS.length], category,
          province: provs[i % provs.length], city: "Kota Contoh", source: "WhatsApp", note: "",
          ktm: category === cats[0] ? ktm : null } });
        if (!r.ok) return;
        const id = r.reg.id;
        // geser tanggal daftar agar grafik harian terisi
        const rows = b.gas.db().sheets.Peserta;
        const row = rows.find((x) => x[0] === id);
        const d = new Date(); d.setDate(d.getDate() - (13 - i)); row[1] = d.toISOString();
        if (i % 7 === 6) return; // tetap Menunggu Pembayaran
        b.call({ action: "confirm", id, contact: email, payerName: name, paidAmount: r.reg.total - (i === 4 ? 100000 : 0), file: ktm });
        if (i % 3 === 0) return; // tetap Menunggu Verifikasi
        const u = b.call({ action: "update", key, id, fields: { status: i % 5 === 1 ? "Lulus" : "Aktif" } });
        if (i % 4 === 3) return; // belum mengisi evaluasi
        // Evaluasi contoh (variasi realistis)
        const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
        const a = { nps: [10, 9, 9, 8, 10, 7, 9, 6][i % 8], pub: i % 2 === 0,
          t1: ["Studi kasus surveilans DBD & peta Kota Padang", "Laporan otomatis dengan Quarto", "Penjelasan regresi logistik yang runtut", "Dataset nyata dan kode siap pakai"][i % 4],
          t2: ["Tambah durasi sesi praktik", "Rekaman sesi dibagikan lebih cepat", "Perbanyak latihan mandiri", ""][i % 4],
          t3: ["Analisis spasial dengan R", "Analisis survival", "Meta-analisis", "Machine learning untuk epidemiologi"][i % 4],
          t4: ["Pelatihan yang sangat aplikatif, langsung bisa dipakai di Dinkes.", "Materi runtut dari dasar sampai laporan otomatis. Recommended!", "", "Narasumber sabar dan menguasai materi."][i % 4] };
        C.EVALUATION.sections.forEach((sec) => sec.items.forEach(([k]) => (a[k] = rnd(sec.type === "session" ? 3 : 4, 5))));
        C.EVALUATION.competencies.forEach(([k]) => { a["pre_" + k] = rnd(1, 3); a["post_" + k] = rnd(3, 5); });
        a.o1 = rnd(4, 5);
        b.call({ action: "evalSubmit", email, code: u.reg.accessCode, answers: a });
      });
      b.gas.save();
    },
  };

  // Sesi peserta (disimpan di browser ini)
  window.Session = {
    get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; } },
    set(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} },
    clear() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} },
  };
})();
