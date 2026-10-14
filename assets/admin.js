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
  if (saved) login(saved);
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
    const live = regs.filter((r) => r.status !== "Dibatalkan");
    const by = (s) => regs.filter((r) => r.status === s);
    const paid = live.filter((r) => r.status === "Aktif" || r.status === "Lulus");
    const revenue = paid.reduce((n, r) => n + (Number(r.paidAmount) || Number(r.total) || 0), 0);
    const kpi = [
      [live.length + " / " + stats.quota, "Pendaftar / kuota"],
      [by("Menunggu Pembayaran").length, "Menunggu pembayaran"],
      [by("Menunggu Verifikasi").length, "Perlu verifikasi", by("Menunggu Verifikasi").length ? "Menunggu Verifikasi" : ""],
      [paid.length, "Peserta aktif + lulus"],
      [by("Lulus").length, "Lulus (sertifikat)"],
      [rupiah(revenue), "Pendapatan terverifikasi"],
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
        "<td class=\"small\">" + esc(r.category) + '</td><td class="num">' + rupiah(r.total) + "</td>" +
        '<td class="num' + (mism ? " mismatch" : "") + '">' + (r.paidAmount ? rupiah(r.paidAmount) + (mism ? " ⚠" : "") : '<span class="muted">—</span>') + "</td>" +
        "<td>" + statusBadge(r.status) + "</td><td class=\"small\">" + progressCount(r) + "/" + TOTAL_DECKS + "</td>" +
        '<td><button class="btn btn-sm" type="button" data-id="' + esc(r.id) + '">Detail</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="center muted" style="padding:28px">Tidak ada data</td></tr>';
    $("rows").querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.id)));
    $("count").textContent = list.length + " dari " + regs.length + " pendaftar";
  }
  function filtered(q, cat) {
    return regs.filter((r) => (!fStatus || r.status === fStatus) && (!cat || r.category === cat) &&
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
      ["Kategori", esc(r.category)], ["Tagihan", rupiah(r.price) + " + kode unik " + esc(r.uniqueCode) + " = <b>" + rupiah(r.total) + "</b>"],
      ["Transfer", r.paidAmount ? '<span class="' + (mism ? "mismatch" : "") + '">' + rupiah(r.paidAmount) + (mism ? " ⚠ tidak sama dengan tagihan" : " ✓ sesuai") + "</span> a.n. " + esc(r.payerName) + "<br><span class=\"small muted\">" + esc(fmtDate(r.proofAt, true)) + "</span>" : '<span class="muted">Belum ada bukti</span>'],
      ["Kode akses", r.accessCode ? '<span class="code-box" style="font-size:18px">' + esc(r.accessCode) + "</span>" : '<span class="muted">Terbit otomatis saat status Aktif</span>'],
      ["Login terakhir", r.lastLogin ? esc(fmtDate(r.lastLogin, true)) + " (" + esc(r.loginCount) + "×)" : '<span class="muted">Belum pernah</span>'],
      ["Modul dibuka", progressCount(r) + " / " + TOTAL_DECKS],
      ["Sertifikat", r.certNo ? '<span class="mono">' + esc(r.certNo) + "</span> · " + esc(r.certDate) : '<span class="muted">—</span>'],
      ["Sumber info", esc(r.source)], ["Catatan peserta", esc(r.note)],
    ];
    const st = r.status;
    const actions = [];
    if (r.proofFileId) actions.push('<button class="btn btn-sm" data-act="proof">🧾 Lihat bukti</button>');
    if (r.ktmFileId) actions.push('<button class="btn btn-sm" data-act="ktm">🪪 Lihat KTM</button>');
    if (st === "Menunggu Pembayaran" || st === "Menunggu Verifikasi") actions.push('<button class="btn btn-sm btn-primary" data-act="Aktif">✓ Verifikasi & aktifkan akses</button>');
    if (st === "Aktif") actions.push('<button class="btn btn-sm btn-primary" data-act="Lulus">🎓 Tandai Lulus (terbitkan sertifikat)</button>');
    if (st === "Lulus") actions.push('<button class="btn btn-sm" data-act="Aktif">↩ Batalkan kelulusan</button>');
    if (st === "Aktif" || st === "Lulus") {
      actions.push('<button class="btn btn-sm" data-act="resend">✉ Kirim ulang email kode</button>');
      actions.push('<a class="btn btn-sm btn-good" target="_blank" rel="noopener" href="' + waAccess(r) + '">💬 Kirim kode via WA</a>');
      actions.push('<button class="btn btn-sm" data-act="reset">🔑 Ganti kode akses</button>');
    }
    if (st === "Menunggu Verifikasi") actions.push('<button class="btn btn-sm" data-act="Menunggu Pembayaran">↩ Tolak bukti (minta transfer ulang)</button>');
    if (st === "Menunggu Pembayaran") actions.push('<a class="btn btn-sm" target="_blank" rel="noopener" href="' + waRemind(r) + '">💬 Ingatkan pembayaran via WA</a>');
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
      if (a === "proof" || a === "ktm") {
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
    return "https://wa.me/" + waNum(r.phone) + "?text=" + encodeURIComponent(
      "Halo " + r.name + ",\n\nPembayaran pelatihan *" + C.TRAINING.title + " " + C.TRAINING.subtitle + "* (" + r.id + ") telah kami verifikasi. Terima kasih!\n\n" +
      "Masuk ke Portal Peserta:\n" + API.base + "masuk.html\n\nEmail: " + r.email + "\nKode akses: *" + r.accessCode + "*\n\nDi portal tersedia 20 modul, paket latihan, jadwal & tautan Zoom. Mohon kode akses tidak dibagikan.");
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
})();
