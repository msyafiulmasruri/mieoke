"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import FoodArtwork from "@/components/FoodArtwork";
import MenuCard from "@/components/MenuCard";
import { addToCart, api, MenuItem, rupiah } from "@/lib/api";

export default function MenuDetailPage() {
  const params = useParams<{ id: string }>();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api<MenuItem[]>("/menus")
      .then((items) => setMenus(items))
      .catch((e) => setError(e.message || "Menu belum dapat dimuat."))
      .finally(() => setLoading(false));
  }, []);

  const menu = menus.find((item) => item.id === Number(params.id));
  useEffect(() => {
    if (menu) setVariant(menu.variants?.[0]?.name || "");
  }, [menu?.id]);

  const selectedVariant = menu?.variants?.find((item) => item.name === variant);
  const unitPrice = menu ? menu.price + (selectedVariant?.additional_price || 0) : 0;
  const total = unitPrice * quantity;
  const related = menus.filter((item) => item.id !== menu?.id && item.category === menu?.category).slice(0, 3);

  function handleAdd() {
    if (!menu) return;
    addToCart({
      menu_id: menu.id,
      name: menu.name,
      variant,
      note: note.trim(),
      image_url: menu.image_url,
      unit_price: unitPrice,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4500);
  }

  if (loading) {
    return <ShopShell><main className="container detail-page"><div className="skeleton detail-skeleton"/></main></ShopShell>;
  }

  if (error || !menu) {
    return (
      <ShopShell>
        <main className="container detail-page">
          <Link href="/menu" className="back-link"><ArrowLeft size={16}/> Kembali ke menu</Link>
          <div className="catalog-empty"><h2>{error || "Menu tidak ditemukan"}</h2><Link href="/menu" className="btn btn-primary">Lihat menu</Link></div>
        </main>
      </ShopShell>
    );
  }

  return (
    <ShopShell>
      <main className="container detail-page">
        <div className="detail-breadcrumb"><Link href="/">Beranda</Link><span>/</span><Link href="/menu">Menu</Link><span>/</span><strong>{menu.name}</strong></div>
        <div className="product-detail-layout">
          <div className="product-detail-visual">{menu.image_url ? <img className="food-photo" src={menu.image_url} alt={menu.name}/> : <FoodArtwork variant={menu.id}/>}<span className="detail-category">{menu.category || "Menu Mie Oke"}</span></div>
          <section className="product-detail-info">
            <span className="section-eyebrow">{menu.category || "MENU MIE OKE"}</span>
            <h1>{menu.name}</h1>
            <div className="detail-price">{rupiah(menu.price)}</div>
            <p className="detail-description">{menu.description || "Menu Mie Oke, siap diracik sesuai pilihanmu."}</p>

            {(menu.variants?.length ?? 0) > 0 && (
              <div className="detail-option-group">
                <div className="row between"><strong>Pilih varian</strong><span className="tiny muted">Pilih satu</span></div>
                <div className="detail-variants">
                  {menu.variants.map((item) => {
                    const active = item.name === variant;
                    return (
                      <button type="button" key={item.name} className={active ? "detail-variant active" : "detail-variant"} onClick={() => setVariant(item.name)}>
                        <span>{item.name}</span>
                        <span className="row gap-8">{item.additional_price > 0 ? `+${rupiah(item.additional_price)}` : "Termasuk"}<span className="detail-radio">{active && <Check size={12}/>}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="detail-option-group">
              <strong>Catatan khusus <span className="muted small">(opsional)</span></strong>
              <textarea className="textarea" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: tanpa daun bawang"/>
            </div>
            <div className="detail-buy-row">
              <div className="stepper" aria-label="Jumlah pesanan">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Kurangi jumlah"><Minus size={16}/></button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => Math.min(30, q + 1))} disabled={quantity >= 30} aria-label="Tambah jumlah"><Plus size={16}/></button>
              </div>
              <span className="detail-total">{rupiah(total)}</span>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleAdd}>
              <ShoppingBag size={18}/> Tambah ke keranjang
            </button>
            {added && <div className="added-notice"><span><Check size={16}/> Ditambahkan ke keranjang</span><Link href="/keranjang">Lihat keranjang <ArrowRight size={14}/></Link></div>}
          </section>
        </div>

        {related.length > 0 && (
          <section className="related-section">
            <div className="section-heading"><div><span className="section-eyebrow">COBA JUGA</span><h2>Menu lainnya.</h2></div><Link href="/menu" className="home-text-link">Semua menu <ArrowRight size={16}/></Link></div>
            <div className="product-grid">{related.map((item, index) => <MenuCard key={item.id} item={item} index={index + 1}/>)}</div>
          </section>
        )}
      </main>
    </ShopShell>
  );
}
