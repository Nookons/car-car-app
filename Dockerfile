# Один образ на все коллекторы: режим и площадка задаются переменными.
#   CARCAR_MODE=watch|enrich|sweep|dashboard
#   CARCAR_SOURCE=otomoto

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY carcar ./carcar

RUN pip install --no-cache-dir . \
    && useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown app:app /entrypoint.sh

USER app

ENTRYPOINT ["/entrypoint.sh"]
