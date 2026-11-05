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
import sys
from pathlib import Path

from .client import BlockedError, Client, FetchError
from .config import Settings
from .control import load_control, save_control
from .parse import Listing, ParseError, parse_offer
from .runner import collect, discover, fetch_detail, watch
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

    p_dash = sub.add_parser("dashboard", help="веб-дашборд со статусом и паузой")
    p_dash.add_argument("--data", type=Path, default=Path("data"))
    p_dash.add_argument("--host", default="127.0.0.1", help="по умолчанию только локально")
    p_dash.add_argument("--port", type=int, default=8077)

    p_pause = sub.add_parser("pause", help="поставить сбор на паузу")
    p_pause.add_argument("--data", type=Path, default=Path("data"))
    p_pause.add_argument("--reason", default=None)

    p_resume = sub.add_parser("resume", help="снять паузу")
    p_resume.add_argument("--data", type=Path, default=Path("data"))

    p_stats = sub.add_parser("stats", help="что уже собрано")
    p_stats.add_argument("--data", type=Path, default=Path("data"))

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

    app = create_app(root=args.data)
    print(f"дашборд: http://{args.host}:{args.port}  (Ctrl+C — остановить)")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


def main(argv: list[str] | None = None) -> int:
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
        print(
            json.dumps(
                store.stats() | {"control": control.as_dict()},
                ensure_ascii=False,
                indent=1,
            )
        )
        return 0

    if args.command == "dashboard":
        return _run_dashboard(args)

    if args.command in {"pause", "resume"}:
        store = Store(root=args.data)
        paused = args.command == "pause"
        state = save_control(
            store.control_path,
            paused=paused,
            reason=getattr(args, "reason", None),
            by="cli",
        )
        print(f"{'пауза' if paused else 'пауза снята'}: {state.updated_at}")
        return 0

    settings = _settings(args)
    store = Store(root=settings.data_dir, source=settings.source)

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
                )
                _print_summary(summary)

            elif args.command == "watch":
                summary = watch(
                    client,
                    store,
                    settings,
                    interval=args.interval,
                    minutes=args.minutes,
                    details=args.details,
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
                    )
                else:
                    print("нужен --id или --url", file=sys.stderr)
                    return 2

                if path:
                    print(f"сохранено: {path} ({path.stat().st_size / 1024:.0f} КБ)")
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

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
