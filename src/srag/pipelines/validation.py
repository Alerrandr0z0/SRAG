"""Data Quality validation logic for SRAG pipelines."""

from __future__ import annotations

from datetime import date

import pandas as pd
import pandera.pandas as pa
from pandera.errors import SchemaErrors


def _future_date_check(s: pd.Series[str]) -> pd.Series[bool]:
    temp_dt = pd.to_datetime(s, errors="coerce")
    return temp_dt.dt.date <= date.today()


def _consistency_check(df: pd.DataFrame) -> pd.Series[bool]:
    if "DT_INTERNA" in df.columns and "DT_EVOLUCA" in df.columns:
        interna = pd.to_datetime(df["DT_INTERNA"], errors="coerce")
        evoluca = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
        # Valid if evoluca is null, interna is null, or evoluca >= interna
        return evoluca.isna() | interna.isna() | (evoluca >= interna)
    return pd.Series(True, index=df.index)


srag_schema = pa.DataFrameSchema(
    columns={
        "unique_hash": pa.Column(str, required=True),
        "DT_NOTIFIC": pa.Column(
            required=True,
            checks=pa.Check(_future_date_check, ignore_na=True, error="data futura em DT_NOTIFIC"),
        ),
        "ID_MUNICIP": pa.Column(required=True),
        "CLASSI_FIN": pa.Column(required=True),
        "DT_SIN_PRI": pa.Column(
            required=False,
            checks=pa.Check(_future_date_check, ignore_na=True, error="data futura em DT_SIN_PRI"),
        ),
        "DT_INTERNA": pa.Column(
            required=False,
            checks=pa.Check(_future_date_check, ignore_na=True, error="data futura em DT_INTERNA"),
        ),
        "DT_EVOLUCA": pa.Column(
            required=False,
            checks=pa.Check(_future_date_check, ignore_na=True, error="data futura em DT_EVOLUCA"),
        ),
        "IDADE_ANOS": pa.Column(
            float,
            required=False,
            coerce=True,
            checks=pa.Check.le(115, ignore_na=True, error="idade superior a 115 anos"),
        ),
    },
    checks=[
        pa.Check(
            _consistency_check,
            error="desfecho ocorre antes da internação",
            ignore_na=False,
        )
    ],
)


def validate_srag_data(df: pd.DataFrame) -> tuple[bool, list[str]]:
    """Perform quality checks on the dataframe before database insertion.

    Returns:
        A tuple (is_valid, list_of_warnings).
    """
    if df.empty:
        return False, ["O dataset está vazio."]

    try:
        srag_schema.validate(df, lazy=True)
        return True, []
    except SchemaErrors as err:
        warnings_df = err.failure_cases

        missing = warnings_df[warnings_df["check"] == "column_in_dataframe"]
        if not missing.empty:
            missing_cols = sorted(missing["failure_case"].unique().tolist())
            # Format exactly as expected by tests: "Colunas críticas ausentes: ['CLASSI_FIN', ...]"
            # We strip quotes to strictly match legacy formatting if needed, but list repr works.
            # Actually, the legacy code printed the list directly.
            formatted_list = [str(c) for c in missing_cols]
            return False, [f"Colunas críticas ausentes: {formatted_list}"]

        # For row-level warnings, count unique indices per check.
        # Dataframe-level checks replicate across all columns for the same index.
        warnings_df = warnings_df.drop_duplicates(subset=["check", "index"])

        warning_counts = warnings_df["check"].value_counts()
        formatted_warnings = [
            f"Detectados {count} registros com {warn}." for warn, count in warning_counts.items()
        ]

        return True, formatted_warnings
