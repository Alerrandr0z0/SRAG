# OpenCode Instructions for SRAG Mossoró/RN

## Toolchain (Makefile)

Execute sempre via `make`, nunca diretamente (pytest, ruff, etc.).

### Quando: Setup inicial
```bash
make setup              # Primeira vez ou após mudanças em deps
make setup-back         # Só backend (uv sync + pre-commit hooks)
make setup-front       # Só frontend (npm install)
```

### Quando: Ciclo de desenvolvimento
```bash
make lint-back          # Ruff + Pyright Strict — SEMPRE antes de testar
make fix-back           # Ruff auto-fix + format (corrige estilo automaticamente)
make test-back          # Pytest + coverage (84%+, threshold 80%)
make bench              # Benchmarks de performance (test_benchmark.py)
```

### Quando: Verificação de qualidade
```bash
make lint               # Backend + Frontend lint
make fix                # Backend + Frontend auto-fix
make security           # Bandit (vulnerabilidades) + Gitleaks (segredos)
make hooks              # Todos os pre-commit hooks manualmente (inclui Pyright)
make mutation           # Testes de mutação (Mutmut) — lento (~30min), usar antes de PR
make mutation-incr      # Mutação incremental — rápido, para agent (ver seção abaixo)
make mutation-score     # Ver score da última execução de mutação
make property-test      # Testes de propriedade (Hypothesis) — críticos para métricas de saúde
```

### Quando: Dados e Infraestrutura
```bash
make ingest             # ETL: data/raw/ → DuckDB → SQLite (sempre após scripts/ingest_data.py mudar)
make start              # Full stack: Dashboard (5173), API (8000), Jupyter (8888)
make stop                # Parar todos os serviços
make status              # Status dos serviços (port_control.sh)
```

### Quando: Conhecimento e Observabilidade
```bash
make update-graph       # Atualizar knowledge graph (graphify)
make observability       # Abrir Logfire dashboard (requer token)
```

### Quando: Backend ou Frontend isolado
```bash
make lint-back          make lint-front
make test-back           make test-front
make fix-back            make fix-front
make mutation-back       make mutation-front
make property-test-back  make property-test-front
```

## Arquitetura

```
SRAG/
├── src/srag/                  # Backend FastAPI
│   ├── api/                   # Routers + types + dependencies
│   │   ├── routers_core.py         # /health, /summary, /trends, /virus, /data_completeness
│   │   ├── routers_clinical.py     # /occupations, /clinical_flow, /hospitalization_duration,
│   │   │                              # /vaccination_profile, /citizen_bootstrap, /clinical_timing,
│   │   │                              # /vaccine_survival
│   │   ├── routers_surveillance.py  # /laboratory_network, /context_trends, /timeline_agg,
│   │   │                               # /icu_bottleneck
│   │   ├── routers_territory.py     # /territory_bootstrap, /units
│   │   ├── routers_geo.py           # /geo/macrosector_heatpoints, /geo/rural_heatpoints,
│   │   │                               # /geo/rural_sectors, /geo/bairros_choropleth
│   │   ├── main.py                  # FastAPI app + Logfire + CORS + route registration
│   │   ├── types.py                 # TypedDict responses (Pydantic-free)
│   │   ├── dependencies.py           # CommonFilters (profile, race, gender, zonas, bairros,
│   │   │                              # unidades, years, agents, maternal, occupations)
│   │   └── core.py                  # get_df(), sanitize_data(), apply_surveillance_filters()
│   │                                  # Importante: get_df() tem cache in-memory de 15 min
│   ├── data/
│   │   ├── analytics/          # Motor analítico vetorizado (Pandas/DuckDB)
│   │   │   ├── surveillance.py       # compute_time_series, compute_virus_distribution,
│   │   │   │                          # compute_laboratory_network_summary, infer_etiologic_agent,
│   │   │   │                          # compute_vaccine_survival (Kaplan-Meier), predictions
│   │   │   ├── clinical.py           # compute_clinical_timing_metrics, compute_maternal_profile,
│   │   │   │                          # compute_risk_factors_full_profile, compute_symptoms_*
│   │   │   ├── demographics.py       # compute_citizen_profile_tree, compute_citizen_pyramid,
│   │   │   │                          # compute_occupation_profile, compute_race_profile,
│   │   │   │                          # compute_schooling_profile
│   │   │   ├── filters.py            # apply_global_filters, apply_surveillance_filters,
│   │   │   │                          # outcome_death_mask, _age_years
│   │   │   ├── quality.py            # compute_data_completeness, compute_diagnostic_latency,
│   │   │   │                          # compute_testing_coverage
│   │   │   └── territorial.py        # compute_territory_distribution, compute_zone_distribution,
│   │   │                              # compute_unit_distribution
│   │   ├── database.py         # SQLite init + case hash (MD5)
│   │   ├── loader.py            # Normalização bairros + zonas + LGPD compliance
│   │   ├── geospatial.py        # GeoJSON generation, heatpoints, sector boundaries
│   │   └── references.py       # Constantes: MOSSORO_IBGE_CODES, DEATH_OUTCOMES={2}
│   ├── pipelines/
│   │   ├── surveillance.py     # Pipeline semanal SIVEP
│   │   ├── validation.py       # Validação de dados
│   │   └── weekly_update.py    # run_weekly_update → build_surveillance_snapshot
│   ├── models/
│   │   └── forecasting.py      # predict_next_weeks (Facebook Prophet)
│   ├── utils/
│   │   └── epi_weeks.py       # get_epi_week (SE brasileira: domingo→sábado, SE1 contém 4-Jan)
│   └── viz/
│       └── charts.py          # Matplotlib helpers (_build_axes)
├── frontend/                  # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── services/api.ts    # API client (fetchJson, withFilters, all endpoints)
│   │   ├── hooks/             # Data fetching: useCoreData, useAuditData, useCitizenData,
│   │   │                          # useTerritoryData, useUnitsData
│   │   ├── components/
│   │   │   ├── panels/         # Domain panels: AuditPanel, CitizenPanel, LabPanel,
│   │   │   │                      # NotebooksPanel, TerritoryPanel, UnitsPanel, VigilancePanel
│   │   │   └── charts/         # ECharts + Leaflet: 30+ chart types
│   │   └── constants/index.ts  # API_ENDPOINTS
│   └── tests/                 # Vitest (unit + e2e)
├── scripts/
│   ├── ingest_data.py         # Master ETL (DuckDB + spatial + Excel extensions)
│   └── port_control.sh        # Start/stop/status dos serviços
├── data/
│   ├── raw/                   # Bronze: Parquet, CSV, XLSX (SIVEP-Gripe)
│   ├── processed/             # Silver: SQLite DB + municipality boundary GeoJSON
│   └── geojson/               # Gold: bairros, rural sectors (dashboard-ready)
└── docker-compose.yml         # Infra: API, Frontend, Nginx, Jupyter
```

## Quality Gates

```
STAGE 0 (local — pre-commit)    STAGE 1 (PR — CI)       STAGE 2 (pós-merge)
────────────────────────────     ─────────────────        ─────────────────────
✓ trailing whitespace            ✗ (não implementado)    mutation ≥ 70% (lento)
✓ end-of-files                   Ideal: GitHub Actions   property-test obrigatório
✓ yaml + toml                    lint → test → cobertura coverage ≥ 80% (já enforce)
✓ ruff-check                     security → mutation    pyright = 0 erros (já enforce)
✓ ruff-format
✓ bandit (s/ B101)
✓ gitleaks
✓ pyright (strict)
✓ frontend (ESLint + typecheck)
```

**Ordem obrigatória:** `make lint-back` → `make test-back` (falha bloqueia)
**Antes de PR:** `make mutation` (lento, ~30min) — ver score com `make mutation-score`

## Mutation Testing Workflow (para agent)

### Alvo ideal: **mutation score ≥ 70%**

### Modo incremental (agent): `make mutation-incr`

NUNCA rode `make mutation` (full suite, ~30min) durante desenvolvimento. Use o alvo incremental:

```bash
# Após editar surveillance.py, testar só os mutantes desse arquivo:
make mutation-incr PATHS="src/srag/data/analytics/surveillance.py"

# Com testes específicos (mais rápido que rodar tudo):
make mutation-incr PATHS="src/srag/data/analytics/surveillance.py" \
                   TESTS="tests/unit/test_surveillance.py"

# Múltiplos arquivos:
make mutation-incr PATHS="src/srag/api/routers_core.py src/srag/api/core.py" \
                   TESTS="tests/unit/test_core.py"
```

### Workflow completo do agent

```
1. git stash                      # guarda edições em progresso
2. mutation-incr PATHS=<alvos>    # snapshot: quantos mutantes sobrevivem ANTES
3. git stash pop                  # restaura edições
4. [edita código + testes]
5. lint-back                      # SEMPRE antes de testar
6. test-back                      # garantir que não quebrou nada
7. mutation-incr PATHS=<alvos>    # comparar: menos sobreviventes?
8. [repete 4-7 até满意]
```

### Estratégia para matar mutantes

| Mutante sobrevivente comum | Como matar |
|----------------------------|------------|
| `if x > 0` → `if x >= 0` | Teste com valor exato no boundary (`x=0`) |
| `return a` → `return None` | Teste que verifica o valor de retorno (`assert result == a`) |
| `pandas.Series.any()` → `all()` | Monte DataFrame com casos True e False misturados |
| `dict[key]` → `dict.get(key)` | Teste com chave ausente |
| `and` → `or` | Monte True/False table cobrindo todas as combinações |
| Remoção de `dropna()` / `fillna()` | Inclua NaN nos dados de teste |

### Como funciona `make mutation-incr`

O alvo incremental **patcheia temporariamente** o `pyproject.toml`:
- Substitui `paths_to_mutate` pelos arquivos em `PATHS`
- Adiciona `pytest_add_cli_args_test_selection` com os testes em `TESTS`
- Roda mutmut com `--max-children 4`
- Restaura o `pyproject.toml` original via `trap` (mesmo em caso de Ctrl+C ou erro)

### Otimizações manuais

Sem `PATHS`/`TESTS`, mutmut varre `src/` inteiro e roda TODOS os 327 testes para cada mutante (~30min). Com `PATHS` e `TESTS` bem escolhidos:

| Cenário | Tempo estimado |
|---------|---------------|
| `make mutation` (sem args) | ~30 min |
| `PATHS` + `TESTS` bem escolhidos | 1-5 min |
| Só `PATHS` (todos os testes) | 5-15 min |

A economia vem de dois lados:
1. **Menos mutantes** — `paths_to_mutate` limita quantos arquivos geram mutantes
2. **Menos testes por mutante** — `pytest_add_cli_args_test_selection` limita quais testes rodam (cada mutante roda N testes, então reduzir N corta proporcionalmente)

## Regras Críticas

- **NÃO usar Python loops** sobre DataFrames — usar operações vetorizadas (Pandas/DuckDB).
- Não manter código de compatibilidade/legado sem persistência real, consumidor externo ou requisito explícito.
- **Novos endpoints:** adicionar TypedDict em `src/srag/api/types.py` + `CommonFilters` em `src/srag/api/dependencies.py`.
- **Modificar ETL:** atualizar `scripts/ingest_data.py` → re-roda `make ingest`.
- **Modificar GeoJSON:** verificar `src/srag/data/geospatial.py` e `scripts/generate_mossoro_bairros_geojson.py`.
- **Hash de desduplicação:** `md5(DT_NOTIFIC|ID_MUNICIP|DT_SIN_PRI|NU_IDADE_N|CS_SEXO)` — **exclui ID_UNIDADE** para permitir enriquecimento de dados corrigidos. Alterar em `src/srag/data/database.py` E `scripts/ingest_data.py`.
- **Python 3.14** (strict mode) — `pyproject.toml: pythonVersion = "3.14"`, `typeCheckingMode = "strict"`.

## Decisões Arquiteturais (Lidas do Código)

### Desduplicação e Enriquecimento
O hash de caso usa 5 campos estáveis que identificam um paciente mesmo após anonimização. `ID_UNIDADE` é **excluído intencionalmente** — casos com unidade corrigida enrichecem o registro existente sem quebrar a série temporal.

### LGPD Compliance
`load_and_clean_srag_data()` remove imediatamente 12+ campos sensíveis antes de qualquer processamento: `NM_PACIENT`, `NU_CPF`, `NU_CNS`, `NM_MAE_PAC`, `NU_NUMERO`, `NU_DDD_TEL`, `NU_TELEFON`, `ID_RG_RESI`.

### Inconsistência de Nomenclatura SIVEP
SIVEP renomeia colunas entre anos de exportação:
- `CO-DETEC` vs `CO_DETEC`
- `FAB_COV_1` vs `FAB_COV1`
- `FAB_COV_2` vs `FAB_COV2`
Normalizados em `loader.py` (COLUMN_ALIASES) e em `ingest_data.py` (DuckDB SELECT).

### Normalização de Idade
SIVEP armazena idade como `(NU_IDADE_N, TP_IDADE)` → 1=dias, 2=meses, 3=anos. Normalizado para anos decimais: `idade/365.25` ou `/12.0`.

### Semana Epidemiológica Brasileira
SE brasileira: semana começa no **domingo**, SE1 é a semana que contém **4 de janeiro (quarta)**. Equivalente a ISO week mas com início no domingo. Implementado em `src/srag/utils/epi_weeks.py`.

### Óbito = Código 2
Código 3 = "Ignorado" — **excluído** de cálculos de letalidade. Override em `src/srag/data/references.py`: `DEATH_OUTCOMES = {2}`.

### ETL DuckDB (scripts/ingest_data.py)
- DuckDB é usado para Parquet e CSV; XLSX é lido com pandas quando houver múltiplas abas ou necessidade de metadados do workbook.
- Filtro Catch-all: `LIKE '240800%' OR IN (MOSSORO_NAMES)`.
- **Pandas Geographic Pass** executado APÓS carga DuckDB para normalizar `BAIRRO_REF` (Unicode NFKD) + inferir `ZONA` via keywords rurais.

### Inferência Geográfica
ZONA inferida de duas fontes: (1) `CS_ZONA` oficial (1=Urbana, 2=Rural, 3=Periurbana) e (2) keywords no nome do bairro (`SITIO`, `FAZENDA`, `ASSENTAMENTO`, `VILA RURAL`, `RURAL`, `PROJETO DE ASSENTAMENTO`).

### Backend Cache
`get_df()` mantém cache in-memory de 15 minutos para evitar re-leitura do SQLite em cada request.

### Classificação Etiológica
Prioridade: Influenza A(H1N1) > Influenza A(H3N2) > Influenza B > SARS-CoV-2 > VSR > outros. Definido em `ETIOLOGIC_AGENT_PRIORITY` em `surveillance.py`.

### Aggregação laboratory_network
Endpoint `/laboratory_network` agrega **25+ sub-métricas** em uma única chamada para evitar N+1 requests do frontend:
- base_summary, quality_metrics, treatment_metrics
- vaccine_survival (Kaplan-Meier: COVID + Influenza)
- virus_trends, positivity_trend, influenza_subtypes
- antiviral_usage, closure_criteria, notification_delay
- mortality_by_treatment_agent, genomic_variants, imaging_profile
- serology_profile, antiviral_types, virus_ranking
- agent_lethality_heatmap, codetection_matrix

## Campos SIVEP (Grupos Semânticos)

### Vacinação
- **COVID:** `VACINA_COV`, `DOSE_1_COV`, `DOSE_2_COV`, `DOSE_REF`, `DOSE_2REF`, `DOSE_ADIC`, `DOS_RE_BI`, `FAB_COV1/2/RF/RF2/ADIC/RE_BI`
- **Influenza:** `VACINA`, `DT_UT_DOSE`
- **Materna:** `MAE_VAC`, `DT_VAC_MAE`, `M_AMAMENTA`, `DT_DOSEUNI`, `DT_1_DOSE`, `DT_2_DOSE`

### Diagnóstico Laboratorial
- **Antigênico:** `TP_TES_AN`, `DT_RES_AN`, `RES_AN`, `LAB_AN`, `POS_AN_FLU`, `AN_SARS2`
- **RT-PCR:** `DT_PCR`, `PCR_RESUL`, `POS_PCRFLU`, `PCR_FLUASU`, `PCR_FLUBLI`, `PCR_VSR`, `PCR_ADENO`, `PCR_METAP`, `PCR_PARA1-4`
- **Sorologia:** `TP_SOR`, `RES_IGG`, `RES_IGM`, `RES_IGA`

### Genômica
`VG_OMS` (linhagem OMS), `VG_LIN` (linhagem específica), `VG_MET` (método), `VG_REINF` (reinfecção), `CO_DETEC` (codetecção)

## Frontend API Contract

```typescript
// Endpoints principais
GET /summary                      → SummaryData
GET /trends                       → TrendsData (history + forecast)
GET /virus?detail_level=          → VirusData[]
GET /data_completeness            → DataCompletenessGroup[]
GET /laboratory_network           → LaboratoryNetwork (25+ sub-métricas)
GET /citizen_bootstrap           → CitizenBootstrap (10 sub-profiles)
GET /territory_bootstrap         → TerritoryBootstrap (bairros + choropleth)
GET /clinical_flow                → ClinicalFlow (Sankey nodes/links)
GET /vaccine_survival            → VaccineSurvival (covid + gripe KM curves)
GET /timeline_agg?virus=          → AggregatedTimeline[]
GET /icu_bottleneck              → IcuBottleneckRecord[]
GET /units                       → UnitStats[]
GET /context_trends?key=         → TrendsData (BAIRRO:: or ZONA:: prefix)
GET /occupations                 → Array<{label, count}>
GET /vaccination_profile          → VaccinationProfile

// Geo endpoints
GET /geo/macrosector_heatpoints  → ECharts heatmap points
GET /geo/rural_heatpoints        → Rural sector counts
GET /geo/rural_sectors           → FeatureCollection (triangular sectors)
GET /geo/bairros_choropleth      → GeoJSON FeatureCollection
```

## Debugging

| Sintoma | Ação |
|---------|------|
| API 500 | Verificar `src/srag/api/` logs + `make lint-back` (Pyright) |
| Ingestão falha | Verificar `data/raw/` integridade + `make ingest` |
| Frontend sem dados | Verificar `VITE_API_BASE` env + `frontend/src/services/api.ts` |
| GeoJSON vazio | Verificar `src/srag/data/geospatial.py` + `data/geojson/` |
| Cache desatualizado | Reiniciar API (cache de 15 min em `get_df()`) |
| Erro de tipagem | `make lint-back` — Pyright Strict mode |

## Key Files (Read First)

- `src/srag/api/main.py:91` — register_routes (entrypoint)
- `src/srag/api/core.py:55` — get_df() com cache de 15 min
- `src/srag/data/analytics/__init__.py` — 55+ funções exportadas, mapa do motor
- `scripts/ingest_data.py:118-126` — hash de desduplicação (crítico)
- `src/srag/api/dependencies.py:7-19` — CommonFilters (filtros universais)
- `src/srag/data/references.py` — CONSTANTES: MOSSORO_IBGE_CODES, DEATH_OUTCOMES
- `src/srag/data/loader.py:17-33` — SENSITIVE_FIELDS (LGPD)

## Knowledge Graph

```bash
make update-graph       # atualiza o grafo
graphify query "pergunta"  # consultar o grafo
```

- Grafo em `graphify-out/graph.json` (19.843 nós, 24.417 arestas, 3 hyperedges)
- Nós semânticos: rationale de decisões, grupos de campos SIVEP, hyperedges funcionais
- **Quando usar:** entender conexões entre módulos, descobrir dependências ocultas, tracear o fluxo de dados
- **Ordem de busca:** para qualquer investigação do código, use `graphify` primeiro; só depois use `Glob`, `Grep` e `Read` para confirmar detalhes exatos em arquivos específicos.

### Uso Prático

- Use `make update-graph` após mudanças estruturais, especialmente em `src/srag/`, `scripts/` e `tests/`.
- Use `graphify query "<termo>"` para responder perguntas de impacto e navegação sem varrer o repo inteiro.
- Use `graphify explain "<nó>"` para entender um símbolo e seus vizinhos imediatos.
- Use `graphify path "A" "B"` para descobrir o caminho mais curto entre dois nós.
- Prefira consultas curtas e direcionadas: nomes de função, arquivo, endpoint, campo SIVEP, classe ou pipeline.
- Se a pergunta for ampla, comece por um termo central e refine com 2 ou 3 consultas menores.
- Para mudanças em regra de negócio, use o grafo para mapear origem → transformação → consumo antes de editar.
- Para APIs, verifique router → `types.py` → hook/frontend antes de concluir que a mudança está completa.
- Para ingestão, siga `raw file -> loader/ingest -> database -> analytics/API` e confirme cada salto com `graphify query`.
- Se o grafo ficar ruidoso, limpe `graphify-out/` e rode `make update-graph` de novo; `mutants/` deve permanecer ignorado.
- Não use o grafo como fonte final de verdade para comportamento atual; ele complementa o código e os testes.

### Cookbook

#### Impacto de mudança

```bash
graphify query "<função-ou-endpoint>"
graphify path "<origem>" "<consumo>"
graphify explain "<símbolo>"
```

Use quando quiser saber o que quebra, o que consome, e qual caminho de dados está envolvido.

#### Ingestão e ETL

```bash
graphify query "ingest_data.py"
graphify query "load_and_clean_srag_data"
graphify query "generate_case_hash"
graphify query "save_cases"
```

Use para seguir arquivo bruto -> normalização -> persistência -> API.

#### API e frontend

```bash
graphify query "routers_core.py"
graphify query "CommonFilters"
graphify query "useCoreData"
graphify path "routers_*.py" "frontend/src/hooks"
```

Use para achar contrato, tipos, dependências e pontos de consumo no frontend.

#### Testes

```bash
graphify query "test_*.py"
graphify query "<função> test"
graphify path "<código>" "tests/unit"
```

Use para localizar cobertura existente antes de mexer em comportamento.

#### Regras de negócio

```bash
graphify query "DEATH_OUTCOMES"
graphify query "ETIOLOGIC_AGENT_PRIORITY"
graphify query "CS_ZONA"
graphify query "NU_IDADE_N TP_IDADE"
```

Use para conferir constante, classificação, normalização e regra epidemiológica.

#### Limpeza do grafo

```bash
make update-graph
```

Use após alterações grandes em backend, ETL, testes ou scripts para manter o grafo confiável.

### Consultas Úteis

```bash
graphify query "save_cases unique_hash"
graphify query "DT_NOTIFIC ID_MUNICIP hash"
graphify query "run_surveillance_pipeline xlsx"
graphify query "compute_alert_thresholds"
graphify query "load_and_clean_srag_data"
graphify query "CommonFilters endpoints"
graphify explain "generate_case_hash()"
graphify path "run_weekly_update()" "save_cases()"
```
