import pytest

from app.cors_settings import resolve_cors_settings


@pytest.fixture(autouse=True)
def _clear_allowed_origins(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("K_SERVICE", raising=False)


def test_default_localhost(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    allow_any, origins = resolve_cors_settings()
    assert allow_any is False
    assert origins == ["http://localhost:5173"]


def test_star_means_allow_any(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    allow_any, origins = resolve_cors_settings()
    assert allow_any is True
    assert origins == []


def test_comma_separated_list(monkeypatch):
    monkeypatch.setenv(
        "ALLOWED_ORIGINS", " https://app.example.com , https://other.example.com "
    )
    allow_any, origins = resolve_cors_settings()
    assert allow_any is False
    assert origins == ["https://app.example.com", "https://other.example.com"]


def test_empty_entries_ignored(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.test,, ,https://b.test")
    allow_any, origins = resolve_cors_settings()
    assert allow_any is False
    assert origins == ["https://a.test", "https://b.test"]


def test_all_empty_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", ",,  , ")
    monkeypatch.delenv("K_SERVICE", raising=False)
    allow_any, origins = resolve_cors_settings()
    assert allow_any is False
    assert origins == ["http://localhost:5173"]


def test_cloud_run_empty_allowed_origins_is_allow_any(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("K_SERVICE", "watchparty-api")
    allow_any, origins = resolve_cors_settings()
    assert allow_any is True
    assert origins == []
