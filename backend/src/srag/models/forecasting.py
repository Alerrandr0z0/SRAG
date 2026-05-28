"""Advanced seasonal time series forecasting for SRAG using Prophet.

Refined to handle pandemic shocks and seasonal decoupling.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
from prophet import Prophet

from srag.utils.epi_weeks import format_epi_week, get_date_from_epi_week, get_epi_week

# Suppress Prophet/CmdStanPy logging
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)


def predict_next_weeks(
    ts_df: pd.DataFrame,
    weeks_to_predict: int = 4,
    lookback_weeks: int | None = None,
) -> dict[str, Any]:
    """Predict trend using Prophet with improved seasonal handling.

    Args:
        ts_df: DataFrame with 'epi_week' (YYYY-WW) and 'total'.
        weeks_to_predict: Future projection window.
        lookback_weeks: DEPRECATED for fitting. Now used only for UI slicing.
            Fitting now uses all available history to stabilize seasonality.
    """
    if len(ts_df) < 12:
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "insufficient_data",
        }

    # 1. Data Preparation
    def parse_se(se_str: str) -> pd.Timestamp:
        y, w = map(int, se_str.split("-"))
        return pd.Timestamp(get_date_from_epi_week(y, w))

    m_df = ts_df.copy()
    m_df["ds"] = m_df["epi_week"].apply(parse_se)
    m_df["y"] = pd.to_numeric(m_df["total"], errors="coerce").fillna(0)

    # --- InfoGripe Strategy: Handling Pandemic Peaks as Outliers ---
    # Se tivermos anos de pico extremo (2020-2021), eles podem distorcer a média móvel.
    # Aplicamos um log-transform ou cap para estabilizar o modelo.
    # Para SRAG municipal, log costuma funcionar melhor para evitar explosões lineares.
    m_df["y"] = np.log1p(m_df["y"])

    # 2. Configure Prophet
    # 'changepoint_prior_scale' menor (0.01) evita que o modelo mude de direção
    # drasticamente por causa de 1 ou 2 semanas de subida (o problema dos 322 casos).
    m = Prophet(
        yearly_seasonality=True,  # type: ignore
        weekly_seasonality=False,  # type: ignore
        daily_seasonality=False,  # type: ignore
        changepoint_prior_scale=0.01,
        seasonality_prior_scale=1.0,
        interval_width=0.80,
    )

    try:
        # Fit on EVERYTHING we have to get the best seasonal profile
        m.fit(m_df[["ds", "y"]])

        # 3. Forecast
        future = m.make_future_dataframe(periods=weeks_to_predict, freq="W")
        forecast = m.predict(future)

        # Transform back from log space
        for col in ["yhat", "yhat_lower", "yhat_upper"]:
            forecast[col] = np.expm1(forecast[col])

        forecast_future = forecast.tail(weeks_to_predict).copy()

        forecast_results = []
        for _, row in forecast_future.iterrows():
            y, w = get_epi_week(row["ds"].date())
            se_str = format_epi_week(y, w)

            # Garantir que os casos sejam inteiros (não existe 0.5 caso)
            pred = round(max(0, float(row["yhat"])))
            lower = round(max(0, float(row["yhat_lower"])))
            upper = round(max(0, float(row["yhat_upper"])))

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
            "model_type": "prophet_stable_seasonal",
            "lookback_weeks": len(ts_df),
        }

    except Exception as e:
        return {
            "history": ts_df.to_dict(orient="records"),
            "forecast": [],
            "status": "error",
            "error_msg": str(e),
        }
