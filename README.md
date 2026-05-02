# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, projetado para automatizar a análise de dados do SIVEP-Gripe e oferecer inteligência geoespacial e preditiva para apoio à decisão em saúde pública.

##  Visão Geral

O projeto consolidou a análise de dados epidemiológicos em uma plataforma integrada de alta performance, substituindo planilhas manuais por um fluxo automatizado:

1.  **Motor de Ingestão Universal:** Processamento ultrarrápido de arquivos Parquet e CSV via DuckDB com desduplicação global.
2.  **Backend Científico:** API FastAPI com modelos de previsão sazonais (Facebook Prophet) e análise de sobrevivência (Kaplan-Meier).
3.  **Suíte de Testes:** 79 testes (73 unitários + 15 Hypothesis + 17 benchmarks) garantindo confiabilidade nos cálculos epidemiológicos.
4.  **Dashboard Inteligente:** Visualização dinâmica em React com mapas geoespaciais e fluxogramas clínicos.

##  Arquitetura e Estrutura de Dados

O projeto segue uma estrutura organizada para garantir a integridade e escalabilidade dos dados:

```text
├── data/
│   ├── raw/           # Fontes brutas (Bronze): Parquets e CSVs originais
│   ├── processed/     # Dados estruturados (Silver): Banco SQLite e limites municipais
│   ├── geojson/       # Dados prontos para consumo (Gold): Polígonos para o dashboard
│   └── external/      # Bases de terceiros (IBGE, áreas urbanizadas)
├── src/srag/          # Código fonte do backend e lógica de dados
├── frontend/          # Dashboard web (React + TypeScript + Vite)
├── scripts/           # Ferramentas operacionais (Ingestão e Geração de Mapas)
└── tests/             # Suíte de testes unitários e integração
```

##  Requisitos e Instalação

- **Python >= 3.14**
- **Node.js (npm)**
- **uv** (gerenciador de pacotes Python recomendado)

```bash
# Instalar dependências e preparar ambiente
uv sync
cd frontend && npm install
```

##  Como Executar

### 1. Ingestão de Dados (Motor Master)
Para atualizar o banco de dados com novos arquivos ou reconstruí-lo do zero:
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
./scripts/port_control.sh start
```
- **Dashboard:** `http://localhost:5173`
- **API Docs:** `http://localhost:8000/docs`

##  Inteligência Geoespacial e Preditiva

- **Previsão Avançada:** Utiliza o **Facebook Prophet** para capturar a sazonalidade real de Mossoró, oferecendo intervalos de confiança de 80% para planejamento de carga hospitalar.
- **Mapa Territorial:** Divisão precisa em quadrantes cardeais para a zona rural e coroplético por bairro para a zona urbana, com legendas dinâmicas e seleção múltipla.

##  Principais Endpoints

- `GET /vaccine_survival`: Curvas Kaplan-Meier de proteção vacinal.
- `GET /trends`: Histórico e previsão sazonal via Prophet.
- `GET /citizen_bootstrap`: Perfis demográficos, assinaturas e heatmap de sintomas.
- `GET /clinical_flow`: Jornada clínica completa via Sankey.
- `GET /clinical_timing`: Métricas de fluxo clínico (tempo sintomas→internação, UTI, adesão antiviral).
- `GET /laboratory_network`: Inteligência laboratorial (positividade, subtipos de influenza, sorologia, variantes genômicas).

---
