from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def compute_moving_average(values: np.ndarray, window: int = 3) -> np.ndarray:
    """Smooth the time series using a simple moving average.

    Useful for reducing noise in municipal data.
    """
    series = pd.Series(values)
    result = series.rolling(window=window, min_periods=1, center=True).mean()
    return np.asarray(result, dtype=float)


def predict_next_weeks(
    ts_df: pd.DataFrame,
    weeks_to_predict: int = 4,
    lookback_weeks: int | None = 8,
) -> dict[str, Any]:
    """Predict the trend for the next few weeks using a simple linear trend.

    This is a baseline model. For production, more complex models like
    Holt-Winters or Prophet could be used, but linear trend is safer for
    small, direct-feed datasets without seasonality data yet.

    Args:
        ts_df: DataFrame with 'epi_week' and 'total'.
        weeks_to_predict: Number of weeks into the future to project.
        lookback_weeks: Number of recent weeks used for fitting.
            Use ``None`` to use full history.

    Returns:
        Dictionary formatted for JSON consumption by JS charts.
    """
    if len(ts_df) < 4:
        # Not enough data to establish a trend
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "insufficient_data",
        }

    # Prepare data for regression
    # Convert epi_week index to numeric values for training
    y = np.asarray(ts_df["total"].values, dtype=float)
    x = np.arange(len(y)).reshape(-1, 1)

    # Simple smoothing before trend analysis
    y_smoothed = compute_moving_average(y, window=3)

    # Fit linear model on recent or full history.
    lookback = len(y) if lookback_weeks is None else min(len(y), max(4, lookback_weeks))
    model = LinearRegression()
    model.fit(x[-lookback:], y_smoothed[-lookback:])

    # Forecast
    future_x = np.arange(len(y), len(y) + weeks_to_predict).reshape(-1, 1)
    future_y = model.predict(future_x)

    # Ensure no negative cases
    future_y = np.maximum(future_y, 0)

    # Generate future week labels (simplistic increment)
    last_week_str = ts_df["epi_week"].iloc[-1]
    year, week = map(int, last_week_str.split("-"))

    forecast_results = []
    curr_year, curr_week = year, week

    for i in range(weeks_to_predict):
        curr_week += 1
        if curr_week > 52:  # Simple SE overflow
            curr_week = 1
            curr_year += 1

        predicted = round(float(future_y[i]))
        lower = max(0, predicted - 1)
        upper = predicted + 1

        forecast_results.append(
            {
                "epi_week": f"{curr_year}-{curr_week:02d}",
                "predicted_cases": predicted,
                "predicted_cases_lower": lower,
                "predicted_cases_upper": upper,
                "is_forecast": True,
            }
        )

    return {
        "history": ts_df.to_dict(orient="records"),
        "forecast": forecast_results,
        "status": "success",
        "model_type": "linear_trend_smoothed",
        "lookback_weeks": lookback,
    }
