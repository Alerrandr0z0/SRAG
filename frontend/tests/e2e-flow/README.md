# E2E Integrated-Flow Tests

12 Playwright specs validating **5 critical user journeys** in the integrated
dashboard. Distinct from `tests/e2e/` (Storybook visual regression of isolated
components). These run against the **live Vite dev server** at
`http://127.0.0.1:5173` and the **live API** at `http://127.0.0.1:8000`.

## Prerequisites

The full stack must be running:

```bash
make start --no-jupyter
```

This brings up the API (8000) and the Vite dev server (5173). The specs
**will fail** if either port is unreachable.

## Running

```bash
make e2e                          # via Makefile
cd frontend && npm run test:e2e:dashboard   # via npm
```

Run time: ~30s for the full 12-spec suite on a warm cache.

## Spec Map

| Spec | Validates |
| --- | --- |
| `smoke.spec.ts` | Dashboard loads, 5 KPI cards render with numbers, 7 sidebar panels exist, API `/health` returns 200 |
| `filter-chain.spec.ts` | Year filter (Ano) reduces KPI totals, clearing filter restores original values |
| `navigation.spec.ts` | Auditoria panel renders the quality intelligence section; all 7 panels can be activated without crash |
| `geographic.spec.ts` | Territory panel renders the map; `/geo/bairros_choropleth` and `/geo/rural_sectors` return FeatureCollections |
| `cross-panel.spec.ts` | Global filter (Ano) state persists across panel switches (Vigilância → Cidadão → Território → etc.) |

## Selectors Used

| Element | Selector |
| --- | --- |
| KPI card | `.kpi-grid article.panel` filtered by `hasText: <label>` |
| Sidebar button | `button[aria-label="<Panel Label>"]` |
| Sidebar active state | `button[aria-label="<Label>"].active` |
| Year filter select | `.gfb-group:has(text="Ano") select` |
| Auditoria title | `text=Central de Inteligência de Qualidade de Dados` |
| Territory map heading | `h3:has-text("Mapa territorial")` |
| Citizen KPI row | `.citizen-kpi-row` |

## Conventions

- **Real data** — specs use the actual SRAG dataset (2405 cases / 688 deaths).
  If numbers change in production, tests stay correct.
- **No snapshot baselines** — these are functional tests, not visual
  regression. Visual snapshots live in `tests/e2e/`.
- **Workers=1** — sequential execution to avoid filter-state interference
  between tests.
- **Action timeout 10s** — dashboard refetches take ~1-2s; poll-based
  waits tolerate up to 10s.

## Why 5 specs, not 50

- Backend integration tests (53 specs) already cover all endpoint shapes
  and most filter combinations
- Property tests (79 specs) cover analytics invariants
- E2E adds value at the **integration seams**: filter UI ↔ KPI card,
  sidebar ↔ panel render, panel ↔ global filter state
- Adding more specs at this layer has diminishing returns
