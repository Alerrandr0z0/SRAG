# SRAG Mossoró/RN - Unified Toolchain

.PHONY: help setup ingest start stop status test lint fix mutation bench update-graph \
        setup-back setup-front test-back test-front lint-back lint-front \
        fix-back fix-front mutation-back mutation-front \
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
	@echo "  mutation          Run all mutation tests"
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

start:
	./scripts/port_control.sh start

stop:
	./scripts/port_control.sh stop

status:
	./scripts/port_control.sh status

# --- Quality & Security ---
lint: lint-back lint-front
lint-back:
	uv run ruff check .
	uv run pyright
lint-front:
	cd frontend && npm run lint

fix: fix-back fix-front
fix-back:
	uv run ruff check . --fix --unsafe-fixes
	uv run ruff format .
fix-front:
	cd frontend && npm run format

security: security-back security-secrets
security-back:
	uv run bandit -r src/srag
security-secrets:
	uv run pre-commit run gitleaks --all-files

hooks:
	uv run pre-commit run --all-files

# --- Testing ---
test: test-back test-front
test-back:
	uv run pytest tests/
test-front:
	cd frontend && npm run test

property-test: property-test-back property-test-front
property-test-back:
	uv run pytest -m "not slow" tests/unit/test_hypothesis_sivep.py
property-test-front:
	cd frontend && npm run test:property

mutation: mutation-back mutation-front
mutation-back:
	uv run mutmut run
mutation-front:
	cd frontend && npm run test:mutation

bench:
	uv run pytest tests/unit/test_benchmark.py

# --- Observability & Knowledge ---
observability:
	logfire dashboard

update-graph:
	graphify update .
