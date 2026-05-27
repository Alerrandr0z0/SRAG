"""Fetch Mossoro CNES establishments with cached metadata."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

import requests

API_BASE = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
OUTPUT_PATH = Path("data/processed/cnes_units_geo.json")
REQUEST_DELAY = 0.3
DB_PATH = Path("data/processed/srag_mossoro.db")
MOSSORO_CODES = {"240800", "2408003", "240800.0"}


def _norm_text(value: object) -> str:
    text = str(value or "").strip()
    return " ".join(text.split())


def build_unit_record(est: dict[str, Any]) -> dict[str, Any]:
    endereco = _norm_text(est.get("endereco_estabelecimento"))
    numero = _norm_text(est.get("numero_estabelecimento"))
    bairro = _norm_text(est.get("bairro_estabelecimento"))
    base = f"{endereco}, {numero}".strip(" ,") if numero else endereco
    full_address = f"{base} - {bairro}".strip(" -") if bairro else base
    return {
        "codigo_cnes": str(est.get("codigo_cnes", "")).strip(),
        "nome_fantasia": _norm_text(est.get("nome_fantasia"))
        or _norm_text(est.get("nome_razao_social")),
        "nome_razao_social": _norm_text(est.get("nome_razao_social")),
        "endereco": full_address,
        "latitude": est.get("latitude_estabelecimento_decimo_grau"),
        "longitude": est.get("longitude_estabelecimento_decimo_grau"),
        "codigo_municipio": str(est.get("codigo_municipio", "")).strip(),
    }


def geocode_address(address: str) -> dict[str, float] | None:
    params = {"q": address, "format": "jsonv2", "limit": 1, "countrycodes": "br"}
    headers = {"User-Agent": "SRAG-Mossoro/1.0"}
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        payload = resp.json()
        if isinstance(payload, list) and payload:
            first = payload[0]
            return {"latitude": float(first["lat"]), "longitude": float(first["lon"])}
    except Exception:
        return None
    return None


def fetch_unit_by_code(code: str) -> dict[str, Any] | None:
    resp = requests.get(f"{API_BASE}/{code}", timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    if isinstance(payload, dict) and payload.get("codigo_cnes"):
        return payload
    return None


def fetch_db_codes() -> list[str]:
    if not DB_PATH.exists():
        return []
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT DISTINCT ID_UNIDADE FROM casos_srag WHERE ID_UNIDADE IS NOT NULL AND ID_UNIDADE != ''"
        ).fetchall()
    return sorted({str(row[0]).strip() for row in rows if row and row[0]})


def main() -> None:
    mapping: dict[str, dict[str, Any]] = {}
    codes = fetch_db_codes()
    for code in codes:
        try:
            est = fetch_unit_by_code(code)
        except Exception:
            est = None
        if not est:
            continue
        record = build_unit_record(est)
        if record["codigo_municipio"] not in MOSSORO_CODES:
            continue
        if record["latitude"] is None or record["longitude"] is None:
            geo = geocode_address(record["endereco"])
            if geo:
                record.update(geo)
        mapping[code] = record
        time.sleep(REQUEST_DELAY)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(mapping)} CNES records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
