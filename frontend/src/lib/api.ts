const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface MenuVariant {
  name: string;
  additional_price: number;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  variants: MenuVariant[];
  image_url?: string | null;
  available?: boolean;
  sort_order?: number;
}

export interface CartItem {
  key: string;
  menu_id: number;
  name: string;
  variant: string;
  note: string;
  unit_price: number;
  quantity: number;
  image_url?: string;
}

export interface OrderEventItem {
  status: string;
  at: string | null;
}

export interface OrderLineItem {
  name: string;
  variant: string;
  note: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderPublic {
  order_number: string;
  customer_first_name: string;
  status: string;
  payment_method: "qris" | "cod" | string;
  payment_status: "pending" | "paid" | "cod_due" | string;
  subtotal: number;
  total: number;
  created_at: string | null;
  items: OrderLineItem[];
  events: OrderEventItem[];
  review_submitted: boolean;
  review_text: string | null;
  store_location?: { lat: number; lng: number; name?: string } | null;
  destination_location?: { lat: number; lng: number } | null;
  courier_location?: {
    lat: number;
    lng: number;
    updated_at: string | null;
    accuracy_m?: number | null;
    is_live?: boolean;
  } | null;
  distance_km?: number | null;
  eta_minutes?: number | null;
}

export interface OrderAdmin extends OrderPublic {
  id: number;
  customer: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  tracking_url: string;
  updated_at: string | null;
  next_status: string | null;
  can_cancel: boolean;
  review: {
    text: string;
    sentiment: "positif" | "negatif" | string;
    created_at: string | null;
  } | null;
}

export interface SavedOrderRef {
  token: string;
  order_number: string;
  created_at: string;
}

export interface PublicConfig {
  store_name: string;
  whatsapp_number: string;
  payment_mode: string;
  assistant_enabled: boolean;
}

const ADMIN_TOKEN_KEY = "mieoke_admin_token";
const CART_KEY = "mieoke_cart_v1";
const ORDERS_KEY = "mieoke_recent_orders_v1";

export function token(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function setAdminToken(value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, value);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const h = new Headers(init.headers || {});
  if (init.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  const t = token();
  if (t && !h.has("Authorization")) h.set("Authorization", `Bearer ${t}`);
  const r = await fetch(BASE + path, { ...init, headers: h, cache: "no-store" });
  const d = await r.json().catch(() => ({ detail: "Terjadi kendala komunikasi dengan server." }));
  if (!r.ok) {
    const msg =
      typeof d?.detail === "string"
        ? d.detail
        : Array.isArray(d?.detail)
        ? d.detail.map((x: any) => x?.msg || "Input kurang tepat").join(", ")
        : "Permintaan gagal diproses.";
    throw new Error(msg);
  }
  return d as T;
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export function formatTimeWIB(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(isoStr)) + " WIB"
    );
  } catch {
    return "-";
  }
}

export function formatDateTimeWIB(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(isoStr)) + " WIB"
    );
  } catch {
    return "-";
  }
}

export function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00+07:00`);
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Keranjang belanja (localStorage + event sinkronisasi)
// ---------------------------------------------------------------------------
function emitCartChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mieoke:cart"));
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCartStorage(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  emitCartChange();
}

export function addToCart(item: Omit<CartItem, "key">) {
  const current = getCart();
  const key = `${item.menu_id}::${item.variant || ""}::${(item.note || "").trim().toLowerCase()}`;
  const idx = current.findIndex((c) => c.key === key);
  if (idx >= 0) {
    current[idx].quantity = Math.min(30, current[idx].quantity + item.quantity);
  } else {
    current.push({ ...item, note: (item.note || "").trim(), key });
  }
  setCartStorage(current);
}

export function updateCartQty(key: string, quantity: number) {
  const current = getCart();
  const next = quantity <= 0 ? current.filter((c) => c.key !== key) : current.map((c) => (c.key === key ? { ...c, quantity: Math.min(30, quantity) } : c));
  setCartStorage(next);
}

export function updateCartNote(key: string, note: string) {
  const current = getCart().map((c) => (c.key === key ? { ...c, note } : c));
  setCartStorage(current);
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_KEY);
  emitCartChange();
}

// ---------------------------------------------------------------------------
// Riwayat pesanan di perangkat pelanggan (tanpa login)
// ---------------------------------------------------------------------------
export function getSavedOrders(): SavedOrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOrderRef(ref: SavedOrderRef) {
  if (typeof window === "undefined") return;
  const list = getSavedOrders().filter((x) => x.token !== ref.token);
  list.unshift(ref);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 15)));
  window.dispatchEvent(new Event("mieoke:orders"));
}

// ---------------------------------------------------------------------------
// Status & Template WhatsApp
// ---------------------------------------------------------------------------
export const STATUS_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    customerTitle: string;
    customerDesc: string;
    badgeClass: string;
    nextActionLabel?: string;
  }
> = {
  awaiting_payment: {
    label: "Menunggu Pembayaran QRIS",
    shortLabel: "Belum Bayar",
    customerTitle: "Selesaikan pembayaran QRIS terlebih dahulu",
    customerDesc: "Pesananmu sudah tercatat dan akan langsung diteruskan ke admin begitu pembayaran QRIS dikonfirmasi.",
    badgeClass: "badge-yolk",
  },
  waiting_confirmation: {
    label: "Menunggu Konfirmasi Admin",
    shortLabel: "Menunggu Konfirmasi",
    customerTitle: "Menunggu konfirmasi pesanan dari admin",
    customerDesc: "Pesananmu sudah masuk ke sistem Mie Oke. Admin segera memeriksa dan mengonfirmasi pesananmu.",
    badgeClass: "badge-yolk",
    nextActionLabel: "Konfirmasi Pesanan",
  },
  confirmed: {
    label: "Pesanan Dikonfirmasi",
    shortLabel: "Dikonfirmasi",
    customerTitle: "Pesanan telah dikonfirmasi admin",
    customerDesc: "Pesananmu sudah disetujui dan segera masuk ke antrean masak di dapur.",
    badgeClass: "badge-sky",
    nextActionLabel: "Mulai Proses Masak",
  },
  preparing: {
    label: "Sedang Diproses",
    shortLabel: "Diproses",
    customerTitle: "Pesananmu sedang dimasak & disiapkan",
    customerDesc: "Tim dapur Mie Oke sedang menyiapkan pesananmu sesuai varian dan catatan yang kamu pilih.",
    badgeClass: "badge-sky",
    nextActionLabel: "Pesanan Siap & Antar",
  },
  on_delivery: {
    label: "Siap & Sedang Diantar",
    shortLabel: "Diantar",
    customerTitle: "Pesanan siap dan sedang dalam pengantaran",
    customerDesc: "Kurir sedang menuju lokasi pengantaranmu. Pastikan nomor WhatsApp aktif bila kurir menghubungi.",
    badgeClass: "badge-ink",
    nextActionLabel: "Tandai Sampai & Selesai",
  },
  completed: {
    label: "Pesanan Selesai",
    shortLabel: "Selesai",
    customerTitle: "Pesanan telah sampai di tujuan",
    customerDesc: "Terima kasih sudah memesan Mie Oke! Jika berkenan, tuliskan ulasanmu di bawah.",
    badgeClass: "badge-leaf",
  },
  cancelled: {
    label: "Pesanan Dibatalkan",
    shortLabel: "Dibatalkan",
    customerTitle: "Pesanan ini dibatalkan",
    customerDesc: "Jika ada kendala atau ingin memesan ulang, silakan hubungi admin Mie Oke melalui WhatsApp.",
    badgeClass: "badge-chili",
  },
};

export function paymentLabel(method: string, status: string): string {
  if (method === "cod") return status === "paid" ? "COD · Lunas" : "COD · Bayar di Tempat";
  if (status === "paid") return "QRIS · Lunas";
  return "QRIS · Menunggu Bayar";
}

export function waDeliveryTemplate(o: OrderAdmin): string {
  const phone = String(o.phone || "").replace(/\D/g, "").replace(/^0/, "62");
  const msg = [
    `Halo Kak ${o.customer}, pesanan Mie Oke Anda telah siap dan sedang dalam pengantaran.`,
    ``,
    `Nomor pesanan : ${o.order_number}`,
    `Nama : ${o.customer}`,
    `Alamat : ${o.address}`,
    `Link pantau & tracking : ${o.tracking_url}`,
    ``,
    `Tautan di atas dapat dibuka kapan saja untuk memantau status pesanan Anda. Terima kasih!`,
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function waReviewTemplate(o: OrderAdmin): string {
  const phone = String(o.phone || "").replace(/\D/g, "").replace(/^0/, "62");
  const msg = [
    `Terima kasih Kak ${o.customer} telah memesan di Mie Oke! Semoga hidangan kami cocok di lidah.`,
    ``,
    `Jika berkenan, mohon berikan ulasan mengenai makanan/minuman dan layanan kami untuk pesanan ${o.order_number} melalui tautan berikut:`,
    `${o.tracking_url}#ulasan`,
    ``,
    `Masukan Anda sangat berarti bagi evaluasi layanan Mie Oke. Terima kasih banyak!`,
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function waAdminContactLink(whatsappNumber: string, text: string): string {
  const clean = (whatsappNumber || "6285157753982").replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}
