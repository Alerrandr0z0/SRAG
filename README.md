# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, projetado para automatizar a análise de dados do SIVEP-Gripe e oferecer inteligência geoespacial e preditiva para apoio à decisão em saúde pública.

## 📊 Visão Geral

O projeto consolidou a análise de dados epidemiológicos em uma plataforma integrada de alta performance, substituindo planilhas manuais por um fluxo automatizado:

1.  **Motor de Ingestão Universal:** Processamento ultrarrápido de arquivos Parquet, CSV e **XLSX** via DuckDB (com suporte nativo a Excel) e desduplicação global.
2.  **Backend Científico:** API FastAPI com modelos de previsão sazonais (Facebook Prophet), análise de sobrevivência (Kaplan-Meier) e auditoria de completude.
3.  **Suíte de Testes:** **82 testes** (unitários, Hypothesis e benchmarks) garantindo 100% de confiabilidade nos cálculos epidemiológicos.
4.  **Dashboard Inteligente:** Visualização dinâmica em React com layout **Full-Screen** e navegação por **Sidebar**, incluindo mapas coropléticos térmicos e fluxogramas clínicos.

## 🛠️ Arquitetura e Estrutura de Dados

O projeto segue uma estrutura organizada para garantir a integridade e escalabilidade dos dados:

```text
├── data/
│   ├── raw/           # Fontes brutas (Bronze): Parquets, CSVs e XLSX originais
│   ├── processed/     # Dados estruturados (Silver): Banco SQLite e limites municipais
│   ├── geojson/       # Dados prontos para consumo (Gold): Polígonos para o dashboard
│   └── external/      # Bases de terceiros (IBGE, áreas urbanizadas)
├── src/srag/          # Código fonte do backend e lógica de dados
├── frontend/          # Dashboard web (React 19 + TypeScript + Vite)
├── scripts/           # Ferramentas operacionais (Ingestão e Geração de Mapas)
└── tests/             # Suíte de testes unitários, integração e benchmarks
```

## 🚀 Requisitos e Instalação

- **Python >= 3.14**
- **Node.js (npm)**
- **uv** (gerenciador de pacotes Python recomendado)

```bash
# Instalar dependências e preparar ambiente
uv sync
cd frontend && npm install --legacy-peer-deps
```

## ⚙️ Como Executar

### 1. Ingestão de Dados (Motor Master)
Para atualizar o banco de dados com novos arquivos (incluindo planilhas Excel) ou reconstruí-lo:
```bash
uv run scripts/ingest_data.py
```

### 2. Garantia de Qualidade (Testes)
Execute a suíte de testes completa antes de cada deploy:
```bash
uv run pytest
```

### 3. Iniciar o Sistema (Full Stack)
```bash
./scripts/port_control.sh start               # Inicia API, Dashboard e Jupyter
./scripts/port_control.sh start --no-jupyter  # Inicia apenas API e Dashboard
```
- **Dashboard:** `http://localhost:5173`
- **Jupyter Lab:** `http://localhost:8888` (Integrado na Sidebar)
- **API Docs:** `http://localhost:8000/docs`

## 🧠 Inteligência e Novas Funcionalidades

- **Auditoria de Dados:** Painel exclusivo para monitorar a completude (preenchimento válido) de campos críticos do SIVEP-Gripe.
- **Filtros Avançados:** Busca textual de ocupações e filtros específicos para gestantes/puérperas com lógica inteligente que evita duplicidade de dados.
- **Vigilância Refinada:** Grade 2x3 de métricas de qualidade, incluindo cobertura de testagem e distribuição de materiais biológicos.
- **Mapa Coroplético Térmico:** Visualização de intensidade de casos por tons quentes (Amarelo ao Vermelho) com zoom dinâmico automático.
- **Ciência de Dados Integrada:** Acesso direto aos Notebooks Jupyter Lab através de um painel nativo do dashboard via iframe.

## 🔗 Principais Endpoints

- `GET /data_completeness`: Score de qualidade e preenchimento da base.
- `GET /occupations`: Lista dinâmica de profissões presentes na base.
- `GET /vaccine_survival`: Curvas Kaplan-Meier de proteção vacinal.
- `GET /trends`: Histórico e previsão sazonal via Prophet com suporte a múltiplos períodos.
- `GET /citizen_bootstrap`: Bootstrap completo de dados demográficos e assinaturas de sintomas.
- `GET /laboratory_network`: Inteligência laboratorial completa (subtipagem Influenza, variantes COVID, latência e adesão).

---
