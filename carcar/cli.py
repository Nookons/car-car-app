"""Командная строка сборщика.

    python -m carcar discover --pages 2        # забрать выдачу, новые строки — в папку
    python -m carcar collect --details 5       # выдача + карточки новых
    python -m carcar watch --minutes 10        # цикл, как в проде
    python -m carcar detail --id 6151080882    # одна карточка
    python -m carcar dashboard                 # дашборд на http://127.0.0.1:8077
    python -m carcar pause --reason "чиним"    # пауза сбора
    python -m carcar resume                    # снять паузу
    python -m carcar stats                     # что уже лежит на диске
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from .client import BlockedError, Client, FetchError
from .config import Settings, load_env_file
from .control import load_control, save_control
from .db import DatabaseSink, database_url
from .parse import Listing, ParseError, parse_offer
from .runner import collect, discover, enrich, fetch_detail, sweep, watch
from .store import Store

log = logging.getLogger("carcar")


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--data", type=Path, default=Path("data"), help="папка данных")
    parser.add_argument(
        "--rps", type=float, default=1.0, help="запросов в секунду (по умолчанию 1)"
    )
    parser.add_argument("--timeout", type=float, default=20.0, help="таймаут запроса, сек")
    parser.add_argument("--retries", type=int, default=3, help="попыток на запрос")
    parser.add_argument("-v", "--verbose", action="store_true", help="подробный лог")
    parser.add_argument(
        "--file", action="store_true", help="хранить локально в папке, а не в базе"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="carcar", description="Сборщик объявлений otomoto")
    sub = parser.add_subparsers(dest="command", required=True)

    p_discover = sub.add_parser("discover", help="забрать страницы выдачи")
    _add_common(p_discover)
    p_discover.add_argument("--pages", type=int, default=1)
    p_discover.add_argument("--stop-after-known", type=int, default=2)
    p_discover.add_argument("--force", action="store_true", help="игнорировать паузу")

    p_collect = sub.add_parser("collect", help="выдача + карточки новых объявлений")
    _add_common(p_collect)
    p_collect.add_argument("--pages", type=int, default=1)
    p_collect.add_argument("--details", type=int, default=5, help="сколько карточек забрать")
    p_collect.add_argument("--stop-after-known", type=int, default=2)
    p_collect.add_argument("--force", action="store_true", help="игнорировать паузу")

    p_detail = sub.add_parser("detail", help="забрать одну карточку по id или url")
    _add_common(p_detail)
    p_detail.add_argument("--id", help="id объявления, уже встречавшийся в выдаче")
    p_detail.add_argument("--url", help="прямая ссылка на объявление")
    p_detail.add_argument("--refresh", action="store_true", help="перезаписать, если уже есть")

    p_watch = sub.add_parser("watch", help="цикл опроса выдачи")
    _add_common(p_watch)
    p_watch.add_argument("--interval", type=float, default=60.0, help="пауза между опросами, сек")
    p_watch.add_argument("--minutes", type=float, default=10.0, help="сколько работать, мин")
    p_watch.add_argument("--details", type=int, default=5)

    p_bot = sub.add_parser("bot", help="Telegram-бот: кнопка запуска Mini App")
    p_bot.add_argument("--public-url", default=None, help="https-адрес Mini App")

    p_mini = sub.add_parser("miniapp", help="Telegram Mini App (API + фронтенд)")
    p_mini.add_argument("--host", default="127.0.0.1")
    p_mini.add_argument("--port", type=int, default=8080)

    p_dash = sub.add_parser("dashboard", help="веб-дашборд со статусом и паузой")
    p_dash.add_argument("--data", type=Path, default=Path("data"))
    p_dash.add_argument("--host", default="127.0.0.1", help="по умолчанию только локально")
    p_dash.add_argument("--port", type=int, default=8077)
    p_dash.add_argument("--file", action="store_true", help="читать файлы, а не базу")

    p_pause = sub.add_parser("pause", help="поставить сбор на паузу")
    p_pause.add_argument("--data", type=Path, default=Path("data"))
    p_pause.add_argument("--reason", default=None)
    p_pause.add_argument("--source", default=None, help="площадка (по умолчанию из env)")

    p_resume = sub.add_parser("resume", help="снять паузу")
    p_resume.add_argument("--data", type=Path, default=Path("data"))
    p_resume.add_argument("--source", default=None, help="площадка (по умолчанию из env)")

    p_stats = sub.add_parser("stats", help="что уже собрано")
    p_stats.add_argument("--data", type=Path, default=Path("data"))
    p_stats.add_argument("--file", action="store_true", help="смотреть папку, а не базу")

    p_sweep = sub.add_parser("sweep", help="полный обход рынка (история, проверка снятых)")
    _add_common(p_sweep)
    p_sweep.add_argument("--from-page", type=int, default=0, help="продолжить с сохранённого места")
    p_sweep.add_argument("--max-pages", type=int, default=0, help="0 — до конца")
    p_sweep.add_argument("--minutes", type=float, default=0.0, help="0 — без ограничения")

    p_enrich = sub.add_parser("enrich", help="догрузить карточки без фото")
    _add_common(p_enrich)
    p_enrich.add_argument("--limit", type=int, default=200)
    p_enrich.add_argument("--shard", type=int, default=0, help="номер шарда (0..shards-1)")
    p_enrich.add_argument("--shards", type=int, default=1, help="сколько воркеров делят очередь")
    p_enrich.add_argument("--minutes", type=float, default=30.0)

    p_purge = sub.add_parser("purge", help="очистка старых записей в базе")
    p_purge.add_argument("--days", type=int, default=30, help="сколько дней хранить снятые")
    p_purge.add_argument("--data", type=Path, default=Path("data"))

    return parser


def _settings(args: argparse.Namespace) -> Settings:
    return Settings(
        data_dir=args.data,
        rps=args.rps,
        timeout=args.timeout,
        retries=args.retries,
    )


def _print_summary(summary: dict) -> None:
    print(
        f"\nитого: новых {summary.get('new_ids', 0)} | "
        f"карточек {summary.get('details_saved', 0)} | "
        f"ошибок {summary.get('errors', 0)} | "
        f"{summary.get('seconds', 0)} с"
    )
    client = summary.get("client") or {}
    if client:
        print(
            f"сеть: {client.get('requests', 0)} запросов, "
            f"{client.get('retries', 0)} ретраев, "
            f"{client.get('wire_bytes', 0) / 1024:.0f} КБ по проводу"
        )


def _guard_pause(store: Store, force: bool) -> bool:
    control = load_control(store.control_path)
    if control.paused and not force:
        reason = control.reason or "без причины"
        print(f"сбор на паузе ({reason}). Снять: carcar resume, или --force", file=sys.stderr)
        return False
    return True


def _run_dashboard(args: argparse.Namespace) -> int:
    import uvicorn

    from .dashboard.app import create_app

    url = None if getattr(args, "file", False) else database_url()
    app = create_app(root=args.data, use_db=bool(url), db_url=url)
    source = "база" if url else "файлы"
    print(f"дашборд: http://{args.host}:{args.port}  (данные: {source})")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


def main(argv: list[str] | None = None) -> int:
    load_env_file()
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if getattr(args, "verbose", False) else logging.INFO,
        format="%(levelname)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # -- команды, которым не нужен HTTP-клиент ----------------------------
    if args.command == "stats":
        store = Store(root=args.data)
        control = load_control(store.control_path)
        payload: dict = store.stats() | {"control": control.as_dict()}
        url = database_url()
        if url and not args.file:
            sink = DatabaseSink(url)
            try:
                payload["database"] = sink.stats()
            finally:
                sink.close()
        print(json.dumps(payload, ensure_ascii=False, indent=1))
        return 0

    if args.command == "purge":
        url = database_url()
        if not url:
            print("нужен DATABASE_URL", file=sys.stderr)
            return 2
        sink = DatabaseSink(url)
        try:
            with sink.conn.cursor() as cur:
                cur.execute("select * from carcar_purge(%s)", (args.days,))
                row = cur.fetchone()
            sink.conn.commit()
        finally:
            sink.close()
        print(
            f"очистка: снятых объявлений {row[0]}, прогонов {row[1]}, "
            f"отказов {row[2]}, событий {row[3]}"
        )
        return 0

    if args.command == "bot":
        from .bot import Bot

        token = os.environ.get("CARCAR_BOT_TOKEN", "")
        if not token:
            print("нужен CARCAR_BOT_TOKEN", file=sys.stderr)
            return 2
        public_url = args.public_url or os.environ.get("CARCAR_PUBLIC_URL")
        Bot(token, public_url).run()
        return 0

    if args.command == "miniapp":
        import uvicorn

        from .miniapp.api import create_app as create_miniapp

        print(f"mini app: http://{args.host}:{args.port}")
        uvicorn.run(create_miniapp(), host=args.host, port=args.port, log_level="warning")
        return 0

    if args.command == "dashboard":
        return _run_dashboard(args)

    if args.command in {"pause", "resume"}:
        paused = args.command == "pause"
        source = args.source or os.environ.get("CARCAR_SOURCE", "otomoto")
        url = database_url()
        if url:
            sink = DatabaseSink(url)
            try:
                sink.set_paused(
                    source, paused, getattr(args, "reason", None), by="cli"
                )
            finally:
                sink.close()
            print(f"{'пауза' if paused else 'пауза снята'}: {source} (база)")
        else:
            store = Store(root=args.data)
            state = save_control(
                store.control_path,
                paused=paused,
                reason=getattr(args, "reason", None),
                by="cli",
            )
            print(f"{'пауза' if paused else 'пауза снята'}: {state.updated_at}")
        return 0

    settings = _settings(args)
    if settings.source not in {"otomoto"}:
        print(
            f"парсер для площадки «{settings.source}» ещё не реализован "
            "(сейчас поддерживается otomoto)",
            file=sys.stderr,
        )
        return 2
    store = Store(root=settings.data_dir, source=settings.source)

    sink: DatabaseSink | None = None
    if not getattr(args, "file", False):
        url = database_url()
        if url:
            sink = DatabaseSink(url)
            print(f"хранилище: база ({url.split('@')[-1].split('/')[0]})")
        else:
            print("хранилище: папка (DATABASE_URL не задан)")

    if args.command in {"discover", "collect"} and not _guard_pause(
        store, getattr(args, "force", False)
    ):
        return 4

    try:
        with Client(settings) as client:
            if args.command == "discover":
                result = discover(
                    client,
                    store,
                    settings,
                    pages=args.pages,
                    stop_after_known=args.stop_after_known,
                    sink=sink,
                )
                if sink is not None:
                    from .runner import _db_result

                    sink.log_run(
                        code=settings.source,
                        started_at=result.stats.started_at,
                        result=_db_result(result.stats),
                        pages=result.stats.pages,
                        items=result.stats.items,
                        errors=result.stats.errors,
                        notes="discover",
                    )
                summary = result.stats.as_dict() | {
                    "mode": "discover",
                    "client": client.stats.as_dict(),
                }
                store.write_run(summary)
                _print_summary(summary)

            elif args.command == "collect":
                summary = collect(
                    client,
                    store,
                    settings,
                    pages=args.pages,
                    details=args.details,
                    stop_after_known=args.stop_after_known,
                    sink=sink,
                )
                _print_summary(summary)

            elif args.command == "sweep":
                if sink is None:
                    print("нужен DATABASE_URL", file=sys.stderr)
                    return 2
                summary = sweep(
                    client,
                    store,
                    settings,
                    sink=sink,
                    from_page=args.from_page,
                    max_pages=args.max_pages,
                    minutes=args.minutes,
                )
                print(
                    f"обход: страниц {summary['pages']}, новых {summary['inserted']}, "
                    f"обновлено {summary['updated']}, ошибок {summary['errors']}, "
                    f"следующая страница {summary['next_page']}"
                )

            elif args.command == "enrich":
                if sink is None:
                    print("нужен DATABASE_URL", file=sys.stderr)
                    return 2
                summary = enrich(
                    client,
                    store,
                    settings,
                    sink=sink,
                    limit=args.limit,
                    minutes=args.minutes,
                    shard=args.shard,
                    shards=args.shards,
                )
                print(
                    f"обогащено: {summary['enriched']} из {summary['processed']} "
                    f"(ошибок {summary['errors']}, {summary['seconds']} с)"
                )

            elif args.command == "watch":
                summary = watch(
                    client,
                    store,
                    settings,
                    interval=args.interval,
                    minutes=args.minutes,
                    details=args.details,
                    sink=sink,
                )
                _print_summary(summary)
                print(f"на диске: {json.dumps(summary.get('storage', {}), ensure_ascii=False)}")

            elif args.command == "detail":
                if args.url:
                    response = client.get(args.url)
                    offer = parse_offer(response.text, args.url)
                    path = store.save_detail(
                        offer.raw,
                        listing_id=offer.id,
                        url=args.url,
                        refresh=args.refresh,
                    )
                elif args.id:
                    row = store.find_listing(args.id)
                    if not row:
                        print(
                            f"id {args.id} нет в {store.discovered_path} — "
                            "сначала discover или передай --url",
                            file=sys.stderr,
                        )
                        return 2
                    path = fetch_detail(
                        client,
                        store,
                        Listing(**{k: row[k] for k in Listing.__slots__ if k in row}),
                        refresh=args.refresh,
                        sink=sink,
                    )
                else:
                    print("нужен --id или --url", file=sys.stderr)
                    return 2

                if isinstance(path, Path):
                    print(f"сохранено: {path} ({path.stat().st_size / 1024:.0f} КБ)")
                elif path:
                    print("карточка записана в базу")
                else:
                    print("карточка уже есть (--refresh чтобы перезаписать)")
            return 0

    except BlockedError as exc:
        log.error("%s", exc)
        return 3
    except (FetchError, ParseError) as exc:
        log.error("%s", exc)
        return 1
    except KeyboardInterrupt:
        print("\nпрервано", file=sys.stderr)
        return 130
    finally:
        if sink is not None:
            sink.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
