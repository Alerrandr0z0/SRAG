# Guia do Projeto: SRAG Mossoró/RN

## Visão Geral
Sistema de vigilância epidemiológica municipal para Mossoró/RN, focado em automatizar a análise de dados do SIVEP-Gripe (substituindo o Excel) e fornecer previsões de tendência.

## Arquitetura do Sistema
1. **Ferramenta de Privacidade (Local):** Usada pelo setor de epidemiologia de Mossoró para filtrar e anonimizar dados antes do envio.
2. **Backend (FastAPI):** Processa os dados, gerencia o histórico em SQLite e executa modelos de previsão.
3. **Frontend (React + TypeScript + Vite):** Dashboard dinâmico para visualização de métricas e alertas.

---

## Como Rodar o Projeto

### 1. Preparação (Lado Mossoró)
O setor de epidemiologia deve rodar a ferramenta gráfica para gerar o arquivo seguro:
```bash
python tools/mossoro_privacy_tool/secure_processor.py
```
*Isso abrirá uma janela para selecionar o arquivo bruto e salvar o arquivo limpo para o dashboard.*

### 2. Iniciar o Backend (Servidor)
```bash
uv run uvicorn srag.api.main:app --reload
```
*A API estará disponível em http://localhost:8000. Acesse /docs para ver a documentação interativa.*

### 3. Visualizar o Dashboard (Frontend)
```bash
cd frontend
npm install
npm run dev
```
*Abra em* `http://localhost:5173`.

---

## Estrutura de Pastas

```
├── data/                      # Dados brutos, processados e banco SQLite
│   ├── raw/                   # Arquivos brutos de entrada (parquet)
│   ├── staging/               # Dados filtrados intermediários
│   ├── processed/             # Snapshots semanais, CSVs limpos, boundary geojson
│   ├── external/              # Dados externos (vazio, reservado)
│   ├── srag_mossoro.db        # Banco SQLite principal
│   ├── mossoro_bairros.geojson
│   └── neighborhoods_2022_simplified.gpkg
├── src/srag/                  # Código fonte principal
│   ├── api/main.py            # Rotas FastAPI (18 endpoints)
│   ├── data/                  # Camada de dados
│   │   ├── loader.py          # Carregamento e exportação segura
│   │   ├── schema.py          # Validação e tipagem de dados
│   │   ├── database.py        # Gerenciamento do SQLite
│   │   ├── analytics.py       # Funções de análise e agregação
│   │   └── geospatial.py      # Manipulação de dados geoespaciais
│   ├── pipelines/             # Pipelines operacionais
│   │   └── weekly_update.py   # Pipeline de atualização semanal
│   ├── models/                # Modelos de previsão
│   │   └── forecasting.py     # Previsão de tendência
│   ├── utils/                 # Utilitários
│   │   └── epi_weeks.py       # Cálculo de semanas epidemiológicas
│   └── viz/                   # Visualização para notebooks/relatórios
│       └── charts.py          # Funções de geração de gráficos
├── frontend/                  # Dashboard React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/        # 18 componentes de gráficos (ECharts, D3, Observable Plot)
│   │   │   ├── panels/        # Painéis: Citizen, Territory, Units, Vigilance
│   │   │   └── ui/            # Componentes reutilizáveis (ChartWrapper, KpiCard)
│   │   ├── services/          # Comunicação com API
│   │   ├── types/             # Tipagens TypeScript
│   │   ├── hooks/             # Custom hooks (useCoreData, useCitizenData, etc.)
│   │   ├── constants/         # Constantes da aplicação
│   │   ├── utils/             # Utilitários (math.ts)
│   │   └── lib/               # Bibliotecas auxiliares (echarts-heatmap.js)
│   └── public/                # Assets estáticos
├── tools/mossoro_privacy_tool/ # Ferramenta de anonimização LGPD
│   └── secure_processor.py
├── scripts/                   # Scripts utilitários
│   ├── ingest_historical.py   # Ingestão de dados históricos
│   ├── backfill_db_lowmem.py  # Backfill do banco com baixa memória
│   ├── sync_tp_idade.py       # Sincronização de tipo de idade
│   ├── sync_tp_idade_v2.py    # Sincronização de tipo de idade (v2)
│   ├── sync_child_vax.py      # Sincronização de vacinação infantil
│   ├── generate_mossoro_bairros_geojson.py
│   ├── port_control.sh        # Controle de porta
│   └── smoke_test.sh          # Teste rápido de fumaça
├── notebooks/                 # Notebooks de análise
├── docs/                      # Documentação (dicionário de dados, etc.)
├── tests/                     # Testes automatizados
│   ├── unit/                  # Testes unitários (schema, epi_weeks)
│   └── integration/           # Testes de integração (estrutura criada)
├── docs/                      # Dicionário de dados e documentação técnica
├── main.py                    # CLI principal (secure-export, weekly-update)
└── pyproject.toml             # Configuração do projeto e dependências
```

## Endpoints da API

### Core
- `GET /health` - Status do serviço
- `GET /summary` - Métricas gerais (UTI rate, death rate, total)
- `GET /trends` - Série temporal com previsão (parâmetros: `last_n_weeks`, `weeks_to_predict`, `lookback_weeks`)
- `GET /virus` - Distribuição viral (`detail_level=summary|detailed`)
- `GET /units` - Distribuição por unidades de saúde

### Território
- `GET /territory_bootstrap` - Dados territoriais completos (bairros, zonas, geojson, choropleth)
- `GET /context_trends` - Tendências filtradas por bairro/zona (`key=BAIRRO::nome|ZONA::nome`)
- `GET /geo/municipality_boundary` - GeoJSON do limite municipal
- `GET /geo/bairros_choropleth` - GeoJSON dos bairros para mapa
- `GET /geo/macrosector_heatpoints` - Heatpoints por macrosetor

### Cidadão e Vacinação
- `GET /citizen_bootstrap` - Perfis demográficos (perfis, pirâmide etária, raça, escolaridade, sintomas, fatores de risco)
- `GET /vaccination_profile` - Esquema vacinal detalhado (COVID-19 e Influenza)
- `GET /vaccine_survival` - Curvas de sobrevivência Kaplan-Meier

### Clínico
- `GET /clinical_flow` - Fluxo clínico completo (gráfico Sankey)
- `GET /hospitalization_duration` - Distribuição de dias de internação
- `GET /icu_bottleneck` - Tempo de espera para UTI
- `GET /timeline_agg` - Medianas de tempo por perfil vacinal

### Laboratório
- `GET /laboratory_network` - Resumo da rede laboratorial

### Filtros Comuns
Muitos endpoints aceitam os parâmetros de filtro:
- `profile[]` - Perfis: `crianca`, `adolescente`, `adulto`, `idoso`
- `race[]` - Raças/cor: `Branca`, `Preta`, `Amarela`, `Parda`, `Indígena`

---

## Comandos Úteis

### CLI Principal
- **Exportação Segura:** `python main.py secure-export <entrada> <saida>`
- **Atualização Semanal:** `python main.py weekly-update <arquivo_seguro> --last-n-weeks 26 --weeks-to-predict 4 --output data/processed/snapshot_semanal.json`
- **Formatos de Entrada Aceitos:** `.csv`, `.xls`, `.xlsx`, `.parquet`

### Scripts Auxiliares
- **Ingestão Histórica:** `python scripts/ingest_historical.py`
- **Backfill com Baixa Memória:** `python scripts/backfill_db_lowmem.py`
- **Sincronizar Tipo de Idade:** `python scripts/sync_tp_idade.py`
- **Sincronizar Vacinação Infantil:** `python scripts/sync_child_vax.py`
- **Gerar GeoJSON dos Bairros:** `python scripts/generate_mossoro_bairros_geojson.py`

### Desenvolvimento
- **Testes:** `uv run pytest`
- **Linting:** `uv run ruff check .`
- **Type Check:** `uv run mypy .`

---

## Observações Operacionais

- **Banco de Dados:** SQLite em `data/srag_mossoro.db`, incremental e deduplicado por hash de caso.
- **Observabilidade:** Logfire instrumentado para FastAPI, SQLAlchemy e Pydantic.
- **Cache:** DataFrame em cache no backend com TTL de 15 minutos.
- **Sanitização:** Dados numpy são convertidos para tipos nativos antes de serialização JSON.
- **Colunas Core:** A API utiliza um conjunto fixo de colunas do SIVEP-Gripe para otimização de consultas.
- **Python:** Requer Python >= 3.14.
- **Frontend:** React + TypeScript + Vite, com estrutura de componentes, serviços e tipagens próprias.
- **Modelos de Previsão:** Utiliza `lifelines` para análise de sobrevivência Kaplan-Meier.
