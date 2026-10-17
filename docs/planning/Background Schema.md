# Background Schema — VibeMap

VibeMap sengaja tanpa database server-side. Semua struktur data di bawah ini hidup sementara di memori proses selama satu kali pemakaian app (dari folder dipilih sampai jendela ditutup), kecuali ScanHistoryEntry yang disimpan sebagai file cache lokal (`history.json` di folder userData Electron, maksimal 20 entri). Tidak ada tabel SQL, tidak ada akun, tidak ada server. Sumber utama sekarang adalah file scanner (semua file/folder project), git cuma sumber tambahan opsional kalau project punya `.git`.

## 0. ScannedEntry (dari File Scanner, sumber utama, untuk semua file)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| filePath | string | path relatif dari root folder dipilih |
| entryType | enum | file, folder |
| fileExt | string | ekstensi file, dipakai untuk tentukan parsing penuh atau metadata saja |
| sizeBytes | number | ukuran file |
| depth | number | kedalaman folder dari root, dipakai untuk batas scan |

## 1. RawChange (opsional, dari git, cuma ada kalau project punya .git)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| filePath | string | path relatif file yang berubah |
| changeType | enum | added, modified, deleted, renamed |
| diffText | string | raw diff text per file dari git |
| linesAdded | number | jumlah baris ditambah |
| linesRemoved | number | jumlah baris dihapus |

## 2. ParsedChange (hasil parsing AST untuk JS/TS, dari ScannedEntry + RawChange kalau ada)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| filePath | string | relasi ke RawChange |
| functionsAdded | string\[\] | nama fungsi baru terdeteksi |
| functionsRemoved | string\[\] | nama fungsi yang hilang dari file |
| functionsModified | string\[\] | nama fungsi yang isinya berubah |
| importsChanged | string\[\] | modul yang baru diimpor atau dihapus |

## 3. PlainSummary (hasil LLM)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| overallSummary | string | 1-2 kalimat ringkasan keseluruhan perubahan |
| fileSummaries | FileSummary\[\] | ringkasan per file |
| possibleEffects | string\[\] | kemungkinan efek ke proyek, bahasa awam |

### FileSummary (nested)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| filePath | string | relasi ke RawChange |
| plainText | string | penjelasan bahasa awam untuk file ini |

## 4. DiagramNode dan DiagramEdge (untuk Mermaid)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| nodeId | string | id unik node di diagram |
| label | string | nama file atau fungsi yang ditampilkan |
| nodeType | enum | file, function |
| edgeFrom / edgeTo | string | relasi antar node, misal file memanggil fungsi di file lain |

## 5. ScanHistoryEntry (cache lokal, satu-satunya data persisten)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| folderPath | string | path absolut folder project, kunci unik entri |
| folderName | string | nama folder (basename) untuk tampilan |
| lastScannedAt | string | waktu scan terakhir, format ISO |
| result | object | payload sukses penuh dari analyzeFolder() (status ok) |

Aturan: upsert berdasarkan folderPath (path sama menimpa + pindah ke depan), urutan terbaru dulu, maksimal 20 entri (yang tertua dibuang). Disimpan di `history.json` di folder userData Electron. Tidak berisi API key atau kredensial apa pun.

## 6. Alur data (bagaimana struktur ini mengalir)
File Scanner hasilkan ScannedEntry untuk semua file/folder (sumber utama). Kalau folder punya `.git`, Git Reader tambahkan RawChange sebagai info pelengkap (apa yang baru berubah). Keduanya diparsing jadi ParsedChange. ParsedChange dikirim ke LLM, hasilnya jadi PlainSummary (ringkasan keseluruhan project, bukan cuma diff terbaru). ParsedChange yang sama juga diubah jadi DiagramNode dan DiagramEdge untuk dirender Mermaid, merepresentasikan struktur project (bukan cuma file yang berubah). PlainSummary dan DiagramNode/Edge dikirim ke renderer Electron, lalu seluruh struktur ini dibuang begitu app ditutup.
