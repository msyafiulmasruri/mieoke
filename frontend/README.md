# Mie Oke — Frontend Storefront

Frontend Next.js untuk pemesanan Mie Oke.

## Struktur halaman
- `/` — landing page brand dan pintasan menu.
- `/menu` — katalog, pencarian, dan filter kategori.
- `/menu/[id]` — detail produk, pilihan varian, catatan, dan jumlah.
- `/keranjang` — tinjau dan ubah pesanan.
- `/checkout` — data penerima, titik lokasi, dan pembayaran.
- `/track/[token]` — status pesanan, tracking, dan ulasan.
- `/lacak` — riwayat pesanan di perangkat dan input tautan tracking.
- `/chat` — bantuan pelanggan.
- `/admin` — dashboard admin.
- `/order` — kompatibilitas URL lama, diarahkan ke `/keranjang`.

## Menjalankan
```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Isi `NEXT_PUBLIC_API_BASE_URL` dengan alamat backend yang benar.

## Catatan aset menu
API backend saat ini mengirim nama, kategori, deskripsi, harga, dan varian, tetapi belum mengirim URL foto produk. Karena foto asli Mie Oke belum ada pada berkas yang diberikan, kartu produk memakai ilustrasi mangkuk mie sebagai fallback visual. Ganti fallback tersebut dengan foto menu asli setelah aset dan field `image_url` tersedia dari backend.
