# Panduan Deploy Mie Oke ke Vercel + Neon PostgreSQL

Panduan ini memakai **3 layanan gratis**:

| Komponen | Layanan | Hasil akhir (contoh) |
|---|---|---|
| Database | **Neon** (PostgreSQL serverless) | `ep-xxxx-pooler.ap-southeast-1.aws.neon.tech` |
| Backend (FastAPI) | **Vercel** – Project #1, root `backend` | `https://mieoke-api.vercel.app` |
| Frontend (Next.js) | **Vercel** – Project #2, root `frontend` | `https://mieoke.vercel.app` |

Repositori yang sama (`msyafiulmasruri/mieoke`) dipakai untuk **dua project Vercel** yang berbeda, dibedakan lewat **Root Directory**.

> **Urutan wajib:** Neon → Backend → Frontend → Kembali ke Backend (isi domain frontend untuk CORS).

```
Pelanggan / Admin (browser)
        │ HTTPS
        ▼
Frontend Next.js (Vercel)  ──fetch──►  Backend FastAPI (Vercel Python)  ──SSL──►  Neon PostgreSQL
                                              │
                                              └──► Groq API (chatbot)
```

---

## Langkah 0 — Persiapan

1. Pastikan kode terbaru sudah di-push ke GitHub (`git push`).
2. Siapkan akun:
   - Neon → https://neon.tech (login pakai GitHub)
   - Vercel → https://vercel.com (login pakai GitHub yang sama)
3. Siapkan **JWT secret baru khusus production** (jangan pakai yang lokal). Jalankan di PowerShell:
   ```powershell
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Simpan hasilnya (64 karakter hex).

---

## Langkah 1 — Membuat Database di Neon

1. Masuk ke **Neon Console** → **New Project**.
2. Isi:
   - **Project name**: `mieoke`
   - **Postgres version**: versi terbaru yang tersedia
   - **Region**: **AWS Asia Pacific (Singapore)** — paling dekat dengan Indonesia
3. Klik **Create project**.
4. Di Dashboard project, klik tombol **Connect**:
   - **Database**: `neondb` (bawaan) — boleh dipakai langsung
   - Aktifkan **Connection pooling** (alamat host akan mengandung `-pooler`)
   - Salin connection string. Bentuknya:
     ```
     postgresql://neondb_owner:XXXXXXXX@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
5. Simpan string ini — akan dipakai sebagai `DATABASE_URL` di Vercel.

> Tidak perlu mengubah `postgresql://` menjadi `postgresql+psycopg://`; backend menormalkannya otomatis.
> Tabel, akun admin, dan menu awal **dibuat otomatis** saat backend pertama kali menerima request.

---

## Langkah 2 — Deploy Backend (FastAPI) ke Vercel

1. Buka https://vercel.com/new → **Import** repositori `mieoke`.
2. Konfigurasi project:
   - **Project Name**: `mieoke-api`
   - **Framework Preset**: `Other`
   - **Root Directory**: klik **Edit** → pilih **`backend`**
   - Build & Output Settings: biarkan default (diatur oleh `backend/vercel.json`)
3. Buka **Environment Variables**, tambahkan satu per satu:

   | Key | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | *connection string Neon dari Langkah 1* |
   | `JWT_SECRET_KEY` | *secret 64 karakter dari Langkah 0* |
   | `JWT_EXPIRE_MINUTES` | `720` |
   | `ADMIN_EMAIL` | `admin@mieoke.local` (atau email admin asli) |
   | `ADMIN_PASSWORD` | *password admin yang kuat* (jangan `admin12345`) |
   | `CORS_ORIGINS` | `http://localhost:3000` *(sementara, diganti di Langkah 4)* |
   | `PUBLIC_BASE_URL` | `http://localhost:3000` *(sementara, diganti di Langkah 4)* |
   | `STORE_NAME` | `Mie Oke` |
   | `STORE_LAT` | *latitude outlet* (contoh `-7.2655`) |
   | `STORE_LNG` | *longitude outlet* (contoh `112.7485`) |
   | `WHATSAPP_BUSINESS_NUMBER` | `62xxxxxxxxxx` |
   | `GROQ_API_KEY` | *API key Groq* |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `GROQ_TEMPERATURE` | `0.3` |
   | `GROQ_MAX_TOKENS` | `700` |
   | `PAYMENT_MODE` | `mock` *(ganti `doku` setelah integrasi DOKU siap)* |
   | `MODEL_PATH` | `models/model_sentimen_mie_oke.joblib` |
   | `PREPROCESS_CONFIG_PATH` | `models/konfigurasi_preprocessing_mie_oke.json` |

4. Klik **Deploy** dan tunggu hingga selesai (build pertama agak lama karena memasang scikit-learn).
5. **Samakan region fungsi dengan Neon** (mengurangi latensi query):
   Project `mieoke-api` → **Settings → Functions → Function Region** → pilih **Singapore (sin1)** → Save → **Redeploy**.
6. **Uji backend** di browser (ganti dengan domain milikmu):
   - `https://mieoke-api.vercel.app/health` → `{"status":"ok"}`
   - `https://mieoke-api.vercel.app/api/v1/menus` → daftar 3 menu awal (request pertama memicu pembuatan tabel di Neon, bisa 3–8 detik)
   - `https://mieoke-api.vercel.app/docs` → Swagger UI

✅ Catat domain backend, misalnya `https://mieoke-api.vercel.app`.

---

## Langkah 3 — Deploy Frontend (Next.js) ke Vercel

1. Buka lagi https://vercel.com/new → **Import** repositori `mieoke` yang **sama**.
2. Konfigurasi project:
   - **Project Name**: `mieoke` (atau nama lain yang tersedia)
   - **Framework Preset**: `Next.js` (terdeteksi otomatis)
   - **Root Directory**: **`frontend`**
3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://mieoke-api.vercel.app/api/v1` |
   | `NEXT_PUBLIC_STORE_NAME` | `Mie Oke` |

   > Perhatikan akhiran **`/api/v1`** dan **tanpa** garis miring di akhir.
4. Klik **Deploy**.

✅ Catat domain frontend, misalnya `https://mieoke.vercel.app`.

---

## Langkah 4 — Hubungkan Backend ke Domain Frontend (CORS & Link WhatsApp)

Tanpa langkah ini browser akan memblokir request (error **CORS**) dan link tracking di WhatsApp masih mengarah ke `localhost`.

1. Buka project **`mieoke-api`** → **Settings → Environment Variables**.
2. Ubah nilai:

   | Key | Value baru |
   |---|---|
   | `CORS_ORIGINS` | `https://mieoke.vercel.app,http://localhost:3000` |
   | `PUBLIC_BASE_URL` | `https://mieoke.vercel.app` |
   | `DOKU_RETURN_URL` *(opsional)* | `https://mieoke.vercel.app/payment/result` |

   > Beberapa origin dipisah koma, **tanpa spasi** dan **tanpa `/` di akhir**.
3. Buka tab **Deployments** → titik tiga pada deployment teratas → **Redeploy**.
   (Perubahan environment variable baru berlaku setelah redeploy.)

---

## Langkah 5 — Uji Alur Lengkap di Production

- [ ] Buka `https://mieoke.vercel.app` → menu tampil.
- [ ] Tambah menu ke keranjang → checkout (isi nama, WA, alamat, titik peta) → pilih **COD**.
- [ ] Halaman tracking `/track/...` terbuka dengan status *Menunggu Konfirmasi*.
- [ ] Buka `https://mieoke.vercel.app/admin` → login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- [ ] Konfirmasi → Proses → Antar. Tombol **Kirim WA** berisi link `https://mieoke.vercel.app/track/...` (bukan localhost).
- [ ] Saat *Sedang Diantar*, buka detail pesanan dari HP → **Mulai bagikan lokasi** → posisi kurir muncul di halaman tracking pelanggan (GPS berfungsi karena Vercel sudah HTTPS).
- [ ] Tandai Selesai → isi ulasan di halaman tracking → cek tab **Ulasan** (sentimen Positif/Negatif).
- [ ] Coba **Chatbot** (`/chat`).
- [ ] Tab **Kelola Menu** → tambah menu baru → muncul di halaman pelanggan.

---

## Langkah 6 (Opsional) — Memindahkan Data Lokal ke Neon

Jika ingin membawa data pesanan/menu/ulasan dari PostgreSQL lokal:

```powershell
# 1. Ekspor dari lokal (password: password PostgreSQL lokal)
pg_dump -h localhost -U postgres -d mieoke --no-owner --no-privileges -F p -f mieoke_backup.sql

# 2. Impor ke Neon — gunakan connection string Neon TANPA "-pooler" (direct connection)
psql "postgresql://neondb_owner:XXXX@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" -f mieoke_backup.sql
```

> Lakukan impor **sebelum** backend production menerima request pertama, atau kosongkan dulu tabel di Neon (Neon Console → SQL Editor), agar tidak bentrok dengan data awal yang dibuat otomatis.

---

## Update Selanjutnya (Auto Deploy)

Setelah terhubung, setiap `git push` ke branch `main` akan otomatis men-deploy **kedua** project.
Perubahan hanya di folder `frontend/` tetap memicu build kedua project; untuk menghemat build, aktifkan
**Settings → Git → Ignored Build Step** dengan perintah:

- Project `mieoke-api`: `git diff --quiet HEAD^ HEAD -- .`
- Project `mieoke`: `git diff --quiet HEAD^ HEAD -- .`

(Perintah dijalankan di dalam Root Directory masing-masing, sehingga build dilewati jika folder itu tidak berubah.)

---

## Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| Browser console: `blocked by CORS policy` | `CORS_ORIGINS` di backend belum berisi domain frontend persis (https, tanpa `/` akhir). Perbaiki lalu **Redeploy** backend. |
| Frontend masih memanggil `localhost:8000` | `NEXT_PUBLIC_API_BASE_URL` salah/kosong. Variabel `NEXT_PUBLIC_*` ditanam saat build → perbaiki lalu **Redeploy** frontend. |
| Backend `500` / log `connection refused` / `password authentication failed` | `DATABASE_URL` salah. Salin ulang dari Neon → Connect. Pastikan ada `sslmode=require`. |
| Request pertama lambat (3–8 detik) | Normal: *cold start* Vercel + Neon bangun dari *auto-suspend*. Request berikutnya cepat. |
| Build gagal: ukuran fungsi melebihi batas | scikit-learn/scipy cukup besar. Hapus baris `uvicorn[standard]` dari `backend/requirements.txt` (tidak dipakai di Vercel; untuk lokal pasang manual `pip install uvicorn`). |
| Login admin gagal di production | Akun admin dibuat dari `ADMIN_EMAIL`/`ADMIN_PASSWORD` **saat pertama kali** tabel dibuat. Jika env diubah setelahnya, hapus baris di tabel `admins` lewat Neon SQL Editor lalu buka endpoint apa pun agar dibuat ulang. |
| Chatbot menjawab "Asisten sedang sibuk" | `GROQ_API_KEY` salah/kuota habis, atau model tidak aktif di akun Groq. Cek **Logs** project backend. |
| Link WhatsApp masih `localhost:3000/track/...` | `PUBLIC_BASE_URL` belum diganti ke domain frontend → ubah lalu **Redeploy** backend. |

Log error backend dapat dilihat di: Vercel → project `mieoke-api` → **Logs**.

---

## Catatan Keamanan Production

- Gunakan `JWT_SECRET_KEY` dan `ADMIN_PASSWORD` yang **berbeda** dari lokal.
- API key Groq yang pernah dibagikan di chat/dokumen sebaiknya **di-rotate** (buat key baru di https://console.groq.com/keys, hapus yang lama).
- Jangan pernah commit `backend/.env` atau `frontend/.env.local`; semua secret hanya diisi di dashboard Vercel.
- Callback DOKU wajib memverifikasi signature server-to-server sebelum `PAYMENT_MODE=doku` diaktifkan.
