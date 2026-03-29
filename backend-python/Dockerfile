# syntax=docker/dockerfile:1

# Pinned multi-arch index digest (linux/amd64, linux/arm64, …)
ARG PYTHON_IMAGE=python:3.12-slim-bookworm@sha256:31c0807da611e2e377a2e9b566ad4eb038ac5a5838cbbbe6f2262259b5dc77a0

# -----------------------------------------------------------------------------
# Stage 1: dependencies (cache-friendly; no full source yet)
# -----------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS deps
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: runtime — non-root, minimal layers
# -----------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime
WORKDIR /app
RUN groupadd -r appuser && useradd -r -g appuser -u 65532 appuser \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
ENV PATH=/home/appuser/.local/bin:$PATH
USER appuser
EXPOSE 8080
# Cloud Run sets PORT; default matches deploy flags.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 0 app.main:app"]
