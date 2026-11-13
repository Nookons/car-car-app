"""Support subscription deletion: owner scoping and selective queue cancellation."""
from contextlib import contextmanager
import pytest
from fastapi.testclient import TestClient
from carcar.dashboard.app import create_app
from carcar.dashboard.repo import DatabaseRepo


class Cursor:
    def __init__(self, deleted):
        self.deleted = deleted
        self.calls = []
        self.query = ''
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, query, params):
        self.query = query
        self.calls.append((query, params))
    def fetchone(self): return self.deleted
    def fetchall(self):
        if 'select criteria' in self.query:
            return [{'criteria': {'makes': ['BMW']}}]
        return [dict(notification_id=1, make='BMW', status='active'),
                dict(notification_id=2, make='Fiat', status='active')]


class Connection:
    def __init__(self, cursor): self.c = cursor
    def cursor(self): return self.c


class Pool:
    def __init__(self, cursor):
        self.cursor = cursor
        self.committed = False
    @contextmanager
    def connection(self):
        yield Connection(self.cursor)
        self.committed = True


def test_deletion_preserves_notifications_matching_another_subscription():
    cursor = Cursor({'id': 20, 'name': 'Old filter'})
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    result = repo.delete_user_subscription(13, 20)
    assert result == {'id': 20, 'cancelled_notifications': 1}
    assert cursor.calls[0][1] == (20, 13)
    assert 'where id=%s and user_id=%s' in cursor.calls[0][0]
    assert cursor.calls[-1][1] == ('cancelled: subscription deleted by administrator', 13, [2])
    assert repo.pool.committed


def test_missing_or_other_users_subscription_does_not_touch_queue():
    cursor = Cursor(None)
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    assert repo.delete_user_subscription(14, 20) is None
    assert len(cursor.calls) == 1
    assert cursor.calls[0][1] == (20, 14)


def test_failed_cancellation_rolls_back_the_delete():
    cursor = Cursor({'id': 20, 'name': 'Old filter'})
    original = cursor.execute
    def execute(query, params):
        if 'update notification' in query: raise RuntimeError('db failure')
        original(query, params)
    cursor.execute = execute
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    with pytest.raises(RuntimeError): repo.delete_user_subscription(13, 20)
    assert not repo.pool.committed


@pytest.fixture
def admin_client(monkeypatch, tmp_path):
    class Repo:
        def __init__(self): self.calls = []
        def delete_user_subscription(self, user_id, sub_id):
            self.calls.append((user_id, sub_id))
            if (user_id, sub_id) == (13, 20):
                return {'id': sub_id, 'cancelled_notifications': 1}
            return None
        def set_user_subscription_active(self, user_id, sub_id, active):
            self.calls.append((user_id, sub_id, active))
            if (user_id, sub_id) == (13, 20):
                return {'id':sub_id, 'active':active, 'cancelled_notifications':int(not active)}
            return None
        def user_notifications(self, user_id, days, limit, before_id):
            self.calls.append((user_id, days, limit, before_id))
            if user_id == 13: return {'items':[], 'totals':{}, 'next_before_id':None}
            return None
        def close(self): pass
    repo = Repo()
    monkeypatch.setattr('carcar.dashboard.app.DatabaseRepo', lambda url: repo)
    monkeypatch.setenv('CARCAR_DASHBOARD_PASSWORD', 'test-admin-password')
    app = create_app(root=tmp_path, use_db=True, db_url='postgresql://unused')
    with TestClient(app, base_url='https://testserver') as client:
        yield client, repo


def test_route_requires_admin_login(admin_client):
    client, repo = admin_client
    assert client.delete('/api/users/13/subscriptions/20').status_code == 401
    assert not repo.calls


def test_route_deletes_only_named_users_subscription(admin_client):
    client, repo = admin_client
    assert client.post('/api/session', json={'password':'test-admin-password'}).status_code == 200
    response = client.delete('/api/users/13/subscriptions/20')
    assert response.status_code == 200
    assert response.json() == {'ok':True,'id':20,'cancelled_notifications':1}
    assert client.delete('/api/users/14/subscriptions/20').status_code == 404
    assert repo.calls == [(13,20),(14,20)]


@pytest.mark.parametrize('active', [False, True])
def test_pause_resume_is_scoped_and_resume_leaves_queue_untouched(active):
    cursor = Cursor({'id':20, 'active':active})
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    result = repo.set_user_subscription_active(13, 20, active)
    assert result == {'id':20, 'active':active, 'cancelled_notifications':int(not active)}
    assert cursor.calls[0][1] == (active, 20, 13)
    assert 'where id=%s and user_id=%s' in cursor.calls[0][0]
    if active:
        assert len(cursor.calls) == 1
    else:
        assert cursor.calls[-1][1] == ('cancelled: subscription paused by administrator', 13, [2])
    assert repo.pool.committed


def test_pause_missing_subscription_does_not_touch_queue():
    cursor = Cursor(None)
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    assert repo.set_user_subscription_active(14, 20, False) is None
    assert len(cursor.calls) == 1


def test_control_routes_require_admin_and_validate_payload(admin_client):
    client, repo = admin_client
    assert client.patch('/api/users/13/subscriptions/20', json={'active':False}).status_code == 401
    assert client.get('/api/users/13/notifications').status_code == 401
    assert not repo.calls
    client.post('/api/session', json={'password':'test-admin-password'})
    assert client.patch('/api/users/13/subscriptions/20', json={'active':'false'}).status_code == 422
    assert not repo.calls
    response = client.patch('/api/users/13/subscriptions/20', json={'active':False})
    assert response.status_code == 200
    assert response.json() == {'ok':True,'id':20,'active':False,'cancelled_notifications':1}
    assert client.patch('/api/users/14/subscriptions/20', json={'active':True}).status_code == 404
    assert repo.calls == [(13,20,False), (14,20,True)]


def test_history_routes_validate_limits_and_forward_cursor(admin_client):
    client, repo = admin_client
    client.post('/api/session', json={'password':'test-admin-password'})
    assert client.get('/api/users/13/notifications?limit=101').status_code == 422
    assert client.get('/api/users/13/notifications?before_id=0').status_code == 422
    assert not repo.calls
    response = client.get('/api/users/13/notifications?days=7&limit=10&before_id=52')
    assert response.status_code == 200
    assert repo.calls == [(13,7,10,52)]
    assert client.get('/api/users/14/notifications').status_code == 404


class HistoryCursor(Cursor):
    def fetchone(self): return {'id':13}
    def fetchall(self):
        if 'select criteria' in self.query: return [{'criteria':{'makes':['BMW']}}]
        if 'group by 1' in self.query: return [{'state':'sent','total':2}, {'state':'cancelled','total':1}]
        return [dict(id=52, listing_id=100, title='BMW', kind='new', delivery_status='sent',
                     created_at=None, sent_at=None, attempts=1, last_error=None, make='BMW', status='active'),
                dict(id=51, listing_id=101, title='Fiat', kind='new', delivery_status='dead',
                     created_at=None, sent_at=None, attempts=3,
                     last_error='cancelled: error https://api.telegram.org/bot123:Fake_secret/sendPhoto', make='Fiat', status='active'),
                dict(id=50, listing_id=102, title='BMW', kind='new', delivery_status='sent',
                     created_at=None, sent_at=None, attempts=1, last_error=None, make='BMW', status='active')]


def test_history_checks_current_criteria_redacts_secrets_and_paginates():
    cursor = HistoryCursor(None)
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    result = repo.user_notifications(13, 30, 2, 53)
    assert [row['id'] for row in result['items']] == [52, 51]
    assert result['next_before_id'] == 51
    assert result['totals'] == {'sent':2, 'cancelled':1}
    assert result['items'][0]['matches_current_filters'] is True
    assert result['items'][1]['matches_current_filters'] is False
    assert result['items'][1]['status'] == 'cancelled'
    assert 'Fake_secret' not in result['items'][1]['error']
    assert 'bot[скрыто]' in result['items'][1]['error']
    assert 'last_error' not in result['items'][1]
    assert cursor.calls[-1][1] == (13,30,53,3)
    assert 'and n.id < %s' in cursor.calls[-1][0]


def test_history_last_page_has_no_next_cursor():
    cursor = HistoryCursor(None)
    repo = DatabaseRepo.__new__(DatabaseRepo)
    repo.pool = Pool(cursor)
    assert repo.user_notifications(13, 30, 50)['next_before_id'] is None
    assert cursor.calls[-1][1] == (13,30,51)
