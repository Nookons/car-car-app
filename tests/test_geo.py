import pytest

from carcar.geo import GeoIndex, distance_km, get_geo, normalize


def test_normalize_strips_polish_letters():
    assert normalize("Łódź") == "lodz"
    assert normalize("Grodzisk Mazowiecki") == "grodzisk mazowiecki"
    assert normalize("ŚWIĘTOKRZYSKIE") == "swietokrzyskie"
    assert normalize("  ") == ""


def test_lookup_capital():
    place = get_geo().lookup("Warszawa")
    assert place is not None
    assert place.region == "Mazowieckie"
    assert round(place.lat, 2) == 52.23
    assert round(place.lon, 2) == 21.01


def test_lookup_uses_region_for_ambiguous_names():
    # Tuchola есть и в Куявии, и в Великопольше — воеводство решает.
    kujawy = get_geo().lookup("Tuchola", "Kujawsko-Pomorskie")
    wielkopolska = get_geo().lookup("Tuchola", "Wielkopolskie")

    assert kujawy is not None and kujawy.region == "Kujawsko-Pomorskie"
    assert wielkopolska is not None and wielkopolska.region == "Wielkopolskie"
    assert (kujawy.lat, kujawy.lon) != (wielkopolska.lat, wielkopolska.lon)


def test_lookup_handles_ascii_and_diacritics():
    assert get_geo().lookup("Lodz") is not None
    assert get_geo().lookup("Łódź", "Łódzkie") is not None


def test_lookup_unknown_city():
    assert get_geo().lookup("Zzzz Nie Ma Takiego") is None


def test_distance_warsaw_krakow():
    warsaw = get_geo().lookup("Warszawa")
    krakow = get_geo().lookup("Kraków")
    km = distance_km(warsaw.lat, warsaw.lon, krakow.lat, krakow.lon)
    assert 240 < km < 270  # по прямой ~252 км


def test_index_loads_bundled_dataset():
    index = GeoIndex.load()
    assert len(index) > 40_000
    with pytest.raises(FileNotFoundError):
        GeoIndex.load("/nonexistent/geo.tsv.gz")
