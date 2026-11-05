"""Геопривязка объявлений: город → координаты, расстояние между точками.

В выдаче otomoto координат нет — только «город, воеводство». Точные координаты
есть в карточке (`seller.location.map`), но карточки качаются не для всех
объявлений. Поэтому:

  * если карточка скачана — берём точные координаты продавца;
  * иначе — координаты центра населённого пункта из офлайн-справочника
    GeoNames (сборка: `scripts/build_geo.py`).

Справочник лежит рядом (`pl_places.tsv.gz`, ~845 КБ, 56 тыс. алиасов):
никаких сетевых запросов на каждое объявление и никакого лимита Nominatim.
Данные GeoNames — CC BY 4.0.
"""

from __future__ import annotations

import difflib
import gzip
import math
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

DATA_FILE = Path(__file__).with_name("pl_places.tsv.gz")
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True, slots=True)
class Place:
    name: str
    region: str
    lat: float
    lon: float
    population: int


def normalize(text: str) -> str:
    """Łódź → 'lodz', «Grodzisk Mazowiecki» → 'grodzisk mazowiecki'."""
    text = (text or "").lower().replace("ł", "l")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Расстояние по большому кругу (haversine), километры."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


class GeoIndex:
    def __init__(self, by_alias: dict[str, list[Place]]) -> None:
        self._by_alias = by_alias
        self._fuzzy: dict[str, list[str]] = {}
        self._cache: dict[tuple[str, str], Place | None] = {}

    @classmethod
    def load(cls, path: Path | None = None) -> GeoIndex:
        path = Path(path or os.environ.get("CARCAR_GEO", DATA_FILE))
        by_alias: dict[str, list[Place]] = {}
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                parts = line.rstrip("\n").split("\t")
                if len(parts) != 7:
                    continue
                alias, name, region, lat, lon, population, _code = parts
                by_alias.setdefault(alias, []).append(
                    Place(
                        name=name,
                        region=region,
                        lat=float(lat),
                        lon=float(lon),
                        population=int(population),
                    )
                )
        return cls(by_alias)

    def lookup(self, city: str, region: str | None = None) -> Place | None:
        """Город (+ воеводство для неоднозначных) → точка на карте."""
        key = normalize(city)
        if not key:
            return None
        cache_key = (key, normalize(region or ""))
        if cache_key in self._cache:
            return self._cache[cache_key]

        candidates = list(self._by_alias.get(key, ()))
        if not candidates:
            for alias in self._similar(key):
                candidates.extend(self._by_alias.get(alias, ()))
        if not candidates and " " in key:
            # «Warszawa Mokotów» → пробуем по первому слову.
            candidates = list(self._by_alias.get(key.split()[0], ()))

        result = self._best(candidates, region) if candidates else None
        self._cache[cache_key] = result
        return result

    def _similar(self, key: str) -> list[str]:
        if key not in self._fuzzy:
            self._fuzzy[key] = difflib.get_close_matches(
                key, self._by_alias.keys(), n=5, cutoff=0.86
            )
        return self._fuzzy[key]

    @staticmethod
    def _best(candidates: list[Place], region: str | None) -> Place | None:
        if not candidates:
            return None
        wanted = normalize(region or "")

        def score(place: Place) -> tuple[int, int]:
            region_hit = 1 if wanted and normalize(place.region) == wanted else 0
            return region_hit, place.population

        return max(candidates, key=score)

    def __len__(self) -> int:
        return len(self._by_alias)


_INDEX: GeoIndex | None = None


def get_geo() -> GeoIndex:
    """Ленивый синглтон: справочник читается один раз на процесс."""
    global _INDEX
    if _INDEX is None:
        _INDEX = GeoIndex.load()
    return _INDEX
