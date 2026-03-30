import os
from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as video_router, get_db, get_video_service
from app.api.auth import router as auth_router
from app.api.tmdb import router as tmdb_router
from app.pubsub.gcp_listener import GCPPubSubListener
from app.repository.database import engine, Base
from app.cors_settings import resolve_cors_settings


# #region agent log
class _AgentDebugRequestLogMiddleware:
    """Append one NDJSON line per HTTP request (local workspace log only)."""

    def __init__(self, app, allow_any: bool, explicit_origins: list[str]):
        self.app = app
        self._allow_any = allow_any
        self._explicit_origins = explicit_origins

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        raw = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        origin = raw.get("origin")
        path = scope.get("path", "")
        status_holder: dict[str, int | None] = {"code": None}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message.get("status")
            await send(message)

        await self.app(scope, receive, send_wrapper)
        try:
            import json
            import time

            payload = {
                "sessionId": "fc90b6",
                "hypothesisId": "H1-H2-H4",
                "location": "main.py:_AgentDebugRequestLogMiddleware",
                "message": "http_response",
                "data": {
                    "path": path,
                    "origin": origin,
                    "status": status_holder["code"],
                    "cors_allow_any": self._allow_any,
                    "cors_explicit_origins": self._explicit_origins,
                },
                "timestamp": int(time.time() * 1000),
                "runId": "pre-fix",
            }
            with open(
                "/Users/uddeshsingh/Documents/WatchParty/.cursor/debug-fc90b6.log",
                "a",
                encoding="utf-8",
            ) as f:
                f.write(json.dumps(payload) + "\n")
        except OSError:
            pass


# #endregion


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db_gen = get_db()
    db_session = next(db_gen)

    service = get_video_service(db_session)
    app.state.listener = GCPPubSubListener(
        project_id="watchparty-482106",
        topic_id="watchparty-events",
        sub_id="python-backend-sub",
        video_service=service,
    )

    app.state.listener_thread = threading.Thread(
        target=app.state.listener.listen,
        daemon=True,
    )
    app.state.listener_thread.start()
    print("🚀 Server startup complete")

    yield

    app.state.listener.stop()
    db_gen.close()
    print("👋 Server shutdown complete")


app = FastAPI(title="WatchParty API", lifespan=lifespan)

_allow_any, _explicit_origins = resolve_cors_settings()
if _allow_any:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type"],
        allow_credentials=False,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_explicit_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type"],
        allow_credentials=True,
    )

if os.getenv("WP_DEBUG_INGEST_LOG") == "1":
    app.add_middleware(
        _AgentDebugRequestLogMiddleware,
        allow_any=_allow_any,
        explicit_origins=_explicit_origins,
    )

app.include_router(video_router)
app.include_router(auth_router)
app.include_router(tmdb_router)