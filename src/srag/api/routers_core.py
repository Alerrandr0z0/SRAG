"""Core API routers."""

# ruff: noqa

from typing import Any

import pandas as pd

from fastapi import APIRouter, Depends

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.types import SummaryResponse, TrendsResponse, VirusDistributionItem

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/summary")
def get_summary(
    filters: CommonFilters = Depends(get_common_filters),
) -> SummaryResponse:
    from srag.api import main as api

    df_all = api.get_df()
    available_years: list[int] = []
    if not df_all.empty and "DT_SIN_PRI" in df_all.columns:
        years_series = pd.to_datetime(df_all["DT_SIN_PRI"], errors="coerce").dt.year.dropna()
        available_years = sorted({int(y) for y in years_series})

    df = api.apply_global_filters(
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
    df = api.apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return {
            "uti_rate": 0.0,
            "uti_total": 0,
            "death_rate": 0.0,
            "total": 0,
            "available_years": available_years,
        }

    total = len(df)
    hospital_col = df.get("HOSPITAL")
    hospitalized = int((hospital_col.fillna(0) == 1).sum()) if hospital_col is not None else 0
    uti_cases = int((df["UTI"] == 1).sum())
    death_cases = api.outcome_death_mask(df["EVOLUCAO"]).sum()

    return {
        "uti_rate": round((uti_cases / total) * 100, 2) if total > 0 else 0,
        "uti_total": uti_cases,
        "death_rate": round((death_cases / total) * 100, 2) if total > 0 else 0,
        "total": hospitalized,
        "available_years": available_years,
    }


@router.get("/trends")
def get_trends(
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
    lookback_weeks: int = 0,
    filters: CommonFilters = Depends(get_common_filters),
) -> TrendsResponse:
    from srag.api import main as api

    df = api.get_df()
    df = api.apply_global_filters(
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
    df = api.apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return {
            "history": [],
            "forecast": [],
            "thresholds": {},
            "composition": [],
            "base_cumulative": 0,
        }

    ts = api.compute_time_series(df)
    result = api.predict_next_weeks(ts, weeks_to_predict=weeks_to_predict)
    result["thresholds"] = api.compute_alert_thresholds(df)
    ts_virus = api.compute_time_series_by_virus(df)
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

    return api.sanitize_data(result)  # type: ignore[return-value]


@router.get("/virus")
def get_virus(
    detail_level: str = "summary",
    filters: CommonFilters = Depends(get_common_filters),
) -> list[VirusDistributionItem]:
    from srag.api import main as api

    df = api.get_df()
    df = api.apply_global_filters(
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
    df = api.apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return []

    if detail_level == "summary":
        dist = api.compute_virus_distribution(df)
    else:
        dist = api.compute_virus_detailed_distribution(df, detail_level=detail_level)

    return api.sanitize_data(dist.to_dict(orient="records"))  # type: ignore[return-value]


@router.get("/data_completeness")
def get_data_completeness(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    from srag.api import main as api

    df = api.get_df()
    df = api.apply_global_filters(
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
    df = api.apply_surveillance_filters(df, filters.years, filters.agents)
    return api.compute_data_completeness(df)
