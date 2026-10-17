# VibeMap — Project Docs

Dokumen perencanaan untuk VibeMap: software lokal yang menerjemahkan perubahan kode hasil AI coding agent jadi ringkasan bahasa awam dan diagram visual, untuk vibecoder yang tidak familiar istilah git/diff/commit.

## Ringkasan

Vibecoder awam sering kehilangan jejak apa yang baru saja diubah AI coding agent di proyek mereka, karena satu-satunya catatan perubahan (git diff, git log) ditulis dalam istilah teknis yang tidak mereka pahami. VibeMap adalah software lokal yang membaca perubahan itu secara otomatis, lalu menyajikannya sebagai ringkasan bahasa awam dan diagram alur visual lewat satu halaman web lokal, tanpa user pernah melihat istilah git, commit, atau diff secara langsung. Scope PoC: dijalankan lewat satu perintah (`npx vibemap`) di folder proyek, sumber data git diff/log, satu bahasa target JavaScript/TypeScript, satu jenis diagram (Mermaid flowchart), tanpa akun, login, atau database.

## Isi

Semua 9 dokumen selesai: PRD, TRD, App Flow, Background Schema, Implementation Plan, Architecture, Agents, Design System, Design Brief.

- PRD, TRD, App Flow, Background Schema, Implementation Plan, Architecture, Agents, dibangun sekarang
- Design System dan Design Brief, menyusul setelah hasil Google Stitch dikirim
