# PRD — VibeMap

## 1. Masalah

Vibecoder awam (membangun lewat AI coding agent, tidak familiar istilah teknis) kesulitan memahami project mereka sendiri, baik perubahan terbaru dari AI maupun struktur project secara keseluruhan. File, folder, dan kode ditulis untuk developer, bukan untuk mereka.

## 2. Target pengguna

Orang yang membangun software lewat AI coding agent (Claude Code, Cursor, opencode) dan tidak familiar dengan istilah teknis. Bukan developer berpengalaman.

## 3. Tujuan produk

- Membaca folder project (file, struktur, kode) dan meringkasnya jadi bahasa awam, kapan saja user mau, tidak terikat momen tertentu
- Memetakan struktur project jadi diagram visual yang mudah dipahami
- Kalau project pakai git, manfaatkan sebagai info tambahan (apa yang baru berubah), tapi bukan syarat wajib
- Semua lewat software desktop (dobel klik buka), antarmuka klik, tanpa istilah teknis terlihat

## 4. Non-tujuan (di luar scope PoC)

- Tidak mendukung banyak bahasa pemrograman, hanya JavaScript/TypeScript untuk parsing mendalam, file lain dicatat nama dan jenisnya saja
- Tidak ada akun, login, database server-side, atau sinkronisasi cloud. (Klarifikasi: ini tidak melarang file cache lokal kecil di mesin user sendiri, lihat bagian 8.)
- Tidak membuat perubahan apa pun ke project user, murni baca dan tampilkan (read-only)

## 5. User story utama

Sebagai vibecoder awam, kapan saja saya mau mengerti project saya, baik yang baru diubah AI maupun struktur project secara keseluruhan, saya ingin buka aplikasi, pilih folder project saya, lalu melihat ringkasan bahasa awam dan peta visualnya, supaya saya tidak perlu membaca kode atau bertanya ke orang lain.

## 6. Kriteria sukses PoC

- User bisa buka aplikasi (.exe), pilih folder lewat dialog, tanpa setup command line
- Ringkasan bahasa awam akurat mencerminkan isi project (diverifikasi manual terhadap 3-5 contoh project)
- Diagram muncul dan mencerminkan struktur file/folder/fungsi utama project
- Proses dari pilih folder sampai dashboard tampil di bawah 20 detik untuk project berukuran wajar (< 200 file relevan)
- AI (API atau lokal) menghasilkan ringkasan yang benar-benar berguna, bukan generik, untuk minimal 80% kasus uji manual

## 7. Risiko produk

- Scope melebar dari sekadar "diff terbaru" ke "scan seluruh project", waktu proses dan kompleksitas parsing naik, perlu batas jumlah file discan
- Project besar (ribuan file, node\_modules dll) bisa bikin scan lambat atau diagram penuh sesak, wajib exclude folder umum (node\_modules, .git, dist, build) dan batas kedalaman folder
- Ringkasan LLM bisa salah tafsir project kompleks, perlu disclaimer "ringkasan otomatis, bisa meleset"
- Packaging Electron ke .exe menambah waktu build di luar logika inti, risiko jadi bottleneck waktu lomba
- Kalau pakai provider lokal (Ollama), kualitas ringkasan bisa jauh di bawah API cloud, perlu testing supaya tidak "AI bekerja asal-asalan"

## 8. Scan History (cache lokal)

Riwayat scan disimpan lokal saja di mesin user (file `history.json` di folder userData Electron), tanpa server, tanpa akun. Menyimpan maksimal 20 folder yang terakhir discan. Mengklik entri lama menampilkan hasil cache terakhir secara instan tanpa memindai ulang atau memanggil AI. Tombol "Rescan" menjalankan ulang pipeline penuh dan memperbarui entri cache tersebut.
