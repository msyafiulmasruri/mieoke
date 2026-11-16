"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import MenuCard from "@/components/MenuCard";
import { api, MenuItem } from "@/lib/api";

export default function MenuPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");

  useEffect(() => {
    api<MenuItem[]>("/menus")
      .then(setMenus)
      .catch((e) => setError(e.message || "Menu belum dapat dimuat."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(menus.map((m) => m.category || "Menu")))],
    [menus]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menus.filter((m) => {
      const inCategory = category === "Semua" || (m.category || "Menu") === category;
      const inSearch = !q || `${m.name} ${m.description} ${m.category}`.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  }, [menus, query, category]);

  return (
    <ShopShell>
      <main className="container catalog-page">
        <div className="catalog-heading">
          <div>
            <span className="section-eyebrow">MENU MIE OKE</span>
            <h1>Temukan menu favoritmu.</h1>
            <p>Pilih menu, atur varian, lalu masukkan ke keranjang.</p>
          </div>
          <div className="catalog-count">{menus.length} menu</div>
        </div>

        <div className="catalog-controls">
          <label className="catalog-search">
            <Search size={18}/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari menu..." aria-label="Cari menu"/>
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian"><X size={16}/></button>}
          </label>
          {categories.length > 1 && (
            <div className="catalog-categories" aria-label="Filter kategori">
              {categories.map((c) => (
                <button type="button" key={c} className={category === c ? "category-chip active" : "category-chip"} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="product-grid">
            {[1,2,3,4,5,6].map((n) => <div className="skeleton product-skeleton" key={n}/>)}
          </div>
        ) : filtered.length ? (
          <>
            <div className="catalog-result">{filtered.length} pilihan tersedia</div>
            <div className="product-grid">
              {filtered.map((item, index) => <MenuCard key={item.id} item={item} index={index}/>)}
            </div>
          </>
        ) : (
          <div className="catalog-empty">
            <SlidersHorizontal size={26}/>
            <h2>Menu tidak ditemukan</h2>
            <p>Coba kata kunci atau kategori lain.</p>
            <button className="btn btn-outline" onClick={() => {setQuery("");setCategory("Semua");}}>Reset filter</button>
          </div>
        )}
        <div className="catalog-back"><Link href="/">Kembali ke beranda</Link></div>
      </main>
    </ShopShell>
  );
}
