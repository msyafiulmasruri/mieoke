"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LocateFixed, Minus, Plus, Trash2, MapPin, ShieldCheck } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import {
  api,
  CartItem,
  clearCart,
  getCart,
  rupiah,
  saveOrderRef,
  updateCartNote,
  updateCartQty,
} from "@/lib/api";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="map-box skeleton" />,
});

function CheckoutContent() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);

  // Form identitas penerima
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(-7.2575);
  const [lng, setLng] = useState<number | null>(112.7521);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  // Metode pembayaran
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "cod">("qris");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const sync = () => setCart(getCart());
    sync();
    window.addEventListener("mieoke:cart", sync);

    return () => window.removeEventListener("mieoke:cart", sync);
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart]
  );
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocMsg("Browser tidak mendukung deteksi lokasi otomatis. Silakan ketuk peta secara manual.");
      return;
    }
    setLocating(true);
    setLocMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        setLocMsg("Titik lokasi berhasil disesuaikan ke posisi perangkatmu.");
      },
      () => {
        setLocating(false);
        setLocMsg("Izin lokasi ditolak atau gagal dideteksi. Ketuk langsung pada peta untuk menandai titik antar.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function validate(): boolean {
    const nextErr: Record<string, string> = {};
    if (customer.trim().length < 2) {
      nextErr.customer = "Isi nama penerima minimal 2 huruf.";
    }
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.startsWith("0")
      ? "62" + digits.slice(1)
      : digits.startsWith("8")
      ? "62" + digits
      : digits;
    if (!normalized.startsWith("62") || normalized.length < 10 || normalized.length > 15) {
      nextErr.phone = "Masukkan nomor WhatsApp aktif yang valid (contoh: 081234567890).";
    }
    if (address.trim().length < 8) {
      nextErr.address = "Tulis alamat lengkap beserta nomor rumah/gang atau patokan.";
    }
    setFieldErrors(nextErr);
    return Object.keys(nextErr).length === 0;
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (cart.length === 0) {
      setErr("Keranjang masih kosong.");
      return;
    }
    if (!validate()) return;

    setBusy(true);
    try {
      const res = await api<{
        order_number: string;
        token: string;
        status: string;
        payment_url: string | null;
      }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: customer.trim(),
          phone: phone.trim(),
          address: address.trim(),
          lat,
          lng,
          payment_method: paymentMethod,
          items: cart.map((c) => ({
            menu_id: c.menu_id,
            quantity: c.quantity,
            variant: c.variant,
            note: c.note,
          })),
        }),
      });

      saveOrderRef({
        token: res.token,
        order_number: res.order_number,
        created_at: new Date().toISOString(),
      });
      clearCart();

      if (paymentMethod === "qris") {
        router.push(`/bayar/${res.token}`);
      } else {
        router.push(`/track/${res.token}`);
      }
    } catch (error: any) {
      setErr(error.message || "Gagal membuat pesanan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell hideStickyCart hideFloatingChat>
      <main className="container">
        <div className="page-head stack gap-8">
          <Link href="/keranjang" className="row gap-8 small muted" style={{ width: "fit-content" }}>
            <ArrowLeft size={16} />
            <span>Kembali ke keranjang</span>
          </Link>
          <h1>Checkout</h1>
          <p className="muted">Lengkapi detail pengantaran dan pilih metode pembayaran.</p>
        </div>

        {cart.length === 0 ? (
          <section className="card card-pad stack gap-12" style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 20 }}>Keranjang pesananmu masih kosong</h2>
            <p className="muted">
Pilih menu terlebih dahulu sebelum melanjutkan ke checkout.
            </p>
            <div>
              <Link href="/menu" className="btn btn-primary">
                Pilih Menu
              </Link>
            </div>
          </section>
        ) : (
          <form className="checkout" onSubmit={handleSubmitOrder} noValidate>
            <div>
              {/* 1. Rincian item pesanan */}
              <section className="section-card" aria-labelledby="step-1-heading">
                <div className="section-title between">
                  <div className="row gap-10">
                    <span className="n">1</span>
                    <h2 id="step-1-heading">Ringkasan pesanan</h2>
                  </div>
                  <Link href="/keranjang" className="btn btn-sm btn-outline">
                    <span>Ubah keranjang</span>
                  </Link>
                </div>

                <div>
                  {cart.map((item) => (
                    <div key={item.key} className="cart-line">
                      <div className="stack gap-8">
                        <div>
                          <div className="strong" style={{ fontSize: 16 }}>
                            {item.name}
                          </div>
                          <div className="small muted num">
                            {item.variant ? `Varian: ${item.variant} · ` : ""}
                            {rupiah(item.unit_price)} / porsi
                          </div>
                        </div>
                        <input
                          className="input"
                          style={{ minHeight: 38, padding: "6px 10px", fontSize: 13 }}
                          placeholder="Catatan khusus (opsional)"
                          value={item.note}
                          onChange={(e) => updateCartNote(item.key, e.target.value)}
                        />
                      </div>

                      <div className="stack gap-8" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
                        <span className="strong num">{rupiah(item.unit_price * item.quantity)}</span>
                        <div className="row gap-8">
                          <div className="stepper sm">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.key, item.quantity - 1)}
                              aria-label="Kurangi jumlah"
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.key, item.quantity + 1)}
                              aria-label="Tambah jumlah"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-ghost"
                            onClick={() => updateCartQty(item.key, 0)}
                            aria-label={`Hapus ${item.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </section>

              {/* 2. Identitas & Lokasi Pengantaran */}
              <section className="section-card" aria-labelledby="step-2-heading">
                <div className="section-title">
                  <span className="n">2</span>
                  <h2 id="step-2-heading">Identitas & Titik Lokasi Pengantaran</h2>
                </div>

                <div className="stack gap-16">
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="cust-name">Nama Penerima</label>
                      <input
                        id="cust-name"
                        className={`input ${fieldErrors.customer ? "invalid" : ""}`}
                        placeholder="Contoh: Budi Santoso"
                        value={customer}
                        onChange={(e) => {
                          setCustomer(e.target.value);
                          if (fieldErrors.customer) setFieldErrors((f) => ({ ...f, customer: "" }));
                        }}
                        required
                      />
                      {fieldErrors.customer && <span className="err">{fieldErrors.customer}</span>}
                    </div>

                    <div className="field">
                      <label htmlFor="cust-phone">Nomor WhatsApp Aktif</label>
                      <input
                        id="cust-phone"
                        type="tel"
                        className={`input num ${fieldErrors.phone ? "invalid" : ""}`}
                        placeholder="Contoh: 081234567890"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: "" }));
                        }}
                        required
                      />
                      <span className="hint">
                        Link pantau pesanan & tracking pengantaran akan dikirim admin ke nomor WhatsApp ini.
                      </span>
                      {fieldErrors.phone && <span className="err">{fieldErrors.phone}</span>}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="cust-address">Alamat Lengkap & Patokan</label>
                    <textarea
                      id="cust-address"
                      className={`textarea ${fieldErrors.address ? "invalid" : ""}`}
                      placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan/kecamatan, dan patokan (contoh: pagar hitam sebelah warung kelontong)"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (fieldErrors.address) setFieldErrors((f) => ({ ...f, address: "" }));
                      }}
                      required
                    />
                    {fieldErrors.address && <span className="err">{fieldErrors.address}</span>}
                  </div>

                  <div className="stack gap-8">
                    <div className="row between wrap gap-8">
                      <div>
                        <div className="small strong">Titik Lokasi Pengantaran di Peta</div>
                        <div className="tiny muted">
                          Ketuk pada peta untuk memindahkan pin merah ke titik pengantaranmu.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleUseMyLocation}
                        disabled={locating}
                      >
                        <LocateFixed size={15} />
                        <span>{locating ? "Mendeteksi..." : "Pakai lokasi saya"}</span>
                      </button>
                    </div>

                    <MapPicker
                      lat={lat}
                      lng={lng}
                      onChange={(nextLat, nextLng) => {
                        setLat(nextLat);
                        setLng(nextLng);
                      }}
                    />

                    <div className="row between wrap gap-8 tiny muted num">
                      <span className="row gap-4">
                        <MapPin size={14} />
                        <span>
                          Koordinat terpilih: {lat !== null && lng !== null ? `${lat}, ${lng}` : "Belum dipilih"}
                        </span>
                      </span>
                      {locMsg && <span style={{ color: "var(--leaf)", fontWeight: 600 }}>{locMsg}</span>}
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Metode Pembayaran */}
              <section className="section-card" aria-labelledby="step-3-heading">
                <div className="section-title">
                  <span className="n">3</span>
                  <h2 id="step-3-heading">Metode Pembayaran</h2>
                </div>

                <div className="stack gap-12" role="radiogroup" aria-label="Pilih metode pembayaran">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "qris"}
                    className="pay-option"
                    onClick={() => setPaymentMethod("qris")}
                  >
                    <span className="radio" />
                    <div className="stack gap-4">
                      <div className="row between wrap gap-8">
                        <span className="strong" style={{ fontSize: 16 }}>
                          QRIS
                        </span>
                        <span className="badge badge-sky">Scan & bayar</span>
                      </div>
                      <p className="small muted">Bayar dengan memindai kode QRIS. Pesanan diproses setelah pembayaran terverifikasi.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "cod"}
                    className="pay-option"
                    onClick={() => setPaymentMethod("cod")}
                  >
                    <span className="radio" />
                    <div className="stack gap-4">
                      <div className="row between wrap gap-8">
                        <span className="strong" style={{ fontSize: 16 }}>
                          COD (Bayar di Tempat)
                        </span>
                        <span className="badge badge-leaf">Bayar Saat Tiba</span>
                      </div>
                      <p className="small muted">Bayar tunai saat pesanan tiba di alamatmu.</p>
                    </div>
                  </button>
                </div>
              </section>
            </div>

            {/* Ringkasan Struk di Samping */}
            <aside className="sticky-side stack gap-16">
              <div className="receipt stack gap-12">
                <div>
                  <span className="eyebrow">Ringkasan Struk</span>
                  <h3 style={{ fontSize: 20, marginTop: 2 }}>Mie Oke Surabaya</h3>
                </div>
                <hr className="divider" />
                <div className="stack gap-8">
                  {cart.map((item) => (
                    <div key={item.key} className="receipt-row num">
                      <span>
                        {item.quantity}× {item.name}
                        {item.variant ? ` (${item.variant})` : ""}
                        {item.note ? (
                          <small className="block faint" style={{ display: "block", fontSize: 12 }}>
                            Catatan: {item.note}
                          </small>
                        ) : null}
                      </span>
                      <span className="strong">{rupiah(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="dashed" style={{ paddingTop: 10 }}>
                  <div className="receipt-row small muted num">
                    <span>Subtotal ({totalItems} porsi)</span>
                    <span>{rupiah(subtotal)}</span>
                  </div>
                  <div className="receipt-row small muted">
                    <span>Ongkos kirim</span>
                    <span className="strong" style={{ color: "var(--leaf)" }}>
                      Gratis
                    </span>
                  </div>
                </div>
                <div className="dashed" style={{ paddingTop: 12 }}>
                  <div className="receipt-total num">
                    <span>Total Bayar</span>
                    <span style={{ color: "var(--chili)" }}>{rupiah(subtotal)}</span>
                  </div>
                </div>
              </div>

              {err && (
                <div className="alert alert-error">
                  <span>{err}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {busy
                  ? "Memproses pesanan..."
                  : paymentMethod === "qris"
                  ? `Lanjut Bayar QRIS · ${rupiah(subtotal)}`
                  : `Buat Pesanan COD · ${rupiah(subtotal)}`}
              </button>

              <div className="row gap-8 tiny muted" style={{ alignItems: "flex-start" }}>
                <ShieldCheck size={16} style={{ flex: "none", marginTop: 2 }} />
                <span>
                  Pesan tanpa akun. Link pelacakan tersedia setelah checkout.
                </span>
              </div>
            </aside>
          </form>
        )}
      </main>
    </ShopShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <ShopShell hideStickyCart hideFloatingChat>
          <main className="container" style={{ paddingTop: 32 }}>
            Memuat halaman checkout...
          </main>
        </ShopShell>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
