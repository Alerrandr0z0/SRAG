# --- Stage 1: Build the React static frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Serve React statically via FastAPI ---
FROM python:3.14-slim
WORKDIR /app

# Instala o Astral uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Sincroniza apenas as dependências de produção do Python
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project

# Copia os arquivos necessários e a build estática do React
COPY src/ ./src/
COPY data/processed/ ./data/processed/
COPY data/geojson/ ./data/geojson/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Configurações de execução
ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "srag.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
