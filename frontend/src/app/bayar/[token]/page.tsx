"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, QrCode, ShieldAlert } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import { api, OrderPublic, PublicConfig, rupiah, saveOrderRef } from "@/lib/api";

export default function BayarQrisPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadData() {
    try {
      const [o, cfg] = await Promise.all([
        api<OrderPublic>(`/orders/track/${token}`),
        api<PublicConfig>("/config").catch(() => null),
      ]);
      setOrder(o);
      if (cfg) setConfig(cfg);
      saveOrderRef({
        token,
        order_number: o.order_number,
        created_at: o.created_at || new Date().toISOString(),
      });
      if (o.payment_status === "paid" || o.status !== "awaiting_payment") {
        router.replace(`/track/${token}`);
      }
    } catch (e: any) {
      setErr(e.message || "Data pembayaran tidak ditemukan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 6000);
    return () => clearInterval(timer);
  }, [token]);

  async function handleSimulatePay() {
    setBusy(true);
    setErr("");
    try {
      await api(`/payments/mock/confirm/${token}`, { method: "POST" });
      router.push(`/track/${token}`);
    } catch (e: any) {
      setErr(e.message || "Gagal mengonfirmasi pembayaran.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell hideStickyCart>
      <main className="container" style={{ maxWidth: 620, paddingTop: 28 }}>
        {loading ? (
          <div className="card card-pad stack gap-12">
            <div className="skeleton" style={{ height: 28, width: "60%" }} />
            <div className="skeleton" style={{ height: 220, width: "100%" }} />
          </div>
        ) : err && !order ? (
          <div className="card card-pad stack gap-12">
            <div className="alert alert-error">{err}</div>
            <Link href="/" className="btn btn-outline">
              Kembali ke Menu
            </Link>
          </div>
        ) : order ? (
          <div className="stack gap-16">
            <div className="receipt stack gap-16">
              <div className="row between wrap gap-8">
                <div>
                  <span className="eyebrow">Tagihan Pembayaran QRIS · DOKU</span>
                  <h1 className="num" style={{ fontSize: 24, marginTop: 4 }}>
                    {order.order_number}
                  </h1>
                </div>
                <span className="badge badge-yolk badge-dot">Menunggu Pembayaran</span>
              </div>

              <div
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "20px",
                  textAlign: "center",
                }}
                className="stack gap-12"
              >
                <div className="small muted">Total yang harus dibayar</div>
                <div
                  className="num"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 36,
                    fontWeight: 800,
                    color: "var(--chili)",
                  }}
                >
                  {rupiah(order.total)}
                </div>

                {/* Kotak Visual QRIS */}
                <div
                  style={{
                    width: 210,
                    height: 210,
                    margin: "4px auto",
                    background: "#fff",
                    border: "2px solid var(--ink)",
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    padding: 16,
                  }}
                >
                  <div className="stack gap-4" style={{ alignItems: "center" }}>
                    <QrCode size={124} strokeWidth={1.5} />
                    <span className="tiny strong">QRIS DINAMIS · MIE OKE</span>
                  </div>
                </div>

                <p className="small muted" style={{ maxWidth: "42ch", margin: "0 auto" }}>
                  Buka aplikasi m-banking atau e-wallet (GoPay, OVO, DANA, ShopeePay, BCA, Mandiri, BRI), pilih{" "}
                  <strong>Bayar / Scan QRIS</strong>, lalu selesaikan pembayaran sesuai nominal di atas.
                </p>
              </div>

              <div className="dashed" style={{ paddingTop: 12 }}>
                <div className="small strong" style={{ marginBottom: 6 }}>
                  Rincian Pesanan ({order.customer_first_name})
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="receipt-row num small muted">
                    <span>
                      {item.quantity}× {item.name}
                      {item.variant ? ` (${item.variant})` : ""}
                    </span>
                    <span>{rupiah(item.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {(!config || config.payment_mode === "mock") && (
              <section className="card card-pad stack gap-12">
                <div className="alert alert-info">
                  <ShieldAlert size={18} style={{ flex: "none", marginTop: 2 }} />
                  <div className="small">
                    <strong>Mode Pengembangan Lokal (Simulasi QRIS DOKU):</strong> Saat ini <code>PAYMENT_MODE=mock</code>.
                    Klik tombol di bawah untuk mensimulasikan callback pembayaran berhasil dari DOKU sehingga pesanan
                    masuk ke antrean <strong>Menunggu Konfirmasi Admin</strong>.
                  </div>
                </div>

                {err && <div className="alert alert-error">{err}</div>}

                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleSimulatePay}
                  disabled={busy}
                >
                  <CheckCircle2 size={18} />
                  <span>{busy ? "Memverifikasi pembayaran..." : "Simulasikan Pembayaran QRIS Berhasil"}</span>
                </button>
              </section>
            )}

            <div className="row between wrap gap-8">
              <Link href={`/track/${token}`} className="btn btn-outline">
                <span>Buka Halaman Status Pesanan</span>
                <ArrowRight size={15} />
              </Link>
              <Link href="/" className="small muted">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </ShopShell>
  );
}
