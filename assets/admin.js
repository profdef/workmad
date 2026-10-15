/* Dashboard admin pelatihan */
(function () {
  const C = window.APP_CONFIG;
  const $ = (id) => document.getElementById(id);
  const STATUSES = ["Menunggu Pembayaran", "Menunggu Verifikasi", "Aktif", "Lulus", "Dibatalkan"];
  const KEY_SS = "mad_admin_key";
  const TOTAL_DECKS = window.MATERI ? window.MATERI.parts.reduce((n, p) => n + p.decks.length, 0) : 20;
  const DECK_SLUGS = new Set(window.MATERI ? window.MATERI.parts.flatMap((p) => p.decks.map((d) => d.slug)) : []);
  let key = "", regs = [], stats = null, fStatus = "";

  renderChrome("");
  if (API.isDemo) { $("demoTools").classList.remove("hidden"); $("mailBtn").classList.remove("hidden"); $("resetBtn").classList.remove("hidden"); }

  // ---------- Login ----------
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await login($("adminKey").value.trim());
  });
  async function login(k) {
    $("loginErr").classList.add("hidden");
    $("loginBtn").disabled = true;
    try {
      key = k;
      await load();
      sessionStorage.setItem(KEY_SS, key);
      $("loginView").classList.add("hidden");
      $("dashView").classList.remove("hidden");
    } catch (ex) {
      $("loginErr").textContent = ex.message; $("loginErr").classList.remove("hidden");
      sessionStorage.removeItem(KEY_SS);
    }
    $("loginBtn").disabled = false;
  }
  const saved = sessionStorage.getItem(KEY_SS);
  if (saved) login(saved).then(() => { if (location.hash === "#evaluasi") document.querySelector('[data-view="eval"]').click(); });
  $("logoutBtn").addEventListener("click", () => { sessionStorage.removeItem(KEY_SS); location.reload(); });
  $("refreshBtn").addEventListener("click", () => load().catch((e) => alert(e.message)));
  $("seedBtn").addEventListener("click", async () => {
    $("seedBtn").disabled = true; $("seedBtn").textContent = "Mengisi…";
    await API.seedDemo();
    $("seedBtn").textContent = "✓ Data contoh ditambahkan — masuk dengan admin123";
    $("adminKey").value = "admin123";
  });
  $("resetBtn").addEventListener("click", async () => {
    if (!confirm("Hapus SEMUA data demo di browser ini?")) return;
    await API.demoReset(); sessionStorage.removeItem(KEY_SS); location.reload();
  });

  async function load() {
    const r = await API.list(key);
    regs = r.regs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    stats = r.stats;
    $("lastSync").textContent = "Diperbarui " + new Date().toLocaleTimeString("id-ID");
    renderAll();
  }

  // ---------- Ringkasan ----------
  function renderAll() {
    const isFree = (r) => r.program === "Gratis";
    const live = regs.filter((r) => r.status !== "Dibatalkan" && !isFree(r));
    const freeLive = regs.filter((r) => r.status !== "Dibatalkan" && isFree(r));
    const by = (s) => regs.filter((r) => r.status === s && !isFree(r));
    const paid = live.filter((r) => r.status === "Aktif" || r.status === "Lulus");
    const revenue = paid.reduce((n, r) => n + (Number(r.paidAmount) || Number(r.total) || 0), 0);
    const kpi = [
      [live.length + " / " + stats.quota, "Pendaftar / kuota"],
      [by("Menunggu Pembayaran").length, "Menunggu pembayaran"],
      [by("Menunggu Verifikasi").length, "Perlu verifikasi", by("Menunggu Verifikasi").length ? "Menunggu Verifikasi" : ""],
      [paid.length, "Peserta aktif + lulus"],
      [by("Lulus").length, "Lulus (sertifikat)"],
      [rupiah(revenue), "Pendapatan terverifikasi"],
      [freeLive.length + (stats.free ? " / " + stats.free.quota : ""), "Kelas gratis (pembeli buku)", ""],
      [freeLive.filter((r) => r.status === "Menunggu Verifikasi").length, "Kelas gratis perlu verifikasi"],
      [live.filter((r) => r.bookVerified === "Ya").length, "Pelatihan penuh dari pembeli buku"],
    ];
    $("kpis").innerHTML = kpi.map(([v, l, f]) => '<div class="kpi' + (f ? " pill" : "") + '"' + (f ? ' data-f="' + f + '" style="border-color:rgba(248,113,113,.6)"' : "") +
      '><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + "</div></div>").join("");
    $("kpis").querySelectorAll("[data-f]").forEach((el) => el.addEventListener("click", () => { fStatus = el.dataset.f; renderTable(); }));

    // Harian
    const days = [];
    for (let i = 20; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })); }
    const cnt = Object.fromEntries(days.map((d) => [d, 0]));
    live.forEach((r) => { const d = new Date(r.createdAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }); if (d in cnt) cnt[d]++; });
    const max = Math.max(1, ...Object.values(cnt));
    const W = 620, H = 150, bw = W / days.length;
    $("chDaily").innerHTML = '<svg viewBox="0 0 ' + W + " " + (H + 22) + '" style="width:100%;height:auto" role="img" aria-label="Grafik pendaftar per hari">' +
      '<defs><linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs>' +
      days.map((d, i) => {
        const v = cnt[d], h = (v / max) * (H - 18);
        return '<g><title>' + d + ": " + v + " pendaftar</title><rect x=\"" + (i * bw + 3) + '" y="' + (H - h) + '" width="' + (bw - 6) + '" height="' + Math.max(h, v ? 2 : 0) + '" rx="3" fill="url(#bg)"/>' +
          (v ? '<text x="' + (i * bw + bw / 2) + '" y="' + (H - h - 4) + '" text-anchor="middle" font-size="10" fill="#e9e8ff">' + v + "</text>" : "") +
          (i % 3 === 0 ? '<text x="' + (i * bw + bw / 2) + '" y="' + (H + 15) + '" text-anchor="middle" font-size="10" fill="#a9acd9">' + d.slice(8) + "/" + d.slice(5, 7) + "</text>" : "") + "</g>";
      }).join("") + '<line x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '" stroke="rgba(255,255,255,.15)"/></svg>';

    $("chCat").innerHTML = hbars(group(live, "category"));
    $("chProv").innerHTML = hbars(group(live, "province").slice(0, 8));

    const cats = [...new Set(regs.map((r) => r.category))];
    const cur = $("fCat").value;
    $("fCat").innerHTML = '<option value="">Semua kategori</option>' + cats.map((c) => "<option" + (c === cur ? " selected" : "") + ">" + esc(c) + "</option>").join("");
    renderTable();
  }
  function group(rows, k) {
    const m = {};
    rows.forEach((r) => (m[r[k] || "—"] = (m[r[k] || "—"] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  function hbars(list) {
    if (!list.length) return '<div class="muted small">Belum ada data</div>';
    const max = Math.max(...list.map((x) => x[1]));
    return list.map(([l, v]) => '<div class="hbar"><span class="lb" title="' + esc(l) + '">' + esc(l) + '</span><span class="tr"><i style="width:' + (v / max) * 100 + '%"></i></span><span class="vl">' + v + "</span></div>").join("");
  }

  // ---------- Tabel ----------
  $("q").addEventListener("input", renderTable);
  $("fCat").addEventListener("change", renderTable);
  $("fProg").addEventListener("change", renderTable);
  function renderTable() {
    $("pills").innerHTML = ["", ...STATUSES].map((s) => {
      const n = s ? regs.filter((r) => r.status === s).length : regs.length;
      return '<span class="badge pill ' + (s ? "st-" + s.toLowerCase().replace(/\s+/g, "-") : "st-dibatalkan") + (fStatus === s ? " on" : "") + '" data-s="' + esc(s) + '">' + esc(s || "Semua") + " · " + n + "</span>";
    }).join("");
    $("pills").querySelectorAll("[data-s]").forEach((el) => el.addEventListener("click", () => { fStatus = el.dataset.s; renderTable(); }));
    const q = $("q").value.trim().toLowerCase(), cat = $("fCat").value;
    const list = filtered(q, cat);
    $("rows").innerHTML = list.map((r) => {
      const mism = r.paidAmount && Number(r.paidAmount) !== Number(r.total);
      return "<tr><td><span class=\"mono\">" + esc(r.id) + '</span><br><span class="small muted">' + esc(fmtDate(r.createdAt, true)) + "</span></td>" +
        "<td><b style=\"color:#fff\">" + esc(r.name) + '</b><br><span class="small muted">' + esc(r.institution) + "<br>" + esc(r.email) + " · " + esc(r.phone) + "</span></td>" +
        "<td class=\"small\">" + (r.program === "Gratis" ? '<span class="badge st-aktif">Gratis</span><br>' : "") + esc(r.category) +
          (r.bookVerified === "Ya" ? '<br><span style="color:var(--good)">📗 pembeli buku</span>' : "") + '</td><td class="num">' + (r.program === "Gratis" ? "—" : rupiah(r.total)) + "</td>" +
        '<td class="num' + (mism ? " mismatch" : "") + '">' + (r.paidAmount ? rupiah(r.paidAmount) + (mism ? " ⚠" : "") : '<span class="muted">—</span>') + "</td>" +
        "<td>" + statusBadge(r.status) + "</td><td class=\"small\">" + progressCount(r) + "/" + TOTAL_DECKS + (r.evalAt ? '<br><span style="color:var(--good)">✓ evaluasi</span>' : "") + "</td>" +
        '<td><button class="btn btn-sm" type="button" data-id="' + esc(r.id) + '">Detail</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="center muted" style="padding:28px">Tidak ada data</td></tr>';
    $("rows").querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.id)));
    $("count").textContent = list.length + " dari " + regs.length + " pendaftar";
  }
  function filtered(q, cat) {
    const prog = $("fProg").value;
    return regs.filter((r) => (!fStatus || r.status === fStatus) && (!cat || r.category === cat) && (!prog || (r.program || "Penuh") === prog) &&
      (!q || [r.id, r.name, r.email, r.phone, r.institution, r.city, r.province, r.payerName].join(" ").toLowerCase().includes(q)));
  }
  function progressCount(r) { return String(r.progress || "").split(",").filter((s) => DECK_SLUGS.has(s)).length; }

  // ---------- Detail ----------
  $("dlgClose").addEventListener("click", () => $("dlg").close());
  function openDetail(id) {
    const r = regs.find((x) => x.id === id);
    if (!r) return;
    $("dlgTitle").innerHTML = esc(r.name) + " " + statusBadge(r.status);
    const mism = r.paidAmount && Number(r.paidAmount) !== Number(r.total);
    const kv = [
      ["No. pendaftaran", '<span class="mono">' + esc(r.id) + "</span>"], ["Tanggal daftar", esc(fmtDate(r.createdAt, true))],
      ["Email", esc(r.email)], ["WhatsApp", '<a target="_blank" rel="noopener" href="https://wa.me/62' + esc(String(r.phone).replace(/\D/g, "").replace(/^(62|0)+/, "")) + '">' + esc(r.phone) + "</a>"],
      ["Jenis kelamin", esc(r.gender)], ["Profesi", esc(r.profession)], ["Instansi", esc(r.institution)], ["Domisili", esc(r.city + ", " + r.province)],
      ["Program", r.program === "Gratis" ? "Kelas gratis (pembeli buku)" : "Pelatihan penuh"],
      ["Kategori", esc(r.category)],
      ["Pembeli buku", r.bookVerified === "Ya" ? "✓ terverifikasi" + (r.bookOrderId ? " · " + esc(r.bookOrderId) : "") : r.bookOrderId ? esc(r.bookOrderId) + " (belum terverifikasi)" : r.bookProofFileId ? "Bukti foto (perlu dicek)" : "—"],
      ["Tagihan", r.program === "Gratis" ? "Gratis" : rupiah(r.price) + (Number(r.discount) ? " − potongan buku " + rupiah(r.discount) : "") + " + kode unik " + esc(r.uniqueCode) + " = <b>" + rupiah(r.total) + "</b>"],
      ["Transfer", r.paidAmount ? '<span class="' + (mism ? "mismatch" : "") + '">' + rupiah(r.paidAmount) + (mism ? " ⚠ tidak sama dengan tagihan" : " ✓ sesuai") + "</span> a.n. " + esc(r.payerName) + "<br><span class=\"small muted\">" + esc(fmtDate(r.proofAt, true)) + "</span>" : '<span class="muted">Belum ada bukti</span>'],
      ["Kode akses", r.accessCode ? '<span class="code-box" style="font-size:18px">' + esc(r.accessCode) + "</span>" : '<span class="muted">Terbit otomatis saat status Aktif</span>'],
      ["Login terakhir", r.lastLogin ? esc(fmtDate(r.lastLogin, true)) + " (" + esc(r.loginCount) + "×)" : '<span class="muted">Belum pernah</span>'],
      ["Modul dibuka", progressCount(r) + " / " + TOTAL_DECKS],
      ["Kuitansi", r.receiptNo ? '<span class="mono">' + esc(r.receiptNo) + "</span>" : '<span class="muted">Terbit saat diverifikasi</span>'],
      ["Evaluasi", r.evalAt ? "✓ diisi " + esc(fmtDate(r.evalAt, true)) : '<span class="muted">Belum mengisi</span>'],
      ["Sertifikat", r.certNo ? '<span class="mono">' + esc(r.certNo) + "</span> · " + esc(r.certDate) : '<span class="muted">—</span>'],
      ["Sumber info", esc(r.source)], ["Catatan peserta", esc(r.note)],
    ];
    const st = r.status;
    const actions = [];
    const FREEROW = r.program === "Gratis";
    if (!FREEROW) actions.push('<button class="btn btn-sm" data-act="doc">' + (st === "Aktif" || st === "Lulus" ? "🧾 Cetak kuitansi" : "📄 Cetak invoice") + "</button>");
    if (r.bookProofFileId) actions.push('<button class="btn btn-sm" data-act="book">📗 Lihat bukti buku</button>');
    if (r.proofFileId) actions.push('<button class="btn btn-sm" data-act="proof">🖼 Lihat bukti transfer</button>');
    if (r.ktmFileId) actions.push('<button class="btn btn-sm" data-act="ktm">🪪 Lihat KTM</button>');
    if (st === "Menunggu Pembayaran" || st === "Menunggu Verifikasi") actions.push('<button class="btn btn-sm btn-primary" data-act="Aktif">' + (FREEROW ? "✓ Verifikasi buku & aktifkan kelas gratis" : "✓ Verifikasi & aktifkan akses") + "</button>");
    if (st === "Aktif" && !FREEROW) actions.push('<button class="btn btn-sm btn-primary" data-act="Lulus">🎓 Tandai Lulus (terbitkan sertifikat)</button>');
    if (st === "Lulus") actions.push('<button class="btn btn-sm" data-act="Aktif">↩ Batalkan kelulusan</button>');
    if (st === "Aktif" || st === "Lulus") {
      actions.push('<button class="btn btn-sm" data-act="resend">✉ Kirim ulang email kode</button>');
      actions.push('<a class="btn btn-sm btn-good" target="_blank" rel="noopener" href="' + waAccess(r) + '">💬 Kirim kode via WA</a>');
      actions.push('<button class="btn btn-sm" data-act="reset">🔑 Ganti kode akses</button>');
    }
    if (st === "Menunggu Verifikasi" && !FREEROW) actions.push('<button class="btn btn-sm" data-act="Menunggu Pembayaran">↩ Tolak bukti (minta transfer ulang)</button>');
    if (st === "Menunggu Pembayaran" && !FREEROW) actions.push('<a class="btn btn-sm" target="_blank" rel="noopener" href="' + waRemind(r) + '">💬 Ingatkan pembayaran via WA</a>');
    if (st !== "Dibatalkan") actions.push('<button class="btn btn-sm btn-bad" data-act="Dibatalkan">Batalkan</button>');
    else actions.push('<button class="btn btn-sm" data-act="Menunggu Pembayaran">Pulihkan</button>');
    actions.push('<button class="btn btn-sm btn-bad" data-act="delete">🗑 Hapus</button>');

    $("dlgBody").innerHTML = '<dl class="kv">' + kv.map(([k, v]) => "<dt>" + k + "</dt><dd>" + (v || '<span class="muted">—</span>') + "</dd>").join("") + "</dl>" +
      '<div class="dlg-actions">' + actions.join("") + "</div>" +
      '<div class="row" style="margin-top:16px"><div class="field"><label for="eName">Nama di sertifikat</label><input id="eName" value="' + esc(r.name) + '"></div>' +
      '<div class="field"><label for="eNote">Catatan admin</label><input id="eNote" value="' + esc(r.adminNote) + '"></div></div>' +
      '<button class="btn btn-sm" data-act="save">Simpan perubahan</button><div id="dlgMsg"></div><div class="file-view" id="fileView"></div>';
    $("dlgBody").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(r, b.dataset.act, b)));
    if (!$("dlg").open) $("dlg").showModal();
  }

  async function act(r, a, btn) {
    const msg = (t, cls) => ($("dlgMsg").innerHTML = '<div class="alert ' + (cls || "alert-info") + '">' + t + "</div>");
    btn.disabled = true;
    try {
      if (a === "doc") {
        sessionStorage.setItem("mad_doc", JSON.stringify({ id: r.id, admin: key }));
        window.open("invoice.html", "_blank");
      } else if (a === "proof" || a === "ktm" || a === "book") {
        const f = await API.file(key, r.id, a);
        $("fileView").innerHTML = (f.mimeType === "application/pdf" ? '<iframe src="' + f.dataUrl + '"></iframe>' : '<img src="' + f.dataUrl + '" alt="">') +
          (f.url ? '<p class="small"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">Buka di Google Drive</a></p>' : "");
      } else if (a === "resend") {
        await API.resend(key, r.id); msg("✓ Email kode akses dikirim ulang ke " + esc(r.email), "alert-ok");
      } else if (a === "delete") {
        if (!confirm("Hapus permanen pendaftaran " + r.id + " (" + r.name + ")? Data tidak bisa dikembalikan.")) { btn.disabled = false; return; }
        await API.remove(key, r.id); $("dlg").close(); await load(); return;
      } else {
        let fields;
        if (a === "save") fields = { name: $("eName").value.trim(), adminNote: $("eNote").value };
        else if (a === "reset") { if (!confirm("Buat kode akses baru? Kode lama tidak berlaku lagi.")) { btn.disabled = false; return; } fields = { resetCode: true }; }
        else {
          if (a === "Aktif" && r.paidAmount && Number(r.paidAmount) !== Number(r.total) &&
              !confirm("Jumlah transfer (" + rupiah(r.paidAmount) + ") tidak sama dengan tagihan (" + rupiah(r.total) + "). Tetap aktifkan?")) { btn.disabled = false; return; }
          if (a === "Dibatalkan" && !confirm("Batalkan pendaftaran " + r.id + "? Akses materi akan dicabut.")) { btn.disabled = false; return; }
          fields = { status: a };
        }
        const res = await API.update(key, r.id, fields);
        await load();
        openDetail(r.id);
        if (res.mailed) msg("✓ Disimpan. Email berisi kode akses telah dikirim ke " + esc(res.reg.email) + ". Anda juga bisa mengirimnya via WhatsApp.", "alert-ok");
        else if (res.reg.accessCode && (a === "Aktif" || a === "reset")) msg("✓ Disimpan. Email tidak terkirim — kirim kode via tombol WhatsApp.", "alert-warn");
        else msg("✓ Disimpan.", "alert-ok");
        return;
      }
    } catch (ex) { msg(esc(ex.message), "alert-err"); }
    btn.disabled = false;
  }

  function waNum(p) { return "62" + String(p).replace(/\D/g, "").replace(/^(62|0)+/, ""); }
  function waAccess(r) {
    if (r.program === "Gratis") return "https://wa.me/" + waNum(r.phone) + "?text=" + encodeURIComponent(
      "Halo " + r.name + ",\n\nTerima kasih telah membeli buku kami. Pendaftaran *Kelas Gratis Pengenalan R, RStudio & Quarto* (" + r.id + ") sudah aktif.\n\n" +
      "Masuk ke Portal Peserta:\n" + API.base + "masuk.html\n\nEmail: " + r.email + "\nKode akses: *" + r.accessCode + "*\n\n" +
      "Jadwal: " + C.FREE_CLASS.date + ", " + C.FREE_CLASS.time + ". Tautan Zoom & modul pengenalan tersedia di portal.");
    return "https://wa.me/" + waNum(r.phone) + "?text=" + encodeURIComponent(
      "Halo " + r.name + ",\n\nPembayaran pelatihan *" + C.TRAINING.title + " " + C.TRAINING.subtitle + "* (" + r.id + ") telah kami verifikasi. Terima kasih!\n\n" +
      "Masuk ke Portal Peserta:\n" + API.base + "masuk.html\n\nEmail: " + r.email + "\nKode akses: *" + r.accessCode + "*\n\nDi portal tersedia 20 modul, bahan presentasi PDF & data latihan, jadwal & tautan Zoom. Mohon kode akses tidak dibagikan.");
  }
  function waRemind(r) {
    return "https://wa.me/" + waNum(r.phone) + "?text=" + encodeURIComponent(
      "Halo " + r.name + ",\n\nTerima kasih telah mendaftar pelatihan *" + C.TRAINING.title + "* (" + r.id + ").\n" +
      "Tagihan Anda: *" + rupiah(r.total) + "* ke " + C.PAYMENT.map((p) => p.bank + " " + p.number + " a.n. " + p.name).join(" / ") +
      ".\nSetelah transfer, unggah bukti di: " + API.base + "konfirmasi.html?id=" + encodeURIComponent(r.id));
  }

  // ---------- CSV ----------
  $("csvBtn").addEventListener("click", () => {
    const cols = ["id", "createdAt", "status", "name", "email", "phone", "gender", "institution", "profession", "category", "province", "city",
      "price", "uniqueCode", "total", "payerName", "paidAmount", "proofAt", "accessCode", "activatedAt", "lastLogin", "loginCount", "certNo", "certDate", "source", "note", "adminNote"];
    const list = filtered($("q").value.trim().toLowerCase(), $("fCat").value);
    const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "﻿" + [cols.concat("modulDibuka").join(","), ...list.map((r) => cols.map((c) => cell(r[c])).concat(progressCount(r)).join(","))].join("\r\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "peserta-mad-r-" + new Date().toISOString().slice(0, 10) + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------- Kotak email demo ----------
  $("mailBtn").addEventListener("click", async () => {
    const mails = await API.demoMails();
    $("dlgTitle").textContent = "Kotak email terkirim (mode demo)";
    $("dlgBody").innerHTML = mails.length ? mails.map((m, i) => '<details class="mail"' + (i ? "" : " open") + "><summary><b>" + esc(m.subject) + '</b><br><span class="muted small">ke ' + esc(m.to) + " · " + esc(fmtDate(m.at, true)) +
      '</span></summary><div class="body">' + (m.html || "<pre>" + esc(m.text) + "</pre>") + "</div></details>").join("") : '<p class="muted">Belum ada email.</p>';
    if (!$("dlg").open) $("dlg").showModal();
  });

  // ---------- Tab tampilan ----------
  let evalData = null;
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    $("pesertaView").classList.toggle("hidden", b.dataset.view !== "peserta");
    $("evalView").classList.toggle("hidden", b.dataset.view !== "eval");
    if (b.dataset.view === "eval") loadEval();
  }));
  $("refreshBtn").addEventListener("click", () => { if (!$("evalView").classList.contains("hidden")) loadEval(); });

  async function loadEval() {
    try { evalData = await API.evalList(key); renderEval(); }
    catch (e) { $("evBody").innerHTML = '<div class="alert alert-err">' + esc(e.message) + "</div>"; }
  }

  // ---------- Analisis evaluasi ----------
  const E = C.EVALUATION;
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const f1 = (x) => (isNaN(x) ? "–" : x.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const nums = (rows, k, zeroIsNA) => rows.map((r) => r[k]).filter((v) => v !== "" && v != null).map(Number).filter((v) => !isNaN(v) && (!zeroIsNA || v > 0));
  const color = (m) => (m >= 4.2 ? "linear-gradient(90deg,#22c55e,#4ade80)" : m >= 3.4 ? "linear-gradient(90deg,#a855f7,#e879f9)" : "linear-gradient(90deg,#f59e0b,#fbbf24)");
  function bar(label, m, n) {
    return '<div class="ev-bar"><span class="lb">' + esc(label) + (n != null ? ' <span class="muted small">(n=' + n + ")</span>" : "") + '</span><span class="tr"><i style="width:' +
      (isNaN(m) ? 0 : (m / 5) * 100) + "%;background:" + color(m) + '"></i></span><span class="vl">' + f1(m) + "</span></div>";
  }

  function renderEval() {
    const rows = evalData.evals, n = rows.length, eligible = evalData.eligible;
    $("evMeta").textContent = n + " responden dari " + eligible + " peserta aktif/lulus · diperbarui " + new Date().toLocaleTimeString("id-ID");
    if (!n) { $("evBody").innerHTML = '<div class="card center muted">Belum ada peserta yang mengisi evaluasi.</div>'; return; }

    const secMean = (sec) => mean(sec.items.map(([k]) => mean(nums(rows, k, sec.type === "session"))).filter((x) => !isNaN(x)));
    const npsVals = nums(rows, "nps");
    const prom = npsVals.filter((v) => v >= 9).length, pas = npsVals.filter((v) => v >= 7 && v <= 8).length, det = npsVals.filter((v) => v <= 6).length;
    const nps = Math.round(((prom - det) / npsVals.length) * 100);
    const gains = E.competencies.map(([k]) => mean(nums(rows, "post_" + k)) - mean(nums(rows, "pre_" + k)));
    const [sa, sb, sc] = E.sections;
    const kpi = [
      [Math.round((n / Math.max(1, eligible)) * 100) + "%", "Tingkat respons (" + n + "/" + eligible + ")"],
      [f1(mean(nums(rows, "o1"))) + " / 5", "Kepuasan keseluruhan"],
      [(nps > 0 ? "+" : "") + nps, "Net Promoter Score"],
      [f1(secMean(sb)) + " / 5", "Rerata materi"],
      [f1(secMean(sc)) + " / 5", "Rerata narasumber"],
      ["+" + f1(mean(gains)), "Peningkatan kompetensi (poin)"],
    ];
    const quotes = (k, label) => {
      const list = rows.filter((r) => String(r[k] || "").trim());
      return '<div class="ev-sub">' + label + " (" + list.length + ")</div>" + (list.length ? list.map((r) =>
        '<div class="quote">“' + esc(r[k]) + '”<div class="by">' + esc(r.name) + " · " + esc(r.institution) + (k === "t4" ? (r.pub === "Ya" ? ' · <span style="color:var(--good)">boleh dipublikasikan</span>' : " · tidak untuk publikasi") : "") + "</div></div>").join("") : '<div class="muted small">—</div>');
    };

    $("evBody").innerHTML =
      '<div class="kpis">' + kpi.map(([v, l]) => '<div class="kpi"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + "</div></div>").join("") + "</div>" +
      '<div class="ev-grid">' +
        E.sections.map((sec) => '<div class="card"><h3>' + esc(sec.title) + ' <span class="muted small">· rerata ' + f1(secMean(sec)) + "</span></h3>" +
          sec.items.map(([k, q]) => { const v = nums(rows, k, sec.type === "session"); return bar(q, mean(v), sec.type === "session" ? v.length : null); }).join("") + "</div>").join("") +
        '<div class="card"><h3>Peningkatan kompetensi (sebelum → sesudah)</h3><div class="legend" style="margin-bottom:10px"><span><i style="background:#38bdf8"></i>Sebelum</span><span><i style="background:#e879f9"></i>Sesudah</span><span>skala 1–5</span></div>' +
          E.competencies.map(([k, q], i) => {
            const a = mean(nums(rows, "pre_" + k)), b = mean(nums(rows, "post_" + k)), x = (v) => ((v - 1) / 4) * 100;
            return '<div class="dumb"><span class="lb">' + esc(q) + '</span><span class="track"><span class="seg-line" style="left:' + x(Math.min(a, b)) + "%;width:" + Math.abs(x(b) - x(a)) + '%"></span>' +
              '<span class="dot pre" style="left:' + x(a) + '%" title="Sebelum ' + f1(a) + '"></span><span class="dot post" style="left:' + x(b) + '%" title="Sesudah ' + f1(b) + '"></span></span>' +
              '<span class="vl">' + f1(a) + " → " + f1(b) + "<br><b>+" + f1(gains[i]) + "</b></span></div>";
          }).join("") + "</div>" +
        '<div class="card"><h3>Net Promoter Score: ' + (nps > 0 ? "+" : "") + nps + "</h3>" +
          '<div class="nps-bar"><div style="flex:' + det + ';background:#ef4444">' + (det ? det : "") + '</div><div style="flex:' + pas + ';background:#f59e0b">' + (pas ? pas : "") +
          '</div><div style="flex:' + prom + ';background:#22c55e">' + (prom ? prom : "") + "</div></div>" +
          '<div class="legend" style="margin-top:8px"><span><i style="background:#ef4444"></i>Detractor 0–6</span><span><i style="background:#f59e0b"></i>Passive 7–8</span><span><i style="background:#22c55e"></i>Promoter 9–10</span></div>' +
          '<div class="ev-sub">Distribusi skor</div>' + hbars(Array.from({ length: 11 }, (_, v) => [String(10 - v), npsVals.filter((x) => x === 10 - v).length]).filter((x) => x[1])) +
          '<div class="ev-sub">Kepuasan keseluruhan</div>' + hbars([5, 4, 3, 2, 1].map((v) => [v + " · " + E.scale[v - 1], nums(rows, "o1").filter((x) => x === v).length]).filter((x) => x[1])) +
        "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:12px"><h3>Masukan terbuka</h3><div class="ev-grid" style="margin-top:0"><div>' +
        quotes("t1", "Paling bermanfaat") + quotes("t2", "Saran perbaikan") + "</div><div>" + quotes("t3", "Topik pelatihan lanjutan") + quotes("t4", "Testimoni") + "</div></div></div>";
  }

  $("evPrint").addEventListener("click", () => print());
  $("evCsv").addEventListener("click", () => {
    if (!evalData || !evalData.evals.length) return;
    const cols = Object.keys(evalData.evals[0]);
    const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "﻿" + [cols.join(","), ...evalData.evals.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "evaluasi-mad-r-" + new Date().toISOString().slice(0, 10) + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
