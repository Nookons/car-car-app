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
