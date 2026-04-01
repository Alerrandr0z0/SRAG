# GEMINI.md - SRAG Mossoró/RN

## Project Overview
**SRAG Mossoró/RN** is a municipal epidemiological surveillance system designed for Mossoró/RN. It automates SIVEP-Gripe data analysis and provides advanced forecasting models to support public health decision-making.

The project features a high-performance architecture leveraging DuckDB for data orchestration, Facebook Prophet for seasonal forecasting, and React for a rich analytical dashboard.

---

## Architecture & Implementation Details

### Data Ingestion (Universal Engine)
The project uses a master ingestion script `scripts/ingest_data.py` that implements a **Bronze/Silver/Gold** data flow:
- **Engine:** DuckDB is used as the primary processing engine for its extreme performance with Parquet and CSV files.
- **Universal Handling:** Automatically detects and processes all `.parquet` and `.csv` files within `data/raw/`.
- **Deduplication:** Implements a global MD5 hash based on `(DT_NOTIFIC, ID_MUNICIP, DT_SIN_PRI, NU_IDADE_N, CS_SEXO, ID_UNIDADE)`. Duplicates across source files are discarded, maintaining a unique source of truth in SQLite.
- **Flexible Parsing:** Supports both Brazilian (`DD/MM/YYYY`) and ISO (`YYYY-MM-DD`) date formats using a `COALESCE` + `TRY_CAST` strategy in DuckDB.

### Backend (FastAPI + Python 3.14)
The API resides in `src/srag/api/main.py`:
- **Observability:** Integrated with **Pydantic Logfire** for telemetry.
- **Database Persistence:** SQLite located at `data/processed/srag_mossoro.db`.
- **Performance:** TTL-based caching (15 min) for the main DataFrame and surgical column selection.
- **Key Analytics:** Kaplan-Meier survival curves for vaccine effectiveness decoupled into `srag.data.analytics`.

### Forecasting (Facebook Prophet)
Located in `src/srag/models/forecasting.py`:
- **Model:** Seasonal additive model using the Prophet library.
- **Seasonality:** Automatically captures yearly SRAG cycles (winter peaks/summer lows).
- **Uncertainty:** Returns 80% confidence intervals (`predicted_cases_lower/upper`) for risk management.
- **Date Mapping:** Uses `get_date_from_epi_week` to align epidemiological weeks with historical timeframes.

### Frontend (React + Vite + TypeScript)
- **Geospatial:** Advanced Leaflet implementation with 90-degree quadrant sectors, floating legend, and golden connection lines.
- **Visualization:** Hybrid engine using Chart.js (trends) and Modular ECharts (Sankey, Heatmaps, Histograms).

---

## Technical Findings & Standards

### Nomenclatura Oficial
1. **Campos Oficiais (MAIÚSCULO):** `DT_SIN_PRI`, `CLASSI_FIN`, `BAIRRO_REF`, `ZONA`, `NOSOCOMIAL`, `unique_hash`.
2. **Chaves de Resposta (minúsculo):** `count`, `total`, `history`, `forecast`, `nodes`, `links`.

### Testing Standards
The project maintains a comprehensive test suite via `pytest`:
- **Unit Tests:** Located in `tests/unit/`, covering `analytics`, `database`, and `forecasting`.
- **Integration Tests:** Located in `tests/integration/`, validating `api` endpoints and `ingestion` flows.
- **Coverage:** Mandatory validation for any new epidemiological calculation or classification logic.

---

## Building and Running

### Data Update
```bash
uv run scripts/ingest_data.py
```

### Full Stack Execution
```bash
./scripts/port_control.sh start
```

### Quality Assurance
```bash
uv run pytest
```

---

## Development Conventions
- **Data Integrity:** Never skip the `unique_hash` check during ingestion.
- **Modular Analytics:** New aggregation logic MUST be added to `analytics.py`, not directly in API endpoints.
- **Privacy:** `tools/mossoro_privacy_tool/` must be used for any data export destined for public/shared environments.
- **Git Workflow:** Do not commit files in `data/raw/`, `data/processed/*.db` or generated `.geojson` files.
