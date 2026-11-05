"""Настройки сборщика: всё, что можно поменять без правки кода."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env_file(path: Path | None = None) -> None:
    """Подхватывает .env, не перетирая уже заданные переменные."""
    env_path = path or ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))

# Тот же браузерный UA, с которым площадка отдаёт полную страницу.
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Сортировка «свежие сверху». Порядок нестрогий (в выдачу подмешиваются
# «поднятые» объявления), поэтому используется только как подсказка.
SEARCH_ORDER = "created_at:desc"


@dataclass(slots=True)
class Settings:
    base_url: str = "https://www.otomoto.pl"
    category: str = "osobowe"
    user_agent: str = DEFAULT_USER_AGENT
    # Один запрос в секунду — осознанный предел вежливости, не «медленно».
    rps: float = 1.0
    timeout: float = 20.0
    retries: int = 3
    backoff_base: float = 1.0
    data_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("CARCAR_DATA_DIR", "data"))
    )
    # каждая площадка — отдельный сервис: CARCAR_SOURCE=otomoto|olx|...
    source: str = field(default_factory=lambda: os.environ.get("CARCAR_SOURCE", "otomoto"))

    def search_url(self, page: int = 1) -> str:
        order = SEARCH_ORDER.replace(":", "%3A")
        url = f"{self.base_url}/{self.category}?search%5Border%5D={order}"
        return url if page == 1 else f"{url}&page={page}"
