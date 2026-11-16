"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LayoutDashboard, ClipboardList, Utensils, ChartColumn, MessageSquare,
  History, LogOut, RefreshCw, Plus, Search, X, Pencil, Eye, EyeOff,
  Trash2, MapPin, Phone, Clock3, Check, ChevronRight, Navigation,
  Radio, Square, ExternalLink, CalendarDays, PackageCheck
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import {
  api, clearAdminToken, formatDateShort, formatDateTimeWIB, formatTimeWIB,
  MenuItem, MenuVariant, OrderAdmin, paymentLabel, rupiah, STATUS_META,
  token, waDeliveryTemplate, waReviewTemplate
} from "@/lib/api";

type Tab = "ringkasan" | "pesanan" | "menu" | "penjualan" | "ulasan" | "riwayat";
type Summary = {
  orders_today:number; completed_today:number; status_counts:Record<string,number>;
  items_sold_today:number; top_menus_today:{menu:string;quantity:number;variants:any[]}[];
  sentiment:{positif:number;negatif:number;total:number};
  latest_reviews:{id:number;order_number:string;customer:string;text:string;sentiment:string;created_at:string|null}[];
};
type Sales = {start:string|null;end:string|null;items:{menu:string;quantity:number;variants:{variant:string;quantity:number}[]}[];total_items:number;total_orders:number;daily:{date:string;quantity:number}[]};
type Reviews = {total:number;page:number;page_size:number;items:{id:number;order_number:string;customer:string;items:string[];text:string;sentiment:string;created_at:string|null}[]};
type History = {total:number;page:number;page_size:number;items:OrderAdmin[]};

const nav: {id:Tab;label:string;icon:any}[] = [
  {id:"ringkasan",label:"Ringkasan",icon:LayoutDashboard},
  {id:"pesanan",label:"Pesanan",icon:ClipboardList},
  {id:"menu",label:"Menu",icon:Utensils},
  {id:"penjualan",label:"Penjualan",icon:ChartColumn},
  {id:"ulasan",label:"Ulasan",icon:MessageSquare},
  {id:"riwayat",label:"Riwayat",icon:History},
];
const statusNames:Record<string,string> = {
  awaiting_payment:"Menunggu pembayaran", waiting_confirmation:"Perlu konfirmasi",
  confirmed:"Dikonfirmasi", preparing:"Sedang disiapkan", ready_for_delivery:"Siap diantar",
  on_delivery:"Dalam pengantaran", completed:"Selesai", cancelled:"Dibatalkan"
};
const statusOrder = ["awaiting_payment","waiting_confirmation","confirmed","preparing","on_delivery","completed","cancelled"];
const today = () => new Date(Date.now()+7*3600*1000).toISOString().slice(0,10);
const ago = (n:number) => new Date(Date.now()+7*3600*1000-n*86400000).toISOString().slice(0,10);

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab,setTab] = useState<Tab>("ringkasan");
  const [email,setEmail] = useState("");
  const [summary,setSummary] = useState<Summary|null>(null);
  const [active,setActive] = useState<OrderAdmin[]>([]);
  const [selected,setSelected] = useState<OrderAdmin|null>(null);
  const [sales,setSales] = useState<Sales|null>(null);
  const [salesRange,setSalesRange] = useState("today");
  const [salesStart,setSalesStart] = useState(today());
  const [salesEnd,setSalesEnd] = useState(today());
  const [reviews,setReviews] = useState<Reviews|null>(null);
  const [distribution,setDistribution] = useState<any>(null);
  const [reviewFilter,setReviewFilter] = useState("");
  const [reviewStart,setReviewStart] = useState("");
  const [reviewEnd,setReviewEnd] = useState("");
  const [reviewPage,setReviewPage] = useState(1);
  const [history,setHistory] = useState<History|null>(null);
  const [historyQuery,setHistoryQuery] = useState("");
  const [historyStatus,setHistoryStatus] = useState("");
  const [historyStart,setHistoryStart] = useState("");
  const [historyEnd,setHistoryEnd] = useState("");
  const [historyPage,setHistoryPage] = useState(1);
  const [menus,setMenus] = useState<MenuItem[]>([]);
  const [menuModal,setMenuModal] = useState(false);
  const [editing,setEditing] = useState<number|null>(null);
  const [menuName,setMenuName] = useState("");
  const [menuCategory,setMenuCategory] = useState("Mie");
  const [menuPrice,setMenuPrice] = useState("15000");
  const [menuDesc,setMenuDesc] = useState("");
  const [menuImage,setMenuImage] = useState("");
  const [menuVariants,setMenuVariants] = useState<MenuVariant[]>([{name:"Original",additional_price:0}]);
  const [menuAvailable,setMenuAvailable] = useState(true);
  const [menuSort,setMenuSort] = useState("1");
  const [menuBusy,setMenuBusy] = useState(false);
  const [menuFilter,setMenuFilter] = useState("Semua");
  const [busyId,setBusyId] = useState<number|null>(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);
  const [gpsOrder,setGpsOrder] = useState<number|null>(null);
  const [gpsMessage,setGpsMessage] = useState("");
  const watchRef = useRef<number|null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const lastGpsRef = useRef(0);

  async function loadMain() {
    try {
      const [me,s,o,m] = await Promise.all([
        api<{email:string}>("/auth/me"),
        api<Summary>("/admin/summary"),
        api<OrderAdmin[]>("/admin/orders/active"),
        api<MenuItem[]>("/admin/menus")
      ]);
      setEmail(me.email); setSummary(s); setActive(o); setMenus(m);
      setSelected(old => old ? (o.find(x=>x.id===old.id)||old) : null);
      setError("");
    } catch(e:any) {
      if(String(e.message||"").toLowerCase().includes("sesi")) {
        clearAdminToken(); router.replace("/admin/login");
      } else setError(e.message||"Data belum dapat dimuat.");
    } finally { setLoading(false); }
  }
  async function loadSales() {
    try {
      const q = new URLSearchParams();
      if(salesRange==="custom"){if(salesStart)q.set("start",salesStart);if(salesEnd)q.set("end",salesEnd);}
      else if(salesRange==="today"){q.set("start",today());q.set("end",today());}
      else if(salesRange==="7d"){q.set("start",ago(6));q.set("end",today());}
      else if(salesRange==="30d"){q.set("start",ago(29));q.set("end",today());}
      setSales(await api<Sales>(`/admin/analytics/sales${q.toString()?"?"+q.toString():""}`));
    } catch(e:any){setError(e.message||"Data penjualan gagal dimuat.");}
  }
  async function loadReviewData() {
    try {
      const q=new URLSearchParams({page:String(reviewPage),page_size:"15"});
      const dQ=new URLSearchParams();
      if(reviewFilter)q.set("sentiment",reviewFilter);
      if(reviewStart){q.set("start",reviewStart);dQ.set("start",reviewStart);}
      if(reviewEnd){q.set("end",reviewEnd);dQ.set("end",reviewEnd);}
      const [d,r]=await Promise.all([
        api<any>(`/admin/reviews/distribution${dQ.toString()?"?"+dQ.toString():""}`),
        api<Reviews>(`/admin/reviews?${q.toString()}`)
      ]);
      setDistribution(d);setReviews(r);
    } catch(e:any){setError(e.message||"Ulasan gagal dimuat.");}
  }
  async function loadHistory() {
    try {
      const q=new URLSearchParams({page:String(historyPage),page_size:"15"});
      if(historyQuery.trim())q.set("q",historyQuery.trim());
      if(historyStatus)q.set("status",historyStatus);
      if(historyStart)q.set("start",historyStart);
      if(historyEnd)q.set("end",historyEnd);
      setHistory(await api<History>(`/admin/orders?${q.toString()}`));
    } catch(e:any){setError(e.message||"Riwayat gagal dimuat.");}
  }

  useEffect(()=>{
    if(!token()){router.replace("/admin/login");return;}
    loadMain();loadSales();loadReviewData();loadHistory();
    const timer=setInterval(loadMain,12000);
    return ()=>{clearInterval(timer);stopGps();};
  },[]);
  useEffect(()=>{if(token())loadSales();},[salesRange,salesStart,salesEnd]);
  useEffect(()=>{if(token())loadReviewData();},[reviewFilter,reviewStart,reviewEnd,reviewPage]);
  useEffect(()=>{if(token())loadHistory();},[historyStatus,historyStart,historyEnd,historyPage]);

  function stopGps(message="Berbagi lokasi dihentikan.") {
    if(watchRef.current!==null && typeof navigator!=="undefined" && navigator.geolocation){navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;}
    if(heartbeatRef.current){clearInterval(heartbeatRef.current);heartbeatRef.current=null;}
    setGpsOrder(null);setGpsMessage(message);
  }
  async function sendGps(orderId:number,pos:GeolocationPosition) {
    const now=Date.now();if(now-lastGpsRef.current<4000)return;lastGpsRef.current=now;
    try {
      const updated=await api<OrderAdmin>(`/admin/orders/${orderId}/location`,{method:"PATCH",body:JSON.stringify({lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6)),accuracy_m:Number(pos.coords.accuracy.toFixed(1))})});
      setActive(old=>old.map(x=>x.id===orderId?updated:x));setSelected(old=>old?.id===orderId?updated:old);
      setGpsMessage(`Lokasi terkirim · akurasi ±${Math.round(pos.coords.accuracy)} m`);
    } catch(e:any){setError(e.message||"Lokasi gagal dikirim.");}
  }
  function startGps(order:OrderAdmin) {
    stopGps("");
    if(order.status!=="on_delivery"){setGpsMessage("Lokasi hanya dapat dibagikan saat pesanan diantar.");return;}
    if(!window.isSecureContext || !navigator.geolocation){setGpsMessage("Buka dashboard melalui HTTPS dan aktifkan layanan lokasi HP.");return;}
    setGpsOrder(order.id);setGpsMessage("Menunggu izin dan pembacaan GPS...");
    lastGpsRef.current=0;
    const id=navigator.geolocation.watchPosition(p=>sendGps(order.id,p),err=>{
      stopGps(err.code===1?"Izin lokasi ditolak. Aktifkan izin lokasi browser.":"GPS tidak tersedia. Periksa pengaturan lokasi HP.");
    },{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
    watchRef.current=id;
    heartbeatRef.current=setInterval(()=>navigator.geolocation.getCurrentPosition(p=>sendGps(order.id,p),()=>{},{enableHighAccuracy:true,maximumAge:5000,timeout:15000}),12000);
  }

  async function changeStatus(order:OrderAdmin,status:string) {
    setBusyId(order.id);setError("");
    try {
      const updated=await api<OrderAdmin>(`/admin/orders/${order.id}/status`,{method:"PATCH",body:JSON.stringify({status})});
      setSelected(updated);if(status!=="on_delivery"&&gpsOrder===order.id)stopGps();
      await Promise.all([loadMain(),loadSales(),loadHistory()]);
      setNotice(`Pesanan ${order.order_number} diperbarui.`);
    } catch(e:any){setError(e.message||"Status gagal diperbarui.");}
    finally{setBusyId(null);}
  }

  function newMenu() {
    setEditing(null);setMenuName("");setMenuCategory("Mie");setMenuPrice("15000");setMenuDesc("");setMenuImage("");
    setMenuVariants([{name:"Original",additional_price:0},{name:"Pedas",additional_price:0}]);
    setMenuAvailable(true);setMenuSort(String((menus.length+1)*5));setMenuModal(true);
  }
  function editMenu(m:MenuItem) {
    setEditing(m.id);setMenuName(m.name);setMenuCategory(m.category||"Mie");setMenuPrice(String(m.price));
    setMenuDesc(m.description||"");setMenuImage(m.image_url||"");setMenuAvailable(m.available!==false);
    setMenuSort(String(m.sort_order||1));setMenuVariants(m.variants||[]);setMenuModal(true);
  }
  async function saveMenu(e:FormEvent) {
    e.preventDefault();setMenuBusy(true);setError("");
    const payload={name:menuName.trim(),category:menuCategory,price:Number(menuPrice),description:menuDesc.trim(),image_url:menuImage.trim(),available:menuAvailable,sort_order:Number(menuSort)||1,variants:menuVariants.filter(v=>v.name.trim()).map(v=>({name:v.name.trim(),additional_price:Number(v.additional_price)||0}))};
    try {
      await api(editing?`/admin/menus/${editing}`:"/admin/menus",{method:editing?"PUT":"POST",body:JSON.stringify(payload)});
      setMenuModal(false);await loadMain();setNotice("Menu berhasil disimpan.");
    } catch(e:any){setError(e.message||"Menu gagal disimpan.");}
    finally{setMenuBusy(false);}
  }
  async function toggleMenu(m:MenuItem) {
    try{await api(`/admin/menus/${m.id}/availability`,{method:"PATCH",body:JSON.stringify({available:m.available===false})});await loadMain();}
    catch(e:any){setError(e.message||"Status menu gagal diubah.");}
  }
  async function deleteMenu(m:MenuItem) {
    if(!confirm(`Hapus menu "${m.name}"?`))return;
    try{await api(`/admin/menus/${m.id}`,{method:"DELETE"});await loadMain();setNotice("Menu dihapus.");}
    catch(e:any){setError(e.message||"Menu gagal dihapus.");}
  }

  const waiting=active.filter(o=>["waiting_confirmation","awaiting_payment"].includes(o.status));
  const kitchen=active.filter(o=>["confirmed","preparing","ready_for_delivery"].includes(o.status));
  const delivery=active.filter(o=>o.status==="on_delivery");
  const done=active.filter(o=>o.status==="completed");
  const title=nav.find(x=>x.id===tab)?.label||"Ringkasan";
  const topMenus=summary?.top_menus_today||[];
  const filteredMenus=menus.filter(m=>menuFilter==="Semua"||m.category===menuFilter);
  const categories=["Semua",...Array.from(new Set(menus.map(m=>m.category||"Mie")))];

  function orderCard(o:OrderAdmin) {
    return <article className="ops-order" key={o.id}>
      <div className="ops-order-top"><button className="ops-order-no" onClick={()=>setSelected(o)}>{o.order_number}</button><span className={`ops-status ${o.status}`}>{statusNames[o.status]||o.status}</span></div>
      <div className="ops-customer">{o.customer}</div>
      <div className="ops-muted">{o.items.map(i=>`${i.quantity}× ${i.name}${i.variant?` · ${i.variant}`:""}`).join(", ")}</div>
      <div className="ops-order-bottom"><span>{formatTimeWIB(o.created_at)} · {paymentLabel(o.payment_method,o.payment_status)}</span><b>{rupiah(o.total)}</b></div>
      <div className="ops-order-actions">
        <button className="ops-btn ops-btn-light" onClick={()=>setSelected(o)}>Detail</button>
        {o.next_status && !(o.payment_method==="qris"&&o.payment_status!=="paid") &&
          <button className="ops-btn ops-btn-primary" disabled={busyId===o.id} onClick={()=>changeStatus(o,o.next_status!)}>{STATUS_META[o.status]?.nextActionLabel||"Lanjutkan"}</button>}
      </div>
    </article>;
  }

  return <div className="ops-shell">
    <aside className="ops-sidebar">
      <Link href="/" className="ops-brand">mie<span>oke</span><i>.</i><small>PENGELOLA</small></Link>
      <div className="ops-nav-label">MENU</div>
      {nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={`ops-nav-item ${tab===item.id?"active":""}`} onClick={()=>setTab(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id==="pesanan"&&waiting.length>0&&<b>{waiting.length}</b>}</button>;})}
      <div className="ops-sidebar-bottom">
        <div className="ops-user"><div className="ops-avatar">{(email||"A").slice(0,1).toUpperCase()}</div><div><b>Admin Mie Oke</b><small>{email}</small></div></div>
        <Link href="/" className="ops-nav-item"><ExternalLink size={17}/><span>Lihat website</span></Link>
        <button className="ops-nav-item" onClick={()=>{clearAdminToken();router.replace("/admin/login");}}><LogOut size={17}/><span>Keluar</span></button>
      </div>
    </aside>

    <main className="ops-main">
      <header className="ops-topbar">
        <div><div className="ops-breadcrumb">MIE OKE <ChevronRight size={13}/> {title.toUpperCase()}</div><h1>{title}</h1></div>
        <div className="ops-top-actions"><span className="ops-live-dot">Terhubung</span><button className="ops-icon-btn" title="Muat ulang" onClick={()=>{loadMain();loadSales();loadReviewData();loadHistory();}}><RefreshCw size={17}/></button></div>
      </header>
      {error&&<div className="ops-alert">{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
      {notice&&<div className="ops-notice">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
      {loading?<div className="ops-loading">Memuat data...</div>:<>
        {tab==="ringkasan"&&<div className="ops-content">
          <div className="ops-welcome"><div><p>{new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}</p><h2>Selamat bekerja.</h2></div><button className="ops-btn ops-btn-primary" onClick={()=>setTab("pesanan")}>Buka pesanan <ChevronRight size={16}/></button></div>
          <div className="ops-stats">
            <div className="ops-stat"><span>Pesanan hari ini</span><b>{summary?.orders_today||0}</b><small>{summary?.completed_today||0} selesai</small></div>
            <div className="ops-stat attention"><span>Perlu konfirmasi</span><b>{waiting.length}</b><small>Pesanan baru masuk</small></div>
            <div className="ops-stat"><span>Sedang dikerjakan</span><b>{kitchen.length+delivery.length}</b><small>{kitchen.length} dapur · {delivery.length} diantar</small></div>
            <div className="ops-stat"><span>Menu terjual</span><b>{summary?.items_sold_today||0}</b><small>Item hari ini</small></div>
          </div>
          <div className="ops-overview-grid">
            <section className="ops-panel">
              <div className="ops-panel-head"><div><h3>Pesanan perlu ditangani</h3><p>Pesanan baru yang menunggu tindakan</p></div><button className="ops-text-btn" onClick={()=>setTab("pesanan")}>Semua pesanan <ChevronRight size={14}/></button></div>
              <div className="ops-list">
                {waiting.slice(0,5).map(o=><div className="ops-list-row" key={o.id}><div className="ops-order-symbol"><PackageCheck size={17}/></div><div className="ops-list-main"><b>{o.order_number} · {o.customer}</b><small>{o.items.map(i=>`${i.quantity}× ${i.name}`).join(", ")}</small></div><div className="ops-list-side"><b>{rupiah(o.total)}</b><button onClick={()=>setSelected(o)}>Buka</button></div></div>)}
                {waiting.length===0&&<div className="ops-empty">Tidak ada pesanan yang menunggu.</div>}
              </div>
            </section>
            <section className="ops-panel">
              <div className="ops-panel-head"><div><h3>Menu paling laris</h3><p>Jumlah terjual hari ini</p></div><button className="ops-text-btn" onClick={()=>setTab("penjualan")}>Lihat laporan <ChevronRight size={14}/></button></div>
              <div className="ops-top-menus">{topMenus.slice(0,5).map((m,i)=><div className="ops-rank-row" key={m.menu}><span>{i+1}</span><b>{m.menu}</b><strong>{m.quantity}</strong></div>)}{topMenus.length===0&&<div className="ops-empty">Belum ada penjualan tercatat.</div>}</div>
            </section>
          </div>
          <div className="ops-overview-grid">
            <section className="ops-panel">
              <div className="ops-panel-head"><div><h3>Ulasan pelanggan</h3><p>{summary?.sentiment.total||0} ulasan terkumpul</p></div><button className="ops-text-btn" onClick={()=>setTab("ulasan")}>Lihat semua <ChevronRight size={14}/></button></div>
              <div className="ops-sentiment"><div><span>Positif</span><b>{summary?.sentiment.positif||0}</b></div><div className="ops-sentiment-track"><i style={{width:`${summary?.sentiment.total?summary.sentiment.positif/summary.sentiment.total*100:0}%`}}/></div><div><span>Negatif</span><b>{summary?.sentiment.negatif||0}</b></div></div>
              <div className="ops-recent-review">{(summary?.latest_reviews||[]).slice(0,2).map(r=><div key={r.id}><span className={`ops-sentiment-tag ${r.sentiment}`}>{r.sentiment==="positif"?"Positif":"Negatif"}</span><p>{r.text}</p><small>{r.customer} · {r.order_number}</small></div>)}</div>
            </section>
            <section className="ops-panel ops-panel-dark"><div className="ops-panel-head"><div><h3>Ringkasan penjualan</h3><p>Item terjual hari ini</p></div></div><div className="ops-dark-number">{summary?.items_sold_today||0}<small> item</small></div><button className="ops-dark-link" onClick={()=>setTab("penjualan")}>Buka laporan penjualan <ChevronRight size={15}/></button></section>
          </div>
        </div>}

        {tab==="pesanan"&&<div className="ops-content">
          <div className="ops-page-intro"><div><h2>Antrean pesanan</h2><p>Perbarui pesanan sesuai tahap pengerjaan.</p></div><button className="ops-btn ops-btn-light" onClick={loadMain}><RefreshCw size={15}/> Perbarui</button></div>
          <div className="ops-board">
            <section><div className="ops-column-head"><span className="ops-column-dot orange"/><b>Pesanan masuk</b><em>{waiting.length}</em></div>{waiting.map(orderCard)}{waiting.length===0&&<div className="ops-column-empty">Kosong</div>}</section>
            <section><div className="ops-column-head"><span className="ops-column-dot yellow"/><b>Dapur</b><em>{kitchen.length}</em></div>{kitchen.map(orderCard)}{kitchen.length===0&&<div className="ops-column-empty">Kosong</div>}</section>
            <section><div className="ops-column-head"><span className="ops-column-dot green"/><b>Pengantaran</b><em>{delivery.length}</em></div>{delivery.map(orderCard)}{delivery.length===0&&<div className="ops-column-empty">Kosong</div>}</section>
          </div>
          <section className="ops-panel" style={{marginTop:20}}><div className="ops-panel-head"><div><h3>Selesai hari ini</h3><p>Pesanan yang sudah diterima pelanggan</p></div><span className="ops-count">{done.length}</span></div><div className="ops-done-list">{done.slice(0,8).map(o=><button key={o.id} onClick={()=>setSelected(o)}><span>{o.order_number}</span><b>{o.customer}</b><strong>{rupiah(o.total)}</strong><ChevronRight size={15}/></button>)}{done.length===0&&<div className="ops-empty">Belum ada pesanan selesai hari ini.</div>}</div></section>
        </div>}

        {tab==="menu"&&<div className="ops-content">
          <div className="ops-page-intro"><div><h2>Daftar menu</h2><p>{menus.length} menu · {menus.filter(m=>m.available!==false).length} tersedia</p></div><button className="ops-btn ops-btn-primary" onClick={newMenu}><Plus size={16}/> Tambah menu</button></div>
          <div className="ops-filter-row">{categories.map(c=><button key={c} className={menuFilter===c?"selected":""} onClick={()=>setMenuFilter(c)}>{c}</button>)}</div>
          <div className="ops-menu-grid">{filteredMenus.map(m=><article className="ops-menu-card" key={m.id}><div className="ops-menu-image">{m.image_url?<img src={m.image_url} alt={m.name}/>:<span>🍜</span>}<span className={`ops-availability ${m.available===false?"off":""}`}>{m.available===false?"Tidak tersedia":"Tersedia"}</span></div><div className="ops-menu-info"><small>{m.category||"Menu"}</small><h3>{m.name}</h3><p>{m.description||" "}</p><b>{rupiah(m.price)}</b><div className="ops-variants">{(m.variants||[]).map(v=><span key={v.name}>{v.name}{v.additional_price?` +${rupiah(v.additional_price)}`:""}</span>)}</div><div className="ops-menu-actions"><button onClick={()=>editMenu(m)}><Pencil size={14}/> Edit</button><button onClick={()=>toggleMenu(m)}>{m.available===false?<Eye size={14}/>:<EyeOff size={14}/>} {m.available===false?"Tampilkan":"Sembunyikan"}</button><button className="remove" onClick={()=>deleteMenu(m)}><Trash2 size={14}/></button></div></div></article>)}</div>
        </div>}

        {tab==="penjualan"&&<div className="ops-content">
          <div className="ops-page-intro"><div><h2>Penjualan menu</h2><p>Lihat jumlah menu yang terjual pada periode tertentu.</p></div><div className="ops-range">{[["today","Hari ini"],["7d","7 hari"],["30d","30 hari"],["all","Semua"],["custom","Pilih tanggal"]].map(([v,l])=><button key={v} className={salesRange===v?"selected":""} onClick={()=>setSalesRange(v)}>{l}</button>)}</div></div>
          {salesRange==="custom"&&<div className="ops-date-range"><label>Dari <input type="date" value={salesStart} onChange={e=>setSalesStart(e.target.value)}/></label><label>Sampai <input type="date" value={salesEnd} onChange={e=>setSalesEnd(e.target.value)}/></label></div>}
          <div className="ops-stats compact"><div className="ops-stat"><span>Total item terjual</span><b>{sales?.total_items||0}</b></div><div className="ops-stat"><span>Menu terjual</span><b>{sales?.items.length||0}</b></div><div className="ops-stat"><span>Pesanan</span><b>{sales?.total_orders||0}</b></div></div>
          <section className="ops-panel"><div className="ops-panel-head"><div><h3>Penjualan per menu</h3><p>Jumlah porsi terjual</p></div></div><div className="ops-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sales?.items||[]} margin={{top:8,right:15,left:0,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="#eee8dd"/><XAxis dataKey="menu" tick={{fontSize:12}}/><YAxis allowDecimals={false} tick={{fontSize:12}}/><Tooltip/><Bar dataKey="quantity" name="Terjual" fill="#b8321e" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section>
          <section className="ops-panel" style={{marginTop:18}}><div className="ops-panel-head"><div><h3>Rincian menu</h3></div></div><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Menu</th><th>Varian</th><th>Jumlah</th></tr></thead><tbody>{(sales?.items||[]).map(m=><tr key={m.menu}><td>{m.menu}</td><td>{m.variants.map(v=>`${v.variant}: ${v.quantity}`).join(" · ")}</td><td><b>{m.quantity}</b></td></tr>)}{(!sales?.items.length)&&<tr><td colSpan={3}>Belum ada data penjualan.</td></tr>}</tbody></table></div></section>
        </div>}

        {tab==="ulasan"&&<div className="ops-content">
          <div className="ops-page-intro"><div><h2>Ulasan pelanggan</h2><p>Masukan pelanggan setelah pesanan selesai.</p></div><div className="ops-range">{[["","Semua"],["positif","Positif"],["negatif","Negatif"]].map(([v,l])=><button key={v||"all"} className={reviewFilter===v?"selected":""} onClick={()=>{setReviewFilter(v);setReviewPage(1);}}>{l}</button>)}</div></div>
          <div className="ops-date-range"><label>Dari <input type="date" value={reviewStart} onChange={e=>{setReviewStart(e.target.value);setReviewPage(1);}}/></label><label>Sampai <input type="date" value={reviewEnd} onChange={e=>{setReviewEnd(e.target.value);setReviewPage(1);}}/></label></div>
          <div className="ops-stats compact"><div className="ops-stat"><span>Semua ulasan</span><b>{distribution?.total||0}</b></div><div className="ops-stat"><span>Positif</span><b className="positive">{distribution?.positif||0}</b></div><div className="ops-stat"><span>Negatif</span><b className="negative">{distribution?.negatif||0}</b></div></div>
          <section className="ops-panel"><div className="ops-panel-head"><div><h3>Daftar ulasan</h3><p>{reviews?.total||0} ulasan</p></div></div><div className="ops-review-list">{(reviews?.items||[]).map(r=><article key={r.id}><div className="ops-review-top"><b>{r.customer}</b><span className={`ops-sentiment-tag ${r.sentiment}`}>{r.sentiment==="positif"?"Positif":"Negatif"}</span></div><p>“{r.text}”</p><div className="ops-review-foot"><span>{r.order_number}</span><time>{formatDateTimeWIB(r.created_at)}</time></div></article>)}{(!reviews?.items.length)&&<div className="ops-empty">Belum ada ulasan.</div>}</div>
            <div className="ops-pagination"><button disabled={reviewPage<=1} onClick={()=>setReviewPage(p=>p-1)}>Sebelumnya</button><span>Halaman {reviewPage}</span><button disabled={!reviews||reviews.items.length<15} onClick={()=>setReviewPage(p=>p+1)}>Berikutnya</button></div>
          </section>
        </div>}

        {tab==="riwayat"&&<div className="ops-content">
          <div className="ops-page-intro"><div><h2>Riwayat pesanan</h2><p>Cari pesanan yang pernah masuk.</p></div></div>
          <section className="ops-panel"><div className="ops-history-filters"><div className="ops-search"><Search size={16}/><input placeholder="Cari nomor pesanan, nama, atau WhatsApp" value={historyQuery} onChange={e=>{setHistoryQuery(e.target.value);setHistoryPage(1);}} onKeyDown={e=>e.key==="Enter"&&loadHistory()}/></div><select value={historyStatus} onChange={e=>{setHistoryStatus(e.target.value);setHistoryPage(1);}}><option value="">Semua status</option>{statusOrder.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select><input type="date" value={historyStart} onChange={e=>{setHistoryStart(e.target.value);setHistoryPage(1);}}/><input type="date" value={historyEnd} onChange={e=>{setHistoryEnd(e.target.value);setHistoryPage(1);}}/><button className="ops-btn ops-btn-primary" onClick={loadHistory}>Cari</button></div>
            <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Pembayaran</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{(history?.items||[]).map(o=><tr key={o.id}><td><b>{o.order_number}</b><small>{formatDateTimeWIB(o.created_at)}</small></td><td>{o.customer}<small>{o.phone}</small></td><td>{paymentLabel(o.payment_method,o.payment_status)}</td><td><b>{rupiah(o.total)}</b></td><td><span className={`ops-status ${o.status}`}>{statusNames[o.status]||o.status}</span></td><td><button className="ops-text-btn" onClick={()=>setSelected(o)}>Detail</button></td></tr>)}{(!history?.items.length)&&<tr><td colSpan={6}>Tidak ada pesanan yang cocok.</td></tr>}</tbody></table></div>
            <div className="ops-pagination"><span>{history?.total||0} pesanan</span><div><button disabled={historyPage<=1} onClick={()=>setHistoryPage(p=>p-1)}>Sebelumnya</button><span>{historyPage}</span><button disabled={!history||history.items.length<15} onClick={()=>setHistoryPage(p=>p+1)}>Berikutnya</button></div></div>
          </section>
        </div>}
      </>}
    </main>

    {selected&&<div className="ops-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <aside className="ops-drawer">
        <div className="ops-drawer-head"><div><small>DETAIL PESANAN</small><h2>{selected.order_number}</h2></div><button className="ops-icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div>
        <div className="ops-drawer-body">
          <div className="ops-detail-status"><span className={`ops-status ${selected.status}`}>{statusNames[selected.status]||selected.status}</span><b>{rupiah(selected.total)}</b></div>
          <section><h3>Pelanggan</h3><p><b>{selected.customer}</b></p><p><Phone size={14}/> {selected.phone}</p><p><MapPin size={14}/> {selected.address}</p>{selected.maps_url&&<a className="ops-text-btn" href={selected.maps_url} target="_blank" rel="noreferrer">Buka titik tujuan <ExternalLink size={13}/></a>}</section>
          <section><h3>Pesanan</h3>{selected.items.map((it,i)=><div className="ops-line-item" key={i}><span>{it.quantity}× {it.name}{it.variant?` · ${it.variant}`:""}{it.note&&<small>Catatan: {it.note}</small>}</span><b>{rupiah(it.line_total)}</b></div>)}<div className="ops-line-total"><span>{paymentLabel(selected.payment_method,selected.payment_status)}</span><b>{rupiah(selected.total)}</b></div></section>
          {selected.status==="on_delivery"&&<section><div className="ops-section-head"><h3>Lokasi kurir</h3><span className={`ops-gps-state ${selected.courier_location?.is_live?"live":""}`}>{selected.courier_location?.is_live?"Aktif":selected.courier_location?"Lokasi terakhir":"Menunggu GPS"}</span></div><LiveTrackingMap storeLocation={selected.store_location||null} destinationLocation={selected.lat!==null&&selected.lng!==null?{lat:selected.lat,lng:selected.lng}:null} courierLocation={selected.courier_location||null} status={selected.status} height={250}/><p className="ops-hint">{gpsMessage|| (selected.courier_location?.updated_at?`Diperbarui ${formatTimeWIB(selected.courier_location.updated_at)}`:"Buka detail ini dari HP pengantar untuk membagikan lokasi.")}</p>{gpsOrder===selected.id?<button className="ops-btn ops-btn-danger full" onClick={()=>stopGps()}><Square size={15}/> Hentikan lokasi</button>:<button className="ops-btn ops-btn-primary full" onClick={()=>startGps(selected)}><Radio size={15}/> Mulai bagikan lokasi</button>}</section>}
          {selected.events?.length>0&&<section><h3>Perjalanan pesanan</h3><div className="ops-events">{selected.events.map((e,i)=><div key={i}><span className="ops-event-dot"/><div><b>{statusNames[e.status]||e.status}</b><small>{formatDateTimeWIB(e.at)}</small></div></div>)}</div></section>}
          {selected.review&&<section><div className="ops-section-head"><h3>Ulasan</h3><span className={`ops-sentiment-tag ${selected.review.sentiment}`}>{selected.review.sentiment==="positif"?"Positif":"Negatif"}</span></div><p>“{selected.review.text}”</p></section>}
          <section className="ops-drawer-actions">
            {selected.next_status&&!(selected.payment_method==="qris"&&selected.payment_status!=="paid")&&<button className="ops-btn ops-btn-primary full" disabled={busyId===selected.id} onClick={()=>changeStatus(selected,selected.next_status!)}>{STATUS_META[selected.status]?.nextActionLabel||"Lanjutkan pesanan"}</button>}
            {selected.status==="on_delivery"&&<a className="ops-btn ops-btn-wa full" href={waDeliveryTemplate(selected)} target="_blank" rel="noreferrer">Kirim info pengantaran via WhatsApp</a>}
            {selected.status==="completed"&&<a className="ops-btn ops-btn-wa full" href={waReviewTemplate(selected)} target="_blank" rel="noreferrer">Kirim ucapan & minta ulasan</a>}
            {selected.can_cancel&&<button className="ops-btn ops-btn-light full" onClick={()=>changeStatus(selected,"cancelled")}>Batalkan pesanan</button>}
          </section>
        </div>
      </aside>
    </div>}

    {menuModal&&<div className="ops-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuModal(false);}}><form className="ops-modal" onSubmit={saveMenu}>
      <div className="ops-drawer-head"><div><small>MENU MIE OKE</small><h2>{editing?"Edit menu":"Tambah menu"}</h2></div><button type="button" className="ops-icon-btn" onClick={()=>setMenuModal(false)}><X size={18}/></button></div>
      <div className="ops-modal-body">
        <label>Nama menu<input required value={menuName} onChange={e=>setMenuName(e.target.value)} placeholder="Contoh: Mie Oke Original"/></label>
        <div className="ops-form-grid"><label>Kategori<select value={menuCategory} onChange={e=>setMenuCategory(e.target.value)}>{["Mie","Minuman","Tambahan","Paket","Lainnya"].map(x=><option key={x}>{x}</option>)}</select></label><label>Harga dasar<input required type="number" min="500" value={menuPrice} onChange={e=>setMenuPrice(e.target.value)}/></label></div>
        <label>Deskripsi<input value={menuDesc} onChange={e=>setMenuDesc(e.target.value)} placeholder="Deskripsi singkat menu"/></label>
        <label>URL foto menu<input value={menuImage} onChange={e=>setMenuImage(e.target.value)} placeholder="https://..."/></label>
        <div className="ops-modal-subhead"><b>Varian</b><button type="button" className="ops-text-btn" onClick={()=>setMenuVariants(v=>[...v,{name:"",additional_price:0}])}><Plus size={14}/> Tambah varian</button></div>
        {menuVariants.map((v,i)=><div className="ops-form-grid variant" key={i}><input value={v.name} onChange={e=>setMenuVariants(old=>old.map((x,j)=>i===j?{...x,name:e.target.value}:x))} placeholder="Nama varian"/><input type="number" min="0" value={v.additional_price} onChange={e=>setMenuVariants(old=>old.map((x,j)=>i===j?{...x,additional_price:Number(e.target.value)}:x))} placeholder="Tambahan harga"/><button type="button" onClick={()=>setMenuVariants(old=>old.filter((_,j)=>i!==j))}>Hapus</button></div>)}
        <label className="ops-check"><input type="checkbox" checked={menuAvailable} onChange={e=>setMenuAvailable(e.target.checked)}/> Tampilkan menu di katalog</label>
      </div>
      <div className="ops-modal-foot"><button type="button" className="ops-btn ops-btn-light" onClick={()=>setMenuModal(false)}>Batal</button><button className="ops-btn ops-btn-primary" disabled={menuBusy}>{menuBusy?"Menyimpan...":"Simpan menu"}</button></div>
    </form></div>}
  </div>;
}
