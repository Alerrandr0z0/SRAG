"""CNES unit name lookup using pre-fetched mapping data."""

from __future__ import annotations

import json
from pathlib import Path

_unit_names: dict[str, str] | None = None
_load_error: str | None = None

_CNES_JSON_PATH = Path(__file__).resolve().parents[3] / "data" / "processed" / "cnes_units.json"


def _load_cnes_mapping() -> dict[str, str]:
    global _unit_names, _load_error
    result = _unit_names
    if result is not None:
        return result
    if _load_error is not None:
        return {}

    if not _CNES_JSON_PATH.exists():
        _load_error = f"CNES lookup file not found: {_CNES_JSON_PATH}"
        return {}

    try:
        raw = _CNES_JSON_PATH.read_text(encoding="utf-8")
        parsed: dict[str, str] = json.loads(raw)
        _unit_names = parsed
    except Exception as exc:
        _load_error = f"Failed to load CNES lookup: {exc}"
        return {}

    return _unit_names
    if _load_error is not None:
        return {}

    if not _CNES_JSON_PATH.exists():
        _load_error = f"CNES lookup file not found: {_CNES_JSON_PATH}"
        return {}

    try:
        raw = _CNES_JSON_PATH.read_text(encoding="utf-8")
        _unit_names = json.loads(raw)
    except Exception as exc:
        _load_error = f"Failed to load CNES lookup: {exc}"
        return {}

    return _unit_names


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
    return mapping.get(code, code)


def get_unit_names_map() -> dict[str, str]:
    """Return the full CNES code → name mapping (copy)."""
    return dict(_load_cnes_mapping())
