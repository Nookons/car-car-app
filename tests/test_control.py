from carcar.control import Control, load_control, save_control


def test_missing_control_means_running(tmp_path):
    control = load_control(tmp_path / "control.json")
    assert control == Control()
    assert control.paused is False


def test_roundtrip(tmp_path):
    path = tmp_path / "control.json"
    saved = save_control(path, paused=True, reason="чиним парсер", by="cli")

    assert saved.paused is True
    assert saved.reason == "чиним парсер"
    assert saved.updated_at

    loaded = load_control(path)
    assert loaded.paused is True
    assert loaded.reason == "чиним парсер"
    assert loaded.updated_by == "cli"


def test_resume(tmp_path):
    path = tmp_path / "control.json"
    save_control(path, paused=True, reason="x")
    save_control(path, paused=False)
    loaded = load_control(path)
    assert loaded.paused is False
    assert loaded.reason is None


def test_broken_file_does_not_block_collection(tmp_path):
    path = tmp_path / "control.json"
    path.write_text("{не json", encoding="utf-8")
    assert load_control(path).paused is False


def test_atomic_write_leaves_no_tmp(tmp_path):
    path = tmp_path / "control.json"
    save_control(path, paused=True)
    assert list(tmp_path.glob("*.tmp")) == []
    assert path.exists()
