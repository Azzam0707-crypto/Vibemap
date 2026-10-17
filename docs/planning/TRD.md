# TRD — VibeMap

## 1. Ringkasan teknis

VibeMap adalah desktop app (.exe, dibungkus Electron) yang membuka dialog pilih folder, memindai seluruh struktur project (file dan folder, bukan cuma diff git), mengirim hasil scan ke LLM (provider configurable: cloud API atau lokal) untuk diringkas bahasa awam, menghasilkan diagram struktur project untuk dirender Mermaid flowchart, lalu menyajikan semua itu di jendela aplikasi sendiri lewat dashboard yang sebenarnya halaman web dibungkus Electron.

## 2. Komponen teknis

| Komponen | Fungsi | Teknologi (diusulkan) |
| --- | --- | --- |
| Electron shell | Buka jendela app, dialog pilih folder native, bundling jadi .exe | Electron (main + renderer process) |
| File Scanner | Telusuri folder dipilih secara rekursif, baca struktur file/folder | Node.js fs, fast-glob, exclude node\_modules/.git/dist/build otomatis |
| Git Reader (opsional) | Kalau folder punya `.git`, ambil diff/log sebagai info tambahan "apa yang baru berubah" | simple-git, dilewati kalau bukan repo git |
| File/Diff Parser | Ubah hasil scan jadi struktur file/fungsi, gabung info git kalau ada | Parser AST ringan untuk JS/TS, metadata saja untuk file lain |
| Summarizer | Kirim struktur project ke LLM, minta ringkasan bahasa awam | Provider configurable: Claude/OpenAI (API key sendiri) atau Ollama lokal |
| Diagram generator | Ubah struktur project/perubahan jadi sintaks Mermaid flowchart | Template string ke Mermaid syntax |
| Renderer (dashboard UI) | Tampilkan ringkasan dan diagram di jendela app, klik-klik | HTML/CSS/JS, Mermaid.js, dirender di Electron renderer process |

## 3. Kebutuhan non-fungsional

- Instalasi hanya lewat installer .exe, tanpa command line, tanpa dependency eksternal yang perlu diinstal manual user (Node.js dibundel di dalam Electron)
- Tidak menyimpan data user di luar proses sekali jalan (tidak ada database), state hilang saat app ditutup
- API key LLM, kalau pakai cloud, disuplai user sendiri lewat form di app, disimpan lokal terenkripsi ringan (bukan plaintext)
- Waktu proses dari pilih folder sampai dashboard tampil di bawah 20 detik untuk project wajar (< 200 file relevan)

## 4. Batasan teknis

- Scan dibatasi kedalaman folder dan exclude folder umum (node\_modules, .git, dist, build, .next, vendor) secara default
- Hanya parsing AST penuh untuk `.js`, `.jsx`, `.ts`, `.tsx`; file lain (css, json, md, dll) hanya dicatat nama, jenis, dan ukuran
- Diagram dibatasi maksimum sekitar 25-30 node supaya tetap terbaca, project lebih besar dari itu diringkas per folder/modul, bukan per file
- Git Reader bersifat opsional, hanya aktif kalau folder punya `.git`, app tidak gagal atau error kalau tidak ada

## 5. Dependensi eksternal

- Tidak wajib Node.js atau git terpasang terpisah di mesin user (dibundel dalam installer Electron), git CLI dipakai kalau tersedia tapi tidak wajib
- Koneksi internet, hanya kalau pakai provider cloud; tidak perlu internet kalau pakai Ollama lokal (tapi perlu Ollama sudah terpasang dan jalan)
- API key LLM milik user sendiri untuk opsi cloud

## 6. Pertanyaan teknis terbuka

- opencode sebagai builder: perlu dicek kompatibilitas penuh dengan tahap packaging Electron (build .exe biasanya pakai electron-builder, proses ini di luar alur skill pack biasa)
- Pilihan parser AST untuk akurasi deteksi fungsi, trade-off kecepatan scan vs akurasi ringkasan, makin besar project makin terasa trade-off ini
- Strategi exclude folder default perlu daftar awal yang masuk akal (node\_modules, .git, dist, build, .next, venv, **pycache**), supaya scan tidak keisi file tidak relevan

## 7. Summarizer provider (configurable)

Summarizer tidak dikunci ke satu provider. User pilih lewat form setting di app:

- Cloud API dengan key sendiri: Claude, OpenAI, atau provider lain yang kompatibel format chat completion
- Lokal: endpoint Ollama (http://localhost:11434) kalau user sudah jalankan model lokal (Llama, Mistral, dsb)

Trade-off yang perlu disadari, bukan gratis tanpa biaya: opsi lokal gratis secara API, tapi butuh user sudah install dan jalankan Ollama sendiri plus GPU/RAM cukup, model lokal kualitas ringkasannya kemungkinan di bawah API cloud untuk tugas bahasa awam, perlu diuji supaya tidak "AI bekerja asal-asalan". Default PoC: kalau belum ada config, tampilkan form pilih provider di awal, jangan asumsikan diam-diam pakai salah satu.
