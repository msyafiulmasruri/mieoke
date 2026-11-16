"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Utensils, X, ArrowUpRight } from "lucide-react";
import ShopShell from "@/components/ShopShell";
import FoodArtwork from "@/components/FoodArtwork";
import { api, MenuItem, rupiah } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = ["Lihat menu", "Ada pilihan pedas?", "Pembayaran QRIS atau COD?", "Cara lacak pesanan"];

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function AssistantText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const blocks: { type: "p" | "list"; lines: string[] }[] = [];
  lines.forEach(line => {
    const isList = /^([-•]|\d+[.)])\s+/.test(line);
    const clean = line.replace(/^([-•]|\d+[.)])\s+/, "");
    const last = blocks[blocks.length - 1];
    if (isList && last?.type === "list") last.lines.push(clean);
    else if (isList) blocks.push({ type: "list", lines: [clean] });
    else blocks.push({ type: "p", lines: [line] });
  });
  return <div className="chat-formatted">{blocks.map((block, i) =>
    block.type === "list"
      ? <ul key={i}>{block.lines.map((line,j)=><li key={j}>{renderInline(line)}</li>)}</ul>
      : <p key={i}>{renderInline(block.lines.join(" "))}</p>
  )}</div>;
}

function wantsMenu(text: string) {
  return /(lihat|tampilkan|daftar|pilihan|rekomendasi|ada).{0,24}(menu|makanan|minuman)|(menu|makanan|minuman).{0,24}(apa saja|yang tersedia|pilihannya)/i.test(text)
    || /^(menu|lihat menu|makanan|minuman)$/i.test(text.trim());
}

export default function ChatPage() {
  const [history, setHistory] = useState<ChatMessage[]>([
    { role: "assistant", content: "Halo! Mau cari menu atau tanya soal pesanan? Aku bantu." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [history, busy]);

  async function openMenuPopup() {
    setMenuOpen(true);
    setMenuError("");
    if (menus.length) return;
    setMenuLoading(true);
    try {
      setMenus(await api<MenuItem[]>("/menus"));
    } catch (e: any) {
      setMenuError(e.message || "Menu belum dapat dimuat.");
    } finally {
      setMenuLoading(false);
    }
  }

  async function handleSend(customQuestion?: string) {
    const text = (customQuestion ?? input).trim();
    if (!text || busy) return;
    const prev = history;
    const next: ChatMessage[] = [...prev, { role: "user", content: text }];
    setHistory(next);
    setInput("");

    if (wantsMenu(text)) {
      setHistory([...next, { role: "assistant", content: "Tentu. Pilih menu yang kamu suka, lalu buka detailnya untuk melihat varian dan harganya." }]);
      await openMenuPopup();
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history: prev }),
      });
      setHistory([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setHistory([...next, {
        role: "assistant",
        content: "Maaf, aku belum bisa menjawab sekarang. Coba lagi sebentar atau hubungi admin Mie Oke.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell hideFloatingChat hideStickyCart>
      <main className="container chat-page">
        <div className="chat-page-head">
          <div>
            <Link href="/" className="chat-back"><ArrowLeft size={15}/> Kembali</Link>
            <h1><span className="chat-mark"><Sparkles size={18}/></span> Bantuan Mie Oke</h1>
            <p>Tanya menu atau cara pesan. Aku bantu.</p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={openMenuPopup}>
            <Utensils size={15}/> Lihat menu
          </button>
        </div>

        <section className="chat-window">
          <div className="chat-window-top">
            <div className="chat-bot-avatar"><Sparkles size={16}/></div>
            <div><b>Asisten Mie Oke</b><small><i/> Siap membantu</small></div>
          </div>

          <div className="chat-body chat-body-clean" ref={bodyRef} aria-live="polite">
            {history.map((msg, i) => (
              <div key={i} className={`chat-message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}>
                {msg.role === "assistant" && <div className="chat-mini-avatar"><Sparkles size={12}/></div>}
                <div className={`chat-bubble-clean ${msg.role === "user" ? "user-bubble" : "assistant-bubble"}`}>
                  {msg.role === "assistant" ? <AssistantText content={msg.content}/> : msg.content}
                </div>
              </div>
            ))}
            {busy && <div className="chat-message-row assistant-row"><div className="chat-mini-avatar"><Sparkles size={12}/></div><div className="chat-bubble-clean assistant-bubble"><span className="typing"><i/><i/><i/></span></div></div>}
          </div>

          <div className="chat-quick-actions">
            {SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => handleSend(s)} disabled={busy}>{s}</button>)}
          </div>
          <form className="chat-input chat-input-clean" onSubmit={e=>{e.preventDefault();handleSend();}}>
            <input aria-label="Pesan" placeholder="Tulis pertanyaan..." value={input} onChange={e=>setInput(e.target.value)}/>
            <button type="submit" className="btn btn-primary" disabled={busy||!input.trim()} aria-label="Kirim pesan"><Send size={16}/></button>
          </form>
          <div className="chat-footnote">Jangan kirim PIN, OTP, atau informasi pembayaran rahasia.</div>
        </section>
      </main>

      {menuOpen && (
        <div className="chat-menu-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false);}}>
          <section className="chat-menu-modal" role="dialog" aria-modal="true" aria-label="Menu Mie Oke">
            <header><div><small>MENU MIE OKE</small><h2>Pilih yang kamu suka</h2></div><button type="button" onClick={()=>setMenuOpen(false)} aria-label="Tutup"><X size={19}/></button></header>
            {menuLoading ? <div className="chat-menu-state">Memuat menu...</div> : menuError ? <div className="chat-menu-state error">{menuError}</div> : menus.length===0 ? <div className="chat-menu-state">Menu belum tersedia.</div> : (
              <div className="chat-menu-grid">
                {menus.map((m,i)=><article className="chat-menu-card" key={m.id}>
                  <div className="chat-menu-photo">{m.image_url?<img src={m.image_url} alt={m.name}/>:<FoodArtwork variant={i}/>}</div>
                  <div className="chat-menu-copy"><small>{m.category||"Menu"}</small><h3>{m.name}</h3><p>{m.description||"Pilih varian sesuai selera."}</p><b>{rupiah(m.price)}</b>
                    <Link href={`/menu/${m.id}`} className="btn btn-primary btn-sm" onClick={()=>setMenuOpen(false)}>Pilih menu <ArrowUpRight size={14}/></Link>
                  </div>
                </article>)}
              </div>
            )}
            <footer><span>{menus.length} pilihan menu</span><Link href="/menu" onClick={()=>setMenuOpen(false)}>Lihat katalog lengkap <ArrowUpRight size={13}/></Link></footer>
          </section>
        </div>
      )}
    </ShopShell>
  );
}
