"""Surveillance API routers."""

# ruff: noqa

import logging
from typing import Any, Literal, cast

import pandas as pd

from fastapi import APIRouter, Depends, Query

logger = logging.getLogger(__name__)

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.analytics import (
    apply_global_filters,
    compute_aggregated_timeline,
    compute_alert_thresholds,
    compute_antiviral_latency,
    compute_antiviral_outcome_impact,
    compute_antiviral_types,
    compute_antiviral_usage,
    compute_clinical_timing_metrics,
    compute_closure_criteria,
    compute_codetection_matrix,
    compute_diagnostic_latency,
    compute_genomic_variants,
    compute_imaging_profile,
    compute_influenza_subtypes,
    compute_laboratory_network_summary,
    compute_lethality_heatmap,
    compute_mortality_by_treatment_agent,
    compute_notification_delay_series,
    compute_positivity_trend,
    compute_sample_type_distribution,
    compute_serology_profile,
    compute_testing_coverage,
    compute_time_series,
    compute_time_series_by_virus,
    compute_vaccine_survival,
    compute_virus_distribution,
)
from srag.models.forecasting import predict_next_weeks

router = APIRouter()


@router.get("/laboratory_network")
def laboratory_network(
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
    if df.empty:
        return {}

    base_summary = compute_laboratory_network_summary(df)
    timing_metrics = compute_clinical_timing_metrics(df)

    # Adiciona a taxa de adesão 48h ao resumo geral
    overall = cast(dict[str, object], base_summary["overall"])
    overall["protocol_48h_adherence_rate"] = timing_metrics["protocol_48h_adherence_rate"]

    # Novos indicadores de qualidade e tratamento (Blocos 3 e 6)
    quality_metrics = {
        "testing_coverage": compute_testing_coverage(df),
        "sample_type_distribution": compute_sample_type_distribution(df),
        "diagnostic_latency": compute_diagnostic_latency(df),
    }

    treatment_metrics = {
        "antiviral_latency": compute_antiviral_latency(df),
        "antiviral_outcome_impact": compute_antiviral_outcome_impact(df),
    }

    # Cálculo de Sobrevivência Vacinal (KM)
    # Reutiliza a lógica para COVID e Gripe
    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df_km = df.copy()
    df_km["LAST_COV_DATE"] = df_km[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

    vaccine_survival = {
        "covid": compute_vaccine_survival(df_km, "LAST_COV_DATE"),
        "gripe": compute_vaccine_survival(df_km, "DT_UT_DOSE"),
    }

    return sanitize_data(
        {
            **base_summary,
            "quality_metrics": quality_metrics,
            "treatment_metrics": treatment_metrics,
            "vaccine_survival": vaccine_survival,
            "agent_lethality_heatmap": compute_lethality_heatmap(df),
            "codetection_matrix": compute_codetection_matrix(df),
            "positivity_trend": compute_positivity_trend(df),
            "influenza_subtypes": compute_influenza_subtypes(df),
            "antiviral_usage": compute_antiviral_usage(df),
            "closure_criteria": compute_closure_criteria(df),
            "notification_delay": compute_notification_delay_series(df),
            "mortality_by_treatment_agent": compute_mortality_by_treatment_agent(df).to_dict(
                orient="records"
            ),
            "genomic_variants": compute_genomic_variants(df),
            "virus_trends": compute_time_series_by_virus(df).to_dict(orient="records"),
            "imaging_profile": compute_imaging_profile(df),
            "serology_profile": compute_serology_profile(df),
            "antiviral_types": compute_antiviral_types(df),
            "virus_ranking": compute_virus_distribution(df).to_dict(orient="records"),
        }
    )


@router.get("/context_trends")
def context_trends(
    key: str = Query(pattern=r"^(BAIRRO::|ZONA::)"),
    last_n_weeks: int = Query(26, ge=1, le=104),
    weeks_to_predict: int = Query(4, ge=1, le=52),
    lookback_weeks: int = Query(0, ge=0),
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
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
        return sanitize_data({"history": [], "forecast": [], "thresholds": {}, "composition": []})

    work = df.copy()
    if key.startswith("BAIRRO::"):
        work = work[work["BAIRRO_REF"] == key.split("::")[1]]
    elif key.startswith("ZONA::"):
        work = work[work["ZONA"].str.capitalize() == key.split("::")[1].capitalize()]

    ts = compute_time_series(work)
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict)
    # Use full historical baseline for alert thresholds to ensure a stable 'ruler'
    result["thresholds"] = compute_alert_thresholds(df_all)
    history_weeks = [h["epi_week"] for h in result["history"][-last_n_weeks:]]
    composition = ts[ts["epi_week"].isin(history_weeks)]
    result["composition"] = composition.to_dict(orient="records")

    full_history = result["history"]
    if last_n_weeks > 0:
        result["base_cumulative"] = sum(h["total"] for h in full_history[:-last_n_weeks])
        result["history"] = full_history[-last_n_weeks:]
    else:
        result["base_cumulative"] = 0
        result["history"] = full_history

    return sanitize_data(result)


@router.get("/timeline_agg")
def timeline_agg(
    virus: Literal["covid", "gripe"] = Query("covid"),
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
    if df.empty:
        return []

    result = compute_aggregated_timeline(df, virus)
    return sanitize_data(result)


@router.get("/icu_bottleneck")
def icu_bottleneck(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Calcula o tempo de espera (em dias) entre a internação e a entrada na UTI por mês."""
    try:
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

        df_uti = df[df["UTI"] == 1].copy()
        if df_uti.empty:
            return []

        df_uti["DT_INTERNA"] = pd.to_datetime(df_uti["DT_INTERNA"], errors="coerce")
        df_uti["DT_ENTUTI"] = pd.to_datetime(df_uti["DT_ENTUTI"], errors="coerce")

        df_uti = df_uti.dropna(subset=["DT_INTERNA", "DT_ENTUTI"])
        if df_uti.empty:
            return []

        df_uti["wait_days"] = (df_uti["DT_ENTUTI"] - df_uti["DT_INTERNA"]).dt.days
        df_valid = df_uti[(df_uti["wait_days"] >= 0) & (df_uti["wait_days"] <= 30)].copy()
        if df_valid.empty:
            return []

        df_valid["date"] = df_valid["DT_INTERNA"].dt.strftime("%Y-%m-%d")
        df_valid = df_valid.sort_values(by="date")

        result = df_valid[["date", "wait_days"]].to_dict(orient="records")
        return sanitize_data(result)
    except Exception:
        logger.exception("ICU bottleneck calculation failed")
        return []
