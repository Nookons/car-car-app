#!/usr/bin/env bash
# Держит коллекторы живыми: опрос, обогащение и (опционально) полный обход.
#
#   ./scripts/run_collector.sh                            # в переднем плане
#   nohup ./scripts/run_collector.sh >/dev/null 2>&1 &    # в фоне
#
# Логи: logs/collector.log (опрос и обогащение), logs/sweep.log (обход)
# Выключить обход: CARCAR_WITH_SWEEP=0

set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
LOG="logs/collector.log"

# Обогащение: фото/кузов/цвет/продавец для объявлений без карточки.
(
    while true; do
        .venv/bin/python -m carcar enrich --limit 500 --minutes 30 >> "$LOG" 2>&1
        sleep 30
    done
) &

# Полный обход: продолжает с места из sweep_state, поэтому рестарт безопасен.
if [ "${CARCAR_WITH_SWEEP:-1}" = "1" ]; then
    (
        while true; do
            .venv/bin/python -m carcar sweep --rps "${CARCAR_RPS:-0.7}" --minutes 240 \
                >> logs/sweep.log 2>&1
            sleep 30
        done
    ) &
fi

# Опрос выдачи: две страницы раз в минуту.
while true; do
    echo "$(date '+%F %T') запуск сборщика" >> "$LOG"
    .venv/bin/python -m carcar watch --minutes 100000 --details 3 >> "$LOG" 2>&1
    code=$?
    echo "$(date '+%F %T') сборщик завершился (код $code), перезапуск через 10 с" >> "$LOG"
    sleep 10
done
