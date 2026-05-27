"""CNES unit lookup with cached metadata."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import requests

_unit_records: dict[str, dict[str, Any]] | None = None
_load_error: str | None = None

_CNES_JSON_PATH = Path(__file__).resolve().parents[3] / "data" / "processed" / "cnes_units.json"
_CNES_GEO_PATH = Path(__file__).resolve().parents[3] / "data" / "processed" / "cnes_units_geo.json"
_CNES_API_BASE = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
_MOSSORO_MUNICIPAL_CODE = "240800"


def _norm_text(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def _build_address(est: dict[str, Any]) -> str:
    parts = [
        _norm_text(est.get("endereco_estabelecimento")),
        _norm_text(est.get("numero_estabelecimento")),
        _norm_text(est.get("bairro_estabelecimento")),
    ]
    first = ", ".join([parts[0], parts[1]]) if parts[0] and parts[1] else parts[0] or parts[1]
    if first and parts[2]:
        return f"{first} - {parts[2]}"
    return first or parts[2]


def build_unit_record(est: dict[str, Any]) -> dict[str, Any]:
    """Normalize a CNES establishment payload into cached metadata."""
    codigo = str(est.get("codigo_cnes", "")).strip()
    nome = _norm_text(est.get("nome_fantasia")) or _norm_text(est.get("nome_razao_social"))
    lat = est.get("latitude_estabelecimento_decimo_grau")
    lon = est.get("longitude_estabelecimento_decimo_grau")
    latitude = float(lat) if isinstance(lat, (int, float)) else None
    longitude = float(lon) if isinstance(lon, (int, float)) else None
    return {
        "codigo_cnes": codigo,
        "nome_fantasia": nome,
        "nome_razao_social": _norm_text(est.get("nome_razao_social")),
        "endereco": _build_address(est),
        "latitude": latitude,
        "longitude": longitude,
        "codigo_municipio": str(est.get("codigo_municipio", "")).strip(),
    }


def _load_geo_mapping() -> dict[str, dict[str, Any]]:
    if _CNES_GEO_PATH.exists():
        try:
            raw = _CNES_GEO_PATH.read_text(encoding="utf-8")
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {str(k): dict(v) for k, v in parsed.items() if isinstance(v, dict)}
        except Exception:
            return {}
    return {}


def _save_geo_mapping(mapping: dict[str, dict[str, Any]]) -> None:
    _CNES_GEO_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CNES_GEO_PATH.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")


def _fetch_mossoro_cnes() -> list[dict[str, Any]]:
    response = requests.get(
        _CNES_API_BASE,
        params={"codigo_municipio": _MOSSORO_MUNICIPAL_CODE},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    estabelecimentos = payload.get("estabelecimentos", [])
    if not isinstance(estabelecimentos, list):
        return []
    return [est for est in estabelecimentos if isinstance(est, dict)]


def _load_cnes_mapping() -> dict[str, dict[str, Any]]:
    global _unit_records, _load_error
    result = _unit_records
    if result is not None:
        return result
    if _load_error is not None:
        return {}

    geo_mapping = _load_geo_mapping()
    if geo_mapping:
        _unit_records = geo_mapping
        return geo_mapping

    if not _CNES_JSON_PATH.exists():
        _load_error = f"CNES lookup file not found: {_CNES_JSON_PATH}"
        return {}

    try:
        raw = _CNES_JSON_PATH.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            _unit_records = {str(k): {"nome_fantasia": str(v)} for k, v in parsed.items()}
        else:
            _unit_records = {}
    except Exception as exc:
        _load_error = f"Failed to load CNES lookup: {exc}"
        return {}

    return _unit_records or {}


def ensure_mossoro_cnes_geo(refresh: bool = False) -> dict[str, dict[str, Any]]:
    """Build or load the Mossoro CNES metadata cache."""
    mapping = {} if refresh else _load_geo_mapping()
    if mapping and not refresh:
        return mapping

    records = _fetch_mossoro_cnes()
    mapping = {}
    for est in records:
        record = build_unit_record(est)
        if record["codigo_cnes"]:
            mapping[record["codigo_cnes"]] = record
    if mapping:
        _save_geo_mapping(mapping)
        global _unit_records
        _unit_records = mapping
    return mapping


def geocode_unit_address(code: str, address: str) -> dict[str, Any] | None:
    """Resolve an address to coordinates via Nominatim."""
    if not code or not address:
        return None
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "jsonv2", "limit": 1, "countrycodes": "br"},
            headers={"User-Agent": "SRAG-Mossoro/1.0"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, list) and payload:
            first = payload[0]
            return {
                "codigo_cnes": code,
                "endereco": address,
                "latitude": float(first["lat"]),
                "longitude": float(first["lon"]),
            }
    except Exception:
        return None
    return None


def fetch_unit_record_from_api(code: str) -> dict[str, Any] | None:
    """Fetch a Mossoro CNES establishment from the public API."""
    if not code:
        return None
    try:
        response = requests.get(f"{_CNES_API_BASE}/{code}", timeout=30)
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and payload.get("codigo_cnes"):
            return build_unit_record(payload)
    except Exception:
        return None
    return None


def _load_unit_codes_from_db(source_db: Path) -> list[str]:
    if not source_db.exists():
        return []

    import sqlite3

    with sqlite3.connect(source_db) as conn:
        rows = conn.execute(
            "SELECT DISTINCT ID_UNIDADE FROM casos_srag "
            "WHERE ID_UNIDADE IS NOT NULL AND ID_UNIDADE != ''"
        ).fetchall()
    return sorted({str(row[0]).strip() for row in rows if row and row[0]})


def _enrich_cnes_record(record: dict[str, Any]) -> dict[str, Any]:
    code = str(record.get("codigo_cnes") or "").strip()
    if record.get("latitude") is None or record.get("longitude") is None:
        geo = geocode_unit_address(code, str(record.get("endereco") or ""))
        if geo:
            record.update(geo)
    return record


def build_mossoro_cnes_geo(
    db_path: Path | None = None,
    refresh: bool = False,
) -> dict[str, dict[str, Any]]:
    """Build a Mossoro-only CNES cache from database codes."""
    if not refresh:
        cached = _load_geo_mapping()
        if cached:
            return cached

    source_db = db_path or Path("data/processed/srag_mossoro.db")
    codes = _load_unit_codes_from_db(source_db)

    mapping: dict[str, dict[str, Any]] = {}
    for code in codes:
        record = fetch_unit_record_from_api(code)
        if record is None:
            continue
        mapping[code] = _enrich_cnes_record(record)

    if mapping:
        _save_geo_mapping(mapping)
        global _unit_records
        _unit_records = mapping
    return mapping


def lookup_unit_name(id_unidade: str | None | float) -> str:
    """Resolve a CNES code to its establishment name.

    Returns the name if found, or the raw code if not.
    """
    if id_unidade is None:
        return "NAO INFORMADO"

    code = str(id_unidade).strip()
    if not code:
        return "NAO INFORMADO"

    mapping = _load_cnes_mapping()
    record = mapping.get(code)
    if isinstance(record, dict):
        return str(record.get("nome_fantasia") or record.get("nome_razao_social") or code)
    return code


def lookup_unit_record(id_unidade: str | None | float) -> dict[str, Any] | None:
    """Return cached metadata for a CNES code."""
    if id_unidade is None:
        return None
    code = str(id_unidade).strip()
    if not code:
        return None
    mapping = _load_cnes_mapping()
    record = mapping.get(code)
    if isinstance(record, dict):
        return record
    return None


def get_unit_names_map() -> dict[str, str]:
    """Return the full CNES code → name mapping (copy)."""
    mapping = _load_cnes_mapping()
    return {
        code: str(record.get("nome_fantasia") or record.get("nome_razao_social") or code)
        for code, record in mapping.items()
        if isinstance(record, dict)
    }
