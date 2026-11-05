from carcar.messages import caption, messages

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
