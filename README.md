# Mie Oke — Sistem Digitalisasi Pemesanan, Pengantaran & Analisis Ulasan Pelanggan

Sistem pemesanan dan pengantaran berbasis web untuk **Mie Oke** yang terdiri dari **Frontend (Next.js 15 / React 19 / TypeScript)** dan **Backend (FastAPI / SQLAlchemy / PostgreSQL)**, dilengkapi dengan:
- **Pemesanan Tanpa Akun (Guest Checkout)**: Pelanggan memilih menu, varian, dan catatan, mengisi identitas serta titik lokasi peta interaktif (Leaflet), lalu memilih pembayaran **QRIS** atau **COD (Bayar di Tempat)**.
- **Pelacakan Sesi Pesanan & Live GPS Pengantaran**: Tautan unik (`/track/[token]`) yang dikirimkan ke WhatsApp pelanggan untuk memantau status pesanan dari *Menunggu Konfirmasi* hingga *Selesai*, lengkap dengan peta Live GPS posisi kurir.
- **Template WhatsApp Terintegrasi**: Tombol cepat bagi Admin untuk mengirimkan link tracking saat pesanan diantar serta ucapan terima kasih & link pengisian ulasan saat pesanan selesai.
- **Analisis Sentimen Ulasan (Machine Learning NLP — SVM + Sastrawi)**: Ulasan teks pelanggan (tanpa rating bintang) dianalisis otomatis menjadi sentimen **Positif** atau **Negatif** dan divisualisasikan pada Dashboard Admin.
- **Asisten Virtual Chatbot (Generative AI — Groq Llama)**: Membantu pelanggan menanyakan menu, harga, varian, dan panduan cara memesan.
- **Kelola Menu & Varian Dinamis (Tanpa Kelola Stok)**: Admin dapat menambahkan makanan/minuman baru, mengatur varian beserta selisih harga, menyembunyikan sementara, atau menghapus menu langsung dari Dashboard Admin.

---

## Prasyarat Sistem (Menjalankan Secara Lokal)

Pastikan perangkat Anda sudah terpasang:
1. **Python 3.10+** (disarankan Python 3.11 atau 3.12)
2. **Node.js 18+** beserta `npm`
3. **PostgreSQL** (lokal, misalnya PostgreSQL 15–18 pada port `5432`, atau cloud PostgreSQL seperti Neon)

---

## Panduan Menjalankan Proyek Secara Lokal

### 1. Persiapan Database PostgreSQL Lokal

Buat database baru bernama `mieoke` di PostgreSQL lokal Anda (tabel dan data awal akan dibuat otomatis oleh FastAPI saat pertama kali dijalankan):

```sql
CREATE DATABASE mieoke;
```

Atau melalui terminal PowerShell / CMD (jika `psql` sudah ada di PATH):
```powershell
psql -U postgres -h localhost -c "CREATE DATABASE mieoke;"
```

---

### 2. Menjalankan Backend (FastAPI)

Buka terminal pada folder proyek, lalu masuk ke direktori `backend`:

```powershell
cd backend

# 1. Buat virtual environment Python
python -m venv .venv

# 2. Aktifkan virtual environment
# Untuk Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Untuk Windows CMD:
# .venv\Scripts\activate.bat
# Untuk macOS / Linux:
# source .venv/bin/activate

# 3. Install seluruh dependensi Python
pip install -r requirements.txt

# 4. Salin file contoh environment
copy .env.example .env   # (atau cp .env.example .env di macOS/Linux)
```

Buka file `backend/.env` dan sesuaikan konfigurasinya (khususnya `DATABASE_URL`, `JWT_SECRET_KEY`, `ADMIN_PASSWORD`, dan `GROQ_API_KEY`):

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://postgres:PASSWORD_POSTGRES_ANDA@localhost:5432/mieoke
JWT_SECRET_KEY=ganti_dengan_secret_acak_minimal_32_karakter
JWT_EXPIRE_MINUTES=720
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@mieoke.local
ADMIN_PASSWORD=admin12345
PUBLIC_BASE_URL=http://localhost:3000
STORE_LAT=-7.2655
STORE_LNG=112.7485
WHATSAPP_BUSINESS_NUMBER=6285157753982
GROQ_API_KEY=isi_api_key_groq_anda_disini
GROQ_MODEL=openai/gpt-oss-120b
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=700
PAYMENT_MODE=mock
DOKU_RETURN_URL=http://localhost:3000/payment/result
MODEL_PATH=models/model_sentimen_mie_oke.joblib
PREPROCESS_CONFIG_PATH=models/konfigurasi_preprocessing_mie_oke.json
```

Jalankan server Backend FastAPI:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Server Backend akan aktif di: **`http://localhost:8000`**
- Dokumentasi interaktif (Swagger UI): **`http://localhost:8000/docs`**
- Cek kesehatan server: **`http://localhost:8000/health`**

---

### 3. Menjalankan Frontend (Next.js)

Buka terminal **baru**, lalu masuk ke direktori `frontend`:

```powershell
cd frontend

# 1. Install paket dependensi Node.js
npm install

# 2. Salin file contoh environment lokal
copy .env.local.example .env.local   # (atau cp .env.local.example .env.local di macOS/Linux)
```

Pastikan isi `frontend/.env.local` mengarah ke URL Backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_STORE_NAME=Mie Oke
```

Jalankan server development Frontend:

```powershell
npm run dev
```

- Website Pelanggan dapat diakses di: **`http://localhost:3000`**
- Dashboard Admin dapat diakses di: **`http://localhost:3000/admin`**
  - **Email Admin Default**: `admin@mieoke.local`
  - **Password Admin Default**: sesuai nilai `ADMIN_PASSWORD` di `backend/.env` (contoh: `admin12345`)

---

## Deploy ke Production (Vercel + Neon)

Panduan langkah demi langkah hosting frontend & backend di **Vercel** dengan database **Neon PostgreSQL** tersedia di **[DEPLOY_VERCEL_NEON.md](DEPLOY_VERCEL_NEON.md)**.

---

## Struktur Direktori

```text
Project/
├── backend/
│   ├── app/
│   │   └── main.py                 # Aplikasi utama FastAPI, model DB, endpoint publik & admin
│   ├── models/
│   │   ├── model_sentimen_mie_oke.joblib             # Model SVM + TF-IDF + kamus slang & stopword
│   │   └── konfigurasi_preprocessing_mie_oke.json    # Urutan pipeline preprocessing NLP
│   ├── .env.example                # Template variabel environment backend
│   └── requirements.txt            # Daftar pustaka Python
├── frontend/
│   ├── src/
│   │   ├── app/                    # Halaman Next.js App Router (/, /menu, /keranjang, /checkout, /track, /chat, /admin)
│   │   ├── components/             # Komponen UI (ShopShell, MenuCard, MapPicker, LiveTrackingMap, dll.)
│   │   └── lib/api.ts              # Helper pemanggilan API, keranjang lokal, & generator template WhatsApp
│   ├── .env.local.example          # Template variabel environment frontend
│   └── package.json                # Dependensi & skrip npm
└── README.md
```

---

## Catatan Fitur Operasional

### 1. Pelacakan GPS Kurir (`Live GPS Tracking`)
1. Pastikan `STORE_LAT` dan `STORE_LNG` di `backend/.env` diisi dengan titik koordinat outlet Mie Oke.
2. Saat pesanan berstatus **`on_delivery` (Siap & Sedang Diantar)**, Admin/Kurir dapat membuka detail pesanan pada Dashboard Admin melalui perangkat HP dan menekan **Mulai bagikan lokasi** (membutuhkan konteks aman HTTPS atau `localhost`).
3. Halaman tracking pelanggan (`/track/[token]`) akan memperbarui posisi kurir, rute peta, jarak, dan estimasi waktu tiba secara otomatis.

### 2. Kelola Menu & Varian Tanpa Stok
- Buka **`http://localhost:3000/admin`** $\rightarrow$ tab **Kelola Menu**.
- Admin dapat menambahkan makanan/minuman baru, menambahkan atau menghapus opsi varian (misal level pedas atau dingin/hangat) beserta tambahan harganya, menyembunyikan menu sementara, atau menghapus menu secara permanen tanpa harus mengatur stok angka.

### 3. Keamanan & Environment
- Jangan pernah melakukan commit file `backend/.env` maupun `frontend/.env.local` ke repositori Git.
- Simpan seluruh kredensial rahasia (`DATABASE_URL`, `JWT_SECRET_KEY`, `GROQ_API_KEY`, `DOKU_SECRET_KEY`) hanya di sisi server backend.
