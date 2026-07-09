FROM node:22-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim

RUN groupadd -g 1001 -r appgroup && \
    useradd -u 1001 -r -g appgroup appuser

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project && \
    rm -rf /root/.cache/uv

COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup data/processed/ ./data/processed/
COPY --chown=appuser:appgroup data/geojson/ ./data/geojson/
COPY --from=frontend-build --chown=appuser:appgroup /app/frontend/dist ./frontend/dist

ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

USER appuser

CMD ["uvicorn", "srag.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
