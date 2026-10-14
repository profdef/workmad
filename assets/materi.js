/* Dekripsi materi terenkripsi (format dari tools/build-materi.mjs):
   "MAD1" + iv(12) + AES-256-GCM(ciphertext+tag) dari gzip(isi) */
(function () {
  async function importKey(b64) {
    let raw;
    try { raw = Uint8Array.from(atob(String(b64 || "").replace(/\s+|["'`]/g, "")), (c) => c.charCodeAt(0)); }
    catch (e) { raw = new Uint8Array(0); }
    if (raw.length !== 32) throw new Error("Kunci materi tidak valid. Silakan keluar lalu masuk kembali.");
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  }

  async function gunzip(buf) {
    const ds = new DecompressionStream("gzip");
    return new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
  }

  window.Materi = {
    /** Unduh & buka file terenkripsi → ArrayBuffer */
    async open(url, keyB64, onProgress) {
      if (!window.crypto || !crypto.subtle || !window.DecompressionStream)
        throw new Error("Browser terlalu lama. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Materi tidak ditemukan (HTTP " + res.status + ")");
      let bytes;
      const total = Number(res.headers.get("content-length")) || 0;
      if (onProgress && res.body && total) {
        const reader = res.body.getReader(); const chunks = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(got / total); }
        bytes = new Uint8Array(got); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
      } else bytes = new Uint8Array(await res.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 4)) !== "MAD1") throw new Error("Format materi tidak dikenal");
      const key = await importKey(keyB64);
      let plain;
      try {
        plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(4, 16) }, key, bytes.slice(16));
      } catch (e) {
        throw new Error("Materi tidak dapat dibuka dengan kunci Anda (materi mungkin diperbarui). Silakan keluar lalu masuk kembali.");
      }
      return gunzip(plain);
    },
  };
})();
