FROM python:3.13-slim
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project

COPY src/ ./src/
COPY data/processed/ ./data/processed/
COPY data/geojson/ ./data/geojson/

# Configurações de execução
ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "srag.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
