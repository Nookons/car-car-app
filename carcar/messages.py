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
