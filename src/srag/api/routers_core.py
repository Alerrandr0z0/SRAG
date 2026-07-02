"""Core API routers."""

# ruff: noqa

from typing import Any, Literal

import pandas as pd

from fastapi import APIRouter, Depends, Query

from srag import __version__
from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.types import (
    SummaryResponse,
    TrendsResponse,
    VirusDistributionItem,
    AuditBootstrapResponse,
)
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.analytics import (
    apply_global_filters,
    compute_alert_thresholds,
    compute_completeness_trend,
    compute_data_completeness,
    compute_logical_inconsistencies,
    compute_quality_by_bairro,
    compute_quality_by_laboratory,
    compute_quality_by_unit,
    compute_time_series,
    compute_time_series_by_virus,
    compute_timeliness_flow,
    compute_virus_detailed_distribution,
    compute_virus_distribution,
)
from srag.models.forecasting import predict_next_weeks

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


from srag.data.analytics.filters import epi_week_year

@router.get("/summary")
def get_summary(
    filters: CommonFilters = Depends(get_common_filters),
) -> SummaryResponse:
    df_all = get_df()
    available_years: list[int] = []
    if not df_all.empty and "DT_SIN_PRI" in df_all.columns:
        dt_s = pd.to_datetime(df_all["DT_SIN_PRI"], errors="coerce")
        years_series = epi_week_year(dt_s).dropna()
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    if df.empty:
        return sanitize_data(
            {
                "uti_rate": 0.0,
                "uti_total": 0,
                "death_rate": 0.0,
                "death_count": 0,
                "total": 0,
                "hospitalized": 0,
                "notification_total": 0,
                "available_years": available_years,
            }
        )

    total = len(df)
    hospital_col = df.get("HOSPITAL")
    hospitalized = int((hospital_col.fillna(0) == 1).sum()) if hospital_col is not None else 0
    uti_cases = int((df["UTI"] == 1).sum())

    # Standard Epidemiological Lethality: deaths / (cure + deaths)
    closed_cases_mask = df["EVOLUCAO"].isin([1, 2])
    closed_count = closed_cases_mask.sum()
    death_cases = int((df["EVOLUCAO"] == 2).sum())

    return sanitize_data(
        {
            "uti_rate": round((uti_cases / total) * 100, 2) if total > 0 else 0,
            "uti_total": uti_cases,
            "death_rate": round((death_cases / closed_count * 100), 2)
            if closed_count > 0
            else 0.0,
            "death_count": death_cases,
            "total": total,
            "hospitalized": hospitalized,
            "notification_total": total,
            "available_years": available_years,
        }
    )


@router.get("/trends")
def get_trends(
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
    lookback_weeks: int = 0,
    filters: CommonFilters = Depends(get_common_filters),
) -> TrendsResponse:
    df_all = get_df()
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
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
    # Use full historical baseline for alert thresholds to ensure a stable 'ruler'
    result["thresholds"] = compute_alert_thresholds(df_all)
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    return compute_data_completeness(df)


@router.get("/audit_bootstrap")
def get_audit_bootstrap(
    filters: CommonFilters = Depends(get_common_filters),
) -> AuditBootstrapResponse:
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )

    if df.empty:
        return {
            "completeness": [],
            "completeness_trend": [],
            "quality_by_unit": [],
            "quality_by_bairro": [],
            "quality_by_laboratory": [],
            "inconsistencies": [],
            "timeliness_flow": {"nodes": [], "links": [], "kpis": [], "total_cases": 0},
        }

    return sanitize_data(
        {
            "completeness": compute_data_completeness(df),
            "completeness_trend": compute_completeness_trend(df),
            "quality_by_unit": compute_quality_by_unit(df),
            "quality_by_bairro": compute_quality_by_bairro(df),
            "quality_by_laboratory": compute_quality_by_laboratory(df),
            "inconsistencies": compute_logical_inconsistencies(df),
            "timeliness_flow": compute_timeliness_flow(df),
        }
    )
