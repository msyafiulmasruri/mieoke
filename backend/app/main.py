import re, html, math, secrets
from datetime import datetime, timedelta, date, time
from pathlib import Path
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

import joblib
from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, or_, text as sql_text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session, selectinload
from jose import jwt
from passlib.context import CryptContext
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from groq import Groq

BASE_DIR = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore", protected_namespaces=("settings_",))

    app_env: str = "development"
    store_name: str = "Mie Oke"
    store_lat: float = -7.2655
    store_lng: float = 112.7485
    database_url: str
    jwt_secret_key: str
    jwt_expire_minutes: int = 720
    cors_origins: str = "http://localhost:3000"
    admin_email: str = "admin@mieoke.local"
    admin_password: str = "change-me"
    public_base_url: str = "http://localhost:3000"
    whatsapp_business_number: str = ""
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_temperature: float = 0.3
    groq_max_tokens: int = 1024
    payment_mode: str = "mock"
    doku_client_id: str = ""
    doku_secret_key: str = ""
    doku_base_url: str = ""
    doku_qris_create_path: str = ""
    doku_callback_url: str = ""
    doku_return_url: str = ""
    model_path: str = "models/model_sentimen_mie_oke.joblib"
    preprocess_config_path: str = "models/konfigurasi_preprocessing_mie_oke.json"


settings = Settings()
engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

WIB = ZoneInfo("Asia/Jakarta")
UTC = ZoneInfo("UTC")

# Alur status pesanan (satu arah). Template WhatsApp dikirim admin di tahap on_delivery dan completed.
NEXT_STATUS = {
    "waiting_confirmation": "confirmed",
    "confirmed": "preparing",
    "preparing": "on_delivery",
    "on_delivery": "completed",
}
CANCELLABLE = {"awaiting_payment", "waiting_confirmation", "confirmed", "preparing"}
ACTIVE_STATUSES = ("awaiting_payment", "waiting_confirmation", "confirmed", "preparing", "on_delivery")
# Porsi dianggap terjual setelah pesanan dikonfirmasi admin.
SOLD_STATUSES = ("confirmed", "preparing", "on_delivery", "completed")
ALL_STATUSES = set(ACTIVE_STATUSES) | {"completed", "cancelled"}


# ---------------------------------------------------------------------------
# Model database
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


class Admin(Base):
    __tablename__ = "admins"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Menu(Base):
    __tablename__ = "menus"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(40), default="Mie")
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str] = mapped_column(Text, default="")
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    variants: Mapped[list] = mapped_column(JSON, default=list)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    token: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    customer: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(25))
    address: Mapped[str] = mapped_column(Text)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    courier_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    courier_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    courier_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    courier_location_source: Mapped[str] = mapped_column(String(20), default="none")
    courier_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    subtotal: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    payment_method: Mapped[str] = mapped_column(String(20))
    payment_status: Mapped[str] = mapped_column(String(20))
    payment_url: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    items: Mapped[list["OrderLine"]] = relationship(back_populates="order", cascade="all,delete-orphan")
    events: Mapped[list["OrderEvent"]] = relationship(
        back_populates="order", cascade="all,delete-orphan", order_by="OrderEvent.created_at"
    )
    review: Mapped[Optional["Review"]] = relationship(back_populates="order", uselist=False)


class OrderLine(Base):
    __tablename__ = "order_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    menu_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    menu_name: Mapped[str] = mapped_column(String(160))
    variant: Mapped[str] = mapped_column(String(100), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)
    line_total: Mapped[int] = mapped_column(Integer)
    order: Mapped[Order] = relationship(back_populates="items")


class OrderEvent(Base):
    """Riwayat perubahan status; dipakai untuk linimasa tracking pelanggan."""
    __tablename__ = "order_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    order: Mapped[Order] = relationship(back_populates="events")


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    text: Mapped[str] = mapped_column(Text)
    sentiment: Mapped[str] = mapped_column(String(20), index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    order: Mapped[Order] = relationship(back_populates="review")


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def iso(dt: Optional[datetime]) -> Optional[str]:
    """Waktu disimpan sebagai UTC naive; dikirim ke frontend dengan akhiran Z."""
    return dt.replace(microsecond=0).isoformat() + "Z" if dt else None


def today_wib() -> date:
    return datetime.now(WIB).date()


def wib_day_start_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=WIB).astimezone(UTC).replace(tzinfo=None)


def to_wib_date(dt: datetime) -> date:
    return dt.replace(tzinfo=UTC).astimezone(WIB).date()


def apply_date_range(query, column, start: Optional[date], end: Optional[date]):
    if start:
        query = query.filter(column >= wib_day_start_utc(start))
    if end:
        query = query.filter(column < wib_day_start_utc(end + timedelta(days=1)))
    return query


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    if not digits.startswith("62") or not 10 <= len(digits) <= 15:
        raise HTTPException(422, "Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx.")
    return digits


def first_name(name: str) -> str:
    return (name or "").strip().split(" ")[0]


def tracking_url(o: Order) -> str:
    return f"{settings.public_base_url}/track/{o.token}"


def add_event(db: Session, o: Order, status: str):
    o.status = status
    o.updated_at = datetime.utcnow()
    db.add(OrderEvent(order_id=o.id, status=status))


def serialize_items(o: Order):
    return [
        {
            "name": i.menu_name,
            "variant": i.variant,
            "note": i.note,
            "quantity": i.quantity,
            "unit_price": i.unit_price,
            "line_total": i.line_total,
        }
        for i in o.items
    ]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Jarak garis lurus (Haversine) dalam kilometer."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return r * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def serialize_public(o: Order) -> dict:
    """Data untuk halaman tracking pelanggan; dilengkapi titik GPS kurir & tujuan (tanpa teks alamat/nomor WA)."""
    store_loc = {"lat": settings.store_lat, "lng": settings.store_lng, "name": settings.store_name}
    dest_loc = {"lat": o.lat, "lng": o.lng} if o.lat is not None and o.lng is not None else None
    courier_loc = None
    if (
        o.courier_location_source == "gps"
        and o.courier_lat is not None
        and o.courier_lng is not None
    ):
        age_seconds = None
        if o.courier_updated_at:
            age_seconds = max(0, (datetime.utcnow() - o.courier_updated_at).total_seconds())
        is_live = o.status == "on_delivery" and age_seconds is not None and age_seconds <= 45
        courier_loc = {
            "lat": o.courier_lat,
            "lng": o.courier_lng,
            "updated_at": iso(o.courier_updated_at),
            "accuracy_m": o.courier_accuracy,
            "is_live": is_live,
        }

    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    if dest_loc and o.status in ("waiting_confirmation", "confirmed", "preparing"):
        raw_dist = haversine_km(store_loc["lat"], store_loc["lng"], dest_loc["lat"], dest_loc["lng"])
        distance_km = round(raw_dist * 1.25, 2)
        eta_minutes = 12 + max(2, int(round(distance_km / 0.4)))
    elif dest_loc and courier_loc and courier_loc["is_live"]:
        raw_dist = haversine_km(courier_loc["lat"], courier_loc["lng"], dest_loc["lat"], dest_loc["lng"])
        distance_km = round(raw_dist * 1.25, 2)
        eta_minutes = max(1, int(round(distance_km / 0.4)))
    elif o.status == "completed":
        eta_minutes = 0

    return {
        "order_number": o.number,
        "customer_first_name": first_name(o.customer),
        "status": o.status,
        "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "subtotal": o.subtotal,
        "total": o.total,
        "created_at": iso(o.created_at),
        "items": serialize_items(o),
        "events": [{"status": e.status, "at": iso(e.created_at)} for e in o.events],
        "review_submitted": o.review is not None,
        "review_text": o.review.text if o.review else None,
        "store_location": store_loc,
        "destination_location": dest_loc,
        "courier_location": courier_loc,
        "distance_km": distance_km,
        "eta_minutes": eta_minutes,
    }


def serialize_admin(o: Order) -> dict:
    d = serialize_public(o)
    d.update(
        {
            "id": o.id,
            "customer": o.customer,
            "phone": o.phone,
            "address": o.address,
            "lat": o.lat,
            "lng": o.lng,
            "maps_url": f"https://www.google.com/maps?q={o.lat},{o.lng}" if o.lat is not None and o.lng is not None else None,
            "tracking_url": tracking_url(o),
            "updated_at": iso(o.updated_at),
            "next_status": NEXT_STATUS.get(o.status),
            "can_cancel": o.status in CANCELLABLE,
            "review": {"text": o.review.text, "sentiment": o.review.sentiment, "created_at": iso(o.review.created_at)}
            if o.review
            else None,
        }
    )
    return d


def order_query(db: Session):
    return db.query(Order).options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.review))


# ---------------------------------------------------------------------------
# Autentikasi admin
# ---------------------------------------------------------------------------
def token_for(email: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": email, "exp": exp}, settings.jwt_secret_key, algorithm="HS256")


def admin_required(authorization: str = Header(default=""), db: Session = Depends(db_session)) -> Admin:
    email = None
    if authorization.startswith("Bearer "):
        try:
            email = jwt.decode(authorization[7:], settings.jwt_secret_key, algorithms=["HS256"]).get("sub")
        except Exception:
            email = None
    admin = db.query(Admin).filter_by(email=email).first() if email else None
    if not admin:
        raise HTTPException(401, "Sesi admin berakhir. Silakan masuk kembali.")
    return admin


# ---------------------------------------------------------------------------
# Model sentimen (SVM) — preprocessing identik dengan notebook training
# ---------------------------------------------------------------------------
@lru_cache
def sentiment_assets():
    mp = Path(settings.model_path)
    if not mp.is_absolute():
        mp = BASE_DIR / mp
    bundle = joblib.load(mp)
    return bundle, StemmerFactory().create_stemmer()


def preprocess(text: str) -> str:
    bundle, stemmer = sentiment_assets()
    slang = bundle["slang_dict"]
    stop = set(bundle["stop_words"])
    value = str(text)
    for step in bundle["preprocessing_order"]:
        if step == "clean_text":
            value = html.unescape(value)
            value = re.sub(r"<.*?>", " ", value)
            value = re.sub(r"https?://\S+|www\.\S+", " ", value)
            value = re.sub(r"\S+@\S+", " ", value)
            value = re.sub(r"@\w+", " ", value)
            value = value.replace("#", " ")
            value = re.sub(r"([A-Za-z])\1{2,}", r"\1", value)
            value = re.sub(r"[^A-Za-z\s]", " ", value)
            value = re.sub(r"\s+", " ", value).strip()
        elif step == "case_folding":
            value = value.lower()
        elif step == "normalisasi_slang":
            value = " ".join(slang.get(w, w) for w in value.split())
        elif step == "stopword_removal":
            value = " ".join(w for w in value.split() if w not in stop)
        elif step == "stemming":
            value = stemmer.stem(value)
    return value


def predict(text: str):
    processed = preprocess(text)
    if not processed.strip():
        return None, None
    pipe = sentiment_assets()[0]["pipeline"]
    label = str(pipe.predict([processed])[0])
    try:
        score = float(abs(pipe.decision_function([processed])[0]))
    except Exception:
        score = None
    return label, score


# ---------------------------------------------------------------------------
# Skema request
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: str
    password: str


class ItemInput(BaseModel):
    menu_id: int
    quantity: int = Field(ge=1, le=30)
    variant: str = ""
    note: str = Field(default="", max_length=200)


class CheckoutInput(BaseModel):
    customer: str = Field(min_length=2, max_length=150)
    phone: str
    address: str = Field(min_length=8, max_length=500)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    payment_method: str
    items: list[ItemInput] = Field(min_length=1, max_length=30)


class ReviewInput(BaseModel):
    text: str = Field(min_length=5, max_length=1500)


class StatusInput(BaseModel):
    status: str


class CourierLocationInput(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: Optional[float] = Field(default=None, ge=0, le=10000)


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=600)
    history: list[dict] = []


class MenuVariantInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    additional_price: int = Field(default=0, ge=0, le=500000)


class MenuInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(default="Makanan", min_length=1, max_length=40)
    description: str = Field(default="", max_length=600)
    price: int = Field(ge=500, le=1000000)
    image_url: str = Field(default="", max_length=1000)
    available: bool = True
    sort_order: int = Field(default=0, ge=-1000, le=10000)
    variants: list[MenuVariantInput] = Field(default_factory=list, max_length=25)


class MenuAvailabilityInput(BaseModel):
    available: bool


def serialize_menu(m: Menu) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "category": m.category,
        "description": m.description,
        "price": m.price,
        "image_url": m.image_url or None,
        "available": bool(m.available),
        "sort_order": m.sort_order,
        "variants": m.variants or [],
    }


def normalize_variants(raw_variants: list[MenuVariantInput]) -> list[dict]:
    cleaned: list[dict] = []
    seen: set[str] = set()
    for v in raw_variants:
        name = v.name.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({"name": name, "additional_price": int(v.additional_price or 0)})
    return cleaned


class MenuVariantInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    additional_price: int = Field(default=0, ge=0, le=500000)


class MenuInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(default="Makanan", min_length=1, max_length=40)
    description: str = Field(default="", max_length=600)
    price: int = Field(ge=500, le=1000000)
    image_url: str = Field(default="", max_length=1000)
    available: bool = True
    sort_order: int = Field(default=0, ge=-1000, le=10000)
    variants: list[MenuVariantInput] = Field(default_factory=list, max_length=25)


class MenuAvailabilityInput(BaseModel):
    available: bool


def serialize_menu(m: Menu) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "category": m.category,
        "description": m.description,
        "price": m.price,
        "image_url": m.image_url or None,
        "available": bool(m.available),
        "sort_order": m.sort_order,
        "variants": m.variants or [],
    }


def normalize_variants(raw_variants: list[MenuVariantInput]) -> list[dict]:
    cleaned: list[dict] = []
    seen: set[str] = set()
    for v in raw_variants:
        name = v.name.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({"name": name, "additional_price": int(v.additional_price or 0)})
    return cleaned


# ---------------------------------------------------------------------------
# Aplikasi
# ---------------------------------------------------------------------------
app = FastAPI(title="Mie Oke API", version="1.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SEED_MENUS = [
    dict(name="Mie Oke Original", category="Mie", sort_order=1, price=15000,
         description="Mie dengan bumbu khas Mie Oke. Pilih level pedas sesuai selera.",
         variants=[{"name": "Tidak pedas", "additional_price": 0}, {"name": "Pedas sedang", "additional_price": 0}, {"name": "Pedas", "additional_price": 0}]),
    dict(name="Mie Oke Jumbo", category="Mie", sort_order=2, price=20000,
         description="Porsi lebih besar untuk yang benar-benar lapar.",
         variants=[{"name": "Tidak pedas", "additional_price": 0}, {"name": "Pedas sedang", "additional_price": 0}, {"name": "Pedas", "additional_price": 0}]),
    dict(name="Es Teh Manis", category="Minuman", sort_order=10, price=5000,
         description="Teh manis segar.",
         variants=[{"name": "Dingin", "additional_price": 0}, {"name": "Hangat", "additional_price": 0}]),
]


@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for col_sql in (
            "ALTER TABLE menus ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_lat DOUBLE PRECISION",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_lng DOUBLE PRECISION",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_updated_at TIMESTAMP",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_location_source VARCHAR(20) NOT NULL DEFAULT 'none'",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_accuracy DOUBLE PRECISION",
            "UPDATE orders SET courier_location_source = 'legacy' WHERE courier_lat IS NOT NULL AND courier_location_source = 'none'",
        ):
            conn.execute(sql_text(col_sql))
    db = SessionLocal()
    try:
        if not db.query(Admin).filter_by(email=settings.admin_email.lower()).first():
            db.add(Admin(email=settings.admin_email.lower(), password_hash=pwd.hash(settings.admin_password)))
        if db.query(Menu).count() == 0:
            db.add_all([Menu(**m) for m in SEED_MENUS])
        db.commit()
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


# ----- Publik ---------------------------------------------------------------
@app.get("/api/v1/config")
def public_config():
    return {
        "store_name": settings.store_name,
        "store_lat": settings.store_lat,
        "store_lng": settings.store_lng,
        "whatsapp_number": settings.whatsapp_business_number,
        "payment_mode": settings.payment_mode,
        "assistant_enabled": bool(settings.groq_api_key),
    }


@app.get("/api/v1/menus")
def menus(db: Session = Depends(db_session)):
    rows = db.query(Menu).filter_by(available=True).order_by(Menu.sort_order, Menu.id).all()
    return [serialize_menu(m) for m in rows]


@app.post("/api/v1/orders")
def checkout(p: CheckoutInput, db: Session = Depends(db_session)):
    if p.payment_method not in ("qris", "cod"):
        raise HTTPException(422, "Metode pembayaran tidak valid.")
    phone = normalize_phone(p.phone)

    subtotal, lines = 0, []
    for x in p.items:
        m = db.get(Menu, x.menu_id)
        if not m or not m.available:
            raise HTTPException(409, "Ada menu yang sudah tidak tersedia. Muat ulang halaman menu.")
        variant = None
        if x.variant:
            variant = next((v for v in (m.variants or []) if v.get("name") == x.variant), None)
            if not variant:
                raise HTTPException(422, f"Varian untuk {m.name} tidak valid.")
        price = m.price + (int(variant.get("additional_price", 0)) if variant else 0)
        subtotal += price * x.quantity
        lines.append((m, x, price))

    is_qris = p.payment_method == "qris"
    if is_qris and settings.payment_mode == "doku":
        raise HTTPException(501, "Pembayaran QRIS DOKU belum diaktifkan. Silakan pilih COD.")

    o = Order(
        number="MOK-" + datetime.now(WIB).strftime("%y%m%d") + "-" + secrets.token_hex(2).upper(),
        token=secrets.token_urlsafe(24),
        customer=p.customer.strip(),
        phone=phone,
        address=p.address.strip(),
        lat=p.lat,
        lng=p.lng,
        subtotal=subtotal,
        total=subtotal,
        payment_method=p.payment_method,
        payment_status="pending" if is_qris else "cod_due",
        status="awaiting_payment" if is_qris else "waiting_confirmation",
    )
    db.add(o)
    db.flush()
    for m, x, price in lines:
        db.add(OrderLine(order_id=o.id, menu_id=m.id, menu_name=m.name, variant=x.variant, note=x.note.strip(),
                         quantity=x.quantity, unit_price=price, line_total=price * x.quantity))
    db.add(OrderEvent(order_id=o.id, status=o.status))
    if is_qris:
        o.payment_url = f"{settings.public_base_url}/bayar/{o.token}"
    db.commit()
    return {"order_number": o.number, "token": o.token, "status": o.status, "payment_url": o.payment_url or None}


@app.get("/api/v1/orders/track/{token}")
def track(token: str, db: Session = Depends(db_session)):
    o = order_query(db).filter(Order.token == token).first()
    if not o:
        raise HTTPException(404, "Link pesanan tidak ditemukan. Pastikan link yang dibuka sudah lengkap.")
    return serialize_public(o)


@app.post("/api/v1/reviews/{token}")
def submit_review(token: str, p: ReviewInput, db: Session = Depends(db_session)):
    o = order_query(db).filter(Order.token == token).first()
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    if o.status != "completed":
        raise HTTPException(409, "Ulasan bisa dikirim setelah pesanan selesai.")
    if o.review:
        raise HTTPException(409, "Ulasan untuk pesanan ini sudah dikirim.")
    try:
        label, score = predict(p.text)
    except Exception as e:
        raise HTTPException(503, f"Model sentimen belum siap: {e}")
    if label is None:
        raise HTTPException(422, "Ulasan terlalu singkat untuk dibaca. Tambahkan sedikit cerita tentang rasa, porsi, atau pengantaran.")
    db.add(Review(order_id=o.id, text=p.text.strip(), sentiment=label, score=score))
    db.commit()
    return {"message": "Ulasan tersimpan. Terima kasih!"}


CHAT_PROMPT = """Kamu adalah asisten layanan pelanggan {store} di website pemesanan Mie Oke.

Gaya menjawab:
- Gunakan bahasa Indonesia sehari-hari yang sopan, ringan, dan mudah dipahami.
- Jawab langsung pada inti pertanyaan. Umumnya cukup 1–3 kalimat pendek.
- Bahas satu hal terlebih dahulu. Jangan mengirim panduan panjang atau semua tahapan sekaligus kecuali pelanggan memang memintanya.
- Hindari pembuka seperti "Berikut adalah..." dan hindari paragraf panjang.
- Jika ada beberapa pilihan, sebutkan maksimal 2–3 pilihan secara ringkas.
- Akhiri dengan satu pertanyaan singkat hanya jika memang membantu percakapan.
- Jangan gunakan tabel, judul berlebihan, atau penomoran panjang.
- Jangan mengulang informasi yang sudah dijelaskan sebelumnya.

Aturan informasi:
- Hanya gunakan data menu di bawah. Jangan mengarang menu, harga, promo, jam buka, ongkir, atau area antar.
- Jika ditanya hal yang tidak tersedia di data, arahkan pelanggan menghubungi admin lewat WhatsApp{wa}.
- Jangan meminta PIN, OTP, kata sandi, atau informasi pembayaran rahasia.
- Jangan meminta data pribadi yang tidak diperlukan.

Panduan pemesanan:
- Pelanggan memilih menu dan varian, lalu mengisi nama, WhatsApp, alamat, dan titik tujuan.
- Pembayaran tersedia melalui QRIS atau COD.
- QRIS diproses setelah pembayaran terverifikasi. COD menunggu konfirmasi admin.
- Pelanggan dapat membuka tautan tracking untuk melihat status pesanan.
- Setelah pesanan selesai, pelanggan dapat mengirim ulasan melalui tautan yang sama.

Menu yang tersedia:
{menu}"""


@app.post("/api/v1/chat")
def chat(p: ChatInput, db: Session = Depends(db_session)):
    if not settings.groq_api_key:
        return {"reply": "Asisten belum aktif. Silakan hubungi admin Mie Oke lewat WhatsApp."}
    rows = db.query(Menu).filter_by(available=True).order_by(Menu.sort_order).all()
    menu_text = "\n".join(
        f"- {m.name} ({m.category}) Rp{m.price:,}".replace(",", ".")
        + (f", varian: {', '.join(v['name'] for v in (m.variants or []))}" if m.variants else "")
        + (f". {m.description}" if m.description else "")
        for m in rows
    ) or "- (menu belum diisi)"
    wa = f" (nomor {settings.whatsapp_business_number})" if settings.whatsapp_business_number else ""
    messages = [{"role": "system", "content": CHAT_PROMPT.format(store=settings.store_name, wa=wa, menu=menu_text)}]
    for x in p.history[-8:]:
        if x.get("role") in ("user", "assistant") and isinstance(x.get("content"), str):
            messages.append({"role": x["role"], "content": x["content"][:1200]})
    messages.append({"role": "user", "content": p.message})

    client = Groq(api_key=settings.groq_api_key)
    candidates = [settings.groq_model] + [m for m in ("openai/gpt-oss-120b", "qwen/qwen3.8-27b") if m != settings.groq_model]
    for model in candidates:
        try:
            extra = {"reasoning_effort": "low", "include_reasoning": False} if model.startswith("openai/gpt-oss") else {}
            out = client.chat.completions.create(
                model=model, messages=messages, temperature=settings.groq_temperature,
                max_tokens=settings.groq_max_tokens, extra_body=extra or None,
            )
            content = re.sub(r"<think>.*?</think>", "", out.choices[0].message.content or "", flags=re.S).strip()
            if content:
                return {"reply": content}
        except Exception:
            continue
    raise HTTPException(502, "Asisten sedang sibuk. Coba lagi sebentar atau hubungi admin lewat WhatsApp.")


# ----- Pembayaran ----------------------------------------------------------
@app.post("/api/v1/payments/mock/confirm/{token}")
def mock_confirm(token: str, db: Session = Depends(db_session)):
    if settings.payment_mode != "mock":
        raise HTTPException(404, "Tidak tersedia.")
    o = db.query(Order).filter_by(token=token).first()
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    if o.status != "awaiting_payment":
        raise HTTPException(409, "Pesanan ini tidak sedang menunggu pembayaran.")
    o.payment_status = "paid"
    add_event(db, o, "waiting_confirmation")
    db.commit()
    return {"message": "Pembayaran simulasi berhasil (khusus development)."}


@app.post("/api/v1/payments/doku/callback")
def doku_callback():
    # Implementasikan verifikasi signature dan mapping status sesuai kontrak resmi DOKU sebelum digunakan.
    raise HTTPException(501, "Callback DOKU belum diaktifkan. Status paid tidak boleh dipercaya dari redirect browser.")


# ----- Admin ----------------------------------------------------------------
@app.post("/api/v1/auth/login")
def login(p: LoginInput, db: Session = Depends(db_session)):
    a = db.query(Admin).filter_by(email=p.email.strip().lower()).first()
    if not a or not pwd.verify(p.password, a.password_hash):
        raise HTTPException(401, "Email atau password salah.")
    return {"access_token": token_for(a.email), "token_type": "bearer", "email": a.email}


@app.get("/api/v1/auth/me")
def me(a: Admin = Depends(admin_required)):
    return {"email": a.email}


# ----- Admin: Kelola Menu (Tanpa Stok) --------------------------------------
@app.get("/api/v1/admin/menus")
def admin_list_menus(db: Session = Depends(db_session), a=Depends(admin_required)):
    rows = db.query(Menu).order_by(Menu.sort_order, Menu.id).all()
    return [serialize_menu(m) for m in rows]


@app.post("/api/v1/admin/menus")
def admin_create_menu(p: MenuInput, db: Session = Depends(db_session), a=Depends(admin_required)):
    m = Menu(
        name=p.name.strip(),
        category=p.category.strip() or "Makanan",
        description=p.description.strip(),
        price=p.price,
        image_url=p.image_url.strip(),
        available=p.available,
        sort_order=p.sort_order,
        variants=normalize_variants(p.variants),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return serialize_menu(m)


@app.put("/api/v1/admin/menus/{mid}")
def admin_update_menu(mid: int, p: MenuInput, db: Session = Depends(db_session), a=Depends(admin_required)):
    m = db.get(Menu, mid)
    if not m:
        raise HTTPException(404, "Menu tidak ditemukan.")
    m.name = p.name.strip()
    m.category = p.category.strip() or "Makanan"
    m.description = p.description.strip()
    m.price = p.price
    m.image_url = p.image_url.strip()
    m.available = p.available
    m.sort_order = p.sort_order
    m.variants = normalize_variants(p.variants)
    db.commit()
    db.refresh(m)
    return serialize_menu(m)


@app.patch("/api/v1/admin/menus/{mid}/availability")
def admin_toggle_menu_availability(
    mid: int, p: MenuAvailabilityInput, db: Session = Depends(db_session), a=Depends(admin_required)
):
    m = db.get(Menu, mid)
    if not m:
        raise HTTPException(404, "Menu tidak ditemukan.")
    m.available = p.available
    db.commit()
    db.refresh(m)
    return serialize_menu(m)


@app.delete("/api/v1/admin/menus/{mid}")
def admin_delete_menu(mid: int, db: Session = Depends(db_session), a=Depends(admin_required)):
    m = db.get(Menu, mid)
    if not m:
        raise HTTPException(404, "Menu tidak ditemukan.")
    # Lepas referensi menu_id pada order_lines lama (nama & harga sudah tersimpan di order_lines)
    db.query(OrderLine).filter(OrderLine.menu_id == mid).update({OrderLine.menu_id: None}, synchronize_session=False)
    db.delete(m)
    db.commit()
    return {"message": f"Menu '{m.name}' berhasil dihapus."}


@app.get("/api/v1/admin/orders/active")
def admin_active_orders(db: Session = Depends(db_session), a=Depends(admin_required)):
    """Pesanan yang masih berjalan + pesanan selesai hari ini (untuk kirim ucapan terima kasih)."""
    today_start = wib_day_start_utc(today_wib())
    rows = (
        order_query(db)
        .filter(or_(Order.status.in_(ACTIVE_STATUSES), (Order.status == "completed") & (Order.updated_at >= today_start)))
        .order_by(Order.created_at.asc())
        .all()
    )
    return [serialize_admin(o) for o in rows]


@app.get("/api/v1/admin/orders")
def admin_orders(
    q: str = "",
    status: str = "",
    start: Optional[date] = None,
    end: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(db_session),
    a=Depends(admin_required),
):
    query = order_query(db)
    if status:
        query = query.filter(Order.status == status)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Order.number.ilike(like), Order.customer.ilike(like), Order.phone.ilike(like)))
    query = apply_date_range(query, Order.created_at, start, end)
    total = query.count()
    rows = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [serialize_admin(o) for o in rows], "total": total, "page": page, "page_size": page_size}


@app.get("/api/v1/admin/orders/{oid}")
def admin_order_detail(oid: int, db: Session = Depends(db_session), a=Depends(admin_required)):
    o = order_query(db).filter(Order.id == oid).first()
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    return serialize_admin(o)


@app.patch("/api/v1/admin/orders/{oid}/status")
def update_status(oid: int, p: StatusInput, db: Session = Depends(db_session), a=Depends(admin_required)):
    o = order_query(db).filter(Order.id == oid).first()
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    if p.status == "cancelled":
        if o.status not in CANCELLABLE:
            raise HTTPException(409, "Pesanan pada tahap ini tidak bisa dibatalkan.")
    else:
        if NEXT_STATUS.get(o.status) != p.status:
            raise HTTPException(409, "Status sudah berubah. Muat ulang daftar pesanan.")
        if o.payment_method == "qris" and o.payment_status != "paid":
            raise HTTPException(409, "Pembayaran QRIS belum terverifikasi.")
    if p.status == "on_delivery":
        # Jangan tampilkan titik outlet sebagai posisi kurir. Tunggu GPS asli dari perangkat pengantar.
        o.courier_lat = None
        o.courier_lng = None
        o.courier_updated_at = None
        o.courier_accuracy = None
        o.courier_location_source = "none"
    add_event(db, o, p.status)
    db.commit()
    db.refresh(o)
    return serialize_admin(o)


@app.patch("/api/v1/admin/orders/{oid}/location")
def update_courier_location(oid: int, p: CourierLocationInput, db: Session = Depends(db_session), a=Depends(admin_required)):
    o = order_query(db).filter(Order.id == oid).first()
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    if o.status != "on_delivery":
        raise HTTPException(409, "Lokasi hanya dapat dibagikan saat pesanan dalam pengantaran.")
    o.courier_lat = p.lat
    o.courier_lng = p.lng
    o.courier_accuracy = p.accuracy_m
    o.courier_location_source = "gps"
    o.courier_updated_at = datetime.utcnow()
    o.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return serialize_admin(o)


def sold_lines(db: Session, start: Optional[date], end: Optional[date]):
    query = (
        db.query(OrderLine.menu_name, OrderLine.variant, OrderLine.quantity, Order.created_at, Order.id)
        .join(Order)
        .filter(Order.status.in_(SOLD_STATUSES))
    )
    return apply_date_range(query, Order.created_at, start, end).all()


@app.get("/api/v1/admin/analytics/sales")
def sales(start: Optional[date] = None, end: Optional[date] = None, db: Session = Depends(db_session), a=Depends(admin_required)):
    rows = sold_lines(db, start, end)
    per_menu: dict[str, dict] = {}
    daily: dict[str, int] = {}
    orders = set()
    for name, variant, qty, created, oid in rows:
        orders.add(oid)
        m = per_menu.setdefault(name, {"menu": name, "quantity": 0, "variants": {}})
        m["quantity"] += qty
        key = variant or "-"
        m["variants"][key] = m["variants"].get(key, 0) + qty
        d = to_wib_date(created).isoformat()
        daily[d] = daily.get(d, 0) + qty

    if start and end and (end - start).days <= 92:
        d, filled = start, {}
        while d <= end:
            filled[d.isoformat()] = daily.get(d.isoformat(), 0)
            d += timedelta(days=1)
        daily = filled

    items = sorted(
        ({**m, "variants": [{"variant": k, "quantity": v} for k, v in sorted(m["variants"].items(), key=lambda x: -x[1])]} for m in per_menu.values()),
        key=lambda x: -x["quantity"],
    )
    return {
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "items": items,
        "total_items": sum(m["quantity"] for m in items),
        "total_orders": len(orders),
        "daily": [{"date": k, "quantity": v} for k, v in sorted(daily.items())],
    }


@app.get("/api/v1/admin/summary")
def summary(db: Session = Depends(db_session), a=Depends(admin_required)):
    today = today_wib()
    start_utc = wib_day_start_utc(today)
    counts = {s: db.query(Order).filter(Order.status == s).count() for s in ACTIVE_STATUSES}
    orders_today = db.query(Order).filter(Order.created_at >= start_utc).count()
    completed_today = db.query(Order).filter(Order.status == "completed", Order.updated_at >= start_utc).count()
    sold = sales(today, today, db, a)
    pos = db.query(Review).filter_by(sentiment="positif").count()
    neg = db.query(Review).filter_by(sentiment="negatif").count()
    latest = db.query(Review).options(selectinload(Review.order)).order_by(Review.created_at.desc()).limit(3).all()
    return {
        "orders_today": orders_today,
        "completed_today": completed_today,
        "status_counts": counts,
        "items_sold_today": sold["total_items"],
        "top_menus_today": sold["items"][:5],
        "sentiment": {"positif": pos, "negatif": neg, "total": pos + neg},
        "latest_reviews": [
            {"id": r.id, "order_number": r.order.number, "customer": first_name(r.order.customer), "text": r.text,
             "sentiment": r.sentiment, "created_at": iso(r.created_at)}
            for r in latest
        ],
    }


@app.get("/api/v1/admin/reviews")
def admin_reviews(
    sentiment: str = "",
    start: Optional[date] = None,
    end: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(db_session),
    a=Depends(admin_required),
):
    query = db.query(Review).options(selectinload(Review.order).selectinload(Order.items))
    if sentiment in ("positif", "negatif"):
        query = query.filter(Review.sentiment == sentiment)
    query = apply_date_range(query, Review.created_at, start, end)
    total = query.count()
    rows = query.order_by(Review.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": r.id,
                "order_id": r.order_id,
                "order_number": r.order.number,
                "customer": first_name(r.order.customer),
                "items": [f"{i.quantity}× {i.menu_name}" + (f" ({i.variant})" if i.variant else "") for i in r.order.items],
                "text": r.text,
                "sentiment": r.sentiment,
                "score": r.score,
                "created_at": iso(r.created_at),
            }
            for r in rows
        ],
    }


@app.get("/api/v1/admin/reviews/distribution")
def distribution(start: Optional[date] = None, end: Optional[date] = None, db: Session = Depends(db_session), a=Depends(admin_required)):
    query = apply_date_range(db.query(Review.sentiment, Review.created_at), Review.created_at, start, end)
    rows = query.all()
    pos = sum(1 for s, _ in rows if s == "positif")
    neg = sum(1 for s, _ in rows if s == "negatif")
    n = pos + neg
    daily: dict[str, dict] = {}
    for s, created in rows:
        d = daily.setdefault(to_wib_date(created).isoformat(), {"positif": 0, "negatif": 0})
        if s in d:
            d[s] += 1
    return {
        "total": n,
        "positif": pos,
        "negatif": neg,
        "positif_percent": round(pos / n * 100, 1) if n else 0,
        "negatif_percent": round(neg / n * 100, 1) if n else 0,
        "daily": [{"date": k, **v} for k, v in sorted(daily.items())],
    }
