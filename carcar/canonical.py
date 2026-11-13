"""Канонизация и валидация: одна модель для всех площадок.

Сюда приходит `Listing` от любого парсера, отсюда уходит строка для БД
или причина отказа. Мусор (нулевые цены, битые id, гигантские описания,
лишние фото) отсекается здесь, а не в базе.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from .geo import normalize

MAX_PHOTOS = 60
MAX_TITLE = 300
MAX_URL = 700
MAX_PRICE = 100_000_000

FUEL = {
    "benzyna": "petrol",
    "diesel": "diesel",
    "hybryda": "hybrid",
    "hybryda plug in": "plugin_hybrid",
    "hybryda plug-in": "plugin_hybrid",
    "elektryczny": "electric",
    "lpg": "lpg",
    "benzyna lpg": "lpg",
    "benzyna cng": "cng",
    "cng": "cng",
    "inne": "other",
    "other": "other",
    "petrol": "petrol",
    "electric": "electric",
    "hybrid": "hybrid",
}

GEARBOX = {
    "manualna": "manual",
    "automatyczna": "automatic",
    "polautomatyczna": "semi_auto",
    "manual": "manual",
    "automatic": "automatic",
    "other": "other",
    "inna": "other",
}

BODY = {
    "sedan": "sedan",
    "kompakt": "hatchback",
    "hatchback": "hatchback",
    "kombi": "wagon",
    "suv": "suv",
    "coupe": "coupe",
    "kabriolet": "convertible",
    "minivan": "minivan",
    "pickup": "pickup",
    "dostawczy": "van",
    "van": "van",
}

SELLER = {"privateseller": "private", "private": "private",
          "professionalseller": "dealer", "dealer": "dealer"}


@dataclass(slots=True)
class Prepared:
    row: dict[str, Any] | None
    reason: str | None = None

    @property
    def ok(self) -> bool:
        return self.row is not None


def _truncate(value: str | None, limit: int) -> str | None:
    if not value:
        return None
    value = value.strip()
    return value[:limit] if value else None


def canon_body(value: str | None) -> str | None:
    return _canon(value, BODY)


def canon_fuel(value: str | None) -> str | None:
    return _canon(value, FUEL)


def canon_gearbox(value: str | None) -> str | None:
    return _canon(value, GEARBOX)


def _canon(value: str | None, mapping: dict[str, str], default: str | None = None) -> str | None:
    if not value:
        return default
    normalized = normalize(value)
    if normalized in mapping:
        return mapping[normalized]
    # Canonical values such as plugin_hybrid and wagon must be idempotent.
    return next((canonical for canonical in mapping.values() if normalize(canonical) == normalized), default)


def _year(value: Any) -> int | None:
    try:
        year = int(value)
    except (TypeError, ValueError):
        return None
    return year if 1950 <= year <= 2030 else None


def _mileage(value: Any) -> int | None:
    try:
        km = int(value)
    except (TypeError, ValueError):
        return None
    return km if 0 <= km < 2_000_000 else None


def _published(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(UTC)


def content_hash(row: dict[str, Any]) -> str:
    """Хэш канонических полей: по нему видно, менялось ли объявление."""
    parts = [
        row.get("title") or "",
        str(row.get("price") or ""),
        str(row.get("mileage_km") or ""),
        str(row.get("year") or ""),
        row.get("make") or "",
        row.get("model") or "",
        row.get("fuel") or "",
        row.get("gearbox") or "",
        row.get("city") or "",
        f"{round(row['lat'], 4)}" if row.get("lat") is not None else "",
        f"{round(row['lon'], 4)}" if row.get("lon") is not None else "",
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def prepare(item: Any, source_id: int) -> Prepared:
    """Listing → строка для БД или причина отказа."""
    external_id = str(getattr(item, "id", "") or "").strip()
    if not external_id.isdigit():
        return Prepared(None, "bad_external_id")

    url = _truncate(getattr(item, "url", None), MAX_URL)
    if not url or not url.startswith("https://"):
        return Prepared(None, "bad_url")

    title = _truncate(getattr(item, "title", None), MAX_TITLE)
    if not title or len(title) < 3:
        return Prepared(None, "bad_title")

    price = getattr(item, "price", None)
    if not price or price <= 0 or price > MAX_PRICE:
        return Prepared(None, "bad_price")

    photos = list(getattr(item, "photos", None) or [])[:MAX_PHOTOS]
    photos = [p for p in photos if isinstance(p, str) and p.startswith("https://")]

    row: dict[str, Any] = {
        "source_id": source_id,
        "external_id": external_id,
        "url": url,
        "title": title,
        "price": int(price),
        "currency": (getattr(item, "currency", None) or "PLN")[:3].upper(),
        "make": _truncate(getattr(item, "make", None), 80),
        "model": _truncate(getattr(item, "model", None), 120),
        "year": _year(getattr(item, "year", None)),
        "mileage_km": _mileage(getattr(item, "mileage_km", None)),
        "fuel": _canon(getattr(item, "fuel", None), FUEL),
        "gearbox": _canon(getattr(item, "gearbox", None), GEARBOX),
        "body": _canon(getattr(item, "body", None), BODY),
        "power_hp": (
            getattr(item, "power_hp", None)
            if 10 <= (getattr(item, "power_hp", 0) or 0) <= 2000
            else None
        ),
        "engine_cm3": (
            getattr(item, "engine_cm3", None)
            if 600 <= (getattr(item, "engine_cm3", 0) or 0) <= 10_000
            else None
        ),
        "color": _truncate(getattr(item, "color", None), 60),
        "vin": (getattr(item, "vin", None) or "").strip().upper() or None,
        "city": _truncate(getattr(item, "city", None), 120),
        "region": _truncate(getattr(item, "region", None), 120),
        "lat": getattr(item, "lat", None),
        "lon": getattr(item, "lon", None),
        "seller_type": _canon(getattr(item, "seller_type", None), SELLER, "unknown"),
        "seller_name": _truncate(getattr(item, "seller_name", None), 200),
        "thumb_url": _truncate(getattr(item, "thumbnail", None), MAX_URL),
        "photos": photos,
        "photos_count": len(photos),
        "published_at": _published(getattr(item, "created_at", None)),
    }

    if row["vin"] and len(row["vin"]) != 17:
        row["vin"] = None  # битый VIN лучше не хранить вовсе

    row["content_hash"] = content_hash(row)
    return Prepared(row)
