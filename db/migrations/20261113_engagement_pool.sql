-- Единый «котёл» интереса к объявлению.
--
-- Раньше счётчик score складывался в четырёх местах вручную (просмотр, лайк,
-- репост, комментарий) и не знал ни о показах, ни об избранном. Из-за этого
-- лента училась только на своих действиях, а поиск — «кто открыл карточку» —
-- на подборку не влиял.
--
-- Теперь есть одна формула listing_engagement_score() и триггер, который
-- пересчитывает score при любом изменении счётчиков. Любой писатель (поиск,
-- лента, карточка, бот) попадает в один и тот же котёл.

begin;

alter table public.listing_stat
    add column if not exists impressions integer not null default 0,
    add column if not exists favorites   integer not null default 0;

create or replace function public.listing_engagement_score(
    p_views integer,
    p_impressions integer,
    p_favorites integer,
    p_likes integer,
    p_comments integer,
    p_reposts integer
) returns numeric
language sql
immutable
parallel safe
as $$
    select round((
        ln(
            1
            + greatest(coalesce(p_views, 0), 0)
            + 5 * greatest(coalesce(p_favorites, 0), 0)
            + 2 * greatest(coalesce(p_likes, 0), 0)
            + 3 * greatest(coalesce(p_comments, 0), 0)
            + 4 * greatest(coalesce(p_reposts, 0), 0)
        )
        -- CTR: «открыли» весит больше, чем «просто показали». Сглаживание
        -- +1/+10 не даёт одному показу с одним открытием дать 100 % интереса.
        + 4.0 * (greatest(coalesce(p_views, 0), 0) + 1)
              / (greatest(coalesce(p_impressions, 0), 0) + 10)
    )::numeric, 4);
$$;

create or replace function public.listing_stat_recalc_score() returns trigger
language plpgsql
as $$
begin
    new.score := public.listing_engagement_score(
        new.views,
        new.impressions,
        new.favorites,
        new.likes,
        new.comments,
        new.reposts
    );
    return new;
end;
$$;

drop trigger if exists listing_stat_score on public.listing_stat;
create trigger listing_stat_score
    before insert or update of views, impressions, favorites, likes, comments, reposts
    on public.listing_stat
    for each row execute function public.listing_stat_recalc_score();

-- Пересчитываем накопленное: старую формулу писали руками, она расходится
-- с новой у всех строк.
update public.listing_stat set views = views;

grant execute on function public.listing_engagement_score(
    integer, integer, integer, integer, integer, integer
) to carcar_runtime;
grant execute on function public.listing_stat_recalc_score() to carcar_runtime;

commit;
