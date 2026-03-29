import pytest
from httpx import Response

from app.main import app
from app.api.auth import get_current_user
from fastapi.testclient import TestClient

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_tmdb_auth():
    app.dependency_overrides[get_current_user] = lambda: "tmdb_tester"
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer dummy"}


def test_tmdb_search_requires_key(auth_headers, monkeypatch):
    monkeypatch.delenv("TMDB_API_KEY", raising=False)
    r = client.get("/api/tmdb/search", params={"q": "test"}, headers=auth_headers)
    assert r.status_code == 503


def test_tmdb_search_sanitizes_results(auth_headers, monkeypatch):
    monkeypatch.setenv("TMDB_API_KEY", "fake-bearer-token")

    fake_body = {
        "results": [
            {
                "media_type": "movie",
                "id": 99,
                "title": "Hello",
                "poster_path": "/x.jpg",
                "overview": "plot",
            },
            {"media_type": "person", "id": 1, "name": "Actor"},
        ]
    }

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, *args, **kwargs):
            return Response(200, json=fake_body)

    monkeypatch.setattr("app.api.tmdb.httpx.Client", lambda **kw: FakeClient())

    r = client.get("/api/tmdb/search", params={"q": "hello"}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["tmdb_id"] == 99
    assert data[0]["title"] == "Hello"
    assert "popularity" not in data[0]


def test_tmdb_search_masks_upstream_error(auth_headers, monkeypatch):
    monkeypatch.setenv("TMDB_API_KEY", "fake-bearer-token")

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, *args, **kwargs):
            return Response(500, json={"errors": "secret"})

    monkeypatch.setattr("app.api.tmdb.httpx.Client", lambda **kw: FakeClient())

    r = client.get("/api/tmdb/search", params={"q": "x"}, headers=auth_headers)
    assert r.status_code == 502
    assert r.json()["detail"] == "TMDB search unavailable"
