"""Quality and Diagnostic coverage metrics."""

from typing import Any

import numpy as np
import pandas as pd


def compute_diagnostic_latency(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate quartiles for time between sample collection and PCR result for Box Plot."""
    if df.empty:
        return {"boxplot_data": [], "median": 0.0}

    out = df.copy()
    for col in ["DT_COLETA", "DT_PCR"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    # Valid range: 0 to 30 days (filter outliers/errors)
    if "DT_PCR" not in out.columns or "DT_COLETA" not in out.columns:
        return {"boxplot_data": [], "median": 0.0}

    valid = out.dropna(subset=["DT_COLETA", "DT_PCR"])
    valid["delta"] = (valid["DT_PCR"] - valid["DT_COLETA"]).dt.days
    valid = valid[(valid["delta"] >= 0) & (valid["delta"] <= 30)]

    if valid.empty:
        return {"boxplot_data": [], "median": 0.0}

    # Format for ECharts BoxPlot [min, Q1, median, Q3, max]
    deltas = valid["delta"].sort_values()
    stats = [
        float(deltas.min()),
        float(np.percentile(deltas, 25)),
        float(deltas.median()),
        float(np.percentile(deltas, 75)),
        float(deltas.max()),
    ]

    return {"boxplot_data": stats, "median": float(round(deltas.median(), 1)), "count": len(valid)}


def compute_sample_type_distribution(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Analyze TP_AMOSTRA distribution (1=Naso, 2=Lavado, etc.)."""
    if df.empty:
        return []

    col = df.get("TP_AMOSTRA")
    if col is None:
        return []

    sample_map = {
        1: "Secreção Naso/Orofaringe",
        2: "Lavado Bronco-alveolar",
        3: "Tecido post-mortem",
        4: "Outra",
        5: "LCR",
        9: "Ignorado",
    }

    # Force to series to ensure .map works even if input is single-row or scalar
    series = pd.Series(col) if not isinstance(col, pd.Series) else col
    counts = pd.to_numeric(series, errors="coerce").map(sample_map).value_counts()
    return [{"label": str(k), "count": int(v)} for k, v in counts.items()]


def compute_testing_coverage(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate what proportion of cases had samples collected."""
    if df.empty:
        return {"collected": 0, "total": 0, "rate": 0.0}

    col = df.get("AMOSTRA")
    if col is None:
        return {"collected": 0, "total": len(df), "rate": 0.0}

    total = len(df)
    series = pd.Series(col) if not isinstance(col, pd.Series) else col
    collected = (pd.to_numeric(series, errors="coerce") == 1).sum()

    return {
        "collected": int(collected),
        "total": total,
        "rate": round((collected / total * 100), 1) if total > 0 else 0.0,
    }
