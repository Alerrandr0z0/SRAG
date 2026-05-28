"""Core API routers."""

# ruff: noqa

from typing import Any, Literal

import pandas as pd

from fastapi import APIRouter, Depends, Query

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.types import SummaryResponse, TrendsResponse, VirusDistributionItem
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.analytics import (
    apply_global_filters,
    compute_alert_thresholds,
    compute_data_completeness,
    compute_time_series,
    compute_time_series_by_virus,
    compute_virus_detailed_distribution,
    compute_virus_distribution,
    outcome_death_mask,
)
from srag.models.forecasting import predict_next_weeks

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/summary")
def get_summary(
    filters: CommonFilters = Depends(get_common_filters),
) -> SummaryResponse:
    df_all = get_df()
    available_years: list[int] = []
    if not df_all.empty and "DT_SIN_PRI" in df_all.columns:
        years_series = pd.to_datetime(df_all["DT_SIN_PRI"], errors="coerce").dt.year.dropna()
        available_years = sorted({int(y) for y in years_series})

    df = apply_global_filters(
        df_all,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return {
            "uti_rate": 0.0,
            "uti_total": 0,
            "death_rate": 0.0,
            "total": 0,
            "notification_total": 0,
            "available_years": available_years,
        }

    total = len(df)
    hospital_col = df.get("HOSPITAL")
    hospitalized = int((hospital_col.fillna(0) == 1).sum()) if hospital_col is not None else 0
    uti_cases = int((df["UTI"] == 1).sum())
    death_cases = outcome_death_mask(df["EVOLUCAO"]).sum()

    return {
        "uti_rate": round((uti_cases / total) * 100, 2) if total > 0 else 0,
        "uti_total": uti_cases,
        "death_rate": round((death_cases / total) * 100, 2) if total > 0 else 0,
        "total": hospitalized,
        "notification_total": len(df),
        "available_years": available_years,
    }


@router.get("/trends")
def get_trends(
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
    lookback_weeks: int = 0,
    filters: CommonFilters = Depends(get_common_filters),
) -> TrendsResponse:
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return {
            "history": [],
            "forecast": [],
            "thresholds": {},
            "composition": [],
            "base_cumulative": 0,
        }

    ts = compute_time_series(df)
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict)
    result["thresholds"] = compute_alert_thresholds(df)
    ts_virus = compute_time_series_by_virus(df)
    history_weeks = [h["epi_week"] for h in result["history"][-last_n_weeks:]]
    composition = ts_virus[ts_virus["epi_week"].isin(history_weeks)]
    result["composition"] = composition.to_dict(orient="records")

    full_history = result["history"]
    if last_n_weeks > 0:
        result["base_cumulative"] = sum(h["total"] for h in full_history[:-last_n_weeks])
        result["history"] = full_history[-last_n_weeks:]
    else:
        result["base_cumulative"] = 0
        result["history"] = full_history

    return sanitize_data(result)  # type: ignore[return-value]


@router.get("/virus")
def get_virus(
    detail_level: Literal["summary", "detailed", "covid_detailed", "influenza_detailed"] = Query(
        "summary"
    ),
    filters: CommonFilters = Depends(get_common_filters),
) -> list[VirusDistributionItem]:
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return []

    if detail_level == "summary":
        dist = compute_virus_distribution(df)
    else:
        dist = compute_virus_detailed_distribution(df, detail_level=detail_level)

    return sanitize_data(dist.to_dict(orient="records"))  # type: ignore[return-value]


@router.get("/data_completeness")
def get_data_completeness(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    return compute_data_completeness(df)
