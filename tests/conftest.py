import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def as_html(data: dict) -> str:
    """Оборачивает payload в страницу так, как это делает Next.js."""
    payload = json.dumps(data, ensure_ascii=False)
    return (
        "<html><body><div id=__next></div>"
        f'<script id="__NEXT_DATA__" type="application/json" nonce="abc">{payload}</script>'
        "</body></html>"
    )


@pytest.fixture(scope="session")
def search_html() -> str:
    return as_html(load_fixture("search_next_data.json"))


@pytest.fixture(scope="session")
def offer_html() -> str:
    return as_html(load_fixture("offer_next_data.json"))
