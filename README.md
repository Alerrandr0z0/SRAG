# SRAG Mossoró/RN

Sistema de vigilância epidemiológica municipal para Mossoró/RN, projetado para automatizar a análise de dados do SIVEP-Gripe e oferecer inteligência geoespacial e preditiva para apoio à decisão em saúde pública.

## 🚀 Visão Geral

O projeto consolidou a análise de dados epidemiológicos em uma plataforma integrada de alta performance, substituindo planilhas manuais por um fluxo automatizado:

1.  **Motor de Ingestão Universal:** Processamento ultrarrápido de arquivos Parquet e CSV via DuckDB.
2.  **Backend Analítico:** API FastAPI com modelos de sobrevivência (Kaplan-Meier) e previsões de tendência.
3.  **Dashboard Inteligente:** Visualização dinâmica em React com mapas geoespaciais e fluxogramas clínicos.

## 🏗️ Arquitetura e Estrutura de Dados

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
└── tools/             # Ferramenta local de anonimização (LGPD)
```

## 🛠️ Requisitos e Instalação

- **Python >= 3.14**
- **Node.js (npm)**
- **uv** (gerenciador de pacotes Python recomendado)

```bash
# Instalar dependências do backend
uv sync

# Instalar dependências do frontend
cd frontend && npm install
```

## ⚡ Como Executar

### 1. Ingestão de Dados (Motor Master)
Para atualizar o banco de dados com novos arquivos ou reconstruí-lo do zero:
```bash
uv run scripts/ingest_data.py
```
*Este script processa automaticamente arquivos em `data/raw/`, remove duplicatas via hash MD5 e aplica inteligência geográfica.*

### 2. Iniciar o Sistema (Full Stack)
Use o utilitário de controle de portas para subir o Backend e o Frontend simultaneamente:
```bash
./scripts/port_control.sh start
```
- **Dashboard:** `http://localhost:5173`
- **API Docs:** `http://localhost:8000/docs`

## 🌍 Recursos Geoespaciais

O dashboard conta com um mapa territorial avançado para Mossoró:
- **Zona Urbana:** Coroplético detalhado por bairro.
- **Zona Rural:** Divisão em 4 quadrantes cardeais (N, S, L, O) de 90°.
- **Interatividade:** Legenda flutuante dinâmica, seleção múltipla de setores e linhas de conexão em dourado para facilitar a interpretação espacial da carga viral.

## 📊 Endpoints Principais da API

- `GET /territory_bootstrap`: Inicialização completa de dados geográficos e rankings.
- `GET /citizen_bootstrap`: Perfis demográficos, pirâmide etária e assinatura de sintomas.
- `GET /vaccination_profile`: Cobertura vacinal detalhada (COVID-19 e Influenza).
- `GET /vaccine_survival`: Curvas de proteção vacinal Kaplan-Meier.
- `GET /clinical_flow`: Jornada do paciente no sistema hospitalar (Sankey).
- `GET /trends`: Séries temporais históricas com projeção linear suavizada.

## 🔒 Privacidade e LGPD

O projeto inclui uma ferramenta exclusiva (`tools/mossoro_privacy_tool/`) para o setor de epidemiologia realizar o filtro e anonimização de dados sensíveis antes de qualquer processamento no dashboard, garantindo conformidade total com a LGPD.

---
**Desenvolvido para Mossoró/RN - Gestão Baseada em Dados.**
