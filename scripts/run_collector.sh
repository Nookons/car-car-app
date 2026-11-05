#!/usr/bin/env bash
# Держит сборщик и обогащение карточек живыми.
#
#   ./scripts/run_collector.sh                            # в переднем плане
#   nohup ./scripts/run_collector.sh >/dev/null 2>&1 &    # в фоне
#
# Лог: logs/collector.log

set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
LOG="logs/collector.log"

# Обогащение: догружает фото/кузов/цвет/продавца для объявлений без карточки.
(
    while true; do
        .venv/bin/python -m carcar enrich --limit 500 --minutes 30 >> "$LOG" 2>&1
        sleep 30
    done
) &

# Опрос выдачи: две страницы раз в минуту.
while true; do
    echo "$(date '+%F %T') запуск сборщика" >> "$LOG"
    .venv/bin/python -m carcar watch --minutes 100000 --details 3 >> "$LOG" 2>&1
    code=$?
    echo "$(date '+%F %T') сборщик завершился (код $code), перезапуск через 10 с" >> "$LOG"
    sleep 10
done
