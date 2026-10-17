# Design System — VibeMap

Diturunkan dari Design artifact yang kita bangun sendiri (bukan lagi dari Google Stitch), 5 layar: Pick Folder, Scanning, Dashboard, AI Settings, Empty/Error states. UI berbahasa Inggris (keputusan project), dokumen ini tetap Bahasa Indonesia.

## 1. Warna

| Token | Hex | Pemakaian |
| --- | --- | --- |
| bg | #faf9fd | Kanvas dasar semua layar |
| card-bg | #ffffff | Kartu, header bar |
| card-border | #efedf1 | Border kartu, separator |
| ink | #1a1b1e | Teks utama |
| muted | #434655 | Teks sekunder, deskripsi |
| quiet | #747686 | Teks redup, disclaimer, caption |
| accent | #2e5ce6 | Aksen utama: tombol primary, link, border node aktif |
| accent-dark | #0041ca | Teks di atas tint badge "Live" |
| accent-tint | #dce1ff | Background badge "New"/"Live", ring spinner |
| neutral-tint | #dfe2ee / #efedf1 | Badge netral ("Wired"), icon tint netral |
| error-tint | #f6dede | Background kartu error |
| error | #b3261e | Teks/icon error |
| grid-dot | #e9e7eb di atas #fcfcfd | Background dot-grid di Project map |

Catatan: palet ini lebih sederhana dari token Material-style versi Stitch lama (surface-container-low/high dsb). Kita pangkas ke satu set token datar karena cukup untuk 5 layar ini.

## 2. Tipografi

Font: Plus Jakarta Sans (Google Fonts) saja. Tidak pakai Material Symbols lagi, ikon dibuat dari teks/bentuk sederhana (+, \~, ×) di dalam lingkaran/kotak warna.

| Ukuran | Weight | Pemakaian |
| --- | --- | --- |
| 22-20px, 700 | Judul halaman ("Which project do you want to see?") |  |
| 18px, 700 | Judul kartu/section ("Quick recap" text, judul card) |  |
| 16px, 600 | Judul kartu sekunder ("Changes by area", "Project map") |  |
| 14px, 600/500 | Label tombol, judul item, judul node diagram |  |
| 13px, 400 | Body text, deskripsi |  |
| 12px, 400 | Caption, disclaimer, meta kecil |  |
| 11px, 600, uppercase | Kicker/eyebrow label ("QUICK RECAP", "EMPTY FOLDER") |  |

## 3. Radius dan Spacing

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| radius-sm | 8px | Tombol, input, node diagram |
| radius-md | 10px | Area diagram, progress bar track |
| radius-lg | 12px | Kartu utama |
| radius-pill | 999px | Badge, spinner, progress bar fill |
| gap standar | 20-24px | Jarak antar kartu dan padding section |
| page padding | 32px | Padding luar tiap layar |

## 4. Komponen per layar

- **Header bar**, sama di semua layar: logo kotak 28px + nama "VibeMap", kadang ada link kanan ("AI Settings"). Tidak ada badge sesi, tombol refresh, atau "Close tab"
- **Pick Folder**: ikon folder besar, judul, deskripsi, satu tombol primary, satu link sekunder
- **Scanning**: spinner muter, judul status ("Reading your project..."), progress bar, counter file, link skip (preview only)
- **Quick recap card**: kicker + kutipan ringkasan + baris status kecil
- **Change list card**: judul + badge jumlah + daftar item (icon tint, title, desc, badge status)
- **Project map**: kartu dot-grid, node file/fungsi (kotak rounded, border), connector garis lurus (div, bukan svg)
- **AI Settings**: radio card provider (cloud/lokal), input endpoint, input API key, tombol simpan, link skip
- **Empty/Error states**: 3 kartu pola sama (icon tint + kicker + judul + desc + tombol aksi), dipakai buat folder kosong, project kegedean, AI gagal

Tombol "Run live preview" dan "Version history" dari versi Stitch **sudah dibuang**, sesuai keputusan Design Brief lama: PoC gak ada fitur itu, jadi gak usah ditampilkan biar gak janji palsu.

## 5. Status vs Stitch lama

File hasil export Stitch (`stitch_vibemap_ai_change_dashboard.zip`) sudah tidak dipakai sebagai acuan lagi, digantikan Design artifact ini. Saya tidak bisa menghapus file itu dari folder upload kamu sendiri, itu ada di penyimpanan kamu, bukan punya saya. Saya cuma baca dari situ dulu, salinannya di sandbox saya juga sudah gak relevan. Kalau mau dibersihkan, hapus manual dari tempat kamu upload.
