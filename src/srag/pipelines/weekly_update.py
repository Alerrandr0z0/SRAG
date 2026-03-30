"""Operational pipeline for secure ingestion and weekly surveillance snapshots."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine

from srag.data.analytics import (
    compute_age_groups,
    compute_severity_metrics,
    compute_time_series,
    compute_virus_distribution,
)
from srag.data.database import DB_URL, save_cases
from srag.data.loader import load_and_clean_srag_data
from srag.models.forecasting import predict_next_weeks


def _to_path(file_path: str | Path) -> Path:
    """Normalize a string/path input to a ``Path`` instance."""
    return file_path if isinstance(file_path, Path) else Path(file_path)


def _normalize_date_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure date columns use Python ``date`` values for analytics helpers."""
    out = df.copy()
    for col in ("DT_NOTIFIC", "DT_SIN_PRI"):
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce").dt.date
    return out


def ingest_secure_file(file_path: str | Path) -> dict[str, int]:
    """Ingest a secure (already anonymized) file into the historical database.

    Args:
        file_path: CSV/XLS/XLSX path with Mossoro SRAG records.

    Returns:
        Counters describing processed and newly added records.
    """
    source = _to_path(file_path)
    df = load_and_clean_srag_data(source, filter_mossoro=True, drop_sensitive=False)
    if df.empty:
        return {"processed": 0, "new_cases_added": 0}

    new_cases = save_cases(df.to_dict(orient="records"))
    return {"processed": len(df), "new_cases_added": new_cases}


def load_database_dataframe() -> pd.DataFrame:
    """Load all historical SRAG records from SQLite as a DataFrame."""
    engine = create_engine(DB_URL)
    df = pd.read_sql_table("casos_srag", con=engine)
    return _normalize_date_columns(df)


def build_surveillance_snapshot(
    df: pd.DataFrame,
    last_n_weeks: int | None = 26,
    weeks_to_predict: int = 4,
) -> dict[str, Any]:
    """Build a consolidated analysis+forecast snapshot for weekly monitoring.

    Args:
        df: Historical SRAG dataframe.
        last_n_weeks: Optional recent-week window for trend visualization.
        weeks_to_predict: Forecast horizon in epidemiological weeks.

    Returns:
        Dictionary compatible with JSON responses/reports.
    """
    safe_df = _normalize_date_columns(df)
    ts_df = compute_time_series(safe_df)
    if last_n_weeks:
        ts_df = ts_df.tail(last_n_weeks)

    trends = predict_next_weeks(ts_df, weeks_to_predict=weeks_to_predict)
    virus = compute_virus_distribution(safe_df).to_dict(orient="records")
    age_groups = compute_age_groups(safe_df).to_dict(orient="records")

    return {
        "summary": compute_severity_metrics(safe_df),
        "trends": trends,
        "virus": virus,
        "age_groups": age_groups,
    }


def run_weekly_update(
    file_path: str | Path,
    last_n_weeks: int | None = 26,
    weeks_to_predict: int = 4,
) -> dict[str, Any]:
    """Run secure ingestion and return a full weekly surveillance snapshot.

    Args:
        file_path: Path to the secure dataset to ingest.
        last_n_weeks: Optional recent-week window in the returned trends.
        weeks_to_predict: Forecast horizon in epidemiological weeks.

    Returns:
        A dictionary with ingestion counters and snapshot payload.
    """
    ingest_result = ingest_secure_file(file_path)
    db_df = load_database_dataframe()
    snapshot = build_surveillance_snapshot(
        db_df,
        last_n_weeks=last_n_weeks,
        weeks_to_predict=weeks_to_predict,
    )
    return {"ingestion": ingest_result, "snapshot": snapshot}
