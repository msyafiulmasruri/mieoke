import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MenuItem, rupiah } from "@/lib/api";
import FoodArtwork from "@/components/FoodArtwork";

export default function MenuCard({ item, index = 0 }: { item: MenuItem; index?: number }) {
  return (
    <Link href={`/menu/${item.id}`} className="product-card">
      <div className="product-card-visual">
        {item.image_url ? <img className="food-photo" src={item.image_url} alt={item.name} loading="lazy" /> : <FoodArtwork variant={index} />}
        <span className="product-category">{item.category || "Menu"}</span>
        <span className="product-open"><ArrowUpRight size={17} /></span>
      </div>
      <div className="product-card-body">
        <div className="product-card-copy">
          <h3>{item.name}</h3>
          {item.description ? <p>{item.description}</p> : <p className="product-desc-empty">Racik sesuai selera.</p>}
        </div>
        <div className="product-card-bottom">
          <strong>{rupiah(item.price)}</strong>
          <span>Pilih menu <ArrowUpRight size={14} /></span>
        </div>
      </div>
    </Link>
  );
}
