-- Избранное считает сама база, а не код.
--
-- Раньше счётчик listing_stat.favorites вели вручную в add_favorite/
-- remove_favorite. Любой другой путь (удаление пользователя каскадом, чистка
-- избранного руками, будущий писатель) оставлял счётчик врать, а он весит
-- в score больше всего. Триггер на favorite держит его в согласии всегда.

begin;

create or replace function public.favorite_stat_counter() returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.listing_stat (listing_id, favorites)
        values (new.listing_id, 1)
        on conflict (listing_id) do update set
            favorites = listing_stat.favorites + 1,
            updated_at = now();
        return new;
    elsif tg_op = 'DELETE' then
        update public.listing_stat set
            favorites = greatest(favorites - 1, 0),
            updated_at = now()
        where listing_id = old.listing_id;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists favorite_stat_counter on public.favorite;
create trigger favorite_stat_counter
    after insert or delete on public.favorite
    for each row execute function public.favorite_stat_counter();

-- Однократная сверка: до этого счётчик вели в коде, и он мог разойтись
-- с реальным избранным (на момент миграции расхождение уже было).
insert into public.listing_stat (listing_id, favorites)
select listing_id, count(*)::int from public.favorite group by listing_id
on conflict (listing_id) do update set
    favorites = excluded.favorites,
    updated_at = now();

grant execute on function public.favorite_stat_counter() to carcar_runtime;

commit;
