import pytest
from httpx import Response

from app.main import app
from app.api.auth import get_current_user
from fastapi.testclient import TestClient

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_youtube_auth():
    app.dependency_overrides[get_current_user] = lambda: "youtube_tester"
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer dummy"}


def test_youtube_trending_proxies_json(auth_headers, monkeypatch):
    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, *args, **kwargs):
            return Response(200, json=[{"videoId": "abc", "title": "Clip"}])

    monkeypatch.setattr("app.api.youtube_trending.httpx.Client", lambda **kw: FakeClient())

    r = client.get("/api/youtube/trending", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == [{"videoId": "abc", "title": "Clip"}]


def test_youtube_trending_upstream_error(auth_headers, monkeypatch):
    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, *args, **kwargs):
            return Response(502, text="bad gateway")

    monkeypatch.setattr("app.api.youtube_trending.httpx.Client", lambda **kw: FakeClient())

    r = client.get("/api/youtube/trending", headers=auth_headers)
    assert r.status_code == 502
