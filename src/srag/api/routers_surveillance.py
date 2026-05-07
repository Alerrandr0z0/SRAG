"""Surveillance API routers."""

# ruff: noqa

from typing import Any

import pandas as pd

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/laboratory_network")
def laboratory_network(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
    years: list[int] | None = Query(None),
    agents: list[str] | None = Query(None),
) -> Any:
    from srag.api import main as api

    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    df = api.apply_surveillance_filters(df, years, agents)
    if df.empty:
        return {}

    base_summary = api.compute_laboratory_network_summary(df)
    timing_metrics = api.compute_clinical_timing_metrics(df)

    # Adiciona a taxa de adesão 48h ao resumo geral
    base_summary["overall"]["protocol_48h_adherence_rate"] = timing_metrics[
        "protocol_48h_adherence_rate"
    ]  # type: ignore[index]

    # Novos indicadores de qualidade e tratamento (Blocos 3 e 6)
    quality_metrics = {
        "testing_coverage": api.compute_testing_coverage(df),
        "sample_type_distribution": api.compute_sample_type_distribution(df),
        "diagnostic_latency": api.compute_diagnostic_latency(df),
    }

    treatment_metrics = {
        "antiviral_latency": api.compute_antiviral_latency(df),
        "antiviral_outcome_impact": api.compute_antiviral_outcome_impact(df),
    }

    # Cálculo de Sobrevivência Vacinal (KM)
    # Reutiliza a lógica para COVID e Gripe
    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df_km = df.copy()
    df_km["LAST_COV_DATE"] = df_km[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

    vaccine_survival = {
        "covid": api.compute_vaccine_survival(df_km, "LAST_COV_DATE"),
        "gripe": api.compute_vaccine_survival(df_km, "DT_UT_DOSE"),
    }

    return api.sanitize_data(
        {
            **base_summary,
            "quality_metrics": quality_metrics,
            "treatment_metrics": treatment_metrics,
            "vaccine_survival": vaccine_survival,
            "agent_lethality_heatmap": api.compute_lethality_heatmap(df),
            "codetection_matrix": api.compute_codetection_matrix(df),
            "positivity_trend": api.compute_positivity_trend(df),
            "influenza_subtypes": api.compute_influenza_subtypes(df),
            "antiviral_usage": api.compute_antiviral_usage(df),
            "closure_criteria": api.compute_closure_criteria(df),
            "notification_delay": api.compute_notification_delay_series(df),
            "mortality_by_treatment_agent": api.compute_mortality_by_treatment_agent(df).to_dict(
                orient="records"
            ),
            "genomic_variants": api.compute_genomic_variants(df),
            "virus_trends": api.compute_time_series_by_virus(df).to_dict(orient="records"),
            "imaging_profile": api.compute_imaging_profile(df),
            "serology_profile": api.compute_serology_profile(df),
            "antiviral_types": api.compute_antiviral_types(df),
            "virus_ranking": api.compute_virus_distribution(df).to_dict(orient="records"),
        }
    )


@router.get("/context_trends")
def context_trends(
    key: str,
    last_n_weeks: int = 26,
    weeks_to_predict: int = 4,
    lookback_weeks: int = 0,
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    from srag.api import main as api
    from srag.models.forecasting import predict_next_weeks

    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return {"history": [], "forecast": [], "thresholds": {}, "composition": []}

    work = df.copy()
    if key.startswith("BAIRRO::"):
        work = work[work["BAIRRO_REF"] == key.split("::")[1]]
    elif key.startswith("ZONA::"):
        work = work[work["ZONA"].str.capitalize() == key.split("::")[1].capitalize()]

    ts = api.compute_time_series(work)
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict)
    result["thresholds"] = api.compute_alert_thresholds(work)
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

    return api.sanitize_data(result)


@router.get("/timeline_agg")
def timeline_agg(
    virus: str = "covid",
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    from srag.api import main as api

    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return []

    result = api.compute_aggregated_timeline(df, virus)
    return api.sanitize_data(result)


@router.get("/icu_bottleneck")
def icu_bottleneck(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
    years: list[int] | None = Query(None),
    agents: list[str] | None = Query(None),
) -> Any:
    """Calcula o tempo de espera (em dias) entre a internação e a entrada na UTI por mês."""
    from srag.api import main as api

    try:
        df = api.get_df()
        df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades, years)
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
        return api.sanitize_data(result)
    except Exception as e:
        print(f"ERRO ICU_BOTTLENECK: {e}")
        return []
