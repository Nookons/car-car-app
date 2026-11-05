import json

from carcar.store import Store


def test_save_detail_is_idempotent(tmp_path):
    store = Store(root=tmp_path)
    payload = {"id": "123", "title": "Test"}

    first = store.save_detail(payload, listing_id="123", url="https://x/1")
    second = store.save_detail(payload, listing_id="123", url="https://x/1")

    assert first is not None and first.exists()
    assert second is None  # второй раз не перезаписываем

    saved = json.loads(first.read_text(encoding="utf-8"))
    assert saved["schema"] == 1
    assert saved["listing_id"] == "123"
    assert saved["data"] == payload


def test_save_detail_refresh_overwrites(tmp_path):
    store = Store(root=tmp_path)
    store.save_detail({"v": 1}, listing_id="1", url="https://x/1")
    path = store.save_detail({"v": 2}, listing_id="1", url="https://x/1", refresh=True)

    assert json.loads(path.read_text(encoding="utf-8"))["data"] == {"v": 2}


def test_no_partial_files_after_write(tmp_path):
    store = Store(root=tmp_path)
    store.save_detail({"id": "1"}, listing_id="1", url="https://x/1")

    leftovers = list(tmp_path.rglob("*.tmp"))
    assert leftovers == []


def test_discovered_and_seen(tmp_path):
    store = Store(root=tmp_path)

    assert store.append_discovered([{"id": "a"}, {"id": "b"}]) == 2
    assert store.append_discovered([]) == 0
    assert store.append_discovered([{"id": "c"}]) == 1

    rows = list(store.iter_discovered())
    assert [r["id"] for r in rows] == ["a", "b", "c"]
    assert all("seen_at" in r for r in rows)

    assert store.add_seen(["a", "b"]) == 2
    assert store.add_seen(["a", "b"]) == 0  # повторно не пишем
    assert store.load_seen() == {"a", "b"}

    # новый Store читает состояние с диска
    assert Store(root=tmp_path).load_seen() == {"a", "b"}


def test_stats(tmp_path):
    store = Store(root=tmp_path)
    store.append_discovered([{"id": "a"}])
    store.add_seen(["a"])
    store.save_detail({"id": "a"}, listing_id="a", url="https://x/a")

    stats = store.stats()
    assert stats["detail_files"] == 1
    assert stats["discovered_rows"] == 1
    assert stats["seen_ids"] == 1
