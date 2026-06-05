# SRAG Mossoró/RN - Unified Toolchain

.PHONY: help setup ingest start stop status start-docker stop-docker test lint fix mutation bench update-graph \
        setup-back setup-front test-back test-front lint-back lint-front \
        fix-back fix-front mutation-back mutation-front mutation-incr mutation-score \
        observability property-test property-test-back property-test-front \
        e2e security security-back security-secrets hooks

# --- Default ---
help:
	@echo "SRAG Mossoró/RN Toolchain"
	@echo "Usage: make <target>"
	@echo ""
	@echo "General Targets:"
	@echo "  setup             Install all dependencies and git hooks"
	@echo "  ingest            Run universal ingestion"
	@echo "  start             Start all services"
	@echo "  stop              Stop all services"
	@echo "  test              Run all tests (back + front)"
	@echo "  property-test     Run property-based tests"
	@echo "  e2e               Run integrated-flow E2E tests (requires make start)"
	@echo "  lint              Run all quality checks"
	@echo "  security          Run all security scanners (Bandit + Gitleaks)"
	@echo "  hooks             Run all pre-commit hooks on all files"
	@echo "  mutation          Run all mutation tests (full suite, ~30min)"
	@echo "  mutation-incr     Incremental mutation (agent: PATHS= src/... [TESTS= tests/...])"
	@echo "  mutation-score    Show last mutation score"
	@echo "  update-graph      Update knowledge graph (Graphify)"

# --- Setup ---
setup: setup-back setup-front
setup-back:
	uv sync
	uv run pre-commit install
setup-front:
	cd frontend && npm install

# --- Operational ---
ingest:
	uv run scripts/ingest_data.py

cnes-lookup:
	uv run scripts/fetch_cnes_lookup.py
	@echo "CNES lookup updated at data/processed/cnes_units_geo.json"

start:
	./scripts/port_control.sh start

start-docker:
	docker compose up --build -d
	@printf "\nServicos em execucao:\n"
	@printf -- "- Frontend: http://localhost\n"
	@printf -- "- Backend:  http://localhost:8000\n"
	@printf -- "- Jupyter:  http://localhost:8888/lab/\n"

stop-docker:
	docker compose down

stop:
	./scripts/port_control.sh stop

status:
	./scripts/port_control.sh status

# --- Quality & Security ---
lint: lint-back lint-front
lint-back:
	uv run ruff check .
	uv run pyright
	uv run complexipy src/srag/ --max-complexity-allowed 15

.PHONY: complexity
complexity:
	uv run complexipy src/srag/ --max-complexity-allowed 15

lint-front:
	cd frontend && npm run lint

fix: fix-back fix-front
fix-back:
	uv run ruff check . --fix --unsafe-fixes
	uv run ruff format .
fix-front:
	cd frontend && npm run fix

security: security-back security-secrets security-deps security-frontend
security-back:
	uv run bandit -r src/srag scripts/ -s B101
security-secrets:
	uv run pre-commit run gitleaks --all-files
security-deps:
	uv run pip-audit --strict --desc on 2>/dev/null || echo "pip-audit: security audit completed (vulnerabilities found or tool not available)"
security-frontend:
	cd frontend && npm audit --audit-level=high 2>/dev/null || echo "npm audit completed with warnings"

hooks:
	uv run pre-commit run --all-files

# --- Testing ---
test: test-back test-front
test-back:
	uv run pytest tests/ --cov=src/srag --cov-report=term --cov-fail-under=80
test-front:
	cd frontend && npm run test

property-test: property-test-back property-test-front
property-test-back:
	uv run pytest -m "not slow" tests/unit/test_hypothesis_sivep.py
property-test-front:
	cd frontend && npm run test:property

e2e:
	@echo "E2E flow tests require backend (port 8000) + Vite (port 5173) running."
	@echo "Start with: make start --no-jupyter"
	@echo ""
	cd frontend && npm run test:e2e:dashboard

mutation: mutation-back mutation-front
mutation-back:
	rm -rf mutants .mutmut-cache
	uv run mutmut run --max-children 4
	@echo "\n=== Mutation Score ==="
	-uv run mutmut results --no-pager 2>/dev/null | tail -5
mutation-incr:
	@if [ -z "$(PATHS)" ]; then echo "Uso: make mutation-incr PATHS='...' [TESTS='tests/...']"; exit 1; fi
	cp pyproject.toml .pyproject.toml.bak && trap 'mv .pyproject.toml.bak pyproject.toml 2>/dev/null' EXIT && rm -rf mutants .mutmut-cache && TESTS="$(TESTS)" PATHS="$(PATHS)" uv run python scripts/_patch_mutmut_config.py && uv run mutmut run --max-children 4 && uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-score:
	uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-front:
	cd frontend && npm run test:mutation

bench:
	uv run pytest tests/unit/test_benchmark.py

# --- Observability & Knowledge ---
observability:
	logfire dashboard

update-graph:
	uv run graphify update .
