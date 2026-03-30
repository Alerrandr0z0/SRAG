#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8000}"

if [[ $# -lt 1 ]]; then
  printf "Uso: %s <arquivo_limpo.csv|arquivo_limpo.parquet>\n" "$0"
  printf "Exemplo: %s data/mossoro_limpo.csv\n" "$0"
  exit 1
fi

DATA_FILE="$1"

if [[ ! -f "$DATA_FILE" ]]; then
  printf "Erro: arquivo nao encontrado: %s\n" "$DATA_FILE"
  exit 1
fi

printf "[1/6] Verificando API em %s ...\n" "$API_BASE"
curl -sSf "$API_BASE/docs" >/dev/null
printf "OK: API acessivel.\n\n"

printf "[2/6] Enviando dataset: %s\n" "$DATA_FILE"
UPLOAD_RESPONSE="$(curl -sSf -X POST "$API_BASE/upload" -F "file=@$DATA_FILE")"
printf "Resposta /upload:\n%s\n\n" "$UPLOAD_RESPONSE"

printf "[3/6] GET /summary\n"
curl -sSf "$API_BASE/summary"
printf "\n\n"

printf "[4/6] GET /trends?last_n_weeks=26\n"
curl -sSf "$API_BASE/trends?last_n_weeks=26"
printf "\n\n"

printf "[5/6] GET /virus\n"
curl -sSf "$API_BASE/virus"
printf "\n\n"

printf "[6/6] GET /age_groups\n"
curl -sSf "$API_BASE/age_groups"
printf "\n\n"

printf "Smoke test concluido com sucesso.\n"
