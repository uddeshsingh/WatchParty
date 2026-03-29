import os


def resolve_cors_settings() -> tuple[bool, list[str]]:
    """
    Read ALLOWED_ORIGINS.

    Returns (allow_any_origin, explicit_origins). When allow_any_origin is True,
    use CORSMiddleware with allow_origins=['*'] and allow_credentials=False
    (required by the CORS spec; JWT in Authorization still works).

    On Cloud Run (K_SERVICE set), an empty ALLOWED_ORIGINS (common when the
    GitHub secret is unset) defaults to allow-any so browsers are not stuck on
    localhost-only CORS.
    """
    default_local = "http://localhost:5173"
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    on_cloud_run = bool(os.getenv("K_SERVICE"))

    if not raw:
        if on_cloud_run:
            return True, []
        return False, [default_local]

    if raw == "*":
        return True, []

    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        if on_cloud_run:
            return True, []
        return False, [default_local]

    return False, origins
