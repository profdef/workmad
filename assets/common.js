/* Komponen bersama: header, footer, banner demo, rekening, unggah file */
(function () {
  const C = window.APP_CONFIG;
  const T = C.TRAINING;
  const O = C.ORGANIZER;

  window.renderChrome = function (active) {
    const s = window.Session && Session.get();
    const nav = [
      ["index.html#kurikulum", "Kurikulum", "kurikulum"],
      ["index.html#jadwal", "Jadwal", "jadwal"],
      ["index.html#biaya", "Biaya", "biaya"],
      ["konfirmasi.html", "Konfirmasi Bayar", "konfirmasi"],
      ["invoice.html", "Invoice", "invoice"],
      ["sertifikat.html", "Cek Sertifikat", "sertifikat"],
    ].map(([h, t, k]) => '<a class="link' + (k === active ? " on" : "") + '" href="' + h + '">' + t + "</a>").join("");
    const right = s
      ? '<a class="btn btn-sm btn-primary" href="portal.html">Portal Peserta</a>'
      : '<a class="btn btn-sm" href="masuk.html">Masuk</a><a class="btn btn-sm btn-primary" href="daftar.html">Daftar</a>';
    const top = document.getElementById("topbar");
    if (top) top.outerHTML =
      (API.isDemo ? '<div class="demo-banner">Mode demo: data hanya tersimpan di browser ini. Kunci admin <b>admin123</b>. Isi <span class="mono">API_URL</span> di assets/config.js untuk produksi.</div>' : "") +
      '<header class="topbar"><div class="container">' +
        '<a class="brand" href="index.html"><img class="logo" src="' + O.icon + '" alt="publichealth.id"><span>Pelatihan MAD-R<small>' + esc(O.name) + " · " + esc(T.batch) + "</small></span></a>" +
        "<nav>" + nav + right + "</nav>" +
      "</div></header>";
    const foot = document.getElementById("footer");
    if (foot) foot.outerHTML =
      '<footer class="foot"><div class="container">' +
        '<div class="foot-brand"><a href="' + esc(O.url) + '" target="_blank" rel="noopener"><img src="' + O.logoDark + '" alt="publichealth.id — ' + esc(O.motto) + '"></a>' +
        "<div>Pelatihan Online <b style=\"color:#fff\">" + esc(T.title) + " " + esc(T.subtitle) + "</b><br>Narasumber: " + esc(T.instructor) + "<br>Diselenggarakan oleh " +
        '<a href="' + esc(O.url) + '" target="_blank" rel="noopener">publichealth.id</a></div></div>' +
        '<div>WhatsApp admin: <a href="https://wa.me/' + C.ADMIN_WA + '" target="_blank" rel="noopener">+' + C.ADMIN_WA + "</a><br>" +
        'Email: <a href="mailto:' + esc(T.email) + '">' + esc(T.email) + "</a><br>Web: <a href=\"" + esc(O.url) + "\" target=\"_blank\" rel=\"noopener\">publichealth.id</a><br><i>" + esc(O.motto) + "</i></div>" +
      "</div></footer>";
  };

  window.renderPaymentInfo = function (el) {
    el.innerHTML = C.PAYMENT.map((p) =>
      '<div class="bank"><div><div class="small muted">' + esc(p.bank) + '</div><div class="acc">' + esc(p.number) +
      '</div><div class="small">a.n. <b>' + esc(p.name) + '</b></div></div>' +
      '<button type="button" class="btn btn-sm" data-copy="' + esc(p.number) + '">Salin</button></div>').join("");
    bindCopy(el);
  };

  window.bindCopy = function (el) {
    el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      const old = b.textContent;
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "✓ Disalin"; } catch (e) { b.textContent = b.dataset.copy; }
      setTimeout(() => (b.textContent = old), 1800);
    }));
  };

  // Nominal dengan 3 digit kode unik digarisbawahi
  window.amountHtml = function (total, code) {
    const s = rupiah(total);
    const tail = String(code).padStart(3, "0");
    return s.endsWith(tail) ? esc(s.slice(0, -3)) + '<span class="u">' + tail + "</span>" : esc(s);
  };

  window.statusBadge = (st) => '<span class="badge st-' + String(st).toLowerCase().replace(/\s+/g, "-") + '">' + esc(st) + "</span>";

  // Gambar dikompres ke JPEG maks. 1600 px; PDF dikirim apa adanya
  window.fileToPayload = async function (file) {
    if (!file) return null;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") throw new Error("Format file harus gambar (JPG/PNG) atau PDF.");
    let payload;
    if (file.type === "application/pdf") {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      payload = { name: file.name, mimeType: file.type, data: dataUrl.split(",")[1] };
    } else {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Gambar tidak bisa dibaca")); i.src = URL.createObjectURL(file); });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * scale); cv.height = Math.round(img.naturalHeight * scale);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      payload = { name: file.name.replace(/\.\w+$/, "") + ".jpg", mimeType: "image/jpeg", data: cv.toDataURL("image/jpeg", 0.82).split(",")[1] };
    }
    if (payload.data.length * 0.75 > C.PROOF_MAX_MB * 1048576) throw new Error("Ukuran file melebihi " + C.PROOF_MAX_MB + " MB");
    return payload;
  };

  window.previewFile = function (input, img) {
    input.addEventListener("change", () => {
      const f = input.files[0];
      if (f && f.type.startsWith("image/")) { img.src = URL.createObjectURL(f); img.classList.remove("hidden"); }
      else img.classList.add("hidden");
    });
  };

  /**
   * Formulir unggah bukti transfer.
   * opts: { id, contact, total, onDone(reg) } — bila id & contact diberikan, kolom itu disembunyikan.
   */
  window.mountProofForm = function (el, opts) {
    opts = opts || {};
    const known = Boolean(opts.id && opts.contact);
    el.innerHTML =
      '<form novalidate>' +
        (known ? "" :
          '<div class="row">' +
            '<div class="field"><label class="req" for="pfId">No. pendaftaran</label><input id="pfId" placeholder="MAD-261014-0001" autocapitalize="characters" value="' + esc(opts.id || "") + '"></div>' +
            '<div class="field"><label class="req" for="pfContact">Email atau no. WhatsApp saat mendaftar</label><input id="pfContact" autocomplete="email"></div>' +
          "</div>") +
        '<div class="row">' +
          '<div class="field"><label class="req" for="pfName">Nama pemilik rekening pengirim</label><input id="pfName"></div>' +
          '<div class="field"><label class="req" for="pfAmount">Jumlah transfer (Rp)</label><input id="pfAmount" type="number" min="1" inputmode="numeric" value="' + (opts.total || "") + '"></div>' +
        "</div>" +
        '<div class="field"><label class="req" for="pfFile">Foto / screenshot bukti transfer</label>' +
          '<input id="pfFile" type="file" accept="image/*,application/pdf">' +
          '<div class="hint">JPG, PNG, atau PDF · maks. ' + C.PROOF_MAX_MB + ' MB</div>' +
          '<img class="proof-preview hidden" alt="Pratinjau bukti transfer"></div>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">Kirim Bukti Pembayaran</button>' +
        '<div class="alert alert-err hidden" role="alert"></div>' +
      "</form>";
    const form = el.querySelector("form");
    const q = (s) => form.querySelector(s);
    const err = q(".alert");
    previewFile(q("#pfFile"), q(".proof-preview"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.classList.add("hidden");
      const id = (known ? opts.id : q("#pfId").value).trim().toUpperCase();
      const contact = (known ? opts.contact : q("#pfContact").value).trim();
      const payerName = q("#pfName").value.trim();
      const paidAmount = Number(q("#pfAmount").value) || 0;
      const file = q("#pfFile").files[0];
      const miss = [];
      if (!id) miss.push("no. pendaftaran");
      if (!contact) miss.push("email/WhatsApp");
      if (!payerName) miss.push("nama pengirim");
      if (paidAmount <= 0) miss.push("jumlah transfer");
      if (!file) miss.push("file bukti transfer");
      if (miss.length) return fail("Mohon lengkapi: " + miss.join(", ") + ".");
      const btn = q("button[type=submit]");
      btn.disabled = true; btn.textContent = "Mengunggah…";
      try {
        const res = await API.confirm({ id, contact, payerName, paidAmount, file: await fileToPayload(file) });
        el.innerHTML = '<div class="alert alert-ok"><b>✓ Bukti pembayaran terkirim.</b><br>Pendaftaran <span class="mono">' + esc(res.reg.id) +
          "</span> kini berstatus <b>" + esc(res.reg.status) + "</b>. Setelah diverifikasi admin (umumnya 1×24 jam), kode akses materi dikirim ke email Anda.</div>";
        if (opts.onDone) opts.onDone(res.reg);
      } catch (ex) {
        fail(ex.message);
        btn.disabled = false; btn.textContent = "Kirim Bukti Pembayaran";
      }
    });
    function fail(m) { err.textContent = m; err.classList.remove("hidden"); }
  };
})();
