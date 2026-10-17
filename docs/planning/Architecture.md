# Architecture — VibeMap

&#91;embedded content: arsitektur VibeMap, semua lokal kecuali panggilan ke Claude API\]

Semua berjalan lokal di mesin user, dibungkus satu app Electron (.exe), tanpa server remote milik VibeMap. Satu-satunya panggilan keluar adalah ke provider LLM cloud, kalau user pilih opsi itu (opsi lokal lewat Ollama bahkan tidak perlu internet sama sekali).

File Scanner jalan duluan sebagai sumber utama (semua file/folder project), Git Reader cuma pelengkap opsional kalau ada `.git`. Setelah diparsing, jalur memecah jadi dua paralel: Summarizer (panggil provider LLM) dan Diagram Generator (murni lokal, tidak panggil API). Keduanya bertemu lagi di Renderer (jendela Electron) untuk ditampilkan.

## Prinsip arsitektur

- Tidak ada state persisten, semua di memori proses, mati begitu app ditutup
- File Scanner adalah sumber data utama dan wajib, Git Reader opsional dan tidak pernah jadi blocker
- Satu-satunya I/O eksternal opsional, panggilan ke provider LLM cloud untuk Summarizer (dilewati kalau user pakai Ollama lokal)
- Diagram Generator deterministik, tidak bergantung LLM, supaya cepat dan tidak kena rate limit
