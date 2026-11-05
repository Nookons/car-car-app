"""Командная строка сборщика.

    python -m carcar discover --pages 2        # забрать выдачу, новые строки — в папку
    python -m carcar collect --details 5       # выдача + карточки новых
    python -m carcar watch --minutes 10        # цикл, как в проде
    python -m carcar detail --id 6151080882    # одна карточка
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
from .parse import ParseError, parse_offer
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

    p_collect = sub.add_parser("collect", help="выдача + карточки новых объявлений")
    _add_common(p_collect)
    p_collect.add_argument("--pages", type=int, default=1)
    p_collect.add_argument("--details", type=int, default=5, help="сколько карточек забрать")
    p_collect.add_argument("--stop-after-known", type=int, default=2)

    p_detail = sub.add_parser("detail", help="забрать одну карточку по id или url")
    _add_common(p_detail)
    p_detail.add_argument("--id", help="id объявления, уже встречавшийся в выдаче")
    p_detail.add_argument("--url", help="прямая ссылка на объявление")
    p_detail.add_argument("--refresh", action="store_true", help="перезаписать, если уже есть")

    p_watch = sub.add_parser("watch", help="цикл опроса выдачи")
    _add_common(p_watch)
    p_watch.add_argument("--interval", type=float, default=15.0, help="пауза между опросами, сек")
    p_watch.add_argument("--minutes", type=float, default=10.0, help="сколько работать, мин")
    p_watch.add_argument("--details", type=int, default=5)

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


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if getattr(args, "verbose", False) else logging.INFO,
        format="%(levelname)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.command == "stats":
        store = Store(root=args.data)
        print(json.dumps(store.stats(), ensure_ascii=False, indent=1))
        return 0

    settings = _settings(args)
    store = Store(root=settings.data_dir, source=settings.source)

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
                summary = result.stats.as_dict() | {"client": client.stats.as_dict()}
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
                    from .parse import Listing

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
