import os


def resolve_cors_settings() -> tuple[bool, list[str]]:
    """
    Read ALLOWED_ORIGINS.

    Returns (allow_any_origin, explicit_origins). When allow_any_origin is True,
    use CORSMiddleware with allow_origins=['*'] and allow_credentials=False
    (required by the CORS spec; JWT in Authorization still works).
    """
    default = "http://localhost:5173"
    raw = os.getenv("ALLOWED_ORIGINS", default)
    if raw.strip() == "*":
        return True, []
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        origins = [default]
    return False, origins
