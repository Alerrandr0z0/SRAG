FROM python:3.14-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project files
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev

# Copy application source
COPY src/ ./src/
COPY notebooks/ ./notebooks/
COPY main.py ./

# Only copy processed data (essential for presentation)
COPY data/processed/ ./data/processed/
COPY data/geojson/ ./data/geojson/

ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

# Default command (will be overridden in docker-compose)
CMD ["uvicorn", "srag.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
