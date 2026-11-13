-- Execute outside a transaction; keeps ingestion and reads available.
create index concurrently if not exists listing_detail_recovery_idx
    on listing (source_id, first_seen_at, id)
    where status = 'active' and (details_fetched_at is null or coalesce(photos_count,0) = 0);
