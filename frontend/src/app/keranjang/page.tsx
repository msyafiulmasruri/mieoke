"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import FoodArtwork from "@/components/FoodArtwork";
import { CartItem, getCart, rupiah, updateCartNote, updateCartQty } from "@/lib/api";

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setCart(getCart());
    sync();
    window.addEventListener("mieoke:cart", sync);
    return () => window.removeEventListener("mieoke:cart", sync);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  return (
    <ShopShell hideStickyCart hideFloatingChat>
      <main className="container cart-page">
        <div className="cart-page-heading">
          <div><span className="section-eyebrow">PESANANMU</span><h1>Keranjang</h1><p>{totalQty} item dipilih</p></div>
          <Link href="/menu" className="home-text-link">Tambah menu <ArrowRight size={16}/></Link>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon"><ShoppingBag size={30}/></div>
            <h2>Keranjang masih kosong</h2>
            <p>Pilih menu Mie Oke untuk mulai memesan.</p>
            <Link href="/menu" className="btn btn-primary">Lihat menu <ArrowRight size={16}/></Link>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items">
              {cart.map((item, index) => (
                <article className="cart-item-card" key={item.key}>
                  <div className="cart-item-art">{item.image_url ? <img className="food-photo" src={item.image_url} alt={item.name} loading="lazy"/> : <FoodArtwork variant={item.menu_id || index}/>}</div>
                  <div className="cart-item-main">
                    <div className="row between wrap gap-8">
                      <div><h2>{item.name}</h2>{item.variant && <span className="cart-variant">{item.variant}</span>}</div>
                      <strong className="cart-line-total">{rupiah(item.unit_price * item.quantity)}</strong>
                    </div>
                    <label className="cart-note-label">
                      <span>Catatan</span>
                      <input className="input" value={item.note} maxLength={200} placeholder="Contoh: tanpa daun bawang" onChange={(e) => updateCartNote(item.key, e.target.value)}/>
                    </label>
                    <div className="row between wrap gap-12">
                      <div className="stepper sm">
                        <button type="button" onClick={() => updateCartQty(item.key, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Kurangi jumlah"><Minus size={14}/></button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateCartQty(item.key, item.quantity + 1)} disabled={item.quantity >= 30} aria-label="Tambah jumlah"><Plus size={14}/></button>
                      </div>
                      <button type="button" className="cart-remove" onClick={() => updateCartQty(item.key, 0)}><Trash2 size={15}/> Hapus</button>
                    </div>
                  </div>
                </article>
              ))}
              <Link href="/menu" className="cart-continue">← Lanjut pilih menu</Link>
            </section>

            <aside className="cart-summary">
              <span className="section-eyebrow">RINGKASAN</span>
              <h2>Detail pesanan</h2>
              <div className="cart-summary-row"><span>Jumlah item</span><strong>{totalQty} porsi</strong></div>
              <div className="cart-summary-row"><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div>
              <div className="cart-summary-total"><span>Total sementara</span><strong>{rupiah(subtotal)}</strong></div>
              <p className="cart-summary-note">Detail alamat dan pengantaran diisi pada langkah berikutnya.</p>
              <Link href="/checkout" className="btn btn-primary btn-lg btn-block">Lanjut checkout <ArrowRight size={17}/></Link>
              <div className="cart-secure"><span>✓</span> Pesan tanpa membuat akun</div>
            </aside>
          </div>
        )}
      </main>
    </ShopShell>
  );
}
