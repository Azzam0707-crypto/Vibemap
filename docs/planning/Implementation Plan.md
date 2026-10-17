# Implementation Plan — VibeMap

Rencana dibagi jadi slice kecil, cocok dengan alur opencode (satu sesi agent per slice, konteks bersih tiap sesi). Urutan ini sengaja: tiap slice menghasilkan sesuatu yang bisa dites sendiri sebelum lanjut ke slice berikutnya. Builder: opencode (bukan Hermes).

## Slice 1, Electron shell dan dialog folder (fondasi)

- Setup project Electron (main + renderer process), window dasar
- Tombol "Pilih folder project", buka dialog native, dapat path folder terpilih
- Output sementara: cetak path folder terpilih ke console (belum ada UI penuh)
- Tes selesai: app bisa dibuka, dialog folder muncul, path tercetak benar

## Slice 2, File Scanner

- Telusuri folder terpilih secara rekursif, hasilkan ScannedEntry per file/folder
- Exclude otomatis: node\_modules, .git, dist, build, .next, venv, **pycache**
- Batasi kedalaman folder sesuai TRD
- Tes selesai: untuk project contoh (\~50-100 file), ScannedEntry mencatat struktur dengan benar, folder exclude tidak ikut terscan

## Slice 3, Git Reader (opsional) dan parsing AST

- Kalau folder punya `.git`, ambil RawChange (diff/log) sebagai pelengkap
- Parse file JS/TS jadi ParsedChange, deteksi fungsi ditambah/dihapus/diubah
- Tes selesai: untuk project dengan dan tanpa `.git`, ParsedChange tetap terbentuk benar di kedua kasus

## Slice 4, integrasi LLM untuk ringkasan (provider configurable)

- Form setting pilih provider: Claude/OpenAI (API key) atau Ollama lokal (endpoint)
- Kirim ParsedChange ke provider terpilih, minta PlainSummary dalam bahasa awam
- Tangani API key kosong, error API, dan Ollama tidak terdeteksi dengan pesan jelas
- Tes selesai: ringkasan masuk akal untuk 5 project contoh, diverifikasi manual, dicoba di kedua jenis provider minimal sekali

## Slice 5, generator diagram Mermaid

- Ubah ParsedChange (seluruh project, bukan cuma yang berubah) jadi DiagramNode dan DiagramEdge
- Render ke sintaks Mermaid flowchart valid, batasi 25-30 node, ringkas per folder kalau lebih besar
- Tes selesai: sintaks Mermaid valid dan terbaca, untuk project kecil dan project lebih besar (test batas node)

## Slice 6, dashboard UI di renderer Electron

- Renderer process tampilkan ringkasan teks dan diagram Mermaid.js, styling sesuai Design System (dari Stitch)
- Progress indicator saat scan/LLM berjalan (bukan macet tanpa feedback)
- Tes selesai: dari buka app sampai dashboard tampil dengan data benar, di bawah 20 detik untuk project wajar

## Slice 7, jalur gagal dan polish

- Pesan error ramah untuk folder kosong, project terlalu besar, API/provider gagal
- Tes selesai: semua jalur gagal di App Flow tertangani dengan pesan non-teknis

## Slice 8, packaging ke .exe

- Setup electron-builder, konfigurasi target Windows (.exe), app icon
- Tes selesai: installer jadi, terpasang dan jalan di mesin bersih (atau VM), tidak perlu Node.js/git terpasang manual

## Milestone untuk submission (Build With AI: Basics)

| Milestone | Target |
| --- | --- |
| Slice 1-3 selesai | Fondasi app dan data jalan, belum ada AI |
| Slice 4-6 selesai | App inti jalan end to end di dalam Electron |
| Slice 7-8 + video + repo publik | Siap submit, scope.md/prd.md/spec.md ikut di repo |

Catatan risiko waktu: Slice 8 (packaging .exe) riskan makan waktu tak terduga (electron-builder, code signing kalau perlu). Kalau waktu mepet, prioritaskan Slice 1-7 jalan sempurna dalam mode development (`electron .`), video demo boleh dari situ, .exe jadi nice-to-have bukan blocker submission.
