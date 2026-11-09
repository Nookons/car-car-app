from carcar.messages import caption, messages, price_drop_caption

ITEM = {
    "title": "BMW Seria 5",
    "price": 13000,
    "year": 2013,
    "mileage_km": 210000,
    "city": "Warszawa",
}


def test_caption_russian():
    text = caption(ITEM, "ru")
    assert "Подходит под ваш фильтр" in text
    assert "13 000 zł" in text
    assert "210 000 км" in text


def test_caption_polish():
    text = caption(ITEM, "pl")
    assert "Pasuje do Twojego filtra" in text
    assert "km" in text


def test_caption_english():
    assert "Matches your filter" in caption(ITEM, "en")


def test_caption_ukrainian():
    assert "Підходить під ваш фільтр" in caption(ITEM, "uk")


def test_unknown_language_falls_back_to_russian():
    assert "Подходит под ваш фильтр" in caption(ITEM, "de")


def test_buttons_localized():
    assert messages("pl")["open_app"].startswith("🚗")
    assert messages("en")["my_filters"] == "My filters"
    assert messages("uk")["menu_button"] == "Відкрити CarCar"


def test_price_drop_caption_shows_old_and_new_price():
    text = price_drop_caption(ITEM, 13000, 11900, "ru")
    assert "Цена снизилась" in text
    assert "13 000 zł" in text
    assert "11 900 zł" in text
    assert "−8%" in text


def test_price_drop_caption_localized():
    assert "Cena spadła" in price_drop_caption(ITEM, 13000, 11900, "pl")
    assert "Price drop" in price_drop_caption(ITEM, 13000, 11900, "en")
    assert "Ціна знизилась" in price_drop_caption(ITEM, 13000, 11900, "uk")


def test_price_drop_caption_keeps_tiny_drop_visible():
    assert "−0,3%" in price_drop_caption(ITEM, 13000, 12960, "ru")


def test_price_drop_caption_escapes_title():
    text = price_drop_caption({**ITEM, "title": "Audi <A4>"}, 13000, 11900, "en")
    assert "&lt;A4&gt;" in text
