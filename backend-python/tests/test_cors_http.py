"""
HTTP-level CORS checks for the FastAPI stack.

These catch regressions where CORSMiddleware is mis-ordered, misconfigured, or
omits headers on error responses (the browser then reports “CORS missing” even
when the real issue is 401/5xx).

They do **not** validate Cloud Run secrets: if production ALLOWED_ORIGINS omits
the real frontend URL, add a post-deploy smoke curl or E2E against that URL.

Import `app` after conftest sets JWT_SECRET / DATABASE_URL so middleware matches CI.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import _allow_any, _explicit_origins, app

client = TestClient(app)

VITE_DEV = "http://localhost:5173"


@pytest.fixture(autouse=True)
def _skip_if_no_cors_context():
    """Middleware is fixed at import time; skip if config is unexpected."""
    if _allow_any:
        return
    if VITE_DEV not in _explicit_origins:
        pytest.skip(
            "CORS allowlist does not include Vite dev origin; set ALLOWED_ORIGINS or use defaults"
        )


def test_options_preflight_includes_allow_origin():
    r = client.options(
        "/api/tmdb/trending",
        headers={
            "Origin": VITE_DEV,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert r.status_code == 200
    acao = r.headers.get("access-control-allow-origin")
    if _allow_any:
        assert acao == "*"
    else:
        assert acao == VITE_DEV


def test_get_without_auth_still_sends_cors_headers_for_browser():
    """Browsers need ACAO on 401 too; otherwise DevTools only shows a CORS error."""
    r = client.get(
        "/api/tmdb/trending",
        headers={"Origin": VITE_DEV},
    )
    assert r.status_code == 401
    acao = r.headers.get("access-control-allow-origin")
    if _allow_any:
        assert acao == "*"
    else:
        assert acao == VITE_DEV


@pytest.mark.skipif(_allow_any, reason="wildcard mode allows every origin")
def test_disallowed_origin_preflight_is_rejected():
    r = client.options(
        "/api/tmdb/trending",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 400
