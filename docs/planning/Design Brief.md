# Design Brief — VibeMap

Tujuan: memandu opencode membangun UI sesuai Design artifact (5 layar, UI Inggris), dan menandai bagian mana yang wajib dibangun untuk PoC.

Artifact Design: https://claude.ai/artifact/9snNFKZ1nVsFNeXU3kWwNq

## 1. Lima layar, wajib dibangun (selaras PRD/App Flow)

- **Pick Folder**: entry point, satu tombol pilih folder, link skip ke AI Settings
- **Scanning**: spinner + progress bar + counter file, status loading dari File Scanner/Summarizer
- **Dashboard**: panel kiri (Quick recap card + Change list card), panel kanan (Project map, node+edge dari struktur project)
- **AI Settings**: pilih provider (cloud API bebas / Ollama lokal) + input endpoint + API key, sesuai TRD bagian 7 (provider configurable)
- **Empty/Error states**: 3 pola kartu buat folder kosong, project kegedean, AI gagal

Disclaimer wajib ada di Dashboard: "This is an automatic summary and might miss some details"

## 2. Yang SENGAJA tidak ada (beda dari versi Stitch lama)

Versi Stitch lama punya badge sesi, tombol "Version history", tombol "Run live preview", badge "Local view". Semua itu **sudah dibuang** di Design artifact sekarang, bukan cuma didekorasi tanpa fungsi. Alasan sama kayak keputusan lama: PoC gak punya fitur itu, nampilin tombol gak jalan cuma bikin bingung user awam. Jangan tambahin balik pas build kecuali memang ada fiturnya.

## 3. Pemetaan data ke komponen

| Komponen UI | Sumber data (Background Schema) |
| --- | --- |
| Quick recap text | `PlainSummary.overallSummary` |
| Change list items | `PlainSummary.fileSummaries[]`, satu item per entry |
| Icon + badge status item | diturunkan dari `ScannedEntry`/`RawChange.changeType` kalau ada git |
| Project map (node + connector) | `DiagramNode[]` dan `DiagramEdge[]`, digambar pakai div absolute-position (bukan Mermaid, bukan svg tunggal) |
| Badge jumlah ("N changes") | `count(PlainSummary.fileSummaries)` |
| Progress bar + counter (Scanning) | progress event dari File Scanner, persentase file terscan |
| Provider radio + endpoint + key (AI Settings) | config Summarizer provider (TRD bagian 7) |

## 4. Instruksi render diagram (ganti dari Mermaid)

Keputusan berubah dari Design Brief versi lama: **bukan Mermaid lagi**. Project map di Design artifact digambar manual pakai `<div>` absolute-position buat node, dan `<div>` garis lurus tipis buat connector, sesuai aturan format artboard (diagram gak boleh satu `<svg>` tunggal di kanvas desain). Saat opencode build versi produksi:

- Node: kotak rounded 8px, border `#eaeae7` (atau `accent` #2e5ce6 kalau node utama/root), fill putih
- Connector: garis `#d8dbe4`, posisi dihitung dari koordinat node (bukan auto-layout Mermaid)
- Font: Plus Jakarta Sans
- Kalau project besar (>25-30 node, sesuai TRD), auto-layout manual gini bakal berat. opencode boleh pakai library layout graph (misal dagre) buat hitung posisi, tapi styling akhir tetap ikut token di atas, bukan tampilan default library

## 5. Status risiko lama, sudah beres

- ~~Bahasa UI belum diputuskan~~ → Sudah: UI Inggris, dokumen tetap Indonesia (per instruksi user)
- ~~Builder belum pasti baca styling~~ → Sudah: opencode bisa buka Design artifact-nya langsung sebagai acuan visual, gak perlu terjemahan manual ke CSS

## 6. Risiko baru

- Ganti dari Mermaid ke manual div-layout nambah kerjaan di Slice 5 Implementation Plan (dulu "render ke sintaks Mermaid", sekarang "hitung posisi node + gambar connector sendiri"), perlu update Implementation Plan juga
- Project map versi desain cuma contoh 4 node statis, belum ketes gimana tampilannya kalau beneran 25-30 node sekaligus
