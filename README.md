# USER GUIDE & SYSTEM DOCUMENTATION

**Penulis:** Clara Valentina  
**NRP:** 5027221016  
**Project Name:** LipSense – Aspect-Based Sentiment Analysis (ABSA) for Lip Product Comparison  

---

## 1. PENDAHULUAN

### Overview Sistem
**LipSense** adalah aplikasi berbasis web yang berfungsi untuk melakukan scraping ulasan kosmetik bibir dari platform Female Daily secara otomatis dan menganalisis sentimen ulasan tersebut berbasis aspek (**Aspect-Based Sentiment Analysis - ABSA**). Aplikasi ini mengklasifikasikan ulasan ke dalam 5 aspek (Pigmentasi, Ketahanan, Tekstur, Hidrasi, dan Harga) dengan 4 kelas sentimen (No Aspect, Negatif, Netral, Positif) menggunakan arsitektur deep learning **M2 IndoBERT-CABiLSTM**. Sistem ini dirancang untuk mempermudah konsumen dalam membandingkan kualitas dua produk bibir secara visual melalui representasi metrik **Net Sentiment Score (NSS)** yang diperhalus dengan *Laplace smoothing*.

### Komponen Utama

| Komponen | Deskripsi |
| :--- | :--- |
| **Playwright Scraper** | Layanan async crawler untuk mengekstrak ulasan dan metadata produk dari reviews.femaledaily.com. Dilengkapi retry logic (3x) dan exponential backoff. |
| **IndoBERT Backbone** | Model bahasa `indobenchmark/indobert-base-p1` bertindak sebagai pengekstraksi fitur kontekstual teks ulasan (dimensi 768). |
| **CABiLSTM Core** | Layer ekstraksi fitur implisit berbasis deep learning (gabungan dual-layer BiLSTM, Multi-Head Self-Attention, dan Conv2D) untuk memodelkan hubungan aspek-sentimen. |
| **ABSA Classifier** | Multi-label wide classifier yang memetakan output fitur ke 5 aspek utama secara paralel dengan output 4 kelas sentimen. |
| **NSS Aggregator** | Modul penghitung Net Sentiment Score (NSS) per aspek dengan formula `(Positif - Negatif) / Total * 100`, dikalikan faktor *smoothing* untuk menghindari bias data kecil. |
| **FastAPI Backend** | API server asinkron yang menyediakan endpoint scraping, retrieval produk, pencarian, serta komparasi antar produk. |
| **React Web App** | Antarmuka pengguna (Single Page Application) responsif berbasis Vite & Tailwind CSS dengan visualisasi bagan radar dan perbandingan sisi-ke-sisi. |

### Dependencies & Dataset
*   **Backend Dependencies:** PyTorch, Transformers, Playwright, FastAPI, Motor, Pydantic.
*   **Frontend Dependencies:** React, React Router, Recharts, Tailwind CSS, Lucide React.
*   **Dataset Awal:** Kombinasi data ulasan produk bibir dari Female Daily yang diunduh secara manual/otomatis lalu di-anotasi menggunakan platform **Label Studio** (konfigurasi terdapat pada direktori `label-studio`).

---

## 2. PERSIAPAN ENVIRONMENT

### Prasyarat
Pastikan sistem Anda sudah menginstal:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (untuk Windows/Mac) atau Docker Engine & Docker Compose (untuk Linux).

### Langkah-Langkah Menjalankan Sistem

1.  **Clone Repository**
    Jalankan perintah berikut pada terminal Anda untuk meng-clone repository ini:
    ```bash
    git clone <repository-url>
    cd finalproject
    ```
2.  **Konfigurasi Environment Variables**
    Salin file `.env.example` menjadi `.env` pada direktori root proyek ini, kemudian sesuaikan nilai variabel konfigurasi (seperti username/password database) di dalamnya:
    ```bash
    cp .env.example .env
    ```
3.  **Download Model Weights**
    Unduh file bobot model trained **`m2-4cls_best.pt`** dan pastikan diletakkan di dalam folder backend di:
    `backend/app/m2-4cls_best.pt`   
    > [!IMPORTANT]
    > Tanpa file weights ini, sistem API backend akan mengeluarkan peringatan dan berjalan menggunakan inisialisasi bobot acak (random weights), sehingga hasil prediksi sentimen tidak akan akurat.

4.  **Menjalankan Services dengan Docker Compose**
    Jalankan perintah berikut untuk mengompilasi dan memulai seluruh container (Frontend, Backend, & MongoDB) di background:
    ```bash
    docker-compose up --build -d
    ```
5.  **Akses Aplikasi**
    Setelah container berhasil berjalan:
    *   **Frontend (React Web App):** Akses di [http://localhost:5173](http://localhost:5173)
    *   **Backend API (FastAPI):** Akses di [http://localhost:8000](http://localhost:8000)
    *   **API Docs Swagger UI:** Akses di [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 3. DEPLOYMENT & TESTING WEB APPLICATION

### Struktur Direktori Deployment
Struktur file penting dalam deployment aplikasi ini adalah sebagai berikut:
```
finalproject/
├── backend/
│   ├── app/
│   │   ├── api/              # Module endpoints API (compare.py, products.py)
│   │   ├── services/         # Layanan internal (inference.py, scraper.py, product_service.py)
│   │   └── m2-4cls_best.pt    # trained model weights (ABSA Classifier)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/                  # Halaman & Komponen React UI
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env
```

### Reproduksi & Pengujian Lokal
Untuk memverifikasi fungsionalitas backend dan performa model secara manual di luar container, jalankan skrip pengujian berikut:

1.  **Pengujian Inferensi Model (Inference Test)**
    Uji apakah model model IndoBERT-CABiLSTM dapat melakukan prediksi kelas aspek dan sentimen dengan benar pada contoh teks review:
    ```bash
    python test_inference.py
    ```
    *   **Script Path:** [test_inference.py](file:///c:/Users/Clara/Documents/cooleyah/TA/finalproject/test_inference.py)
2.  **Pengujian Latensi & Pipeline (Latency Test)**
    Mengukur waktu eksekusi end-to-end (fase Crawling, Inference, NSS, dan MongoDB Save) untuk *cold run* (data belum ada di DB) dan *cached run* (data diambil dari DB) menggunakan 6 produk benchmark dengan volume ulasan bervariasi (29 hingga 2200+ ulasan).
    ```bash
    python test_latency.py
    ```
    *   **Script Path:** [test_latency.py](file:///c:/Users/Clara/Documents/cooleyah/TA/finalproject/test_latency.py)
    *   **Output:** Hasil uji latensi dicatat dalam [latency_results.csv](file:///c:/Users/Clara/Documents/cooleyah/TA/finalproject/latency_results.csv).

---

## 4. PANDUAN PENGGUNAAN APLIKASI WEB

Aplikasi LipSense dirancang dengan UI modern, premium, dan intuitif. Berikut adalah cara interaksi utama di web:

### Alur Analisis Produk Baru (Scraping & Analisis Sentimen)
1.  Buka web browser dan akses [http://localhost:5173](http://localhost:5173).
2.  Cari produk bibir yang ingin dianalisis di platform Female Daily (misal: *Somethinc Idol Blurry Soft Lip Matte*). Copy URL halaman produk tersebut (contoh domain yang didukung: `reviews.femaledaily.com`).
3.  Paste URL tersebut ke dalam input box di Navbar atas aplikasi LipSense.
4.  Klik tombol **"Analisis"**.
5.  **Proses Analisis:**
    *   Jika produk belum pernah dianalisis, modal loading akan muncul menampilkan progress langkah demi langkah:
        `Membuka Halaman` → `Scraping Ulasan` → `Analisis ABSA` → `Hitung NSS` → `Menyimpan Data`.
    *   Jika proses memakan waktu lama (untuk produk dengan ribuan ulasan), Anda dapat menutup modal tersebut. Sistem backend akan terus berjalan di background, dan Anda dapat memantau statusnya kembali nanti menggunakan URL yang sama (sistem polling otomatis).
    *   Jika produk sudah ada di database, aplikasi akan langsung me-redirect ke halaman detail produk tanpa memproses ulang (menghemat latensi).

### Fitur-Fitur Utama Aplikasi
*   **Dashboard Pencarian & Rekomendasi (Home):** Menampilkan daftar produk bibir populer yang telah di-scrape sebelumnya beserta nilai overall NSS masing-masing produk untuk membantu pembeli memilih produk terbaik.
*   **Visualisasi Radar Chart Aspek:** Menunjukkan kekuatan dan kelemahan produk di 5 aspek utama. Semakin tinggi skor NSS (berkisar -100 hingga +100), semakin positif ulasan pengguna terhadap aspek tersebut.
*   **Data Reliability Indicator:** Menampilkan tanda peringatan (*low count warning*) jika jumlah ulasan untuk aspek tertentu kurang dari 25 ulasan untuk memastikan transparansi data kepada pengguna.
*   **Perbandingan Produk Side-by-Side (Compare):** Bandingkan dua produk secara langsung. Sistem akan menampilkan diagram radar tumpang-tindih (overlapped radar chart) dan komparasi nilai NSS tiap aspek berdampingan agar pembeli bisa memilih secara cepat.
*   **Detail Ulasan Berbasis Sentimen:** Memungkinkan pengguna menyaring ulasan asli berdasarkan label sentimen (Positif, Negatif, Netral) beserta highlight aspek apa saja yang dibahas dalam setiap teks ulasan.

> [!CAUTION]
> **Catatan Penting Penggunaan:**
> *   Pastikan format link yang dimasukkan adalah link detail produk dari `reviews.femaledaily.com`.
> *   URL wajib mengandung keyword kategori bibir (seperti `lip`, `lips`, `lipstick`, `lipcream`, `liptint`, dll.) karena sistem menyaring produk non-lip untuk efisiensi klasifikasi model.
