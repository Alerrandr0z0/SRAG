"""Advanced seasonal time series forecasting for SRAG using Prophet."""

from __future__ import annotations

from typing import Any
from pathlib import Path
import logging

import numpy as np
import pandas as pd
from prophet import Prophet

from srag.utils.epi_weeks import get_date_from_epi_week, get_epi_week, format_epi_week

# Suppress Prophet/CmdStanPy logging for a cleaner API
logging.getLogger('prophet').setLevel(logging.ERROR)
logging.getLogger('cmdstanpy').setLevel(logging.ERROR)

def compute_moving_average(values: np.ndarray, window: int = 3) -> np.ndarray:
    """Smooth the time series using a simple moving average.
    
    Now preserved for compatibility and manual smoothing if needed.
    """
    series = pd.Series(values)
    result = series.rolling(window=window, min_periods=1, center=True).mean()
    return np.asarray(result, dtype=float)

def predict_next_weeks(
    ts_df: pd.DataFrame,
    weeks_to_predict: int = 4,
    lookback_weeks: int | None = None,
) -> dict[str, Any]:
    """Predict the trend using Prophet (seasonal additive model).
    
    Handles yearly seasonality automatically based on the historical series.
    
    Args:
        ts_df: DataFrame with 'epi_week' (YYYY-WW) and 'total'.
        weeks_to_predict: Number of weeks into the future to project.
        lookback_weeks: Number of recent weeks used for fitting. 
            Default None (uses all history, recommended for seasonality).
            
    Returns:
        Dictionary formatted for JSON consumption by JS charts.
    """
    if len(ts_df) < 10:
        # Prophet needs a bit more data to be stable than a simple linear trend
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "insufficient_data",
        }

    # 1. Prepare data for Prophet
    # Convert epi_week strings back to Sunday dates
    def parse_se(se_str):
        y, w = map(int, se_str.split("-"))
        return pd.Timestamp(get_date_from_epi_week(y, w))

    m_df = ts_df.copy()
    m_df['ds'] = m_df['epi_week'].apply(parse_se)
    m_df['y'] = pd.to_numeric(m_df['total'], errors='coerce').fillna(0)
    
    # Filter by lookback if requested
    if lookback_weeks:
        m_df = m_df.tail(lookback_weeks)

    # 2. Configure and Fit Prophet
    # Yearly seasonality is CRITICAL for SRAG (Gripe/COVID cycles)
    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.80  # 80% Confidence Interval
    )
    
    try:
        m.fit(m_df[['ds', 'y']])
        
        # 3. Forecast
        future = m.make_future_dataframe(periods=weeks_to_predict, freq='W')
        forecast = m.predict(future)
        
        # Merge with actual week labels
        # We only want the 'future' part for the forecast_results
        forecast_future = forecast.tail(weeks_to_predict).copy()
        
        forecast_results = []
        for _, row in forecast_future.iterrows():
            # Convert back to epi_week string
            y, w = get_epi_week(row['ds'].date())
            se_str = format_epi_week(y, w)
            
            # Constraints: no negative cases
            pred = max(0, round(float(row['yhat']), 1))
            lower = max(0, round(float(row['yhat_lower']), 1))
            upper = max(0, round(float(row['yhat_upper']), 1))
            
            forecast_results.append({
                "epi_week": se_str,
                "predicted_cases": pred,
                "predicted_cases_lower": lower,
                "predicted_cases_upper": upper,
                "is_forecast": True
            })

        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": forecast_results,
            "status": "success",
            "model_type": "prophet_seasonal",
            "lookback_weeks": lookback_weeks or len(ts_df),
        }
        
    except Exception as e:
        print(f"Error in Prophet forecasting: {e}")
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "error",
            "error_msg": str(e)
        }
