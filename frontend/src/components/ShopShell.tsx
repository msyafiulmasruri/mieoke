"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, ShoppingBag, Compass, Send, X, Home, UtensilsCrossed } from "lucide-react";
import { api, CartItem, getCart, getSavedOrders, rupiah, SavedOrderRef } from "@/lib/api";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Lihat menu",
  "Cara pesan",
  "QRIS atau COD?",
  "Cara lacak pesanan",
];

export default function ShopShell({
  children,
  hideFloatingChat = false,
  hideStickyCart = false,
}: {
  children: React.ReactNode;
  hideFloatingChat?: boolean;
  hideStickyCart?: boolean;
}) {
  const pathname = usePathname();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<SavedOrderRef[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content:
        "Halo! Mau tanya menu atau pesanan?",
    },
  ]);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncCart = () => setCart(getCart());
    const syncOrders = () => setRecentOrders(getSavedOrders());
    syncCart();
    syncOrders();
    window.addEventListener("mieoke:cart", syncCart);
    window.addEventListener("mieoke:orders", syncOrders);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("mieoke:cart", syncCart);
      window.removeEventListener("mieoke:orders", syncOrders);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [history, chatOpen, chatBusy]);

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const showCartBar = !hideStickyCart && totalItems > 0 && (pathname === "/" || pathname?.startsWith("/menu"));

  async function sendChat(question?: string) {
    const text = (question ?? chatInput).trim();
    if (!text || chatBusy) return;
    const prev = history;
    const next: ChatTurn[] = [...prev, { role: "user", content: text }];
    setHistory(next);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history: prev }),
      });
      setHistory([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setHistory([
        ...next,
        {
          role: "assistant",
          content: "Maaf, asisten sedang sibuk. Silakan coba lagi atau hubungi admin Mie Oke lewat WhatsApp.",
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <>
      <header className="shop-header">
        <div className="container">
          <Link href="/" className="wordmark" aria-label="Beranda Mie Oke">
            MIE OKE<span>.</span>
          </Link>
          <nav className="shop-nav" aria-label="Navigasi utama">
            <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
              <Home size={15} /><span>Beranda</span>
            </Link>
            <Link href="/menu" className={`nav-link ${pathname?.startsWith("/menu") ? "active" : ""}`}>
              <UtensilsCrossed size={15} /><span>Menu</span>
            </Link>
            <Link
              href="/lacak"
              className={`nav-link ${pathname?.startsWith("/lacak") || pathname?.startsWith("/track") ? "active" : ""}`}
            >
              <Compass size={16} /><span>Lacak</span>
              {recentOrders.length > 0 && (
                <span className="badge badge-yolk num" style={{ height: 20, padding: "0 6px" }}>
                  {recentOrders.length}
                </span>
              )}
            </Link>
            <Link href="/chat" className={`nav-link nav-help ${pathname === "/chat" ? "active" : ""}`}>
              <MessageSquare size={15} /><span>Bantuan</span>
            </Link>
            <Link href="/keranjang" className="btn btn-sm btn-outline nav-cart num">
              <ShoppingBag size={16} /><span>Keranjang</span>
              {totalItems > 0 && <span className="nav-cart-count">{totalItems}</span>}
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="shop-footer">
        <div className="container row between wrap gap-12">
          <div>
            <strong style={{ color: "var(--ink)" }}>Mie Oke</strong> · Mie hangat, pesan lebih mudah.
          </div>
          <div className="row gap-16">
            <Link href="/menu">Menu</Link>
            <Link href="/lacak">Lacak Pesanan</Link>
            <Link href="/chat">Bantuan</Link>
            <Link href="/admin/login">Portal Admin</Link>
          </div>
        </div>
      </footer>

      {showCartBar && (
        <div className="cart-bar">
          <Link href="/keranjang">
            <div>
              <div className="count num">{totalItems} porsi dipilih</div>
              <div className="strong num" style={{ fontSize: 16 }}>
                {rupiah(totalPrice)}
              </div>
            </div>
            <span className="go">Lihat keranjang →</span>
          </Link>
        </div>
      )}

      {!hideFloatingChat && pathname !== "/chat" && (
        <>
          {!chatOpen ? (
            <button
              type="button"
              className={`chat-fab ${showCartBar ? "lifted" : ""}`}
              onClick={() => setChatOpen(true)}
              aria-label="Buka asisten tanya menu & cara pesan"
            >
              <span className="dot" />
              <MessageSquare size={17} />
              <span>Tanya Mie Oke</span>
            </button>
          ) : (
            <aside className="chat-panel" aria-label="Asisten virtual Mie Oke">
              <div className="chat-head">
                <div>
                  <div className="strong" style={{ fontSize: 15 }}>
                    Asisten Mie Oke
                  </div>
                  <div className="tiny muted">Bantuan menu dan pesanan</div>
                </div>
                <div className="row gap-4">
                  <Link href="/chat" className="btn btn-sm btn-ghost">
                    Layar penuh
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setChatOpen(false)}
                    aria-label="Tutup asisten"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="chat-body" ref={chatBodyRef}>
                {history.map((m, idx) => (
                  <div key={idx} className={`bubble ${m.role === "user" ? "me" : "bot"}`}>
                    {m.content}
                  </div>
                ))}
                {chatBusy && (
                  <div className="bubble bot">
                    <span className="typing" aria-label="Sedang mengetik">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                )}
                {history.length <= 2 && !chatBusy && (
                  <div className="stack gap-8" style={{ marginTop: 4 }}>
                    <span className="tiny faint">Pertanyaan cepat:</span>
                    <div className="chips">
                      {QUICK_PROMPTS.map((q) => (
                        <button key={q} type="button" className="chip" onClick={() => sendChat(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
              >
                <input
                  className="input"
                  style={{ minHeight: 40, padding: "8px 12px" }}
                  placeholder="Tulis pertanyaanmu..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={chatBusy || !chatInput.trim()}>
                  <Send size={15} />
                  <span>Kirim</span>
                </button>
              </form>
            </aside>
          )}
        </>
      )}
    </>
  );
}
