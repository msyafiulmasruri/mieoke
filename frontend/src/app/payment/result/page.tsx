"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import ShopShell from "@/components/ShopShell";

function PaymentResultBody() {
  const params = useSearchParams();
  const order = params.get("order") || "";
  const token = params.get("token") || "";

  return (
    <ShopShell hideStickyCart>
      <main className="container" style={{ maxWidth: 560, paddingTop: 32 }}>
        <section className="card card-pad stack gap-16">
          <div className="row gap-12">
            <CheckCircle2 size={28} color="var(--leaf)" />
            <div>
              <span className="eyebrow">Status Pembayaran</span>
              <h1 style={{ fontSize: 24 }}>Informasi Pembayaran</h1>
            </div>
          </div>

          {order && (
            <p className="small muted">
              Nomor Pesanan: <strong className="num">{order}</strong>
            </p>
          )}

          <p className="muted">
            Status pembayaran QRIS hanya berubah menjadi lunas setelah server menerima konfirmasi pembayaran yang
            tervalidasi. Buka halaman pelacakan pesanan untuk melihat status terbaru dari admin Mie Oke.
          </p>

          <div className="row wrap gap-12">
            {token ? (
              <Link href={`/track/${token}`} className="btn btn-primary">
                <span>Pantau Status Pesanan</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link href="/lacak" className="btn btn-primary">
                <span>Buka Halaman Lacak Pesanan</span>
                <ArrowRight size={16} />
              </Link>
            )}
            <Link href="/" className="btn btn-outline">
              Kembali ke Menu
            </Link>
          </div>
        </section>
      </main>
    </ShopShell>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <ShopShell hideStickyCart>
          <main className="container" style={{ paddingTop: 32 }}>
            Memuat informasi pembayaran...
          </main>
        </ShopShell>
      }
    >
      <PaymentResultBody />
    </Suspense>
  );
}
