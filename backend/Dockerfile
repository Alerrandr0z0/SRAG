FROM python:3.14-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev

COPY backend/src/ ./src/
COPY backend/main.py ./

ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "srag.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
