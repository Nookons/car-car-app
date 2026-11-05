#!/usr/bin/env bash
# Режим работы коллектора задаётся переменными окружения:
#   CARCAR_MODE   watch | enrich | sweep | dashboard   (по умолчанию watch)
#   CARCAR_SOURCE площадка: otomoto | olx | ...        (по умолчанию otomoto)
set -euo pipefail

MODE="${CARCAR_MODE:-watch}"
SOURCE="${CARCAR_SOURCE:-otomoto}"

export CARCAR_SOURCE="$SOURCE"

echo "[entrypoint] mode=$MODE source=$SOURCE db=$([ -n "${DATABASE_URL:-}" ] && echo yes || echo no)"

case "$MODE" in
    watch)
        exec python -m carcar watch \
            --interval "${CARCAR_INTERVAL:-60}" \
            --details "${CARCAR_DETAILS:-3}" \
            --minutes 100000
        ;;
    enrich)
        exec python -m carcar enrich \
            --limit "${CARCAR_ENRICH_LIMIT:-500}" \
            --minutes 30
        ;;
    sweep)
        exec python -m carcar sweep \
            --rps "${CARCAR_RPS:-0.7}" \
            --minutes 0
        ;;
    worker)
        exec python -m carcar worker --consumer "${CARCAR_CONSUMER:-worker-1}"
        ;;
    bot)
        exec python -m carcar bot
        ;;
    miniapp)
        exec python -m carcar miniapp --host 0.0.0.0 --port "${PORT:-8080}"
        ;;
    dashboard)
        exec python -m carcar dashboard \
            --host 0.0.0.0 \
            --port "${PORT:-8077}"
        ;;
    *)
        echo "неизвестный CARCAR_MODE: $MODE" >&2
        exit 2
        ;;
esac
