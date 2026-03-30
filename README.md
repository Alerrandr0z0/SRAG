# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, focado em automatizar a análise de dados do SIVEP-Gripe (substituindo planilhas manuais) e oferecer previsões de tendência para apoio à decisão.

## Visão geral

O projeto é dividido em três partes principais:

1. Ferramenta local de privacidade (LGPD) para filtrar e anonimizar os dados brutos.
2. Backend FastAPI para ingestão, persistência (SQLite), análise e previsão.
3. Frontend Web para visualização de indicadores e tendências.

## Arquitetura

- `tools/mossoro_privacy_tool/`: aplicativo local (Tkinter) para processar arquivos SIVEP-Gripe com remoção de campos sensíveis.
- `src/srag/api/`: API FastAPI com rotas de upload, resumo, tendências, perfil viral e faixa etária.
- `src/srag/data/`: carregamento, validação (Pydantic), limpeza, analytics e persistência em SQLite.
- `src/srag/models/`: modelo de previsão (tendência linear com suavização).
- `frontend/`: dashboard web (React + Vite) consumindo a API local.

## Documentação de referência

- Dicionário oficial do SIVEP-Gripe: `docs/dicionariodedados-2d1.pdf`
- Esse documento é a referência para nomes, tipos e regras dos campos utilizados na ingestão e validação dos dados.
- O schema do projeto está em `src/srag/data/schema.py` e segue os campos exportados do SIVEP-Gripe para a ficha de SRAG hospitalizado.

## Requisitos

- Python `>= 3.14`
- [uv](https://docs.astral.sh/uv/) (recomendado para ambiente e execução)

## Instalação

```bash
uv sync
```

## Como executar

### 1) Gerar dataset seguro (lado Mossoró)

Opção GUI:

```bash
python tools/mossoro_privacy_tool/secure_processor.py
```

Opção CLI:

```bash
python main.py secure-export <arquivo_entrada> <arquivo_saida>
```

Formatos de entrada aceitos: `.csv`, `.xls`, `.xlsx`, `.parquet`.

Atualização semanal com snapshot analítico e preditivo:

```bash
python main.py weekly-update <arquivo_seguro> --last-n-weeks 26 --weeks-to-predict 4 --output data/snapshot_semanal.json
```

Exemplo:

```bash
python main.py secure-export dados_brutos.csv dados_mossoro_limpos.csv
```

### 2) Subir backend

```bash
uv run uvicorn srag.api.main:app --reload
```

API disponível em:

- `http://localhost:8000`
- documentação interativa: `http://localhost:8000/docs`

### 3) Abrir dashboard

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173` no navegador.

### Inicialização rápida (backend + frontend)

```bash
./scripts/port_control.sh start
```

O script sobe os dois serviços e encerra ambos com `Ctrl+C`.

Frontend em `http://localhost:5173`.

### Frontend (React + Vite)

Base de frontend:

- código: `frontend/`
- API por padrão: `http://localhost:8000`

Executar em desenvolvimento:

```bash
cd frontend
npm install
npm run dev
```

Para apontar para outra API:

```bash
VITE_API_BASE=http://127.0.0.1:8001 npm run dev
```

Para encerrar serviços já em execução por porta:

```bash
./scripts/port_control.sh stop
```

Também aceita portas customizadas:

```bash
API_PORT=8001 VITE_PORT=5174 ./scripts/port_control.sh start
```

Outras ações disponíveis:

```bash
./scripts/port_control.sh status
./scripts/port_control.sh restart
```

## Endpoints principais

- `POST /upload`: recebe arquivo já anonimizado e salva no histórico.
- `GET /summary`: retorna métricas de gravidade (taxa de UTI, letalidade, total).
- `GET /trends`: histórico semanal + previsão (parâmetros: `weeks_to_predict`, `last_n_weeks`).
- `GET /virus`: distribuição por classificação viral (opcional `year`).
- `GET /age_groups`: distribuição por faixa etária.
- `GET /territory_summary`: distribuição por bairro (com supressão) e por zona.
- `GET /territory_heatmap`: matriz bairro x semana para mapa de calor.
- `GET /units`: distribuição por unidade notificadora (`ID_UNIDADE`/`CO_UNI_NOT`).
- `GET /geo/municipality_boundary`: limite municipal do IBGE (GeoJSON).
- `GET /geo/bairros_choropleth`: choropleth por bairro com base em GeoJSON local.

## Campos críticos usados no projeto

Campos do dicionário SIVEP-Gripe atualmente usados na ingestão, análise e API:

- `DT_NOTIFIC`, `SEM_NOT`
- `DT_SIN_PRI`, `SEM_PRI`
- `ID_MUNICIP` (compatível com `CO_MUN_NOT` na importação)
- `ID_MN_RESI` (compatível com `CO_MUN_RES` na importação)
- `ID_UNIDADE` (compatível com `CO_UNI_NOT` na importação)
- `NU_IDADE_N`, `TP_IDADE`, `CS_SEXO`
- `CLASSI_FIN`, `EVOLUCAO`, `UTI`, `HOSPITAL`, `SUPORT_VEN`

Esses campos são validados no schema em `src/srag/data/schema.py` e usados nas rotinas de análise em `src/srag/data/analytics.py` e persistência em `src/srag/data/database.py`.

## Compatibilidade com o dicionário SIVEP-Gripe

- Verificação realizada com base em `docs/dicionariodedados-2d1.pdf` (via extração de texto local).
- Os nomes principais utilizados pelo sistema estão compatíveis com o dicionário (ex.: `DT_NOTIFIC`, `DT_SIN_PRI`, `CLASSI_FIN`, `UTI`, `EVOLUCAO`, `HOSPITAL`).
- Foi adicionada compatibilidade para aliases de exportação (`CO_MUN_NOT`, `CO_MUN_RES`, `CO_UNI_NOT`) no carregamento.
- Foi reforçada anonimização para endereço com remoção de `NM_LOGRADO` e `NM_COMPLEM`, além dos campos sensíveis já removidos.

### Variável recomendada para próxima melhoria

- `idade_anos`: variável derivada de `NU_IDADE_N` + `TP_IDADE`.
- Motivo: no SIVEP a idade pode vir em dias, meses ou anos; hoje a análise de faixa etária usa `NU_IDADE_N` diretamente.
- Impacto: melhora a acurácia da distribuição etária e evita distorção em menores de 1 ano.

Status atual: implementada no pipeline de ingestão e usada na análise de faixa etária.

## Privacidade e LGPD

Os seguintes campos sensíveis são removidos no processamento seguro:

- `NM_PACIENT`, `NU_CPF`, `NU_CNS`, `NM_MAE_PAC`
- `ID_LOGRADO`, `NU_NUMERO`, `NM_BAIRRO`, `NU_CEP`
- `NU_DDD_TEL`, `NU_TELEFON`, `ID_RG_RESI`

Além disso, o filtro mantém apenas casos relacionados a Mossoró (`2408003`) por notificação ou residência.

## Banco de dados

- SQLite local em `data/srag_mossoro.db`
- tabela principal: `casos_srag`
- deduplicação por hash de campos epidemiológicos-chave durante o upload

## Testes e qualidade

```bash
uv run pytest
uv run ruff check .
```

## Smoke test da API

Com a API rodando em `http://127.0.0.1:8000`, execute:

```bash
./scripts/smoke_test.sh data/mossoro_limpo.csv
```

Se a API estiver em outra URL/porta:

```bash
API_BASE="http://127.0.0.1:8001" ./scripts/smoke_test.sh data/mossoro_limpo.csv
```

O script faz:

- verificação de disponibilidade da API
- `POST /upload`
- `GET /summary`
- `GET /trends?last_n_weeks=26`
- `GET /virus`
- `GET /age_groups`

## Estrutura do projeto

```text
.
|-- frontend/
|   |-- src/
|   `-- package.json
|-- src/srag/
|   |-- api/
|   |   `-- main.py
|   |-- data/
|   |   |-- analytics.py
|   |   |-- database.py
|   |   |-- loader.py
|   |   `-- schema.py
|   |-- models/
|   |   `-- forecasting.py
|   `-- utils/
|       `-- epi_weeks.py
|-- tests/
|-- tools/mossoro_privacy_tool/
|   `-- secure_processor.py
`-- main.py
```

## Observações

- O backend inicializa o banco automaticamente na subida da API.
- O modelo de previsão atual é baseline (linear), pensado para simplicidade e robustez inicial.
- Para mapa por bairro (polígonos), coloque um arquivo local em `data/mossoro_bairros.geojson` com uma propriedade de nome do bairro (`bairro`, `nome`, `name` ou `nm_bairro`).

### Gerar GeoJSON de bairros de Mossoró (automático)

Baixar base de bairros nacional (geobr) e gerar o recorte de Mossoró:

```bash
uv run --with requests python -c "import requests, pathlib; u='https://www.ipea.gov.br/geobr/data_gpkg/neighborhood/2022/neighborhoods_2022_simplified.gpkg'; p=pathlib.Path('data/neighborhoods_2022_simplified.gpkg'); p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(requests.get(u, timeout=120).content)"
uv run --with duckdb python scripts/generate_mossoro_bairros_geojson.py
```

Depois disso, o endpoint `GET /geo/bairros_choropleth` e o mapa no frontend passam a usar os polígonos dos bairros.
