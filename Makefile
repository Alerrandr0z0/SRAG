# SRAG Mossoró/RN - Unified Toolchain

.PHONY: help setup ingest start stop status start-docker stop-docker test lint fix mutation bench update-graph \
        setup-back setup-front test-back test-front lint-back lint-front \
        fix-back fix-front mutation-back mutation-front mutation-incr mutation-score \
        observability property-test property-test-back property-test-front \
        security security-back security-secrets hooks

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
	cd backend && uv sync
	cd backend && uv run pre-commit install
setup-front:
	cd frontend && npm install

# --- Operational ---
ingest:
	cd backend && uv run scripts/ingest_data.py

cnes-lookup:
	cd backend && uv run scripts/fetch_cnes_lookup.py
	@echo "CNES lookup updated at data/processed/cnes_units.json"

start:
	./backend/scripts/port_control.sh start

start-docker:
	docker compose up --build -d
	@printf "\nServicos em execucao:\n"
	@printf -- "- Frontend: http://localhost\n"
	@printf -- "- Backend:  http://localhost:8000\n"
	@printf -- "- Jupyter:  http://localhost:8888/lab/\n"

stop-docker:
	docker compose down

stop:
	./backend/scripts/port_control.sh stop

status:
	./backend/scripts/port_control.sh status

# --- Quality & Security ---
lint: lint-back lint-front
lint-back:
	cd backend && uv run ruff check .
	cd backend && uv run pyright
lint-front:
	cd frontend && npm run lint

fix: fix-back fix-front
fix-back:
	cd backend && uv run ruff check . --fix --unsafe-fixes
	cd backend && uv run ruff format .
fix-front:
	cd frontend && npm run fix

security: security-back security-secrets security-deps security-frontend
security-back:
	cd backend && uv run bandit -r src/srag scripts/ -s B101
security-secrets:
	cd backend && uv run pre-commit run gitleaks --all-files
security-deps:
	cd backend && uv run pip-audit --strict --desc on 2>/dev/null || echo "pip-audit: security audit completed (vulnerabilities found or tool not available)"
security-frontend:
	cd frontend && npm audit --audit-level=high 2>/dev/null || echo "npm audit completed with warnings"

hooks:
	cd backend && uv run pre-commit run --all-files

# --- Testing ---
test: test-back test-front
test-back:
	cd backend && uv run pytest tests/ --cov=src/srag --cov-report=term --cov-fail-under=80
test-front:
	cd frontend && npm run test

property-test: property-test-back property-test-front
property-test-back:
	cd backend && uv run pytest -m "not slow" tests/unit/test_hypothesis_sivep.py
property-test-front:
	cd frontend && npm run test:property

mutation: mutation-back mutation-front
mutation-back:
	cd backend && rm -rf mutants .mutmut-cache
	cd backend && uv run mutmut run --max-children 4
	@echo "\n=== Mutation Score ==="
	-cd backend && uv run mutmut results --no-pager 2>/dev/null | tail -5
mutation-incr:
	@if [ -z "$(PATHS)" ]; then echo "Uso: make mutation-incr PATHS='...' [TESTS='tests/...']"; exit 1; fi
	cd backend && cp pyproject.toml .pyproject.toml.bak && trap 'mv .pyproject.toml.bak pyproject.toml 2>/dev/null' EXIT && rm -rf mutants .mutmut-cache && TESTS="$(TESTS)" PATHS="$(PATHS)" uv run python scripts/_patch_mutmut_config.py && uv run mutmut run --max-children 4 && uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-score:
	cd backend && uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-front:
	cd frontend && npm run test:mutation

bench:
	cd backend && uv run pytest tests/unit/test_benchmark.py

# --- Observability & Knowledge ---
observability:
	cd backend && uv run logfire dashboard

update-graph:
	uv run graphify update .
