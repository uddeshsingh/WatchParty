import os


def _extra_allowed_origins() -> list[str]:
    """Comma-separated origins merged into an explicit allowlist (not used with *)."""
    raw = os.getenv("EXTRA_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return []
    return [o.strip() for o in raw.split(",") if o.strip()]


def _merge_origins(base: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for o in base + _extra_allowed_origins():
        if o not in seen:
            seen.add(o)
            out.append(o)
    return out


def resolve_cors_settings() -> tuple[bool, list[str]]:
    """
    Read ALLOWED_ORIGINS.

    Returns (allow_any_origin, explicit_origins). When allow_any_origin is True,
    use CORSMiddleware with allow_origins=['*'] and allow_credentials=False
    (required by the CORS spec; JWT in Authorization still works).

    On Cloud Run (K_SERVICE set), an empty ALLOWED_ORIGINS (common when the
    GitHub secret is unset) defaults to allow-any so browsers are not stuck on
    localhost-only CORS.

    EXTRA_ALLOWED_ORIGINS (comma-separated) is appended to any explicit list
    from ALLOWED_ORIGINS so deploy can add Firebase Hosting (e.g. web.app)
    without duplicating the whole secret.
    """
    default_local = "http://localhost:5173"
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    on_cloud_run = bool(os.getenv("K_SERVICE"))

    if not raw:
        if on_cloud_run:
            return True, []
        return False, _merge_origins([default_local])

    if raw == "*":
        return True, []

    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        if on_cloud_run:
            return True, []
        return False, _merge_origins([default_local])

    return False, _merge_origins(origins)
