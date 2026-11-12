#!/usr/bin/env bash
# Держит коллекторы живыми: опрос, обогащение (несколько воркеров) и обход.
#
#   ./scripts/run_collector.sh
#
# Логи: logs/collector.log, logs/enrich-*.log, logs/sweep.log
# Отключить обход: CARCAR_WITH_SWEEP=0
# Политика: не гоняем массовое обогащение — карточки догружаются при открытии.
# Примерка темпа: sweep 0.25 запроса/с, опрос раз в 2 минуты, рандомные паузы.

set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
LOG="logs/collector.log"
SHARDS="${CARCAR_ENRICH_SHARDS:-0}"

# Обогащение: фото, характеристики, описание. Каждый воркер берёт свой шард очереди.
if [ "$SHARDS" -gt 0 ]; then
for i in $(seq 0 $((SHARDS - 1))); do
    (
        while true; do
            .venv/bin/python -m carcar enrich --limit 100000 --minutes 30 \
                --shard "$i" --shards "$SHARDS" >> "logs/enrich-$i.log" 2>&1
            sleep 10
        done
    ) &
done
fi

# Полный обход: продолжает с места из sweep_state, поэтому рестарт безопасен.
if [ "${CARCAR_WITH_SWEEP:-1}" = "1" ]; then
    (
        while true; do
            .venv/bin/python -m carcar sweep --rps "${CARCAR_RPS:-0.25}" --minutes 240 \
                --min-interval "${CARCAR_SWEEP_MIN_INTERVAL:-1440}" \
                >> logs/sweep.log 2>&1
            sleep 30
        done
    ) &
fi

# Опрос выдачи: две страницы раз в минуту.
while true; do
    echo "$(date '+%F %T') запуск сборщика" >> "$LOG"
    .venv/bin/python -m carcar watch --minutes 100000 --details 2 --interval 120 >> "$LOG" 2>&1
    code=$?
    echo "$(date '+%F %T') сборщик завершился (код $code), перезапуск через 10 с" >> "$LOG"
    sleep 10
done
