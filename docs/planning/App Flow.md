# App Flow — VibeMap

&#91;embedded content: alur VibeMap, 5 langkah, tanpa istilah teknis terlihat\]

Alur dari user buka aplikasi sampai dashboard tampil, lima langkah berurutan, tanpa istilah teknis terlihat ke user. Tidak lagi terikat momen "abis AI selesai ngoding", user bisa buka app dan pilih folder kapan saja.

Semua langkah di tengah (scan folder, kirim ke AI, buat ringkasan) berjalan otomatis di background, user cuma lihat langkah pertama (pilih folder) dan langkah terakhir (dashboard tampil).

## Detail tiap langkah

1. **Buka aplikasi**, user dobel klik VibeMap.exe, muncul jendela dengan tombol "Pilih folder project"
2. **Pilih folder**, user pilih folder project lewat dialog native (seperti buka folder di File Explorer)
3. **Scan otomatis**, app telusuri seluruh struktur file/folder project di background, exclude node\_modules/.git/dist dll, pakai git diff juga kalau folder punya `.git`
4. **Kirim ke AI**, struktur project dikirim ke LLM (provider sesuai pengaturan user) untuk diringkas jadi bahasa awam
5. **Tampilkan dashboard**, jendela app menampilkan ringkasan dan peta visual project, siap diklik-klik

## Jalur gagal yang perlu ditangani

- Folder kosong atau tidak ada file relevan, tampilkan "folder ini sepertinya belum ada isinya"
- Project terlalu besar (ribuan file), tampilkan progress bar dan batasi scan sesuai aturan exclude di TRD, bukan macet tanpa feedback
- API LLM gagal, API key kosong, atau provider lokal tidak terdeteksi, tampilkan instruksi singkat cara atur provider di pengaturan
