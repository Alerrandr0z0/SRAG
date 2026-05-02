"""Weekly update helpers for SRAG Mossoró.

This module restores the CLI contract expected by ``main.py`` while keeping the
implementation intentionally small and aligned with the existing data layer.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import pandas as pd
from sqlalchemy import create_engine

from srag.data.analytics import (
    compute_alert_thresholds,
    compute_severity_metrics,
    compute_time_series,
    compute_virus_distribution,
)
from srag.data.database import DB_URL, init_db, save_cases
from srag.data.loader import load_and_clean_srag_data
from srag.models.forecasting import predict_next_weeks

if TYPE_CHECKING:
    from pathlib import Path


def ingest_secure_file(input_path: Path) -> dict[str, int]:
    """Load a sanitized file and persist Mossoró cases into SQLite."""
    init_db()
    df = load_and_clean_srag_data(input_path, filter_mossoro=True, drop_sensitive=True)
    if df.empty:
        return {"processed": 0, "new_cases_added": 0}

    new_cases_added = save_cases(df.to_dict(orient="records"))
    return {"processed": len(df), "new_cases_added": int(new_cases_added)}


def load_database_dataframe() -> pd.DataFrame:
    """Return the current analytical dataframe from SQLite."""
    engine = create_engine(DB_URL, pool_pre_ping=True)
    try:
        return pd.read_sql("SELECT * FROM casos_srag", engine)
    except Exception:
        return pd.DataFrame()


def build_surveillance_snapshot(
    df: pd.DataFrame,
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
) -> dict[str, Any]:
    """Build the compact weekly snapshot consumed by the CLI."""
    if df.empty:
        return {
            "summary": {"total_cases": 0, "uti_rate": 0.0, "death_rate": 0.0},
            "trends": {"history": [], "forecast": [], "thresholds": {}, "status": "empty"},
            "virus": [],
        }

    summary = compute_severity_metrics(df)
    ts = compute_time_series(df)
    trends = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict)
    trends["thresholds"] = compute_alert_thresholds(df)

    if last_n_weeks > 0:
        trends["history"] = trends.get("history", [])[-last_n_weeks:]

    return {
        "summary": {
            "total_cases": int(summary.get("total", len(df))),
            "uti_rate": summary.get("uti_rate", 0.0),
            "death_rate": summary.get("death_rate", 0.0),
        },
        "trends": trends,
        "virus": compute_virus_distribution(df).to_dict(orient="records"),
    }


def run_weekly_update(
    input_path: Path,
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
    output: Path | None = None,
) -> dict[str, Any]:
    """Ingest a secure file, refresh the snapshot and optionally save it."""
    ingestion = ingest_secure_file(input_path)
    snapshot = build_surveillance_snapshot(
        load_database_dataframe(),
        last_n_weeks=last_n_weeks,
        weeks_to_predict=weeks_to_predict,
    )

    result = {"ingestion": ingestion, "snapshot": snapshot}
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
        )
    return result
