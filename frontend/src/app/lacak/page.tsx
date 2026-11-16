"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import { formatDateTimeWIB, getSavedOrders, SavedOrderRef } from "@/lib/api";

export default function LacakPesananPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SavedOrderRef[]>([]);
  const [inputLink, setInputLink] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setOrders(getSavedOrders());
  }, []);

  function handleOpenInput(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const raw = inputLink.trim();
    if (!raw) return;

    // Bisa menerima URL penuh (/track/xxxx) atau token langsung
    const match = raw.match(/\/(?:track|bayar)\/([A-Za-z0-9_-]+)/);
    const token = match ? match[1] : raw.replace(/\s+/g, "");
    if (token.length < 8) {
      setErr("Masukkan tautan tracking lengkap dari WhatsApp atau kode token pesananmu.");
      return;
    }
    router.push(`/track/${token}`);
  }

  return (
    <ShopShell hideStickyCart>
      <main className="container" style={{ maxWidth: 680, paddingTop: 28 }}>
        <div className="stack gap-24">
          <div className="stack gap-8">
            <span className="eyebrow">Tanpa Akun · Pantau Kapan Saja</span>
            <h1 style={{ fontSize: 32 }}>Lacak Pesananmu</h1>
            <p className="muted">
              Buka kembali status pesanan yang pernah kamu buat di perangkat ini, atau tempel tautan tracking yang
              dikirimkan admin Mie Oke ke WhatsApp-mu.
            </p>
          </div>

          <section className="card card-pad stack gap-12">
            <h2 style={{ fontSize: 18 }}>Buka dari Tautan WhatsApp</h2>
            <form className="row wrap gap-8" onSubmit={handleOpenInput}>
              <input
                className="input grow"
                placeholder="Tempel link tracking (contoh: http://localhost:3000/track/...)"
                value={inputLink}
                onChange={(e) => setInputLink(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <Search size={16} />
                <span>Buka Pesanan</span>
              </button>
            </form>
            {err && <div className="alert alert-error">{err}</div>}
          </section>

          <section className="card card-pad stack gap-12">
            <h2 style={{ fontSize: 18 }}>Riwayat Pesanan di Perangkat Ini</h2>
            {orders.length === 0 ? (
              <div className="stack gap-12">
                <p className="small muted">
                  Belum ada pesanan yang tersimpan di browser ini. Silakan pilih menu di halaman utama untuk membuat
                  pesanan baru.
                </p>
                <div>
                  <Link href="/menu" className="btn btn-outline">
                    Lihat Menu
                  </Link>
                </div>
              </div>
            ) : (
              <div className="stack">
                {orders.map((item, idx) => (
                  <div
                    key={item.token}
                    className="row between wrap gap-12"
                    style={{
                      padding: "14px 0",
                      borderTop: idx > 0 ? "1px dashed var(--line)" : "none",
                    }}
                  >
                    <div>
                      <div className="strong num" style={{ fontSize: 16 }}>
                        {item.order_number}
                      </div>
                      <div className="tiny muted num">{formatDateTimeWIB(item.created_at)}</div>
                    </div>
                    <Link href={`/track/${item.token}`} className="btn btn-sm btn-dark">
                      <span>Pantau & Tracking</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </ShopShell>
  );
}
