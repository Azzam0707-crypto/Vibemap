# Agents — VibeMap

Catatan tentang peran AI agent di dua lapis berbeda: agent yang membangun VibeMap (development time), dan AI yang dipakai VibeMap sendiri saat jalan (runtime).

## 1. Agent development time (membangun VibeMap)

| Peran | Alat | Tanggung jawab |
| --- | --- | --- |
| Perencana dan peninjau | Claude (chat) | Susun scope, PRD, TRD, tinjau output skill pack sebelum lanjut ke slice berikutnya, cari celah logika |
| Builder | opencode | Eksekusi tiap slice di Implementation Plan, tulis kode, jalankan tes |
| Skill pack proses | Devpost Learn Skill Pack | Wawancara scope dan PRD, jaga alur rencana-dulu-baru-bangun, siapkan submission |

Catatan: opencode sudah dikonfirmasi mendukung Devpost Learn Skill Pack lewat npx skills add, jadi tidak perlu alat lain untuk slice yang butuh skill pack.

## 2. AI runtime (dipakai VibeMap saat dijalankan user)

| Peran | Alat | Tanggung jawab |
| --- | --- | --- |
| Summarizer | Configurable: Claude/OpenAI/lain (API key sendiri) atau Ollama lokal | Terima ParsedChange, hasilkan PlainSummary bahasa awam |

Hanya satu peran AI di runtime, sengaja dibatasi supaya scope PoC tetap kecil. Diagram Generator tidak pakai AI, murni deterministik dari ParsedChange (lihat Architecture).

## 3. Batas tanggung jawab antar lapis

- Agent development time tidak pernah masuk ke kode VibeMap yang dirilis, perannya selesai begitu build selesai
- AI runtime (Summarizer) adalah bagian permanen dari produk, jalan tiap kali user pakai VibeMap
- Jangan campur dua konteks ini saat menulis prompt untuk opencode, supaya tidak bingung antara instruksi membangun dan instruksi yang seharusnya jadi bagian kode produk
