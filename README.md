# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, projetado para automatizar a análise de dados do SIVEP-Gripe e oferecer inteligência geoespacial e preditiva para apoio à decisão em saúde pública.

## 📊 Visão Geral

O projeto consolidou a análise de dados epidemiológicos em uma plataforma integrada de alta performance, substituindo planilhas manuais por um fluxo automatizado de engenharia:

1.  **Motor de Ingestão Universal:** Processamento ultrarrápido de arquivos Parquet, CSV e **XLSX** via DuckDB e desduplicação global baseada em hashes únicos.
2.  **Backend Científico:** API FastAPI desacoplada com motor analítico vetorizado (Pandas), modelos de previsão sazonais (Facebook Prophet) e análise de sobrevivência (Kaplan-Meier).
3.  **Engenharia de Qualidade:** Suite de **262 testes** com 87% de cobertura, integrando testes de propriedade (Hypothesis), benchmarks e testes de mutação (Mutmut) para garantir robustez matemática.
4.  **Dashboard Inteligente:** Visualização dinâmica em React 19 com **Modo Escuro**, navegação por **Sidebar**, e integração nativa com notebooks Jupyter.

## 🛠️ Arquitetura e Estrutura de Dados

O projeto segue uma estrutura organizada para garantir a integridade e escalabilidade:

```text
├── data/
│   ├── raw/           # Fontes brutas (Bronze): Parquets, CSVs e XLSX originais
│   ├── processed/     # Dados estruturados (Silver): Banco SQLite e limites municipais
│   ├── geojson/       # Dados prontos para consumo (Gold): Polígonos para o dashboard
├── src/srag/          # Backend (API e Motor Analítico)
├── frontend/          # Dashboard (React 19 + TypeScript + Vite)
├── scripts/           # Ferramentas operacionais e orquestração
└── tests/             # Suite de testes (Unitários, Integração e Propriedade)
```

## 🚀 Toolchain Unificada (Makefile)

Gerencie todo o ciclo de vida do projeto com comandos simplificados:

```bash
# 1. Instalação e Setup (uv + npm + hooks)
make setup

# 2. Ingestão e Processamento de Dados
make ingest

# 3. Qualidade e Segurança (Lint, Tipagem Strict, Bandit)
make lint-back   # Roda Ruff + Pyright (Strict)
make security    # Roda Bandit + Gitleaks

# 4. Suite de Testes Completa
make test-back   # Pytest (262 testes)
make mutation    # Teste de mutação (Mutmut + Stryker)

# 5. Iniciar Sistema (Full Stack)
make start       # Dashboard (5173), API (8000), Jupyter (8888)

# 6. Iniciar com Docker
make start-docker # Frontend (80), API (8000), Jupyter (8888)

# 7. Encerrar Docker
make stop-docker  # Encerra o stack do Compose
```

### Acesso público via Docker

- `Frontend`: http://localhost
- `Backend`: http://localhost:8000
- `Jupyter`: http://localhost:8888/lab/

## 🛡️ Padrões de Engenharia

- **Tipagem Estrita:** Migração concluída de Mypy para **Pyright (Strict Mode)** para máxima segurança em tempo de desenvolvimento.
- **Segurança Blindada:** Auditoria automática contra injeção de SQL e vazamento de segredos (Gitleaks) via hooks de pre-commit.
- **Performance:** Todas as lógicas analíticas são **vetorizadas**, eliminando loops lentos e garantindo escalabilidade para grandes bases de dados.
- **Observabilidade:** Integração opcional com **Logfire** para monitoramento de performance de queries e erros de validação Pydantic.

## 🧠 Inteligência e Funcionalidades

- **Auditoria de Dados:** Painel exclusivo de completude de campos críticos.
- **Filtros Avançados:** Busca textual de ocupações e filtros maternos inteligentes.
- **Ciência de Dados:** Notebooks Jupyter Lab integrados diretamente no dashboard.
- **Mapa Térmico:** Visualização de densidade com suporte a áreas urbanas e rurais.

## 🔗 Principais Endpoints

- `GET /data_completeness`: Score de qualidade e preenchimento.
- `GET /trends`: Histórico e previsão sazonal.
- `GET /laboratory_network`: Subtipagem Influenza, variantes COVID e latência diagnóstica.
- `GET /vaccine_survival`: Curvas de eficácia vacinal no tempo.
