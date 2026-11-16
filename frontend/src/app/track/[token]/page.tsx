"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  CreditCard,
  MessageCircle,
  Navigation,
  RefreshCw,
  Send,
  CheckCircle2,
} from "lucide-react";
import ShopShell from "@/components/ShopShell";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import {
  api,
  formatDateTimeWIB,
  formatTimeWIB,
  OrderPublic,
  paymentLabel,
  PublicConfig,
  rupiah,
  saveOrderRef,
  STATUS_META,
  waAdminContactLink,
} from "@/lib/api";

const TIMELINE_STEPS = [
  {
    key: "waiting_confirmation",
    title: "Menunggu Konfirmasi Admin",
    desc: "Pesanan diterima sistem dan menunggu konfirmasi admin Mie Oke.",
  },
  {
    key: "confirmed",
    title: "Pesanan Dikonfirmasi",
    desc: "Admin telah mengonfirmasi pesananmu.",
  },
  {
    key: "preparing",
    title: "Pesanan Diproses",
    desc: "Dapur Mie Oke sedang memasak dan menyiapkan pesananmu.",
  },
  {
    key: "on_delivery",
    title: "Siap & Sedang Diantar",
    desc: "Pesanan telah siap dan sedang dalam perjalanan menuju lokasi pengantaran.",
  },
  {
    key: "completed",
    title: "Pesanan Selesai",
    desc: "Pesanan telah tiba di tujuan dan diselesaikan oleh admin/karyawan.",
  },
];

export default function TrackOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  // Ulasan teks (tanpa rating/bintang)
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  async function loadOrder(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await api<OrderPublic>(`/orders/track/${token}`);
      setOrder(data);
      setErr("");
      saveOrderRef({
        token,
        order_number: data.order_number,
        created_at: data.created_at || new Date().toISOString(),
      });
    } catch (e: any) {
      setErr(e.message || "Tautan pesanan tidak ditemukan.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    api<PublicConfig>("/config")
      .then(setConfig)
      .catch(() => {});
    loadOrder(false);
    const interval = setInterval(() => loadOrder(true), 3000);
    return () => clearInterval(interval);
  }, [token]);

  const eventMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const ev of order?.events || []) {
      map[ev.status] = ev.at;
    }
    return map;
  }, [order]);

  const currentStepIndex = useMemo(() => {
    if (!order) return -1;
    return TIMELINE_STEPS.findIndex((s) => s.key === order.status);
  }, [order]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewErr("");
    setReviewSuccess("");
    if (reviewText.trim().length < 5) {
      setReviewErr("Tuliskan ulasan minimal 5 karakter mengenai makanan/minuman atau pengantaran.");
      return;
    }
    setReviewBusy(true);
    try {
      const res = await api<{ message: string }>(`/reviews/${token}`, {
        method: "POST",
        body: JSON.stringify({ text: reviewText.trim() }),
      });
      setReviewSuccess(res.message || "Terima kasih! Ulasanmu sudah tersimpan.");
      setReviewText("");
      await loadOrder(true);
    } catch (error: any) {
      setReviewErr(error.message || "Gagal mengirim ulasan.");
    } finally {
      setReviewBusy(false);
    }
  }

  const statusMeta = order
    ? STATUS_META[order.status] || {
        label: order.status,
        shortLabel: order.status,
        customerTitle: "Status pesanan",
        customerDesc: "",
        badgeClass: "badge-ink",
      }
    : null;

  return (
    <ShopShell hideStickyCart>
      <main className="container" style={{ paddingTop: 24 }}>
        {loading ? (
          <div className="stack gap-16">
            <div className="skeleton" style={{ height: 140, width: "100%" }} />
            <div className="two-col">
              <div className="skeleton" style={{ height: 320 }} />
              <div className="skeleton" style={{ height: 280 }} />
            </div>
          </div>
        ) : err || !order ? (
          <section className="card card-pad stack gap-12" style={{ maxWidth: 540 }}>
            <h1 style={{ fontSize: 22 }}>Tautan Pesanan Tidak Ditemukan</h1>
            <p className="muted">
              {err || "Pastikan tautan tracking yang dikirimkan melalui WhatsApp dibuka secara utuh."}
            </p>
            <div className="row gap-8">
              <Link href="/lacak" className="btn btn-primary">
                Cari di Riwayat Perangkat
              </Link>
              <Link href="/" className="btn btn-outline">
                Kembali ke Menu
              </Link>
            </div>
          </section>
        ) : (
          <div className="stack gap-24">
            {/* Banner Status Utama */}
            <section className="status-hero">
              <div className="row between wrap gap-12">
                <div>
                  <div className="eyebrow">
                    Pantau Sesi Order & Tracking Pengantaran · {order.order_number}
                  </div>
                  <h1>{statusMeta?.customerTitle}</h1>
                  <p>{statusMeta?.customerDesc}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}
                  onClick={() => loadOrder(true)}
                >
                  <RefreshCw size={14} />
                  <span>Perbarui</span>
                </button>
              </div>

              {order.status === "awaiting_payment" && (
                <div style={{ marginTop: 16 }}>
                  <Link href={`/bayar/${token}`} className="btn btn-primary">
                    <CreditCard size={16} />
                    <span>Buka Instruksi & Selesaikan Pembayaran QRIS</span>
                  </Link>
                </div>
              )}
            </section>

            <div className="two-col">
              <div className="stack gap-16">
                {/* Peta Live GPS Pengantaran (Ala GoFood / ShopeeFood / GrabFood) */}
                {order.status !== "cancelled" && (
                  <section className="card card-pad stack gap-12" aria-labelledby="live-gps-heading">
                    <div className="row between wrap gap-8">
                      <div>
                        <span className="eyebrow">Live GPS Pengantaran</span>
                        <h2 id="live-gps-heading" style={{ fontSize: 20, marginTop: 2 }}>
                          {order.status === "on_delivery"
                            ? "Lacak Posisi Kurir Secara Langsung"
                            : order.status === "completed"
                            ? "Pengantaran Telah Tiba di Tujuan"
                            : "Peta Rute Pengantaran"}
                        </h2>
                      </div>
                      <span
                        className={`badge badge-dot ${
                          order.status === "on_delivery"
                            ? "badge-ok"
                            : order.status === "completed"
                            ? "badge-info"
                            : "badge-warn"
                        }`}
                      >
                        {order.status === "completed"
                          ? "Pesanan tiba"
                          : order.status === "on_delivery" && order.courier_location?.is_live
                          ? "Lokasi kurir aktif"
                          : order.status === "on_delivery" && order.courier_location
                          ? "Menampilkan lokasi terakhir"
                          : order.status === "on_delivery"
                          ? "Menunggu lokasi kurir"
                          : "Menunggu pengantaran"}
                      </span>
                    </div>

                    {/* Ringkasan Jarak & Estimasi Waktu Tiba (ETA) */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-s)",
                          background: "var(--paper)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="tiny muted">Estimasi Tiba</div>
                        <div className="num strong" style={{ fontSize: 17, marginTop: 2 }}>
                          {order.status === "completed"
                            ? "Sudah Tiba"
                            : order.eta_minutes != null
                            ? `~${order.eta_minutes} menit`
                            : "Menyesuaikan"}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-s)",
                          background: "var(--paper)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="tiny muted">Jarak ke Tujuan</div>
                        <div className="num strong" style={{ fontSize: 17, marginTop: 2 }}>
                          {order.distance_km != null
                            ? order.distance_km < 1
                              ? `${Math.round(order.distance_km * 1000)} m`
                              : `${order.distance_km.toFixed(2)} km`
                            : order.status === "on_delivery" ? "Menunggu GPS kurir" : "Belum tersedia"}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-s)",
                          background: "var(--paper)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="tiny muted">Lokasi Diperbarui</div>
                        <div className="num strong" style={{ fontSize: 14, marginTop: 4 }}>
                          {order.courier_location?.updated_at
                            ? formatTimeWIB(order.courier_location.updated_at)
                            : order.status === "on_delivery"
                            ? "Menunggu GPS"
                            : "Belum berangkat"}
                        </div>
                      </div>
                    </div>

                    <LiveTrackingMap
                      storeLocation={order.store_location || null}
                      destinationLocation={order.destination_location || null}
                      courierLocation={order.courier_location || null}
                      status={order.status}
                      height={320}
                    />

                    <div className="row between wrap gap-8 tiny muted">
                      <div className="row gap-12 wrap">
                        <span>🍜 Outlet Mie Oke</span>
                        {order.courier_location && <span>🛵 Posisi Kurir</span>}
                        <span>🏠 Titik Lokasi Pelanggan</span>
                      </div>
                      {order.status === "on_delivery" && !order.courier_location?.is_live && (
                        <span>Lokasi kurir belum diperbarui. Peta akan bergerak setelah HP kurir membagikan lokasi.</span>
                      )}
                      {order.courier_location?.is_live && (
                        <span>Lokasi kurir diperbarui otomatis</span>
                      )}
                    </div>
                  </section>
                )}

                {/* Linimasa Perjalanan Pesanan */}
                <section className="card card-pad stack gap-16" aria-labelledby="timeline-heading">
                  <div className="row between wrap gap-8">
                    <div>
                      <span className="eyebrow">Alur Proses & Pengantaran</span>
                      <h2 id="timeline-heading" style={{ fontSize: 20, marginTop: 2 }}>
                        Status Pesanan {order.customer_first_name}
                      </h2>
                    </div>
                    <span className={`badge badge-dot ${statusMeta?.badgeClass || ""}`}>
                      {statusMeta?.label}
                    </span>
                  </div>

                  {order.status === "cancelled" ? (
                    <div className="alert alert-error">
                      Pesanan ini telah dibatalkan. Silakan hubungi admin Mie Oke melalui WhatsApp apabila membutuhkan
                      bantuan lebih lanjut.
                    </div>
                  ) : (
                    <ol className="timeline">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isDone =
                          order.status === "completed" ||
                          (currentStepIndex > idx && currentStepIndex !== -1) ||
                          Boolean(eventMap[step.key] && order.status !== step.key);
                        const isCurrent = order.status === step.key;
                        const stateClass = isCurrent ? "current" : isDone ? "done" : "todo";
                        const timestamp = eventMap[step.key];

                        return (
                          <li key={step.key} className={stateClass}>
                            <span className="mark" aria-hidden="true">
                              {isDone && !isCurrent ? <Check size={13} strokeWidth={3} /> : null}
                            </span>
                            <div>
                              <div className="t-title">{step.title}</div>
                              <p className="small muted" style={{ marginTop: 2 }}>
                                {step.desc}
                              </p>
                            </div>
                            <div className="t-time">{timestamp ? formatTimeWIB(timestamp) : ""}</div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                {/* Form Ulasan Makanan/Minuman (Tanpa Bintang/Rating) */}
                <section id="ulasan" className="card card-pad stack gap-12" aria-labelledby="review-heading">
                  <div>
                    <span className="eyebrow">Evaluasi Layanan Mie Oke</span>
                    <h2 id="review-heading" style={{ fontSize: 20, marginTop: 2 }}>
                      Ulasan Pesanan
                    </h2>
                  </div>

                  {order.review_submitted ? (
                    <div className="stack gap-12">
                      <div className="alert alert-ok">
                        <CheckCircle2 size={18} style={{ flex: "none", marginTop: 2 }} />
                        <div>
                          <strong>Terima kasih atas ulasanmu!</strong> Masukanmu sudah tercatat dan terhubung dengan
                          pesanan <span className="num strong">{order.order_number}</span> untuk evaluasi layanan Mie
                          Oke.
                        </div>
                      </div>
                      {order.review_text && (
                        <blockquote
                          style={{
                            margin: 0,
                            padding: "12px 14px",
                            background: "var(--paper)",
                            borderRadius: "var(--radius-s)",
                            borderLeft: "3px solid var(--ink)",
                            fontSize: 14,
                          }}
                        >
                          “{order.review_text}”
                        </blockquote>
                      )}
                    </div>
                  ) : order.status === "completed" ? (
                    <form className="stack gap-12" onSubmit={handleSubmitReview}>
                      <p className="small muted">
                        Bagaimana rasa makanan/minuman, porsi, atau ketepatan pengantaran untuk pesanan{" "}
                        <strong className="num">{order.order_number}</strong>? Tuliskan kritik, saran, atau kesanmu di
                        bawah ini (berupa ulasan teks tanpa rating bintang).
                      </p>

                      <div className="field">
                        <label htmlFor="review-textarea">Isi Ulasan Pelanggan</label>
                        <textarea
                          id="review-textarea"
                          className="textarea"
                          rows={4}
                          placeholder="Contoh: Mienya enak banget dan bumbunya pas, pengantaran juga cepat sampai hangat!"
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          required
                        />
                      </div>

                      {reviewErr && <div className="alert alert-error">{reviewErr}</div>}
                      {reviewSuccess && <div className="alert alert-ok">{reviewSuccess}</div>}

                      <div>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={reviewBusy || reviewText.trim().length < 5}
                        >
                          <Send size={15} />
                          <span>{reviewBusy ? "Mengirim ulasan..." : "Kirim Ulasan"}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="small muted">
                      Form pengisian ulasan akan otomatis terbuka di halaman ini setelah pesananmu sampai di tujuan dan
                      dikonfirmasi selesai oleh admin/karyawan Mie Oke.
                    </p>
                  )}
                </section>
              </div>

              {/* Kolom Kanan: Struk Pesanan & Aksi */}
              <aside className="stack gap-16">
                <div className="receipt stack gap-12">
                  <div className="row between">
                    <div>
                      <span className="eyebrow">Struk Pesanan</span>
                      <h3 className="num" style={{ fontSize: 19, marginTop: 2 }}>
                        {order.order_number}
                      </h3>
                    </div>
                    <span className="badge">{paymentLabel(order.payment_method, order.payment_status)}</span>
                  </div>

                  <div className="tiny muted num">Dibuat pada {formatDateTimeWIB(order.created_at)}</div>
                  <hr className="divider" />

                  <div className="stack gap-8">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="receipt-row num">
                        <div>
                          <span className="strong">
                            {item.quantity}× {item.name}
                          </span>
                          {item.variant ? <span className="muted"> ({item.variant})</span> : null}
                          {item.note ? (
                            <div className="tiny muted" style={{ marginTop: 2 }}>
                              Catatan: {item.note}
                            </div>
                          ) : null}
                        </div>
                        <span className="strong">{rupiah(item.line_total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="dashed" style={{ paddingTop: 12 }}>
                    <div className="receipt-total num">
                      <span>Total</span>
                      <span style={{ color: "var(--chili)" }}>{rupiah(order.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="card card-pad stack gap-12">
                  <div className="small strong">Simpan Tautan Tracking Ini</div>
                  <p className="tiny muted">
                    Karena pemesanan tidak memerlukan login akun, tautan halaman ini adalah kunci untuk membuka kembali
                    status pesananmu kapan saja.
                  </p>
                  <div className="row wrap gap-8">
                    <button type="button" className="btn btn-sm btn-outline" onClick={handleCopyLink}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copied ? "Tautan Tersalin" : "Salin Link Tracking"}</span>
                    </button>

                    <a
                      href={waAdminContactLink(
                        config?.whatsapp_number || "6285157753982",
                        `Halo Admin Mie Oke, saya ingin menanyakan pesanan saya dengan nomor ${order.order_number}.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-wa"
                    >
                      <MessageCircle size={15} />
                      <span>Hubungi WA Admin</span>
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>
    </ShopShell>
  );
}
