#!/usr/bin/env python3
"""Сборка офлайн-справочника городов Польши из GeoNames.

Зачем: в выдаче otomoto есть только «город, воеводство», без координат.
Точные координаты есть в карточке (`seller.location.map`), но карточки качаются
не для всех объявлений. Поэтому нужен локальный справочник «город → широта,
долгота» — без сетевых запросов на каждое объявление.

Источник: GeoNames (CC BY 4.0), dump PL + admin1CodesASCII.

    python3 scripts/build_geo.py                 # скачает и соберёт
    python3 scripts/build_geo.py --src /tmp/geo  # соберёт из уже скачанного

Результат: carcar/geo/pl_places.tsv.gz (алиас → место, с латинскими
альтернативными названиями: otomoto пишет «Warszawa», а в GeoNames столица
называется «Warsaw»).
"""

from __future__ import annotations

import argparse
import gzip
import io
import re
import sys
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "carcar" / "geo" / "pl_places.tsv.gz"
SRC = ROOT / "data" / "geo" / "src"

PL_URL = "https://download.geonames.org/export/dump/PL.zip"
ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"

# PPLQ — заброшенные, PPLH — исторические, PPLF — фермы, PPLS — урочища.
SKIP_CODES = {"PPLQ", "PPLH", "PPLF", "PPLS"}

# Английские названия воеводств из GeoNames → польские, как их пишет otomoto.
REGION_PL = {
    "PL.72": "Dolnośląskie",
    "PL.73": "Kujawsko-Pomorskie",
    "PL.74": "Łódzkie",
    "PL.75": "Lubelskie",
    "PL.76": "Lubuskie",
    "PL.77": "Małopolskie",
    "PL.78": "Mazowieckie",
    "PL.79": "Opolskie",
    "PL.80": "Podkarpackie",
    "PL.81": "Podlaskie",
    "PL.82": "Pomorskie",
    "PL.83": "Śląskie",
    "PL.84": "Świętokrzyskie",
    "PL.85": "Warmińsko-Mazurskie",
    "PL.86": "Wielkopolskie",
    "PL.87": "Zachodniopomorskie",
}

NON_LATIN = re.compile(r"[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u4E00-\u9FFF\u0600-\u06FF]")


def ensure_sources(src: Path) -> tuple[Path, Path]:
    src.mkdir(parents=True, exist_ok=True)
    pl_txt = src / "PL.txt"
    admin1 = src / "admin1CodesASCII.txt"
    if not pl_txt.exists():
        print(f"скачиваю {PL_URL}")
        with urllib.request.urlopen(PL_URL, timeout=120) as response:  # noqa: S310
            data = response.read()
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            archive.extract("PL.txt", src)
    if not admin1.exists():
        print(f"скачиваю {ADMIN1_URL}")
        urllib.request.urlretrieve(ADMIN1_URL, admin1)  # noqa: S310
    return pl_txt, admin1


def load_regions(admin1: Path) -> dict[str, str]:
    regions = {}
    for line in admin1.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].startswith("PL."):
            regions[parts[0]] = parts[1]
    return regions


def normalize(text: str) -> str:
    """Łódź → lodz: нижний регистр, без диакритики, только буквы и цифры."""
    text = text.lower().replace("ł", "l")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def build(pl_txt: Path, admin1: Path, out: Path) -> int:
    regions = load_regions(admin1)
    rows: list[str] = []
    seen: set[tuple[str, str, str]] = set()

    for line in pl_txt.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) < 19 or parts[6] != "P" or parts[7] in SKIP_CODES:
            continue
        name = parts[1]
        lat, lon = parts[4], parts[5]
        region = REGION_PL.get(f"PL.{parts[10]}", regions.get(f"PL.{parts[10]}", ""))
        population = int(parts[14] or 0)
        code = parts[7]
        if not name or not lat or not lon:
            continue

        aliases = {name, parts[2]}  # name + asciiname
        if population > 0:
            # У больших городов берём латинские альтернативные названия:
            # так «Warszawa» находит «Warsaw», «Varsovie» и т.п.
            for alias in parts[3].split(","):
                alias = alias.strip()
                if (
                    alias
                    and len(alias) <= 60
                    and not NON_LATIN.search(alias)
                    and re.fullmatch(r"[A-Za-zÀ-žŁł0-9 .'\-]+", alias)
                ):
                    aliases.add(alias)

        for alias in aliases:
            key = normalize(alias)
            if not key or (key, lat, lon) in seen:
                continue
            seen.add((key, lat, lon))
            rows.append(f"{key}\t{name}\t{region}\t{lat}\t{lon}\t{population}\t{code}")

    rows.sort()
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", encoding="utf-8") as handle:
        handle.write("\n".join(rows) + "\n")
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, default=SRC)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    pl_txt, admin1 = ensure_sources(args.src)
    count = build(pl_txt, admin1, args.out)
    size = args.out.stat().st_size
    print(f"готово: {count} населённых пунктов → {args.out} ({size / 1024:.0f} КБ)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
