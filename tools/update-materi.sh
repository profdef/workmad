#!/usr/bin/env bash
# PERBARUI MATERI SETELAH SLIDE DI ~/Github/ppt BERUBAH
#   bash tools/update-materi.sh            → ekspor PDF, build materi terenkripsi, naikkan versi situs
#   bash tools/update-materi.sh --push     → sama, lalu commit & push ke GitHub
# Prasyarat: slide sudah dirender di Quarto (file ppt/*.html terbaru), Google Chrome terpasang.
set -euo pipefail
cd "$(dirname "$0")/.."
PPT="${PPT:-../ppt}"

echo "1/4 Ekspor slide → PDF (R Code & Output)…"
node tools/export-pdf.mjs "$PPT"

echo; echo "2/4 Build materi terenkripsi (deck web + PDF + data)…"
node tools/build-materi.mjs "$PPT"

echo; echo "3/4 Naikkan versi situs (agar browser peserta memuat materi terbaru)…"
V="$(date +%Y.%m.%d-%H%M)"
printf '{ "v": "%s" }\n' "$V" > version.json
sed -i '' "s/APP_VERSION: \"[^\"]*\"/APP_VERSION: \"$V\"/" assets/config.js
N=$(( $(grep -o 'catalog\.js?v=[0-9]*' portal.html | head -1 | sed 's/.*=//') + 1 ))
for f in *.html tools/view.html; do sed -i '' -E "s/(catalog\.js)\?v=[0-9]+\"/\1?v=$N\"/g; s/(assets\/config\.js)\?v=[0-9]+\"/\1?v=$N\"/g" "$f"; done
cp tools/view.html materi/view.html
echo "   versi: $V"

echo; echo "4/4 Uji backend…"
node tools/test-backend.mjs | tail -1

if [[ "${1:-}" == "--push" ]]; then
  git add -A
  git commit -q -m "Perbarui materi slide, PDF & data ($V)"
  git push -q origin main
  echo; echo "✓ Ter-push. Situs diperbarui dalam ±1–3 menit: https://pelatihan.publichealth.id"
else
  echo; echo "Cek dulu di lokal (opsional):  python3 -m http.server 8080  → http://localhost:8080/?demo=1"
  echo "Lalu terbitkan:                git add -A && git commit -m \"Perbarui materi ($V)\" && git push"
fi
