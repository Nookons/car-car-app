-- Индексы под тяжёлые рыночные запросы и фильтр городов.
-- ВАЖНО: CONCURRENTLY нельзя запускать внутри транзакции.
-- Применять отдельными statement'ами при остановленном фоновом конвейере.

create index concurrently if not exists listing_market_comps_idx
    on listing (make, model, year, mileage_km)
    where status = 'active' and price is not null;

create index concurrently if not exists listing_active_city_idx
    on listing (city)
    where status = 'active' and city is not null and lat is not null and lon is not null;
