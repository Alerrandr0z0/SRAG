# GEMINI.md - SRAG Mossoró/RN

## Project Overview
**SRAG Mossoró/RN** is a municipal epidemiological surveillance system designed for Mossoró/RN. It automates SIVEP-Gripe data analysis and provides forecasting models to support public health decision-making.

The project is fully functional with an integrated React frontend and a high-performance FastAPI backend.

---

## Architecture & Implementation Details

### Backend (FastAPI + Python 3.14)
The API resides in `src/srag/api/main.py` and implements several high-performance patterns:
- **Observability:** Integrated with **Pydantic Logfire** for real-time telemetry, SQL profiling, and error tracking.
- **Database Persistence:** SQLite (`data/srag_mossoro.db`) using SQLAlchemy with a **Singleton Engine** and `pool_pre_ping=True`.
- **Advanced Analytics:** Uses the `lifelines` library to compute rigorous Kaplan-Meier survival curves for vaccine protection analysis.
- **Performance Optimization:**
    - **Memory Caching:** Implements a TTL-based cache (15 min) for the main DataFrame to minimize disk I/O.
    - **Surgical Column Selection:** Only essential columns (defined in `CORE_COLS`) are loaded from SQLite.
    - **NumPy Sanitization:** Explicit conversion of `np.float64` and `np.int64` to native Python types for reliable JSON serialization.
- **Key Endpoints:**
    - `/clinical_flow`: Clinical journey Sankey (Admission -> ICU -> Ventilation -> Outcome).
    - `/hospitalization_duration`: Distribution of stay lengths (Histogram).
    - `/vaccination_profile`: Unified horizontal stacked bar chart data comparing COVID-19 (detailed doses) and Flu vaccination coverage.
    - `/vaccine_survival`: Dual Kaplan-Meier survival curves (COVID-19 and Flu) showing protection over time with 95% Confidence Intervals.
    - `/territory_bootstrap`: Integrated GeoJSON delivery (neighborhood boundaries + cases).
    - `/citizen_bootstrap`: Hierarchical profiles, age pyramids, and symptoms heatmap.

### Frontend (React + Vite + TypeScript)
Located in `frontend/`, the dashboard is built for responsiveness and speed:
- **Proxy Configuration:** `vite.config.ts` handles API routing using `127.0.0.1` (IPv4) to avoid resolution conflicts, with prefix rewriting from `/api/*` to `/*`.
- **Hybrid Charting Engine:** 
    - **Chart.js:** Used for trends and standard bar charts.
    - **ECharts (Modular):** Used for heavy visualizations: **Sankey Diagram**, **Symptoms Heatmap**, **Hospitalization Histogram**, **Vaccination Profile**, and **Kaplan-Meier Curve**.
- **Optimization:** Dynamic `import()` loaders for ECharts and Leaflet to keep the initial bundle small.

---

## Technical Findings & Standards (Critical)

### Nomenclatura Oficial (Rule of Thumb)
O projeto segue uma convenção de caixa estrita para evitar inconsistências entre Backend e Frontend:
1. **Campos Oficiais SIVEP & Negócio (MAIÚSCULO):** Exemplos: `DT_SIN_PRI`, `CLASSI_FIN`, `ID_UNIDADE`, `BAIRRO_REF`, `ZONA`, `NOSOCOMIAL`, `DOSE_1_COV`, `DT_UT_DOSE`.
2. **Chaves de Resposta & Agregações (minúsculo):** Exemplos: `count`, `total`, `history`, `forecast`, `nodes`, `links`, `male`, `female`, `age_band`.

### Database Schema
- A tabela `casos_srag` utiliza nomes de colunas em **MAIÚSCULO**.
- O campo `BAIRRO_REF` contém o nome do bairro normalizado (limpo), enquanto `NM_BAIRRO` contém o texto original da ficha.
- A variável `NOSOCOMIAL` foi adicionada via migração para rastrear infecções hospitalares.
- **Vacinação Detalhada:** O banco armazena as datas exatas de cada dose (ex: `DOSE_1_COV`, `DOSE_REF`, `DOS_RE_BI` para COVID, e `DT_UT_DOSE` para Gripe) para permitir análises temporais rigorosas.
- **Atenção:** Colunas `sg_uf` e `tp_idade` do dicionário original estão ausentes no SQLite de produção e foram removidas de `CORE_COLS` para evitar falhas de SQL.

### Data Parsing
- Colunas de data (ex: `DT_SIN_PRI`, `DT_INTERNA`, e todas as datas de vacina) devem ser convertidas para objetos `datetime.date` ou validadas corretamente para compatibilidade com cálculos de tempo (ex: `lifelines`) e economia de memória.

---

## Building and Running

### Prerequisites
- Python >= 3.14 (uv manager recommended)
- Node.js (npm)

### Integrated Execution
```bash
./scripts/port_control.sh start
```
*Starts API on port 8000 and Frontend on port 5173.*

### Maintenance
- **Backend Sync:** `uv sync`
- **Observability:** `uv run logfire live` (terminal viewer) or [Logfire Web](https://logfire-us.pydantic.dev/alerrandr0z0/srag-mossoro).
- **Restart Services:** `./scripts/port_control.sh restart`

---

## Development Conventions
- **API Consistency:** New endpoints must use the `sanitize_data` helper to ensure JSON compatibility.
- **Frontend State:** `App.tsx` is the primary entry point; avoid duplicating fetch logic outside the `API_BASE` pattern.
- **Git Workflow:** Keep `data/*.db` and `data/*.geojson` local; do not commit large datasets.
