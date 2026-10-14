// DIBUAT OTOMATIS oleh tools/build-materi.mjs
window.MATERI = {
 "builtAt": "2026-10-14T07:32:02.158Z",
 "parts": [
  {
   "label": "Pengantar",
   "title": "",
   "decks": [
    {
     "slug": "00-tentang-buku",
     "n": "i",
     "title": "Tentang Buku Ini",
     "desc": "Untuk siapa, mengapa R/RStudio/Quarto, susunan buku, profil penulis"
    },
    {
     "slug": "01-pendahuluan",
     "n": "ii",
     "title": "Pendahuluan: Epidemiologi, Kesehatan Masyarakat, dan Era Data",
     "desc": "Manajemen dan analisis data sebagai keterampilan inti"
    }
   ]
  },
  {
   "label": "Bagian I",
   "title": "Konsep Dasar",
   "decks": [
    {
     "slug": "bab-01-konsep-dasar-data",
     "n": "1",
     "title": "Konsep Dasar Data dalam Epidemiologi",
     "desc": "Tidy data, skala pengukuran, tipe data di R"
    },
    {
     "slug": "bab-02-siklus-hidup-data",
     "n": "2",
     "title": "Siklus Hidup Data Penelitian",
     "desc": "Enam tahap, kamus data, siklus iteratif"
    },
    {
     "slug": "bab-03-tata-kelola-data",
     "n": "3",
     "title": "Tata Kelola Data yang Baik",
     "desc": "Empat pilar data governance, jejak audit di R"
    },
    {
     "slug": "bab-04-etika-privasi-keamanan",
     "n": "4",
     "title": "Etika, Privasi, dan Keamanan Data Kesehatan",
     "desc": "Prinsip etika, UU PDP 2022, pemisahan identitas"
    },
    {
     "slug": "bab-05-jenis-sumber-data",
     "n": "5",
     "title": "Jenis dan Sumber Data Epidemiologi",
     "desc": "Primer vs sekunder, ragam sumber data Indonesia"
    }
   ]
  },
  {
   "label": "Bagian II",
   "title": "R, RStudio & Quarto",
   "decks": [
    {
     "slug": "bab-06-mengenal-r-rstudio",
     "n": "6",
     "title": "Mengenal R dan RStudio",
     "desc": "Instalasi, empat panel, RStudio Project, paket"
    },
    {
     "slug": "bab-07-dasar-pemrograman-r",
     "n": "7",
     "title": "Dasar Pemrograman R untuk Epidemiologi",
     "desc": "Objek, vektor, tibble, tidyverse, pipe, fungsi"
    },
    {
     "slug": "bab-08-reproducible-quarto",
     "n": "8",
     "title": "Reproducible Research dengan Quarto",
     "desc": "Anatomi .qmd, opsi chunk, render, Quarto Book"
    }
   ]
  },
  {
   "label": "Bagian III",
   "title": "Manajemen Data",
   "decks": [
    {
     "slug": "bab-09-impor-ekspor-data",
     "n": "9",
     "title": "Impor, Ekspor, dan Struktur Data",
     "desc": "CSV, Excel, SPSS, Stata; struktur folder proyek"
    },
    {
     "slug": "bab-10-pembersihan-transformasi",
     "n": "10",
     "title": "Pembersihan dan Transformasi Data",
     "desc": "janitor, stringr, case_when, lubridate"
    },
    {
     "slug": "bab-11-penggabungan-rekode",
     "n": "11",
     "title": "Penggabungan, Rekode, dan Manajemen Variabel",
     "desc": "join, factor, data hilang dengan naniar"
    }
   ]
  },
  {
   "label": "Bagian IV",
   "title": "Analisis Data",
   "decks": [
    {
     "slug": "bab-12-analisis-univariat",
     "n": "12",
     "title": "Analisis Univariat",
     "desc": "Ringkasan numerik/kategorik, tbl_summary"
    },
    {
     "slug": "bab-13-analisis-bivariat",
     "n": "13",
     "title": "Analisis Bivariat",
     "desc": "Uji-t, chi-square, korelasi, OR kasar"
    },
    {
     "slug": "bab-14-tabel-2x2-asosiasi",
     "n": "14",
     "title": "Tabulasi Tabel 2×2 dan Ukuran Asosiasi",
     "desc": "Odds ratio, risiko relatif, Fisher, tbl_cross"
    },
    {
     "slug": "bab-15-analisis-multivariat",
     "n": "15",
     "title": "Analisis Multivariat",
     "desc": "Regresi logistik, adjusted OR, kesimpulan"
    }
   ]
  },
  {
   "label": "Bagian V",
   "title": "Studi Kasus",
   "decks": [
    {
     "slug": "bab-16-studi-kasus-surveilans",
     "n": "16",
     "title": "Studi Kasus: Surveilans Penyakit Menular",
     "desc": "Kurva epidemi, ambang kewaspadaan, peta Kota Padang"
    },
    {
     "slug": "bab-17-studi-kasus-survei",
     "n": "17",
     "title": "Studi Kasus: Survei Kesehatan Masyarakat",
     "desc": "Framingham Heart Study dengan gtsummary"
    },
    {
     "slug": "bab-18-laporan-otomatis-quarto",
     "n": "18",
     "title": "Studi Kasus: Laporan Epidemiologi Otomatis",
     "desc": "Quarto berparameter, multi-format, terjadwal"
    }
   ]
  }
 ],
 "downloads": [
  {
   "id": "paket-latihan",
   "file": "paket-latihan-mad.zip",
   "title": "Paket Latihan RStudio",
   "desc": "Dataset (CSV, Excel, SPSS, Stata, GeoJSON), R/setup.R, dan semua file .qmd untuk dirender sendiri",
   "size": 6002319
  }
 ]
};
