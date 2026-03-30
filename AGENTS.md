# Guia do Projeto: SRAG Mossoró/RN

## Visão Geral
Sistema de vigilância epidemiológica municipal para Mossoró/RN, focado em automatizar a análise de dados do SIVEP-Gripe (substituindo o Excel) e fornecer previsões de tendência.

## Arquitetura do Sistema
1. **Ferramenta de Privacidade (Local):** Usada pelo setor de epidemiologia de Mossoró para filtrar e anonimizar dados antes do envio.
2. **Backend (FastAPI):** Processa os dados, gerencia o histórico em SQLite e executa modelos de previsão.
3. **Frontend (React/Web):** Dashboard dinâmico para visualização de métricas e alertas.

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

## Estrutura de Pastas Atualizada
- `src/srag/api/`: Rotas do Backend FastAPI.
- `src/srag/data/`: Lógica de banco de dados, limpeza e análise (substitui Excel).
- `src/srag/pipelines/`: Pipeline operacional (ingestão + snapshot semanal).
- `src/srag/models/`: Modelos de previsão de tendência.
- `src/srag/viz/`: Funções reutilizáveis de visualização para notebook/relatórios.
- `tools/mossoro_privacy_tool/`: Programa independente para anonimização LGPD.
- `frontend/`: Dashboard principal em React.

## Comandos Úteis
- **Exportação Segura via CLI:** `python main.py secure-export <entrada> <saida>`
- **Atualização Semanal (ingestão + snapshot):** `python main.py weekly-update <arquivo_seguro> --last-n-weeks 26 --weeks-to-predict 4 --output data/processed/snapshot_semanal.json`
- **Formatos de Entrada Aceitos:** `.csv`, `.xls`, `.xlsx`, `.parquet`
- **Testes:** `uv run pytest`
- **Linting:** `uv run ruff check .`

## Observações Operacionais
- O banco local é incremental e deduplicado por hash de caso.
- O endpoint `/virus` aceita `detail_level=summary|detailed`.
- Para mapa por bairros, usar `data/mossoro_bairros.geojson`.
- Endpoints territoriais principais: `/territory_summary`, `/territory_heatmap`, `/units`, `/geo/municipality_boundary`, `/geo/bairros_choropleth`.
