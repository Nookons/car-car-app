-- Восстановленное объявление не должно оставаться в «Индексе ушедших».
--
-- Если объявление снова появилось в выдаче (relist/restore), его строка в
-- listing_lifecycle больше не означает снятие. Удаляем её при переходе
-- removed → active. Это же чистит уже накопившиеся такие строки.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '10s';

create or replace function public.cleanup_restored_listing() returns trigger
language plpgsql
as $$
begin
    if new.status = 'active' and old.status = 'removed' then
        delete from public.listing_lifecycle where listing_id = new.id;
    end if;
    return new;
end;
$$;

drop trigger if exists listing_restored_cleanup on public.listing;
create trigger listing_restored_cleanup
after update of status on public.listing
for each row execute function public.cleanup_restored_listing();

-- Уже накопившиеся «архивные, но активные» строки.
delete from public.listing_lifecycle lc
using public.listing l
where l.id = lc.listing_id and l.status = 'active';

commit;
