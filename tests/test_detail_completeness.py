"""Regressions for cards that were marked fetched without saving their photos."""
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
import json

import pytest

from carcar.cache import Cache
from carcar.config import Settings
from carcar.dashboard.repo import DatabaseRepo
from carcar.db import DatabaseSink
from carcar.miniapp.repo import MiniAppRepo
from carcar.parse import ParseError, extract_next_data, parse_offer
from carcar.runner import enrich
from carcar.store import Store


class Cursor:
    def __init__(self, row=None):
        self.row = row
        self.calls = []
        self.query = ''
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, params=None):
        self.query = sql
        self.calls.append((sql, params))
    def fetchone(self): return self.row
    def fetchall(self): return []


class Connection:
    def __init__(self, cursor): self.c = cursor
    def cursor(self): return self.c


class Pool:
    def __init__(self, cursor): self.c = cursor
    @contextmanager
    def connection(self): yield Connection(self.c)


def repo_for(row):
    repo = MiniAppRepo.__new__(MiniAppRepo)
    repo.pool = Pool(Cursor(row))
    repo.cache = None
    repo._detail_guard = Cache()
    return repo


def fake_client(monkeypatch, html, calls):
    class Client:
        def __init__(self, settings):
            assert settings.timeout == 10
            assert settings.retries == 1
        def __enter__(self): return self
        def __exit__(self, *args): calls.append('closed')
        def get(self, url):
            calls.append(url)
            return SimpleNamespace(text=html)
    monkeypatch.setattr('carcar.client.Client', Client)


def test_lazy_detail_saves_photos_with_metadata_and_closes_http_client(monkeypatch, offer_html):
    offer = parse_offer(offer_html)
    row = dict(id=12, external_id=offer.id, title=offer.title, price=0, url='https://example/card',
               currency='PLN', photos=[], photos_count=0, details_fetched_at=None)
    repo = repo_for(row)
    calls = []
    saved = []
    fake_client(monkeypatch, offer_html, calls)
    repo.apply_detail = lambda listing_id, values: saved.append((listing_id, values))
    card = repo.get_listing(12)
    assert saved[0][0] == 12
    assert saved[0][1]['photos'] == offer.photos[:60]
    assert saved[0][1]['photos_count'] == len(offer.photos[:60])
    assert card['photos'] == offer.photos[:60]
    assert card['description'] == offer.description.strip()[:2000]
    assert card['detail_status'] == 'ready'
    assert calls == ['https://example/card', 'closed']


def test_missing_optional_equipment_does_not_redownload_complete_card(monkeypatch):
    repo = repo_for(dict(id=12,external_id='123',title='BMW',price=0,url='https://example/card',
                        currency='PLN',photos=['https://example/photo'],photos_count=1,
                        description='',equipment=[],details_fetched_at=datetime.now(UTC)))
    calls = []
    fake_client(monkeypatch, '', calls)
    assert repo.get_listing(12)['detail_status'] == 'ready'
    assert calls == []


def test_failed_detail_does_not_mark_complete_or_repeat_immediately(monkeypatch, offer_html):
    offer = parse_offer(offer_html)
    repo = repo_for(dict(id=12,external_id='different-id',title='BMW',price=0,url='https://example/card',
                        currency='PLN',photos=[],photos_count=0,details_fetched_at=None))
    calls = []
    fake_client(monkeypatch, offer_html, calls)
    repo.apply_detail = lambda *args: pytest.fail('invalid source card must never be saved')
    assert repo.get_listing(12)['detail_status'] == 'pending'
    assert repo.get_listing(12)['detail_status'] == 'pending'
    assert calls == ['https://example/card', 'closed']


def test_apply_detail_writes_photos_and_completion_in_one_transaction():
    repo = repo_for(None)
    values = {'photos':['https://example/1.jpg','javascript:bad'], 'equipment':[]}
    repo.apply_detail(12, values)
    sql, params = repo.pool.c.calls[0]
    assert params['photos'] == ['https://example/1.jpg']
    assert 'then cardinality(%(photos)s::text[]) else photos_count' in sql
    assert 'then now() else details_fetched_at' in sql
    assert 'photos = case' in sql
    assert len(repo.pool.c.calls) == 1


def test_dashboard_returns_saved_description_equipment_and_actual_fetch_time():
    fetched = datetime(2026,11,10,tzinfo=UTC)
    updated = datetime(2026,11,13,tzinfo=UTC)
    row = dict(id=12,external_id='123',title='BMW',price=20000,currency='PLN',url='https://example/card',
               photos=['https://example/photo'],photos_count=1,description='Saved original description',
               equipment=['ABS'],doors=4,details_fetched_at=fetched,updated_at=updated)
    card = DatabaseRepo.__new__(DatabaseRepo)._card(row,[])
    assert card['description'] == row['description']
    assert card['equipment'] == ['ABS']
    assert card['doors'] == 4
    assert card['fetched_at'] == fetched.isoformat()
    assert card['has_detail']
    row['details_fetched_at'] = None
    assert not DatabaseRepo.__new__(DatabaseRepo)._card(row,[])['has_detail']


def test_parser_rejects_empty_photos_and_wrong_card_identity(offer_html):
    payload = extract_next_data(offer_html)
    advert = payload['props']['pageProps']['advert']
    expected = str(advert['id'])
    with pytest.raises(ParseError, match='другую карточку'):
        parse_offer(offer_html, expected_id='wrong-id')
    advert['images'] = {'photos':[]}
    html = '<script id="__NEXT_DATA__">'+json.dumps(payload)+'</script>'
    with pytest.raises(ParseError, match='фотографии'):
        parse_offer(html, expected_id=expected)


class QueueSink:
    def __init__(self): self.requests = []; self.removed = []
    def is_paused(self, code): return False, None
    def pending_details(self, **kwargs):
        self.requests.append(kwargs)
        return [dict(external_id=id,url='https://example/'+id) for id in ['broken','valid']
                if id not in kwargs['exclude_ids'] and id != 'done'] if len(self.requests)==1 else [
                    dict(external_id='broken',url='https://example/broken')
                ] if 'broken' not in kwargs['exclude_ids'] else []


def test_enrich_excludes_failed_card_and_keeps_processing_others(monkeypatch,tmp_path):
    sink = QueueSink()
    calls = []
    def fetch(client,store,item,*,sink,code):
        calls.append((item.id,code))
        if item.id == 'broken': raise ParseError('invalid')
        return 'db'
    monkeypatch.setattr('carcar.runner.fetch_detail',fetch)
    result = enrich(None,Store(root=tmp_path),Settings(source='olx'),sink=sink,limit=10,minutes=1)
    assert result['processed'] == 2
    assert result['enriched'] == 1
    assert result['errors'] == 1
    assert sink.requests[1]['exclude_ids'] == ['broken']
    assert sink.requests[0]['code'] == 'olx'
    assert calls == [('broken','olx'),('valid','olx')]


def test_enrich_stops_after_source_block_without_hammering_next_cards(monkeypatch,tmp_path):
    from carcar.client import BlockedError
    sink = QueueSink()
    def fetch(*args,**kwargs): raise BlockedError('403')
    monkeypatch.setattr('carcar.runner.fetch_detail',fetch)
    result = enrich(None,Store(root=tmp_path),Settings(),sink=sink,limit=10,minutes=1)
    assert result['blocked']
    assert result['processed'] == 1
    assert result['errors'] == 1


def test_enrich_respects_source_pause(monkeypatch,tmp_path):
    sink = QueueSink()
    sink.is_paused = lambda code: (True,'maintenance')
    result = enrich(None,Store(root=tmp_path),Settings(),sink=sink,limit=10,minutes=1)
    assert result['processed'] == 0
    assert not sink.requests


def test_pending_queue_revisits_legacy_no_photo_rows_and_uses_oldest_first():
    cursor = Cursor()
    sink = DatabaseSink.__new__(DatabaseSink)
    sink.conn = Connection(cursor)
    sink.conn.commit = lambda: None
    sink.source_id = lambda code: 7
    sink.pending_details(code='olx',exclude_ids=['broken'],shard=1,shards=2)
    sql, params = cursor.calls[-1]
    assert 'order by first_seen_at asc, id asc' in sql
    assert 'coalesce(photos_count,0) = 0' in sql
    assert 'source_id = %s' in sql
    assert params == (7,2,2,1,['broken'],50)
    with pytest.raises(ValueError): sink.pending_details(shard=2,shards=2)


def test_fetch_guard_claims_once_until_expiration(monkeypatch):
    clock = [10.0]
    monkeypatch.setattr('carcar.cache.time.monotonic',lambda:clock[0])
    cache = Cache()
    assert cache.add('same-card',True,ttl=60)
    assert not cache.add('same-card',True,ttl=60)
    clock[0] = 71
    assert cache.add('same-card',True,ttl=60)
