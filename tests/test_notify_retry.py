from carcar.notify import BACKOFF_SECONDS, MAX_ATTEMPTS, retry_delay


def test_backoff_grows():
    delays = [retry_delay(attempt) for attempt in range(1, 6)]
    assert delays == [60, 300, 900, 3600, 21600]
    assert delays == sorted(delays)


def test_backoff_caps_at_last_value():
    assert retry_delay(99) == BACKOFF_SECONDS[-1]


def test_backoff_first_attempt_is_minute():
    assert retry_delay(0) == 60
    assert retry_delay(1) == 60


def test_max_attempts_limit():
    assert MAX_ATTEMPTS == 6


def test_matches_multi_select_criteria():
    from carcar.notify import matches

    row = {"make": "Audi", "body": "sedan", "fuel": "petrol", "gearbox": "automatic"}
    assert matches({"makes": ["BMW", "Audi"], "bodies": ["sedan", "wagon"]}, row)
    assert matches({"makes": ["BMW", "Audi"], "bodies": ["suv"]}, row) is False
    assert matches({"fuels": ["diesel"]}, row) is False
    assert matches({"gearboxes": ["automatic"]}, row)


def test_wrong_brand_and_removed_listing_never_match():
    from carcar.notify import matches
    criteria = {'makes': ['BMW', 'Audi'], 'price_max': 100000}
    assert not matches(criteria, {'make': 'Fiat', 'price': 81000})
    assert not matches(criteria, {'make': 'BMW', 'price': 81000, 'status': 'removed'})
    assert matches(criteria, {'make': 'Audi', 'price': 81000, 'status': 'active'})


def test_published_days_is_checked():
    from datetime import UTC, datetime, timedelta
    from carcar.notify import matches
    assert not matches({'published_days': 1}, {'published_at': datetime.now(UTC) - timedelta(days=3)})
    assert not matches({'published_days': 1}, {})
    assert matches({'published_days': 1}, {'published_at': datetime.now(UTC)})


class QueueCursor:
    def __init__(self, rows):
        self.rows = rows
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, *args): pass
    def fetchall(self): return self.rows


class QueueConnection:
    def __init__(self, rows): self.rows = rows
    def cursor(self): return QueueCursor(self.rows)
    def close(self): pass


def queue_notifier(criteria):
    from carcar.notify import Notifier
    notifier = Notifier('postgresql://unused', 'not-used')
    rows = [dict(id=1,listing_id=1,user_id=13,make='Fiat',price=81000,status='active',kind='new'),
            dict(id=2,listing_id=2,user_id=13,make='BMW',price=81000,status='active',kind='new')]
    notifier.connect = lambda: QueueConnection(rows)
    notifier.current_criteria = lambda conn,user: criteria
    notifier.cancelled = []
    notifier.delivered = []
    notifier.cancel_unmatched = lambda conn,user,listing: notifier.cancelled.append(listing)
    notifier.send = lambda chat,item,lang: (notifier.delivered.append(item['id']) or True, 123, None)
    notifier.mark_sent = lambda *args,**kwargs: None
    notifier.mark_failed = lambda *args,**kwargs: None
    for row in rows: row.update(tg_id=123, lang='en', attempts=0)
    return notifier


def test_retry_rechecks_current_filters_before_sending():
    notifier = queue_notifier([{'makes':['BMW','Audi'],'price_max':100000}])
    assert notifier.retry_due() == 1
    assert notifier.cancelled == [1]
    assert notifier.delivered == [2]
    notifier.client.close()


def test_retry_cancels_queue_when_subscriptions_removed():
    notifier = queue_notifier([])
    assert notifier.retry_due() == 0
    assert notifier.cancelled == [1,2]
    assert notifier.delivered == []
    notifier.client.close()


def test_digest_rechecks_filters_and_marks_only_delivered_ids():
    from carcar.notify import Notifier
    class Cursor:
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def execute(self,sql,params=None):
            self.sql=sql
            if 'update notification set status' in sql: delivered.append(params[2])
        def fetchall(self):
            if 'group by u.id' in self.sql:
                return [dict(id=13,tg_id=123,lang='en',total=100)]
            return [dict(id=1,title='Fiat',price=80000,url='https://example.test/1',make='Fiat',status='active'),
                    dict(id=2,title='BMW',price=80000,url='https://example.test/2',make='BMW',status='active')]
    class Conn:
        def cursor(self): return Cursor()
        def commit(self): pass
        def close(self): pass
    class HTTP:
        def post(self,*args,**kwargs):
            messages.append(kwargs['json']['text'])
            class Response:
                def json(self): return {'ok':True,'result':{'message_id':123}}
            return Response()
    delivered=[]; cancelled=[]; messages=[]
    n=Notifier('postgresql://unused','unused');n.client.close();n.client=HTTP()
    n.connect=lambda:Conn()
    n.current_criteria=lambda conn,user:[{'makes':['BMW','Audi']}]
    n.cancel_unmatched=lambda conn,user,listing:cancelled.append(listing)
    assert n.send_digests()==1
    assert cancelled==[1]
    assert delivered==[[2]]
    assert 'BMW' in messages[0] and 'Fiat' not in messages[0]
