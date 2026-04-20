# 🦠 SRAG Mossoró/RN

> Sistema de vigilância epidemiológica municipal para Mossoró/RN — automatizando a análise do SIVEP-Gripe com inteligência geoespacial e preditiva para apoio à decisão em saúde pública.

---

## 📊 Visão Geral

O projeto transforma o processo de vigilância epidemiológica, substituindo planilhas manuais por uma **plataforma integrada de alta performance**:

| Componente | Descrição |
|---|---|
| 🔄 **Motor de Ingestão** | Processamento ultrarrápido de Parquet e CSV via DuckDB com desduplicação global |
| 🧪 **Backend Científico** | API FastAPI com previsão sazonal (Facebook Prophet) e análise de sobrevivência (Kaplan-Meier) |
| ✅ **Suíte de Testes** | 30 testes unitários e de integração — 100% de confiabilidade nos cálculos epidemiológicos |
| 🗺️ **Dashboard Inteligente** | Visualização em React (Vite) com mapas geoespaciais e fluxogramas clínicos interativos |

---

## 🏗️ Arquitetura e Estrutura de Dados

A pipeline segue o modelo **Medalhão (Bronze → Silver → Gold)** para garantir integridade e rastreabilidade dos dados:

```text
srag-mossoro/
├── data/
│   ├── raw/           # 🥉 Bronze — Fontes brutas: Parquets e CSVs originais
│   ├── processed/     # 🥈 Silver — Dados estruturados: SQLite e limites municipais
│   ├── geojson/       # 🥇 Gold  — Prontos para consumo: Polígonos para o dashboard
│   └── external/      # Bases de terceiros (IBGE, áreas urbanizadas)
├── src/srag/          # Código-fonte do backend e lógica de dados
├── frontend/          # Dashboard web (React + TypeScript + Vite)
├── scripts/           # Ferramentas operacionais (Ingestão e Geração de Mapas)
└── tests/             # Suíte de testes unitários e de integração
```

---

## ⚙️ Requisitos

- **Python >= 3.14**
- **Node.js** com npm
- **[uv](https://docs.astral.sh/uv/)** — gerenciador de pacotes Python recomendado

---

## 🚀 Instalação e Execução

### 1. Configurar o ambiente

```bash
# Instalar dependências Python
uv sync

# Instalar dependências do frontend
cd frontend && npm install
```

### 2. Obter os dados brutos

Antes de rodar o sistema, baixe os dados abertos do Ministério da Saúde:

1. Acesse o portal **[Dados Abertos do SUS — SRAG](https://dados.gov.br)**
2. Baixe o arquivo `.csv` do ano desejado (ex: `INFLUD24.csv` para 2024)
3. Coloque o arquivo **sem alterar a extensão** dentro de `data/raw/`

### 3. Executar a pipeline de ingestão

```bash
# Limpa e ingere os dados do CSV para o SQLite
uv run scripts/ingest_data.py

# Roda o motor de vigilância (gera o JSON preditivo)
uv run python main.py weekly-update data/raw
```

### 4. Iniciar o backend (API)

```bash
uv run uvicorn srag.api.main:app --reload --port 8000
```

Acesse a documentação interativa em: **`http://localhost:8000/docs`**

> ⚠️ **Nota sobre Logfire:** Se a API falhar com `LogfireConfigError`, autentique com `uv run logfire auth`. Para rodar localmente sem telemetria, comente a linha `logfire.configure()` em `src/srag/api/main.py`.

### 5. Iniciar o frontend (Dashboard)

```bash
cd frontend
npm run dev
```

Acesse o dashboard em: **`http://localhost:5173`**

> 💡 **Atalho para Linux/Mac:** Suba toda a stack de uma vez com `./scripts/port_control.sh start` na raiz do projeto.

---

## 🧪 Testes

Execute a suíte completa antes de qualquer deploy para validar a lógica epidemiológica:

```bash
uv run pytest
```

> ⚠️ **Usuários Windows:** Um aviso `[WinError 32]` pode aparecer na limpeza final do banco SQLite de testes. Se todos os testes estiverem `PASSED` (verdes), esse aviso pode ser ignorado com segurança.

---

## 🧠 Inteligência Geoespacial e Preditiva

**Previsão Avançada com Prophet**
Utiliza o Facebook Prophet para capturar a sazonalidade real de Mossoró, gerando intervalos de confiança de 80% — essencial para o planejamento antecipado de carga hospitalar.

**Mapa Territorial Inteligente**
Combina divisão por quadrantes cardeais na zona rural com visualização coroplética por bairro na zona urbana. Legendas dinâmicas e seleção múltipla para análise granular.

---

## 🔌 Principais Endpoints da API

| Endpoint | Descrição |
|---|---|
| `GET /vaccine_survival` | Curvas Kaplan-Meier de proteção vacinal |
| `GET /trends` | Histórico epidemiológico e previsão sazonal via Prophet |
| `GET /citizen_bootstrap` | Perfis demográficos e assinaturas de sintomas |
| `GET /clinical_flow` | Jornada clínica completa visualizada via diagrama Sankey |

---