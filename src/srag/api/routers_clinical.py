"""Clinical API routers."""

# ruff: noqa

import logging
from typing import Any

import pandas as pd

from fastapi import APIRouter, Depends, Query

logger = logging.getLogger(__name__)

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.analytics import (
    apply_global_filters,
    classificar_status_gripe,
    compute_animal_contact_distribution,
    compute_citizen_profile_tree,
    compute_citizen_pyramid,
    compute_clinical_timing_metrics,
    compute_maternal_profile,
    compute_occupation_profile,
    compute_race_profile,
    compute_risk_factors_full_profile,
    compute_schooling_profile,
    compute_symptoms_heatmap,
    compute_symptoms_signature,
    compute_traditional_community_distribution,
    compute_vaccine_manufacturer_distribution,
    compute_vaccine_survival,
)

router = APIRouter()


@router.get("/occupations")
def get_occupations(
    limit: int = Query(50, ge=1, le=500),
    filters: CommonFilters = Depends(get_common_filters),
) -> list[dict[str, Any]]:
    """Retorna as ocupações mais frequentes, permitindo filtragem por ano/zona."""
    df = get_df()
    # Aplicamos apenas filtros de base (Ano, Zona, Bairro) para não circular a busca
    df = apply_global_filters(
        df,
        zonas=filters.zonas,
        bairros=filters.bairros,
        years=filters.years,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    return compute_occupation_profile(df, top_n=limit)


@router.get("/clinical_flow")
def clinical_flow(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Analisa a jornada clínica completa para o gráfico Sankey com porcentagens."""
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    if df.empty:
        return {"nodes": [], "links": []}

    df = df.copy()
    df["S_ORIGEM"] = (
        df["NOSOCOMIAL"]
        .map({1: "Infecção Hospitalar", 2: "Comunitária"})
        .fillna("Origem (Ignorado)")
    )
    df["S_UTI"] = (
        df["UTI"]
        .map({1: "Internado em UTI", 2: "Internado em Enfermaria"})
        .fillna("Internação (Ignorado)")
    )
    df["S_VENT"] = (
        df["SUPORT_VEN"]
        .map({1: "Vent. Invasiva", 2: "Vent. Não Inv.", 3: "Sem Suporte"})
        .fillna("Suporte (Ignorado)")
    )
    df["S_FIM"] = df["EVOLUCAO"].map({1: "Cura", 2: "Óbito"}).fillna("Em Aberto")

    links_raw = []

    def add_flow(df_step: pd.DataFrame, col_source: str, col_target: str) -> None:
        counts = df_step.groupby([col_source, col_target]).size().reset_index(name="value")
        source_totals = counts.groupby(col_source)["value"].transform("sum")
        counts["pct"] = (counts["value"] / source_totals * 100).round(1)
        for _, r in counts.iterrows():
            links_raw.append(
                {
                    "source": r[col_source],
                    "target": r[col_target],
                    "value": int(r["value"]),
                    "pct": float(r["pct"]),
                }
            )

    add_flow(df, "S_ORIGEM", "S_UTI")
    add_flow(df, "S_UTI", "S_VENT")
    add_flow(df, "S_VENT", "S_FIM")

    all_nodes = set()
    for l in links_raw:
        all_nodes.add(l["source"])
        all_nodes.add(l["target"])

    nodes = [{"name": n} for n in sorted(list(all_nodes))]
    return {"nodes": nodes, "links": links_raw}


@router.get("/hospitalization_duration")
def hospitalization_duration(
    filters: CommonFilters = Depends(get_common_filters),
) -> list[float]:
    """Calcula a distribuição de dias de internação (DT_EVOLUCA - DT_INTERNA)."""
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    if df.empty:
        return []

    try:
        df["DT_INTERNA"] = pd.to_datetime(df["DT_INTERNA"], errors="coerce")
        df["DT_EVOLUCA"] = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
        dur = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days
        return [float(x) for x in dur[(dur >= 0) & (dur <= 90)].dropna()]
    except Exception:
        logger.exception("Failed to compute hospitalization duration")
        return []


@router.get("/vaccination_profile")
def vaccination_profile(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Analisa o esquema vacinal detalhado de COVID-19 e Influenza com filtros."""
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    if df.empty:
        return {}

    raw_gripe = df.apply(classificar_status_gripe, axis=1).value_counts().to_dict()
    gripe_schema = {k: int(v) for k, v in raw_gripe.items()}
    label_map = {
        "protegido": "Protegido (Campanha Atual)",
        "dose_1": "Gripe: Dose 1",
        "dose_2": "Gripe: Dose 2",
        "dose_unica": "Gripe: Dose Única",
        "vencida": "Imunidade Vencida",
        "nao_vacinado": "Não Vacinado",
        "ignorado": "Ignorado",
        "inconsistencia": "Inconsistência",
    }
    gripe_schema_readable: dict[str, int] = {
        label_map.get(str(k), str(k)): int(v) for k, v in gripe_schema.items()
    }
    for label in label_map.values():
        if label not in gripe_schema_readable:
            gripe_schema_readable[label] = 0

    def get_last_dose(row: pd.Series) -> str:
        if pd.notna(row["DOS_RE_BI"]):
            return "Bivalente"
        if pd.notna(row["DOSE_2REF"]):
            return "2º Reforço"
        if pd.notna(row["DOSE_REF"]):
            return "1º Reforço"
        if pd.notna(row["DOSE_2_COV"]):
            return "Esquema Completo"
        if pd.notna(row["DOSE_1_COV"]):
            return "Dose 1"
        if row["VACINA_COV"] == 2:
            return "Não Vacinado"
        return "Ignorado"

    covid_schema = df.apply(get_last_dose, axis=1).value_counts().to_dict()
    manufacturers = compute_vaccine_manufacturer_distribution(df)

    return sanitize_data(
        {
            "gripe": gripe_schema_readable,
            "covid_detailed": covid_schema,
            "manufacturers": manufacturers,
        }
    )


@router.get("/citizen_bootstrap")
def citizen_bootstrap(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Bootstrap de dados do cidadão com filtros hierárquicos e multi-seleção."""
    df = get_df()
    df_filtered = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )

    valid_profiles = [p for p in (filters.profile or []) if p]
    heatmap_profile = valid_profiles[0] if len(valid_profiles) == 1 else "all"

    return sanitize_data(
        {
            "citizen_profiles": compute_citizen_profile_tree(df_filtered),
            "citizen_pyramid": compute_citizen_pyramid(df_filtered),
            "race_profile": compute_race_profile(df_filtered),
            "schooling_profile": compute_schooling_profile(df_filtered),
            "occupation_profile": compute_occupation_profile(df_filtered),
            "animal_contact": compute_animal_contact_distribution(df_filtered),
            "traditional_communities": compute_traditional_community_distribution(df_filtered),
            "symptoms_signature": compute_symptoms_signature(df_filtered, heatmap_profile),
            "symptoms_heatmap": compute_symptoms_heatmap(df_filtered),
            "risk_factors_full": compute_risk_factors_full_profile(df_filtered),
            "maternal_profile": compute_maternal_profile(df_filtered),
        }
    )


@router.get("/clinical_timing")
def clinical_timing(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Métricas de fluxo clínico: tempo sintomas→internação, internação→UTI, adesão ao protocolo antiviral."""
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    return compute_clinical_timing_metrics(df)


@router.get("/vaccine_survival")
def vaccine_survival(
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    """Calcula as curvas de sobrevivência Kaplan-Meier com filtros."""
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        years=filters.years,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    if df.empty:
        return {"covid": {}, "gripe": {}}

    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df["LAST_COV_DATE"] = df[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

    return sanitize_data(
        {
            "covid": compute_vaccine_survival(df, "LAST_COV_DATE"),
            "gripe": compute_vaccine_survival(df, "DT_UT_DOSE"),
        }
    )
