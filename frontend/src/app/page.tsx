"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, MapPin, ShoppingBag, WalletCards } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import FoodArtwork from "@/components/FoodArtwork";
import MenuCard from "@/components/MenuCard";
import { api, MenuItem } from "@/lib/api";

export default function HomePage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  useEffect(() => {
    api<MenuItem[]>("/menus")
      .then(setMenus)
      .catch(() => setMenuError("Menu belum dapat dimuat. Coba buka halaman menu lagi."))
      .finally(() => setMenuLoading(false));
  }, []);

  return (
    <ShopShell>
      <main className="container home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker"><span /> Mie Oke · Surabaya</span>
            <h1>Mie enak, <em>hari</em> jadi lebih oke.</h1>
            <p>Pilih racikan favoritmu. Kami siapkan, lalu antar ke tempatmu.</p>
            <div className="home-hero-actions">
              <Link href="/menu" className="btn btn-primary btn-lg">
                Pesan sekarang <ArrowRight size={18} />
              </Link>
              <Link href="/menu" className="home-text-link">Lihat semua menu</Link>
            </div>
            <div className="home-proof">
              <span><Check size={15} /> Tanpa buat akun</span>
              <span><Check size={15} /> QRIS atau COD</span>
            </div>
          </div>
          <div className="home-hero-visual">
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-stamp"><span>RACIK</span><strong>SESUAI<br/>SELERA</strong></div>
            <FoodArtwork variant={0} className="hero-food-art" />
            <div className="hero-caption">
              <span className="hero-caption-dot" />
              <span>Hangat dari dapur Mie Oke</span>
            </div>
            <div className="hero-side-note">GOOD FOOD<br/>GOOD MOOD</div>
          </div>
        </section>

        <section className="benefit-strip" aria-label="Keunggulan pemesanan">
          <div><ShoppingBag size={19}/><span><strong>Pilih menu</strong><small>Varian sesuai selera</small></span></div>
          <div><WalletCards size={19}/><span><strong>Pembayaran mudah</strong><small>QRIS atau COD</small></span></div>
          <div><MapPin size={19}/><span><strong>Pantau pesanan</strong><small>Status pesanan online</small></span></div>
        </section>

        <section className="home-menu-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">DARI DAPUR MIE OKE</span>
              <h2>Pilih yang bikin ngiler.</h2>
            </div>
            <Link href="/menu" className="home-text-link">Lihat semua menu <ArrowRight size={16}/></Link>
          </div>
          {menuError ? (
            <div className="menu-state">{menuError}</div>
          ) : menuLoading ? (
            <div className="home-menu-skeleton">
              {[1,2,3].map((n) => <div className="skeleton product-skeleton" key={n}/>)}
            </div>
          ) : menus.length === 0 ? (
            <div className="menu-state">Menu sedang disiapkan.</div>
          ) : (
            <div className="product-grid">
              {menus.slice(0, 3).map((item, index) => <MenuCard key={item.id} item={item} index={index}/>)}
            </div>
          )}
        </section>

        <section className="how-section" id="cara-pesan">
          <div className="how-heading">
            <span className="section-eyebrow">PESAN TANPA RIBET</span>
            <h2>Tiga langkah, beres.</h2>
          </div>
          <div className="how-grid">
            <article><span className="how-number">01</span><div><h3>Pilih menu</h3><p>Tentukan varian dan jumlah pesanan.</p></div></article>
            <article><span className="how-number">02</span><div><h3>Isi detail antar</h3><p>Masukkan kontak, alamat, dan pembayaran.</p></div></article>
            <article><span className="how-number">03</span><div><h3>Pantau pesanan</h3><p>Lihat perkembangannya lewat halaman lacak.</p></div></article>
          </div>
        </section>

        <section className="home-cta">
          <div>
            <span className="section-eyebrow">LAPAR? MIE OKE DULU.</span>
            <h2>Menu favoritmu tinggal beberapa klik.</h2>
          </div>
          <Link href="/menu" className="btn btn-light btn-lg">Mulai pesan <ArrowRight size={18}/></Link>
        </section>
      </main>
    </ShopShell>
  );
}
