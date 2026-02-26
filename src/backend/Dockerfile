# ── Build stage ───────────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment (no project source yet)
RUN uv sync --frozen --no-install-project --no-dev

# Copy the rest of the source
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev


# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

# System dependencies:
#   poppler-utils  → required by pdf2image
#   libpq-dev      → required by asyncpg / psycopg at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the virtual environment and source from the builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app /app

# Make sure the venv's binaries take precedence
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# The safe/ directory is used for uploaded files / prompts ONLY DURING DEV
VOLUME ["/app/safe"]

EXPOSE 8000

# Default: run the API server. Override for the worker:
#   docker build --build-arg ENTRYPOINT=worker -t matcha-worker .
ARG ENTRYPOINT=api
ENV APP_ENTRYPOINT=${ENTRYPOINT}

CMD if [ "$APP_ENTRYPOINT" = "worker" ]; then \
        python -m app.worker.main; \
    else \
        uvicorn app.main:app --host 0.0.0.0 --port 8000; \
    fi
