"""Разбор страниц otomoto.

Страницы — Next.js: все данные уже лежат в HTML, в
`<script id="__NEXT_DATA__">`. Для выдачи это состояние GraphQL-клиента
(urql) с результатом `advertSearch`; для карточки — объект `advert`.
Поэтому браузер и выполнение JS не нужны.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(?P<json>.*?)</script>', re.S
)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
DIGITS_RE = re.compile(r"\d+")


class ParseError(ValueError):
    """Страница не похожа на ожидаемую: вёрстка изменилась или нас заблокировали."""


def extract_next_data(html: str) -> dict[str, Any]:
    match = NEXT_DATA_RE.search(html)
    if not match:
        raise ParseError(
            "в странице нет __NEXT_DATA__: либо изменилась вёрстка, "
            "либо отдана заглушка вместо объявлений"
        )
    try:
        return json.loads(match.group("json"))
    except json.JSONDecodeError as exc:
        raise ParseError(f"__NEXT_DATA__ не разобрался как JSON: {exc}") from exc


LEADING_NUMBER_RE = re.compile(r"^[\s\u00a0\u202f]*(\d[\d\s\u00a0\u202f]*)")


def _to_int(value: str | None) -> int | None:
    """'222 693 km' → 222693, '1 998 cm3' → 1998, '2013' → 2013.

    Берём только ведущее число: иначе «cm3» добавляет тройку к объёму
    двигателя и получается 15983 вместо 1598.
    """
    if not value:
        return None
    match = LEADING_NUMBER_RE.match(str(value))
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(1))
    return int(digits) if digits else None


def _text(value: Any) -> str:
    return str(value).strip() if value else ""


def html_to_text(value: str | None) -> str:
    """HTML описания → плоский текст (без тегов и лишних пробелов)."""
    if not value:
        return ""
    return WS_RE.sub(" ", TAG_RE.sub(" ", value)).strip()


# ---------------------------------------------------------------------------
# Выдача
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class Listing:
    """Строка выдачи: ровно то, что нужно фильтру и уведомлению."""

    id: str
    url: str
    title: str
    created_at: str
    price: int | None
    currency: str
    make: str
    model: str
    year: int | None
    mileage_km: int | None
    fuel: str
    gearbox: str
    engine_cm3: int | None
    power_hp: int | None
    city: str
    region: str
    seller_type: str
    thumbnail: str
    is_pinned: bool = False
    lat: float | None = None
    lon: float | None = None
    geo_source: str | None = None

    def to_row(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_node(cls, node: dict[str, Any]) -> Listing:
        params = {
            p.get("key"): (p.get("displayValue") or p.get("value") or "")
            for p in node.get("parameters") or []
        }
        price = (node.get("price") or {}).get("amount") or {}
        location = node.get("location") or {}
        return cls(
            id=_text(node.get("id")),
            url=_text(node.get("url")),
            title=_text(node.get("title")),
            created_at=_text(node.get("createdAt")),
            price=_to_int(price.get("value")),
            currency=_text(price.get("currencyCode") or "PLN"),
            make=_text(params.get("make")),
            model=_text(params.get("model")),
            year=_to_int(params.get("year")),
            mileage_km=_to_int(params.get("mileage")),
            fuel=_text(params.get("fuel_type")),
            gearbox=_text(params.get("gearbox")),
            engine_cm3=_to_int(params.get("engine_capacity")),
            power_hp=_to_int(params.get("engine_power")),
            city=_text((location.get("city") or {}).get("name")),
            region=_text((location.get("region") or {}).get("name")),
            seller_type=_text((node.get("seller") or {}).get("__typename")),
            thumbnail=_text((node.get("thumbnail") or {}).get("x2")),
            is_pinned=bool(node.get("isPremiumTopAd")),
        )


@dataclass(slots=True)
class SearchPage:
    url: str
    total: int
    page_size: int
    offset: int
    items: list[Listing] = field(default_factory=list)


def _advert_search(data: dict[str, Any]) -> dict[str, Any]:
    """Находит в urqlState результат запроса выдачи."""
    page_props = data.get("props", {}).get("pageProps", {})
    state = page_props.get("urqlState") or {}
    for entry in state.values():
        payload = entry.get("data")
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                continue
        if isinstance(payload, dict) and "advertSearch" in payload:
            return payload["advertSearch"]
    raise ParseError("в urqlState нет advertSearch — структура выдачи изменилась")


def parse_search(html: str, url: str = "") -> SearchPage:
    data = extract_next_data(html)
    search = _advert_search(data)
    pager = search.get("pageInfo") or {}
    edges = search.get("edges") or []
    return SearchPage(
        url=url,
        total=int(search.get("totalCount") or 0),
        page_size=int(pager.get("pageSize") or 0),
        offset=int(pager.get("currentOffset") or 0),
        items=[Listing.from_node(edge["node"]) for edge in edges if edge.get("node")],
    )


# ---------------------------------------------------------------------------
# Карточка объявления
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class Offer:
    id: str
    url: str
    title: str
    description: str
    price: int | None
    currency: str
    details: dict[str, str]
    seller_type: str
    seller_name: str
    photos: list[str]
    created_at: str
    updated_at: str
    price_drop: dict[str, Any] | None
    equipment_count: int
    version: str
    generation: str
    doors: int | None
    seats: int | None
    drive: str | None
    condition: str | None
    co2_gkm: int | None
    consumption_urban: float | None
    consumption_extra: float | None
    equipment: list[str]
    raw: dict[str, Any]

    def to_summary(self) -> dict[str, Any]:
        """Короткая запись для индекса — без тяжёлого описания и фото."""
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "price": self.price,
            "currency": self.currency,
            "make": self.details.get("make"),
            "model": self.details.get("model"),
            "year": _to_int(self.details.get("year")),
            "mileage_km": _to_int(self.details.get("mileage")),
            "fuel": self.details.get("fuel_type"),
            "gearbox": self.details.get("gearbox"),
            "vin": self.details.get("vin") or None,
            "city": self.raw.get("location", {}).get("city", {}).get("name")
            if isinstance(self.raw.get("location"), dict)
            else None,
            "seller_type": self.seller_type,
            "seller_name": self.seller_name,
            "photos_count": len(self.photos),
            "created_at": self.created_at,
        }


def _condition(value: str | None) -> str | None:
    text = (value or "").lower()
    if "now" in text or "new" in text:
        return "new"
    if "uż" in text or "used" in text:
        return "used"
    return None


def _drive_value(value: str | None) -> str | None:
    text = (value or "").lower()
    if "przednie" in text or "front" in text:
        return "front"
    if "tylne" in text or "rear" in text:
        return "rear"
    if "4x4" in text or "wszystkie" in text or "awd" in text or "all" in text:
        return "awd"
    return None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    match = re.search(r"\d+(?:[.,]\d+)?", str(value))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


class _Drive:
    parse = staticmethod(_drive_value)


def parse_offer(html: str, url: str = "") -> Offer:
    data = extract_next_data(html)
    advert = data.get("props", {}).get("pageProps", {}).get("advert")
    if not isinstance(advert, dict):
        raise ParseError("в pageProps нет advert — структура карточки изменилась")

    details = {
        str(item.get("key")): _text(item.get("value"))
        for item in advert.get("details") or []
        if item.get("key")
    }
    price = (advert.get("price") or {}).get("value")
    seller = advert.get("seller") or {}
    photos = [
        _text(photo.get("url"))
        for photo in ((advert.get("images") or {}).get("photos") or [])
        if photo.get("url")
    ]
    equipment = advert.get("equipment") or []

    return Offer(
        id=_text(advert.get("id")),
        url=url or _text(advert.get("url")),
        title=_text(advert.get("title")),
        description=html_to_text(advert.get("description")),
        price=_to_int(price),
        currency="PLN",
        details=details,
        seller_type=_text(seller.get("type")),
        seller_name=_text(seller.get("name")),
        photos=photos,
        created_at=_text(advert.get("createdAt")),
        updated_at=_text(advert.get("updatedAt")),
        price_drop=advert.get("priceDrop"),
        equipment_count=sum(len(group.get("values") or []) for group in equipment),
        version=details.get("version") or "",
        generation=details.get("generation") or "",
        doors=_to_int(details.get("door_count")),
        seats=_to_int(details.get("nr_seats")),
        drive=_Drive.parse(details.get("transmission")),
        condition=_condition(details.get("new_used")),
        co2_gkm=_to_int(details.get("co2_emissions")),
        consumption_urban=_to_float(details.get("urban_consumption")),
        consumption_extra=_to_float(details.get("extra_urban_consumption")),
        equipment=[
            _text(value.get("label"))
            for group in equipment
            for value in (group.get("values") or [])
            if value.get("label")
        ],
        raw=advert,
    )


# публичный алиас для нормализации чисел вне парсера
to_int = _to_int
