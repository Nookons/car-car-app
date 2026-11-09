"""Алерты о снижении цены: кому, с каким ключом дедупа и без спама."""

from carcar.notify import Notifier


class FakeConn:
    def close(self) -> None:
        pass


ITEM = {
    "id": 42,
    "external_id": "6150373432",
    "title": "Audi A4 2.0 TDI",
    "price": 37900,
    "currency": "PLN",
    "year": 2018,
    "mileage_km": 120000,
    "city": "Kraków",
    "thumb_url": None,
}


class FakeNotifier(Notifier):
    def __init__(self, users, send_ok=True):
        super().__init__("postgresql://fake", "token")
        self.users = users
        self.send_ok = send_ok
        self.remembered: list[dict] = []
        self.sent: list[dict] = []
        self.failed: list[dict] = []
        self.delivered: list[tuple] = []
        self._seen: set[tuple] = set()

    def connect(self):
        return FakeConn()

    def listing(self, conn, source, external_id):
        return ITEM

    def favorited(self, conn, listing_id):
        return self.users

    def remember_price_drop(self, conn, user_id, listing_id, old_price, new_price):
        key = (user_id, listing_id, new_price)
        if key in self._seen:
            return False
        self._seen.add(key)
        self.remembered.append(
            {
                "user_id": user_id,
                "listing_id": listing_id,
                "kind": "price_drop",
                "payload": {"old_price": old_price, "new_price": new_price},
            }
        )
        return True

    def sent_last_hour(self, conn, user_id):
        return 0

    def mark_sent(self, conn, user_id, listing_id, message_id, kind="new"):
        self.sent.append({"user_id": user_id, "kind": kind, "message_id": message_id})

    def mark_failed(self, conn, user_id, listing_id, attempts, error, kind="new"):
        self.failed.append({"user_id": user_id, "kind": kind, "error": error})

    def send_price_drop(self, chat_id, item, old_price, new_price, lang="ru"):
        self.delivered.append((chat_id, old_price, new_price, lang))
        return (True, 55, None) if self.send_ok else (False, None, "telegram down")


EVENT = {
    "type": "listing.price_drop",
    "source": "otomoto",
    "external_id": "6150373432",
    "old_price": 39000,
    "new_price": 37900,
}


def test_handle_event_routes_price_drop():
    notifier = FakeNotifier([])
    notifier.handle_price_drop = lambda event: 7
    assert notifier.handle_event(EVENT) == 7


def test_unknown_event_is_ignored():
    assert FakeNotifier([]).handle_event({"type": "listing.removed"}) == 0


def test_price_drop_sends_to_favorited_user():
    notifier = FakeNotifier([{"user_id": 1, "tg_id": 101, "lang": "ru"}])

    assert notifier.handle_price_drop(EVENT) == 1

    assert notifier.delivered == [(101, 39000, 37900, "ru")]
    assert notifier.remembered[0]["kind"] == "price_drop"
    assert notifier.remembered[0]["payload"] == {"old_price": 39000, "new_price": 37900}
    assert notifier.sent[0]["kind"] == "price_drop"


def test_same_price_is_not_sent_twice():
    notifier = FakeNotifier([{"user_id": 1, "tg_id": 101, "lang": "ru"}])

    assert notifier.handle_price_drop(EVENT) == 1
    assert notifier.handle_price_drop(EVENT) == 0
    assert len(notifier.delivered) == 1


def test_no_favorites_no_message():
    notifier = FakeNotifier([])
    assert notifier.handle_price_drop(EVENT) == 0
    assert notifier.delivered == []


def test_price_growth_is_not_an_alert():
    notifier = FakeNotifier([{"user_id": 1, "tg_id": 101, "lang": "ru"}])
    event = {**EVENT, "old_price": 37900, "new_price": 39000}
    assert notifier.handle_price_drop(event) == 0
    assert notifier.delivered == []


def test_send_failure_is_marked_for_retry():
    notifier = FakeNotifier([{"user_id": 1, "tg_id": 101, "lang": "ru"}], send_ok=False)
    assert notifier.handle_price_drop(EVENT) == 0
    assert notifier.failed[0]["kind"] == "price_drop"


class _DictCursor:
    def __init__(self, row):
        self._row = row

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *args, **kwargs):
        pass

    def fetchone(self):
        return self._row


class _DictConn:
    def __init__(self, row):
        self._row = row

    def cursor(self):
        return _DictCursor(self._row)


def test_hourly_cap_reads_dict_rows():
    notifier = Notifier("postgresql://fake", "token")
    assert notifier.sent_last_hour(_DictConn({"n": 3}), user_id=1) == 3
