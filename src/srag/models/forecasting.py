"""Seasonal time series forecasting baseline for SRAG.

Replaced Prophet dependency with a stable and lightweight moving average projection.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from srag.utils.epi_weeks import format_epi_week


def predict_next_weeks(
    ts_df: pd.DataFrame,
    weeks_to_predict: int = 4,
    lookback_weeks: int | None = None,
) -> dict[str, Any]:
    """Predict trend using a lightweight moving average baseline (Prophet-free).

    Args:
        ts_df: DataFrame with 'epi_week' (YYYY-WW) and 'total'.
        weeks_to_predict: Future projection window.
        lookback_weeks: DEPRECATED, kept for API compatibility.
    """
    if len(ts_df) < 12:
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "insufficient_data",
        }

    # 1. Compute moving average and standard deviation from the last 4 weeks
    recent_data = pd.to_numeric(ts_df["total"].tail(4), errors="coerce").fillna(0)
    mean_val = float(recent_data.mean())
    std_val = float(recent_data.std())
    if np.isnan(std_val):
        std_val = 0.0

    # 2. Get last epidemiological week in history
    last_row = ts_df.iloc[-1]
    last_week_str = str(last_row["epi_week"])
    try:
        y, w = map(int, last_week_str.split("-"))
    except ValueError:
        # Fallback if string cannot be parsed
        y, w = 2026, 1

    forecast_results: list[dict[str, Any]] = []

    # 3. Project future weeks sequentially
    current_y, current_w = y, w
    for _ in range(weeks_to_predict):
        # Advance epidemiological week
        current_w += 1
        # Simple epidemiologic week rollover (52/53 weeks per year)
        if current_w > 52:
            current_w = 1
            current_y += 1

        se_str = format_epi_week(current_y, current_w)

        # Baseline projection: stable moving average with 1 standard deviation bounds
        pred = round(max(0.0, mean_val))
        lower = round(max(0.0, mean_val - std_val))
        upper = round(max(0.0, mean_val + std_val))

        forecast_results.append(
            {
                "epi_week": se_str,
                "predicted_cases": pred,
                "predicted_cases_lower": lower,
                "predicted_cases_upper": upper,
                "is_forecast": True,
            }
        )

    return {
        "history": ts_df.to_dict(orient="records"),
        "forecast": forecast_results,
        "status": "success",
        "model_type": "stable_moving_average",
        "lookback_weeks": len(ts_df),
    }
