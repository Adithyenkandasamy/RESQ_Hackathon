# ─────────────────────────────────────────────────────────
# Dockerfile — Emergency Response Coordination System
# ─────────────────────────────────────────────────────────
# Production-minded image.  Does NOT include .env or secrets.
#
# Build:
#   docker build -t er-cs-backend .
#
# Run:
#   docker run -p 8000:8000 --env-file .env er-cs-backend
# ─────────────────────────────────────────────────────────

FROM python:3.10-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Install uv for fast, reproducible dependency resolution ──
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# ── Copy dependency files first (layer caching) ──
COPY pyproject.toml uv.lock ./

# Install production dependencies only (no dev deps).
RUN uv sync --frozen --no-dev --no-install-project

# ── Copy application code ──
COPY app/ app/
COPY migrations/ migrations/
COPY alembic.ini .

# ── Create non-root user ──
RUN groupadd --system appuser && \
    useradd --system --gid appuser appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Production startup — no --reload, no debug.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
