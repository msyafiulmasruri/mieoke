"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { api, setAdminToken, token } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mieoke.local");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (token()) {
      api("/auth/me")
        .then(() => router.replace("/admin"))
        .catch(() => {});
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAdminToken(res.access_token);
      router.push("/admin");
    } catch (error: any) {
      setErr(error.message || "Gagal masuk ke dashboard admin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <aside className="login-art">
        <Link href="/" className="wordmark">
          MIE OKE<span>.</span>
        </Link>

        <div className="stack gap-16">
          <span className="eyebrow" style={{ color: "var(--yolk)" }}>
            Panel Operasional & Evaluasi Layanan
          </span>
          <h2>Kelola pesanan, pengantaran, & analisis sentimen dalam satu layar.</h2>
          <p style={{ color: "#c9c0b2", maxWidth: "46ch" }}>
            Konfirmasi pesanan masuk, kirim template WhatsApp ke pelanggan dengan sekali klik, pantau kuantitas menu
            terjual, dan evaluasi kepuasan pelanggan melalui klasifikasi sentimen Machine Learning (SVM).
          </p>
        </div>

        <div className="tiny" style={{ color: "#9e9588" }}>
          Sistem Digitalisasi Pemesanan & Pengantaran Mie Oke Surabaya
        </div>
      </aside>

      <main className="login-form">
        <form onSubmit={handleSubmit}>
          <Link href="/" className="row gap-8 small muted" style={{ width: "fit-content" }}>
            <ArrowLeft size={15} />
            <span>Kembali ke Website Pelanggan</span>
          </Link>

          <div className="stack gap-4">
            <span className="eyebrow">Akses Khusus Pengelola</span>
            <h1 style={{ fontSize: 28 }}>Login Dashboard Admin</h1>
            <p className="small muted">Masukkan email dan password admin untuk mengelola operasional Mie Oke.</p>
          </div>

          {err && <div className="alert alert-error">{err}</div>}

          <div className="field">
            <label htmlFor="admin-email">Email Admin</label>
            <input
              id="admin-email"
              type="email"
              className="input"
              placeholder="admin@mieoke.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="input"
              placeholder="Masukkan password admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            <Lock size={16} />
            <span>{busy ? "Memverifikasi..." : "Masuk ke Dashboard"}</span>
          </button>
        </form>
      </main>
    </div>
  );
}
