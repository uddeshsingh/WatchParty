"""Mirror login session ids to Redis so the Go WebSocket server can reject stale JWTs."""

import os


def mirror_auth_session(username: str, session_id: str) -> None:
    addr = os.getenv("REDIS_ADDR", "").strip()
    if not addr:
        return
    try:
        import redis
    except ImportError:
        return
    try:
        ttl = 90000  # 25h — JWT is 24h
        if addr.startswith("redis://") or addr.startswith("rediss://"):
            r = redis.from_url(addr, decode_responses=True)
        elif ":" in addr:
            host, _, port_str = addr.rpartition(":")
            r = redis.Redis(host=host, port=int(port_str), decode_responses=True)
        else:
            r = redis.Redis(host=addr, port=6379, decode_responses=True)
        r.setex(f"wp:sess:{username}", ttl, session_id)
    except Exception:
        pass
