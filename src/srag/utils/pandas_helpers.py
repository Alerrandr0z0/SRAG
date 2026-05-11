"""Helper functions for safe Pandas operations with Pyright strict mode."""

import pandas as pd


def to_numeric_series(df: pd.DataFrame, col: str) -> pd.Series:
    """Safely convert a column to numeric, returning an empty Series if missing."""
    s = df.get(col)
    if s is None or not isinstance(s, pd.Series):
        return pd.Series(dtype="float64", index=df.index)
    return pd.to_numeric(s, errors="coerce")


def to_datetime_series(df: pd.DataFrame, col: str) -> pd.Series:
    """Safely convert a column to datetime, returning an empty Series if missing."""
    s = df.get(col)
    if s is None or not isinstance(s, pd.Series):
        return pd.Series(dtype="datetime64[ns]", index=df.index)
    return pd.to_datetime(s, errors="coerce")
