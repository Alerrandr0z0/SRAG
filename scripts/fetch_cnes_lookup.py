"""Fetch CNES establishment names from the public API.

Saves a JSON mapping of CNES code → nome_fantasia to data/processed/cnes_units.json.
Fetches all establishments from Mossoró plus any other municipalities
that appear in the local database with unresolved codes.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

import requests

SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

API_BASE = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
OUTPUT_PATH = Path("data/processed/cnes_units.json")
DB_PATH = Path("data/processed/srag_mossoro.db")
PAGE_SIZE = 20
REQUEST_DELAY = 0.3


def _load_existing_lookup() -> dict[str, str]:
    if OUTPUT_PATH.exists():
        try:
            return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def fetch_by_cnes_code(code: str) -> dict[str, Any] | None:
    url = f"{API_BASE}/{code}"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if "codigo_cnes" in data:
                return data
    except requests.RequestException:
        pass
    return None


def build_lookup(estabelecimentos: list[dict[str, Any]]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for est in estabelecimentos:
        codigo = str(est.get("codigo_cnes", ""))
        nome = est.get("nome_fantasia") or est.get("nome_razao_social") or ""
        if codigo:
            lookup[codigo] = nome
    return lookup


def main() -> None:
    lookup = _load_existing_lookup()
    print(f"Existing lookup: {len(lookup)} entries", flush=True)

    # Get all unique CNES codes from the database
    conn = sqlite3.connect(str(DB_PATH))
    rows = conn.execute(
        "SELECT DISTINCT ID_UNIDADE FROM casos_srag WHERE ID_UNIDADE IS NOT NULL AND ID_UNIDADE != ''"
    ).fetchall()
    conn.close()
    db_codes = {str(r[0]).strip() for r in rows if r[0]}
    print(f"Database CNES codes: {len(db_codes)}", flush=True)

    # Find codes not yet in the lookup
    missing = sorted(db_codes - set(lookup.keys()))
    if not missing:
        print("No missing codes to resolve.", flush=True)
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps(lookup, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Saved {len(lookup)} entries to {OUTPUT_PATH}", flush=True)
        return

    print(f"\nResolving {len(missing)} codes individually...", flush=True)
    found = 0
    for code in missing:
        est = fetch_by_cnes_code(code)
        if est:
            nome = est.get("nome_fantasia") or est.get("nome_razao_social") or ""
            if nome:
                lookup[code] = nome
                print(f"  {code} -> {nome}", flush=True)
                found += 1
        time.sleep(REQUEST_DELAY)
    print(f"  Resolved: {found} / {len(missing)}", flush=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(lookup, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {len(lookup)} entries to {OUTPUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
