# SRAG Mossoró/RN - Unified Toolchain

.PHONY: help setup ingest start stop status start-docker stop-docker test lint fix mutation bench update-graph \
        setup-back setup-front test-back test-front lint-back lint-front \
        fix-back fix-front mutation-back mutation-front         mutation-incr mutation-score \
        observability property-test property-test-back property-test-front \
        e2e security security-back security-secrets skill-validate skill-validate-fix hooks fix-perms

# --- Default ---
help:
	@echo "SRAG Mossoró/RN Toolchain"
	@echo "Usage: make <target>"
	@echo ""
	@echo "General Targets:"
	@echo "  setup             Install all dependencies and git hooks"
	@echo "  ingest            Run universal ingestion"
	@echo "  start             Start all services (production mode, Nginx)"
	@echo "  dev               Start dev mode with Vite HMR (live reload) at :5173"
	@echo "  stop              Stop all services"
	@echo "  test              Run all tests (back + front)"
	@echo "  property-test     Run property-based tests"
	@echo "  e2e               Run integrated-flow E2E tests (requires make start)"
	@echo "  lint              Run all quality checks"
	@echo "  skill-validate     Validate .opencode/skills/ against live source code"
	@echo "  security          Run all security scanners (Bandit + Gitleaks)"
	@echo "  hooks             Run all pre-commit hooks on all files"
	@echo "  mutation          Run all mutation tests (full suite, ~30min)"
	@echo "  mutation-incr     Incremental mutation (agent: PATHS= src/... [TESTS= tests/...])"
	@echo "  mutation-score    Show last mutation score"
	@echo "  update-graph      Update knowledge graph (Graphify)"

# --- Docker Helper Variables ---
DOCKER_RUN_BACK = docker-compose run --rm \
	-v ./tests:/app/tests \
	-v ./scripts:/app/scripts \
	-v ./data/processed:/app/data/processed \
	-v /tmp/duckdb_extensions:/home/appuser/.duckdb \
	backend
DOCKER_RUN_FRONT = docker run --rm --network=host \
  -u $(shell id -u):$(shell id -g) \
  -e HOME=/tmp \
  -v ./frontend:/app \
  -w /app node:22-slim

# --- Setup ---
setup: setup-back setup-front
setup-back:
	@echo "Instale o pre-commit localmente se desejar usar git hooks no host: pip install pre-commit && pre-commit install"
setup-front:
	$(DOCKER_RUN_FRONT) npm install

# --- Operational ---
ingest:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run scripts/ingest_data.py

cnes-lookup:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run scripts/fetch_cnes_lookup.py
	@echo "CNES lookup updated at data/processed/cnes_units_geo.json"

start:
	$(eval GIT_HASH := $(shell git rev-parse HEAD 2>/dev/null || echo $$(date +%s)))
	docker-compose --profile production build --build-arg CACHEBUST=$(GIT_HASH)
	docker-compose --profile production up -d
	@printf "\nServicos em execucao:\n"
	@printf -- "- Frontend (Nginx): http://localhost\n"
	@printf -- "- Backend:          http://localhost:8000\n"

start-docker: start

dev:
	DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker-compose --profile dev up --build -d
	@printf "\nServicos em execucao (MODO DEV):\n"
	@printf -- "- Frontend (Vite HMR): http://localhost:5173\n"
	@printf -- "- Backend:            http://localhost:8000\n"
	@printf "\nAlteracoes no codigo React sao refletidas automaticamente (live reload).\n"

stop-docker: stop

stop:
	docker-compose --profile production --profile dev down

status:
	docker-compose ps

# --- Quality & Security ---
lint: lint-back lint-front
lint-back:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache RUFF_CACHE_DIR=/tmp/.ruff-cache uv run ruff check .
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run pyright
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run complexipy src/srag/ --max-complexity-allowed 15

.PHONY: complexity
complexity:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run complexipy src/srag/ --max-complexity-allowed 15

lint-front:
	$(DOCKER_RUN_FRONT) npm run lint

fix: fix-back fix-front
fix-back:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache RUFF_CACHE_DIR=/tmp/.ruff-cache uv run ruff check . --fix --unsafe-fixes
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache RUFF_CACHE_DIR=/tmp/.ruff-cache uv run ruff format .
fix-front:
	$(DOCKER_RUN_FRONT) npm run fix

security: security-back security-secrets security-deps security-frontend
security-back:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run bandit -r src/srag scripts/ -s B101
security-secrets:
	docker run --rm -v $(shell pwd):/path zricethezav/gitleaks:latest detect --source=/path -v || true
security-deps:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run pip-audit --strict --desc on 2>/dev/null || echo "pip-audit: security audit completed"
security-frontend:
	$(DOCKER_RUN_FRONT) npm audit --audit-level=high 2>/dev/null || echo "npm audit completed with warnings"

hooks:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run ruff check . --fix
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run ruff format .
	@$(MAKE) graph-sync

# --- Permissions ---
# Re-claim root-owned files in frontend/ created by older Docker runs
fix-perms:
	docker run --rm -v $(shell pwd)/frontend/node_modules:/tmp/node_modules alpine sh -c 'find /tmp/node_modules -user 0 -exec chown $(shell id -u):$(shell id -g) {} +' 2>/dev/null; echo "done"

# --- Testing ---
test: test-back test-front
test-back:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache COVERAGE_FILE=/tmp/.coverage HOME=/home/appuser uv run pytest tests/ --basetemp=/tmp/pytest -p no:cacheprovider --cov=src/srag --cov-report=term --cov-fail-under=80
test-front:
	$(DOCKER_RUN_FRONT) npm run test

property-test: property-test-back property-test-front
property-test-back:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run pytest -m "not slow" tests/unit/test_hypothesis_sivep.py
property-test-front:
	$(DOCKER_RUN_FRONT) npm run test:property

e2e:
	@echo "E2E flow tests require backend (port 8000) + Vite (port 5173) running."
	@echo "Start with: make start"
	@echo ""
	$(DOCKER_RUN_FRONT) npm run test:e2e:dashboard

mutation: mutation-back mutation-front
mutation-back:
	rm -rf mutants .mutmut-cache
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run mutmut run --max-children 4
	@echo "\n=== Mutation Score ==="
	-$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run mutmut results --no-pager 2>/dev/null | tail -5
mutation-incr:
	@if [ -z "$(PATHS)" ]; then echo "Uso: make mutation-incr PATHS='...' [TESTS='tests/...']"; exit 1; fi
	cp pyproject.toml .pyproject.toml.bak && trap 'mv .pyproject.toml.bak pyproject.toml 2>/dev/null' EXIT && rm -rf mutants .mutmut-cache && TESTS="$(TESTS)" PATHS="$(PATHS)" $(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run python scripts/_patch_mutmut_config.py && $(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run mutmut run --max-children 4 && $(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-score:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run mutmut results --no-pager 2>/dev/null | tail -10
mutation-front:
	$(DOCKER_RUN_FRONT) npm run test:mutation

bench:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run pytest tests/unit/test_benchmark.py

# --- Observability & Knowledge ---
observability:
	logfire dashboard

graph-sync:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run graphify update .

graph-orchestrate:
	$(DOCKER_RUN_BACK) env UV_CACHE_DIR=/tmp/.uv-cache uv run python scripts/orchestrate_graphify.py

.PHONY: skill-validate
skill-validate:
	docker-compose run --rm -v ./tests:/app/tests -v ./scripts:/app/scripts -v ./.agents:/app/.agents backend env UV_CACHE_DIR=/tmp/.uv-cache uv run python scripts/validate_skills.py

.PHONY: skill-validate-fix
skill-validate-fix:
	docker-compose run --rm -v ./tests:/app/tests -v ./scripts:/app/scripts -v ./.agents:/app/.agents backend env UV_CACHE_DIR=/tmp/.uv-cache uv run python scripts/validate_skills.py --fix
