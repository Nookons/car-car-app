-- Полный сброс схемы public проекта CarCar.
--
-- ВНИМАНИЕ: необратимо. Удаляются все таблицы, представления и свои enum-типы
-- в схеме public. Схемы auth, storage, realtime и расширения не трогаются.
--
-- Выполнять ТОЛЬКО в проекте CarCar. Проект складской эко-системы
-- (ljkugtpeboomboobodom) удалять нельзя — скрипт-запускатор это блокирует.

begin;

-- 1. Представления (кроме принадлежащих расширениям: geography_columns у PostGIS)
do $$
declare r record;
begin
    for r in
        select c.relname, c.relkind
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('v', 'm')
          and not exists (
              select 1 from pg_depend d
              where d.objid = c.oid and d.deptype = 'e'
          )
    loop
        execute format(
            'drop %s if exists public.%I cascade',
            case when r.relkind = 'm' then 'materialized view' else 'view' end,
            r.relname
        );
    end loop;
end $$;

-- 2. Таблицы (кроме принадлежащих расширениям: spatial_ref_sys у PostGIS)
do $$
declare r record;
begin
    for r in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and not exists (
              select 1 from pg_depend d
              where d.objid = c.oid and d.deptype = 'e'
          )
    loop
        execute format('drop table if exists public.%I cascade', r.relname);
    end loop;
end $$;

-- 3. Свои enum-типы (типы расширений не принадлежат public, их не задеваем)
do $$
declare r record;
begin
    for r in
        select t.typname
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typtype = 'e'
          and not exists (
              select 1 from pg_depend d
              where d.objid = t.oid and d.deptype = 'e'
          )
    loop
        execute format('drop type if exists public.%I cascade', r.typname);
    end loop;
end $$;

commit;

-- Проверка: своих таблиц должно остаться 0 (spatial_ref_sys принадлежит PostGIS)
select count(*) as own_tables_left
from pg_tables t
where t.schemaname = 'public'
  and not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_depend d on d.objid = c.oid and d.deptype = 'e'
      where n.nspname = 'public' and c.relname = t.tablename
  );
