"""Тексты бота и уведомлений на языках пользователя.

Язык берётся из app_user.lang (его выбирают в приложении). Неизвестный язык —
русский. Здесь только то, что видит человек в Telegram.
"""

from __future__ import annotations

LANGS = ("ru", "pl", "en", "uk")

MESSAGES: dict[str, dict[str, str]] = {
    "ru": {
        "start": (
            "CarCar — свежие объявления о продаже авто в Польше.\n\n"
            "Открой приложение: поиск, фильтры по расстоянию и уведомления."
        ),
        "start_button": "🚗 Открыть CarCar",
        "menu_button": "Открыть CarCar",
        "no_url": (
            "Бот настроен, но публичный адрес приложения ещё не задан.\n"
            "Задай CARCAR_PUBLIC_URL (https://…) и перезапусти бота."
        ),
        "notify_ok": "✅ Подходит под ваш фильтр",
        "open_app": "🚗 Открыть в CarCar",
        "my_filters": "Мои фильтры",
        "km": "км",
    },
    "pl": {
        "start": (
            "CarCar — świeże ogłoszenia sprzedaży aut w Polsce.\n\n"
            "Otwórz aplikację: wyszukiwanie, filtry odległości i powiadomienia."
        ),
        "start_button": "🚗 Otwórz CarCar",
        "menu_button": "Otwórz CarCar",
        "no_url": (
            "Bot jest gotowy, ale adres aplikacji nie jest ustawiony.\n"
            "Ustaw CARCAR_PUBLIC_URL (https://…) i uruchom bota ponownie."
        ),
        "notify_ok": "✅ Pasuje do Twojego filtra",
        "open_app": "🚗 Otwórz w CarCar",
        "my_filters": "Moje filtry",
        "km": "km",
    },
    "en": {
        "start": (
            "CarCar — fresh car listings from Poland.\n\n"
            "Open the app: search, distance filters and notifications."
        ),
        "start_button": "🚗 Open CarCar",
        "menu_button": "Open CarCar",
        "no_url": (
            "The bot is ready, but the app URL is not set yet.\n"
            "Set CARCAR_PUBLIC_URL (https://…) and restart the bot."
        ),
        "notify_ok": "✅ Matches your filter",
        "open_app": "🚗 Open in CarCar",
        "my_filters": "My filters",
        "km": "km",
    },
    "uk": {
        "start": (
            "CarCar — свіжі оголошення про продаж авто в Польщі.\n\n"
            "Відкрий застосунок: пошук, фільтри за відстанню та сповіщення."
        ),
        "start_button": "🚗 Відкрити CarCar",
        "menu_button": "Відкрити CarCar",
        "no_url": (
            "Бот налаштований, але публічну адресу застосунку ще не задано.\n"
            "Задай CARCAR_PUBLIC_URL (https://…) і перезапусти бота."
        ),
        "notify_ok": "✅ Підходить під ваш фільтр",
        "open_app": "🚗 Відкрити в CarCar",
        "my_filters": "Мої фільтри",
        "km": "км",
    },
}


SPEC_LABELS: dict[str, dict[str, str]] = {
    "ru": {
        "specs_button": "📋 Характеристики",
        "year": "Год", "mileage": "Пробег", "engine": "Объём", "power": "Мощность",
        "fuel": "Топливо", "gearbox": "КПП", "body": "Кузов", "drive": "Привод",
        "color": "Цвет", "doors": "Двери", "seats": "Мест", "condition": "Состояние",
        "co2": "CO₂", "urban": "Расход город", "extra": "Расход трасса",
        "city": "Город", "seller": "Продавец", "vin": "VIN",
        "open": "Открыть в CarCar",
    },
    "pl": {
        "specs_button": "📋 Dane techniczne",
        "year": "Rok", "mileage": "Przebieg", "engine": "Pojemność", "power": "Moc",
        "fuel": "Paliwo", "gearbox": "Skrzynia", "body": "Nadwozie", "drive": "Napęd",
        "color": "Kolor", "doors": "Drzwi", "seats": "Miejsca", "condition": "Stan",
        "co2": "CO₂", "urban": "Spalanie miasto", "extra": "Spalanie trasa",
        "city": "Miasto", "seller": "Sprzedający", "vin": "VIN",
        "open": "Otwórz w CarCar",
    },
    "en": {
        "specs_button": "📋 Specifications",
        "year": "Year", "mileage": "Mileage", "engine": "Engine", "power": "Power",
        "fuel": "Fuel", "gearbox": "Gearbox", "body": "Body", "drive": "Drive",
        "color": "Color", "doors": "Doors", "seats": "Seats", "condition": "Condition",
        "co2": "CO₂", "urban": "Consumption city", "extra": "Consumption highway",
        "city": "City", "seller": "Seller", "vin": "VIN",
        "open": "Open in CarCar",
    },
    "uk": {
        "specs_button": "📋 Характеристики",
        "year": "Рік", "mileage": "Пробіг", "engine": "Об'єм", "power": "Потужність",
        "fuel": "Паливо", "gearbox": "КПП", "body": "Кузов", "drive": "Привід",
        "color": "Колір", "doors": "Двері", "seats": "Місць", "condition": "Стан",
        "co2": "CO₂", "urban": "Витрата місто", "extra": "Витрата траса",
        "city": "Місто", "seller": "Продавець", "vin": "VIN",
        "open": "Відкрити в CarCar",
    },
}

FUEL_LABELS = {
    "ru": {"petrol": "Бензин", "diesel": "Дизель", "hybrid": "Гибрид",
           "plugin_hybrid": "Гибрид plug-in", "electric": "Электро", "lpg": "Газ"},
    "pl": {"petrol": "Benzyna", "diesel": "Diesel", "hybrid": "Hybryda",
           "plugin_hybrid": "Hybryda plug-in", "electric": "Elektryczny", "lpg": "LPG"},
    "en": {"petrol": "Petrol", "diesel": "Diesel", "hybrid": "Hybrid",
           "plugin_hybrid": "Plug-in hybrid", "electric": "Electric", "lpg": "LPG"},
    "uk": {"petrol": "Бензин", "diesel": "Дизель", "hybrid": "Гібрид",
           "plugin_hybrid": "Гібрид plug-in", "electric": "Електро", "lpg": "Газ"},
}

GEARBOX_LABELS = {
    "ru": {"manual": "Механика", "automatic": "Автоматическая", "semi_auto": "Полуавтомат"},
    "pl": {"manual": "Manualna", "automatic": "Automatyczna", "semi_auto": "Półautomat"},
    "en": {"manual": "Manual", "automatic": "Automatic", "semi_auto": "Semi-automatic"},
    "uk": {"manual": "Механіка", "automatic": "Автоматична", "semi_auto": "Напівавтомат"},
}

DRIVE_LABELS = {
    "ru": {"front": "Передний", "rear": "Задний", "awd": "Полный (4x4)"},
    "pl": {"front": "Przedni", "rear": "Tylny", "awd": "4x4"},
    "en": {"front": "Front", "rear": "Rear", "awd": "All-wheel (4x4)"},
    "uk": {"front": "Передній", "rear": "Задній", "awd": "Повний (4x4)"},
}


def specs(lang: str | None) -> dict[str, str]:
    return SPEC_LABELS.get((lang or "ru").lower(), SPEC_LABELS["ru"])


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def grid_caption(item: dict, lang: str | None) -> str:
    """Подпись к фото: ключевые факты и характеристики сеткой по две в строке."""
    text = messages(lang)
    labels = specs(lang)
    fuel = FUEL_LABELS.get(lang, {}).get(item.get("fuel") or "", item.get("fuel") or "")
    gearbox = GEARBOX_LABELS.get(lang, {}).get(
        item.get("gearbox") or "", item.get("gearbox") or ""
    )
    drive = DRIVE_LABELS.get(lang, {}).get(item.get("drive") or "", item.get("drive") or "")

    def number(value):
        return f"{value:,}".replace(",", " ") if value else ""

    pairs = [
        (labels["year"], item.get("year")),
        (
            labels["mileage"],
            f"{number(item.get('mileage_km'))} {text['km']}" if item.get("mileage_km") else "",
        ),
        (labels["engine"], f"{item.get('engine_cm3')} cm³" if item.get("engine_cm3") else ""),
        (labels["power"], f"{item.get('power_hp')} KM" if item.get("power_hp") else ""),
        (labels["fuel"], fuel),
        (labels["gearbox"], gearbox),
        (labels["body"], item.get("body") or ""),
        (labels["drive"], drive),
        (labels["color"], item.get("color") or ""),
    ]
    pairs = [(label, value) for label, value in pairs if value]
    lines = []
    for index in range(0, len(pairs), 2):
        chunk = pairs[index:index + 2]
        lines.append("   ".join(f"{label} <b>{_escape(str(value))}</b>" for label, value in chunk))
    grid = "\n".join(lines)

    price = f"{number(item.get('price'))} zł"
    facts = " · ".join(
        str(part)
        for part in [
            item.get("year"),
            f"{number(item.get('mileage_km'))} {text['km']}" if item.get("mileage_km") else None,
            item.get("city"),
        ]
        if part
    )
    return (
        f"<b>{_escape(str(item.get('title') or ''))}</b>\n"
        f"<b>{price}</b>\n"
        f"{_escape(facts)}\n\n"
        f"{grid}\n\n"
        f"{text['notify_ok']}"
    )[:1024]


def article(item: dict, lang: str | None) -> str:
    """Одно сообщение-статья: заголовок, факты, сворачиваемая таблица."""
    text = messages(lang)
    labels = specs(lang)
    fuel = FUEL_LABELS.get(lang, {}).get(item.get("fuel") or "", item.get("fuel") or "")
    gearbox = GEARBOX_LABELS.get(lang, {}).get(
        item.get("gearbox") or "", item.get("gearbox") or ""
    )
    drive = DRIVE_LABELS.get(lang, {}).get(item.get("drive") or "", item.get("drive") or "")

    def number(value):
        return f"{value:,}".replace(",", " ") if value else ""

    price = f"{number(item.get('price'))} zł"
    facts = " · ".join(
        str(part)
        for part in [
            item.get("year"),
            f"{number(item.get('mileage_km'))} {text['km']}" if item.get("mileage_km") else None,
            fuel,
            gearbox,
        ]
        if part
    )
    rows = [
        (labels["year"], item.get("year")),
        (
            labels["mileage"],
            f"{number(item.get('mileage_km'))} {text['km']}" if item.get("mileage_km") else "",
        ),
        (labels["engine"], f"{item.get('engine_cm3')} cm³" if item.get("engine_cm3") else ""),
        (labels["power"], f"{item.get('power_hp')} KM" if item.get("power_hp") else ""),
        (labels["fuel"], fuel),
        (labels["gearbox"], gearbox),
        (labels["body"], item.get("body") or ""),
        (labels["drive"], drive),
        (labels["color"], item.get("color") or ""),
        (labels["doors"], item.get("doors") or ""),
        (labels["seats"], item.get("seats") or ""),
        (labels["condition"], item.get("condition") or ""),
        (labels["co2"], f"{item.get('co2_gkm')} g/km" if item.get("co2_gkm") else ""),
        (
            labels["urban"],
            f"{item.get('consumption_urban')} l/100" if item.get("consumption_urban") else "",
        ),
        (
            labels["extra"],
            f"{item.get('consumption_extra')} l/100" if item.get("consumption_extra") else "",
        ),
        (labels["city"], item.get("city") or ""),
        (labels["seller"], item.get("seller_name") or ""),
    ]
    table = "\n".join(f"{label:<20}{value}" for label, value in rows if value)
    return (
        f"<b>{_escape(str(item.get('title') or ''))}</b>\n"
        f"<b>{price}</b>\n"
        f"{_escape(facts)}\n"
        f"📍 {_escape(str(item.get('city') or '—'))}\n"
        f"{text['notify_ok']}\n\n"
        f"<blockquote expandable><pre>{table}</pre></blockquote>"
    )


def messages(lang: str | None) -> dict[str, str]:
    return MESSAGES.get((lang or "ru").lower(), MESSAGES["ru"])


def caption(item: dict, lang: str | None) -> str:
    text = messages(lang)
    price = f"{item['price']:,}".replace(",", " ") if item.get("price") else "—"
    mileage = f"{item['mileage_km']:,}".replace(",", " ") if item.get("mileage_km") else "—"
    return (
        f"🚗 {item['title']}\n"
        f"💰 {price} zł\n"
        f"📅 {item.get('year') or '—'} · {mileage} {text['km']}\n"
        f"📍 {item.get('city') or '—'}\n"
        f"{text['notify_ok']}"
    )
