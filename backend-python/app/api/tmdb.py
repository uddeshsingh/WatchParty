import os
import time
from collections import defaultdict
from threading import Lock

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import get_current_user
from app.domain.schemas import TMDBSearchResult

router = APIRouter(prefix="/api/tmdb", tags=["tmdb"])

TMDB_BASE = "https://api.themoviedb.org/3"
RATE_WINDOW_SEC = 60
RATE_MAX = 30

_rate_lock = Lock()
_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _rate_limit_key(user: str) -> str:
    return user


def _check_rate_limit(username: str) -> None:
    now = time.monotonic()
    with _rate_lock:
        bucket = _rate_buckets[_rate_limit_key(username)]
        while bucket and now - bucket[0] > RATE_WINDOW_SEC:
            bucket.pop(0)
        if len(bucket) >= RATE_MAX:
            raise HTTPException(status_code=429, detail="Too many TMDB requests")
        bucket.append(now)


def _tmdb_headers() -> dict[str, str]:
    token = os.getenv("TMDB_API_KEY", "").strip()
    if not token:
        raise HTTPException(
            status_code=503,
            detail="TMDB search unavailable",
        )
    return {"Authorization": f"Bearer {token}"}


def _sanitize_result(raw: dict) -> TMDBSearchResult | None:
    mt = raw.get("media_type")
    if mt not in ("movie", "tv"):
        return None
    tid = raw.get("id")
    if tid is None:
        return None
    title = raw.get("title") if mt == "movie" else raw.get("name")
    if not title:
        return None
    return TMDBSearchResult(
        tmdb_id=int(tid),
        title=str(title),
        media_type=mt,
        poster_path=raw.get("poster_path"),
        release_date=raw.get("release_date"),
        first_air_date=raw.get("first_air_date"),
        vote_average=raw.get("vote_average"),
        overview=raw.get("overview"),
    )


@router.get("/search", response_model=list[TMDBSearchResult])
def tmdb_search(
    q: str = Query(..., min_length=1, max_length=200),
    page: int = Query(1, ge=1, le=500),
    user: str = Depends(get_current_user),
):
    _check_rate_limit(user)
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(
                f"{TMDB_BASE}/search/multi",
                params={"query": q, "page": page, "include_adult": "false"},
                headers=_tmdb_headers(),
            )
            if r.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="TMDB search unavailable",
                )
            body = r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="TMDB search unavailable",
        ) from None

    out: list[TMDBSearchResult] = []
    for item in body.get("results") or []:
        s = _sanitize_result(item)
        if s:
            out.append(s)
    return out


@router.get("/trending", response_model=list[TMDBSearchResult])
def tmdb_trending(
    window: str = Query("day", pattern="^(day|week)$"),
    user: str = Depends(get_current_user),
):
    _check_rate_limit(user)
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(
                f"{TMDB_BASE}/trending/all/{window}",
                headers=_tmdb_headers(),
            )
            if r.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="TMDB search unavailable",
                )
            body = r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="TMDB search unavailable",
        ) from None

    out: list[TMDBSearchResult] = []
    for item in body.get("results") or []:
        s = _sanitize_result(item)
        if s:
            out.append(s)
    return out[:20]
