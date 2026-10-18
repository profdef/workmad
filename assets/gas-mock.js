/* =========================================================
   Tiruan layanan Google Apps Script (Sheets, Drive, Gmail, dll.)
   untuk MODE DEMO di browser dan untuk pengujian di Node.
   apps-script/Code.gs yang ASLI dijalankan di atas tiruan ini,
   sehingga demo = perilaku backend sebenarnya.
   ========================================================= */
(function (root) {
  function createGas(store) {
    // store: { load() → db, save(db) }
    let db = store.load() || {};
    db.sheets = db.sheets || {}; db.props = db.props || {}; db.files = db.files || {}; db.mails = db.mails || [];
    const save = () => store.save(db);

    const b64enc = (bytes) => {
      if (typeof Buffer !== "undefined") return Buffer.from(bytes.map((b) => b & 255)).toString("base64");
      let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 255);
      return btoa(s);
    };
    const b64dec = (str) => {
      if (typeof Buffer !== "undefined") return Array.from(Buffer.from(str, "base64")).map((b) => (b > 127 ? b - 256 : b));
      const s = atob(str); const a = new Array(s.length);
      for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); a[i] = b > 127 ? b - 256 : b; }
      return a;
    };

    function makeSheet(name, box) {
      box = box || (() => db.sheets);
      const rows = () => box()[name];
      const sheet = {
        getLastRow: () => rows().length,
        getLastColumn: () => rows().reduce((m, r) => Math.max(m, r.length), 0),
        getMaxRows: () => Math.max(1000, rows().length),
        setFrozenRows() {},
        deleteRow(r) { rows().splice(r - 1, 1); save(); },
        getRange(r, c, nr, nc) {
          nr = nr || 1; nc = nc || 1;
          const range = {
            setNumberFormat: () => range,
            setFontWeight: () => range,
            getValues() {
              const out = [];
              for (let i = 0; i < nr; i++) {
                const row = rows()[r - 1 + i] || [];
                out.push(Array.from({ length: nc }, (_, j) => (row[c - 1 + j] == null ? "" : row[c - 1 + j])));
              }
              return out;
            },
            setValues(vals) {
              for (let i = 0; i < nr; i++) {
                const idx = r - 1 + i;
                while (rows().length <= idx) rows().push([]);
                for (let j = 0; j < nc; j++) rows()[idx][c - 1 + j] = vals[i][j];
              }
              save();
              return range;
            },
          };
          return range;
        },
      };
      return sheet;
    }

    function makeFile(id) {
      const f = db.files[id];
      if (!f) throw new Error("File tidak ada");
      return {
        getId: () => id,
        getUrl: () => "https://drive.google.com/file/d/" + id + "/view",
        setDescription(d) { f.desc = d; save(); return this; },
        getBlob: () => ({ getContentType: () => f.mime, getBytes: () => b64dec(f.data) }),
      };
    }

    const pad = (n, w) => String(n).padStart(w || 2, "0");
    const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 256) - 128);

    return {
      db: () => db,
      reset() { db = { sheets: {}, props: {}, files: {}, mails: [] }; save(); },
      save,
      services: {
        SpreadsheetApp: {
          getActiveSpreadsheet: () => ({
            getSheetByName: (n) => (db.sheets[n] ? makeSheet(n) : null),
            insertSheet: (n) => { db.sheets[n] = []; save(); return makeSheet(n); },
          }),
          // Spreadsheet lain (mis. data pesanan buku aplikasi orderbuku): db.ext[id][namaSheet] = baris
          openById: (id) => {
            if (!db.ext || !db.ext[id]) throw new Error("Spreadsheet tidak ditemukan");
            return { getSheetByName: (n) => (db.ext[id][n] ? makeSheet(n, () => db.ext[id]) : null) };
          },
        },
        PropertiesService: {
          getScriptProperties: () => ({
            getProperty: (k) => (k in db.props ? db.props[k] : null),
            setProperty: (k, v) => { db.props[k] = String(v); save(); },
          }),
        },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        Utilities: {
          // Waktu WIB (UTC+7)
          formatDate(date, tz, fmt) {
            const d = new Date(date.getTime() + 7 * 3600e3);
            return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, (t) => ({
              yyyy: d.getUTCFullYear(), yy: pad(d.getUTCFullYear() % 100), MM: pad(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()),
              HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()),
            }[t]));
          },
          base64Decode: b64dec,
          base64Encode: b64enc,
          newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
          sleep() {},
          getUuid: () => Math.random().toString(36).slice(2) + Date.now().toString(36),
          DigestAlgorithm: { SHA_256: "SHA_256" },
          computeDigest: () => rnd(32),
        },
        DriveApp: {
          createFolder: (name) => { db.props.__folder = name; save(); return root.__gasFolder; },
          getFolderById: () => root.__gasFolder,
          getFileById: makeFile,
        },
        MailApp: {
          getRemainingDailyQuota: () => 100,
          sendEmail(a, subject, text) {
            const m = typeof a === "object" ? a : { to: a, subject, body: text };
            db.mails.unshift({ at: new Date().toISOString(), to: m.to, subject: m.subject, html: m.htmlBody || "", text: m.body || "" });
            db.mails = db.mails.slice(0, 50);
            save();
          },
        },
        ContentService: {
          MimeType: { JSON: "JSON" },
          createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }),
        },
        Logger: { log: (...a) => console.log("[GAS]", ...a) },
        UrlFetchApp: {
          fetch(url, opt) {
            db.telegram = db.telegram || [];
            if (/api\.telegram\.org/.test(url)) db.telegram.unshift({ at: new Date().toISOString(), body: opt && opt.payload ? JSON.parse(opt.payload) : null });
            db.telegram = db.telegram.slice(0, 50); save();
            return { getResponseCode: () => 200, getContentText: () => '{"ok":true,"result":[]}' };
          },
        },
      },
      // Folder tiruan
      folder: {
        getId: () => "demo-folder",
        getUrl: () => "https://drive.google.com/drive/folders/demo-folder",
        createFile(blob) {
          const id = "demo-" + Math.random().toString(36).slice(2, 10);
          db.files[id] = { name: blob.name, mime: blob.mime, data: b64enc(blob.bytes) };
          save();
          return makeFile(id);
        },
      },
    };
  }

  /** Jalankan teks Code.gs dalam lingkup terisolasi → { doPost, gas } */
  function loadBackend(codeText, store) {
    const gas = createGas(store);
    root.__gasFolder = gas.folder;
    const names = Object.keys(gas.services);
    const fn = new Function(...names, codeText + "\n;return { doPost: doPost, CONFIG: CONFIG };");
    const api = fn(...names.map((n) => gas.services[n]));
    return {
      gas, CONFIG: api.CONFIG,
      call(body) {
        const out = api.doPost({ postData: { contents: JSON.stringify(body) } });
        return JSON.parse(out.getContent());
      },
    };
  }

  root.GasMock = { createGas, loadBackend };
  if (typeof module !== "undefined") module.exports = root.GasMock;
})(typeof window !== "undefined" ? window : globalThis);
