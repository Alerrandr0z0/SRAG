# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, automatizando análise de dados do SIVEP-Gripe com inteligência geoespacial e preditiva.

## Stack

- **Backend:** Python 3.14, FastAPI, Pandas, DuckDB, Prophet, Kaplan-Meier
- **Frontend:** React 19, TypeScript, Vite, ECharts, Leaflet
- **Qualidade:** Pyright (strict), Ruff, 447 testes, 84% cobertura, Mutmut, Hypothesis

## Toolchain

```bash
make setup              # Primeira instalação (uv + npm + hooks)
make ingest             # ETL DuckDB → SQLite
make lint-back          # Ruff + Pyright strict
make test-back          # 447 testes + coverage (threshold 80%)
make fix-back           # Ruff auto-fix + format
make security           # Bandit + Gitleaks
make mutation-incr      # Mutação incremental (rápido, para dev)
make property-test      # Testes de propriedade (Hypothesis)
make bench              # Benchmarks de performance
make start              # Dashboard (5173) + API (8000) + Jupyter (8888)
make observability      # Logfire dashboard
make update-graph       # Knowledge graph (graphify)
```

## Arquitetura

```
data/               # raw/ → processed/ → geojson/
src/srag/           # API + Motor analítico vetorizado
  ├── api/          # FastAPI routers + TypedDicts
  ├── data/         # Analytics, database, loader, geospatial
  ├── pipelines/    # SIVEP ingestão e validação
  └── models/       # Forecasting (Prophet)
frontend/           # React 19 + ECharts + Leaflet
scripts/            # ingest_data.py, port_control.sh
```

## Endpoints principais

- `GET /summary` — Resumo epidemiológico
- `GET /trends` — Histórico + previsão sazonal
- `GET /laboratory_network` — 25+ sub-métricas laboratoriais
- `GET /vaccine_survival` — Curvas Kaplan-Meier (COVID + Influenza)
- `GET /citizen_bootstrap` — 10 perfis demográficos
- `GET /geo/*` — Mapas coropléticos, setores rurais, heatpoints
