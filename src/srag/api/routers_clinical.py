"""Clinical API routers."""

# ruff: noqa

from typing import Any

import pandas as pd

from fastapi import APIRouter, Query

from srag.api import main as api

router = APIRouter()


@router.get("/clinical_flow")
def clinical_flow(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    """Analisa a jornada clínica completa para o gráfico Sankey com porcentagens."""
    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return {"nodes": [], "links": []}

    df = df.copy()
    df["S_ORIGEM"] = (
        df["NOSOCOMIAL"].map({1: "Infecção Hospitalar", 2: "Comunitária"}).fillna("Origem (Ignorado)")
    )
    df["S_UTI"] = (
        df["UTI"].map({1: "Internado em UTI", 2: "Internado em Enfermaria"}).fillna(
            "Internação (Ignorado)"
        )
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
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> list[float]:
    """Calcula a distribuição de dias de internação (DT_EVOLUCA - DT_INTERNA)."""
    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return []

    try:
        df["DT_INTERNA"] = pd.to_datetime(df["DT_INTERNA"], errors="coerce")
        df["DT_EVOLUCA"] = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
        dur = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days
        return [float(x) for x in dur[(dur >= 0) & (dur <= 90)].dropna()]
    except Exception as e:
        print(f"Erro no cálculo de duração: {e}")
        return []


@router.get("/vaccination_profile")
def vaccination_profile(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    """Analisa o esquema vacinal detalhado de COVID-19 e Influenza com filtros."""
    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return {}

    raw_gripe = df.apply(api.classificar_status_gripe, axis=1).value_counts().to_dict()
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
    gripe_schema_readable: dict[str, int] = {label_map.get(str(k), str(k)): int(v) for k, v in gripe_schema.items()}
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

    return api.sanitize_data({"gripe": gripe_schema_readable, "covid_detailed": covid_schema})


@router.get("/citizen_bootstrap")
def citizen_bootstrap(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    """Bootstrap de dados do cidadão com filtros hierárquicos e multi-seleção."""
    df = api.get_df()
    df_filtered = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)

    valid_profiles = [p for p in (profile or []) if p]
    heatmap_profile = valid_profiles[0] if len(valid_profiles) == 1 else "all"

    return api.sanitize_data(
        {
            "citizen_profiles": api.compute_citizen_profile_tree(df_filtered),
            "citizen_pyramid": api.compute_citizen_pyramid(df_filtered),
            "race_profile": api.compute_race_profile(df_filtered),
            "schooling_profile": api.compute_schooling_profile(df_filtered),
            "symptoms_signature": api.compute_symptoms_signature(df_filtered, heatmap_profile),
            "symptoms_heatmap": api.compute_symptoms_heatmap(df_filtered),
            "risk_factors_full": api.compute_risk_factors_full_profile(df_filtered),
            "maternal_profile": api.compute_maternal_profile(df_filtered),
        }
    )


@router.get("/clinical_timing")
def clinical_timing(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
    years: list[int] | None = Query(None),
    agents: list[str] | None = Query(None),
) -> Any:
    """Métricas de fluxo clínico: tempo sintomas→internação, internação→UTI, adesão ao protocolo antiviral."""
    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    df = api.apply_surveillance_filters(df, years, agents)
    if df.empty:
        return api.compute_clinical_timing_metrics(df)

    return api.compute_clinical_timing_metrics(df)


@router.get("/vaccine_survival")
def vaccine_survival(
    profile: list[str] | None = Query(None),
    race: list[str] | None = Query(None),
    gender: list[str] | None = Query(None),
    zonas: list[str] | None = Query(None),
    bairros: list[str] | None = Query(None),
    unidades: list[str] | None = Query(None),
) -> Any:
    """Calcula as curvas de sobrevivência Kaplan-Meier com filtros."""
    df = api.get_df()
    df = api.apply_global_filters(df, profile, race, gender, zonas, bairros, unidades)
    if df.empty:
        return {"covid": {}, "gripe": {}}

    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df["LAST_COV_DATE"] = df[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

    return api.sanitize_data(
        {
            "covid": api.compute_vaccine_survival(df, "LAST_COV_DATE"),
            "gripe": api.compute_vaccine_survival(df, "DT_UT_DOSE"),
        }
    )
