"""Clinical API routers."""

# ruff: noqa

import logging
from typing import Any

import numpy as np
import pandas as pd

from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)

from srag.api.types import ComorbiditiesTreemapResponse
from srag.api.dependencies import CommonFiltersDep
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
    compute_comorbidities_treemap,
    compute_schooling_profile,
    compute_symptoms_heatmap,
    compute_symptoms_signature,
    compute_traditional_community_distribution,
    compute_vaccine_manufacturer_distribution,
    compute_vaccine_survival,
    outcome_death_mask,
)

router = APIRouter(tags=["clinical"])


@router.get("/occupations")
def get_occupations(
    filters: CommonFiltersDep,
    limit: int = Query(50, ge=1, le=500),
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    return compute_occupation_profile(df, top_n=limit)


@router.get("/clinical_flow")
def clinical_flow(
    filters: CommonFiltersDep,
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
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


EMPTY_HOSPITALIZATION = {
    "cure": [],
    "death": [],
    "kde_cure": [],
    "kde_death": [],
    "kde_x": [],
    "median_cure": 0.0,
    "median_death": 0.0,
    "difference": 0.0,
    "ratio": 0.0,
    "cure_count": 0,
    "death_count": 0,
}

HOSPITALIZATION_MAX_DAYS = 90
KDE_GRID_STEP = 0.5
KDE_GRID_MAX = 45.5
KDE_BANDWIDTH_CURE = 4.0
KDE_BANDWIDTH_DEATH = 3.0


def _epanechnikov_kde(values: np.ndarray, bandwidth: float, grid: np.ndarray) -> np.ndarray:
    """Epanechnikov kernel density estimate evaluated on `grid`.

    Bandwidth selection follows Silverman's rule of thumb for daily counts;
    we then scale by the bin width so the curve aligns with histogram bars.
    """
    if values.size == 0:
        return np.zeros_like(grid)
    diffs = (grid[:, None] - values[None, :]) / bandwidth
    mask = np.abs(diffs) <= 1.0
    kernel = np.zeros_like(diffs)
    kernel[mask] = 0.75 * (1.0 - diffs[mask] ** 2) / bandwidth
    density = kernel.mean(axis=1)
    return density * values.size


def _extract_hospitalization_durations(df: pd.DataFrame) -> pd.DataFrame:
    """Return closed cases (cured/deceased) with valid duration in days."""
    df = df.copy()
    df["DT_INTERNA"] = pd.to_datetime(df["DT_INTERNA"], errors="coerce")
    df["DT_EVOLUCA"] = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
    closed = df[df["EVOLUCAO"].isin([1, 2])].copy()
    dur = (closed["DT_EVOLUCA"] - closed["DT_INTERNA"]).dt.days
    valid = dur[(dur >= 0) & (dur <= HOSPITALIZATION_MAX_DAYS)].dropna()
    if valid.empty:
        return pd.DataFrame(columns=["EVOLUCAO", "days"])
    out = closed.loc[valid.index, ["EVOLUCAO"]].copy()
    out["days"] = valid
    return out


def _summarize_hospitalization(cure: pd.Series, death: pd.Series) -> dict[str, float | int]:
    """Compute medians, difference, and ratio for the two outcome groups."""
    median_cure = float(round(cure.median(), 1)) if not cure.empty else 0.0
    median_death = float(round(death.median(), 1)) if not death.empty else 0.0
    difference = float(round(median_cure - median_death, 1)) if len(death) > 0 else 0.0
    ratio = float(round(median_cure / median_death, 1)) if median_death > 0 else 0.0
    return {
        "median_cure": median_cure,
        "median_death": median_death,
        "difference": difference,
        "ratio": ratio,
        "cure_count": int(len(cure)),
        "death_count": int(len(death)),
    }


def _compute_kde_curves(
    cure: pd.Series, death: pd.Series
) -> tuple[list[float], list[float], list[float]]:
    """Compute KDE curves on a fixed 0-45d grid with Epanechnikov kernel.

    Both curves always have the same length as the grid; empty groups yield
    a zero-filled array, so the frontend can plot a degenerate series.
    """
    grid = np.arange(0.0, KDE_GRID_MAX, KDE_GRID_STEP)
    cure_arr = cure.to_numpy() if not cure.empty else np.array([])
    death_arr = death.to_numpy() if not death.empty else np.array([])
    kde_cure = (
        _epanechnikov_kde(cure_arr, KDE_BANDWIDTH_CURE, grid)
        if cure_arr.size
        else np.zeros_like(grid)
    )
    kde_death = (
        _epanechnikov_kde(death_arr, KDE_BANDWIDTH_DEATH, grid)
        if death_arr.size
        else np.zeros_like(grid)
    )
    return (
        [float(x) for x in grid.tolist()],
        [round(float(y), 2) for y in kde_cure.tolist()],
        [round(float(y), 2) for y in kde_death.tolist()],
    )


@router.get("/hospitalization_duration")
def hospitalization_duration(
    filters: CommonFiltersDep,
) -> dict[str, Any]:
    """Calcula a distribuição de dias de internação separada por cura e óbito, com KDE."""
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    if df.empty:
        return dict(EMPTY_HOSPITALIZATION)

    try:
        closed = _extract_hospitalization_durations(df)
        if closed.empty:
            return dict(EMPTY_HOSPITALIZATION)

        cure_mask = closed["EVOLUCAO"] == 1
        death_mask = outcome_death_mask(closed["EVOLUCAO"])
        cure = closed.loc[cure_mask, "days"].astype(float)
        death = closed.loc[death_mask, "days"].astype(float)

        summary = _summarize_hospitalization(cure, death)
        kde_x, kde_cure, kde_death = _compute_kde_curves(cure, death)

        return {
            "cure": [float(x) for x in cure.tolist()],
            "death": [float(x) for x in death.tolist()],
            "kde_x": kde_x,
            "kde_cure": kde_cure,
            "kde_death": kde_death,
            **summary,
        }
    except Exception:
        logger.exception("Failed to compute hospitalization duration")
        return dict(EMPTY_HOSPITALIZATION)


def _get_last_covid_dose(row: pd.Series) -> str:
    """Cascade COVID vaccine doses priority mapping."""
    if pd.notna(row.get("DOS_RE_BI")):
        return "Bivalente"
    if pd.notna(row.get("DOSE_2REF")):
        return "2º Reforço"
    if pd.notna(row.get("DOSE_REF")):
        return "1º Reforço"
    if pd.notna(row.get("DOSE_2_COV")):
        return "Esquema Completo"
    if pd.notna(row.get("DOSE_1_COV")):
        return "Dose 1"
    if row.get("VACINA_COV") == 2:
        return "Não Vacinado"
    return "Ignorado"


def _normalize_flu_labels(raw_schema: dict[Any, Any]) -> dict[str, int]:
    """Normalize raw Flu labels to human-readable strings and pre-populate with 0."""
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
        label_map.get(str(k), str(k)): int(v) for k, v in raw_schema.items()
    }
    for label in label_map.values():
        if label not in gripe_schema_readable:
            gripe_schema_readable[label] = 0
    return gripe_schema_readable


@router.get("/vaccination_profile")
def vaccination_profile(
    filters: CommonFiltersDep,
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    if df.empty:
        return {}

    raw_gripe = df.apply(classificar_status_gripe, axis=1).value_counts().to_dict()
    gripe_schema_readable = _normalize_flu_labels(raw_gripe)

    covid_schema = df.apply(_get_last_covid_dose, axis=1).value_counts().to_dict()
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
    filters: CommonFiltersDep,
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
    df_filtered = apply_surveillance_filters(
        df_filtered, filters.years, filters.agents, filters.months, filters.days
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
    filters: CommonFiltersDep,
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    return compute_clinical_timing_metrics(df)


@router.get("/vaccine_survival")
def vaccine_survival(
    filters: CommonFiltersDep,
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
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


@router.get("/clinical/comorbidities_treemap")
def comorbidities_treemap(
    filters: CommonFiltersDep,
) -> ComorbiditiesTreemapResponse:
    """Calcula a distribuição de comorbidades com letalidade (CFR) para treemap."""
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
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    res = compute_comorbidities_treemap(df)
    return sanitize_data(res)
