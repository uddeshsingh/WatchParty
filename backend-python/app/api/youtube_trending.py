import os

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user

router = APIRouter(prefix="/api/youtube", tags=["youtube"])

_DEFAULT_PUFFYAN = (
    "https://vid.puffyan.us/api/v1/trending?type=movies&region=US"
)


@router.get("/trending")
def youtube_trending_proxy(_user: str = Depends(get_current_user)):
    """
    Server-side proxy for lobby YouTube trending (avoids browser CORS to Puffyan).
    """
    url = os.getenv("PUFFYAN_TRENDING_URL", _DEFAULT_PUFFYAN).strip() or _DEFAULT_PUFFYAN
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(url, headers={"Accept": "application/json"})
            if r.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="YouTube trending source unavailable",
                )
            try:
                return r.json()
            except ValueError:
                raise HTTPException(
                    status_code=502,
                    detail="YouTube trending source unavailable",
                ) from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="YouTube trending source unavailable",
        ) from None
