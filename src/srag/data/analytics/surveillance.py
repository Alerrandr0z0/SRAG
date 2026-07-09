"""Surveillance metrics: Viruses, Testing, Variants, Alerts, and Vaccines."""

from contextlib import suppress
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter

from srag.data.analytics.filters import outcome_death_mask
from srag.utils.epi_weeks import compute_epi_week_columns


def _ensure_epi_week(df: pd.DataFrame) -> pd.DataFrame:
    if "_epi_week" not in df.columns and "DT_SIN_PRI" in df.columns:
        epi = compute_epi_week_columns(df["DT_SIN_PRI"])
        return pd.concat([df, epi], axis=1)
    return df


ETIOLOGIC_AGENT_PRIORITY = [
    "VSR",
    "Influenza",
    "COVID-19",
    "Outros Vírus",
    "Outro Agente",
    "Não Especificada",
]

CAMPANHAS_GRIPE = {
    2019: pd.to_datetime("2019-04-10").date(),
    2020: pd.to_datetime("2020-03-23").date(),
    2021: pd.to_datetime("2021-04-12").date(),
    2022: pd.to_datetime("2022-04-04").date(),
    2023: pd.to_datetime("2023-04-10").date(),
    2024: pd.to_datetime("2024-03-25").date(),
    2025: pd.to_datetime("2025-03-20").date(),
}


def infer_etiologic_agent(df: pd.DataFrame) -> pd.Series:
    """Infer the etiologic agent label used across surveillance views."""
    if df.empty:
        return pd.Series(dtype="object")

    out = df.copy()
    col = out.get("CLASSI_FIN")
    if col is None:
        return pd.Series(["Não Especificada"] * len(out), index=out.index)

    classi = pd.to_numeric(col, errors="coerce")
    agent = classi.map(
        {
            1: "Influenza",
            2: "Outros Vírus",
            3: "Outro Agente",
            4: "Não Especificada",
            5: "COVID-19",
        }
    ).fillna("Não Especificada")

    has_vsr_cols = {"PCR_VSR", "AN_VSR"}.intersection(set(out.columns))
    if has_vsr_cols:
        pcr_vsr = pd.to_numeric(out.get("PCR_VSR"), errors="coerce")  # type: ignore[arg-type]
        an_vsr = pd.to_numeric(out.get("AN_VSR"), errors="coerce")  # type: ignore[arg-type]
        agent.loc[(pcr_vsr == 1) | (an_vsr == 1)] = "VSR"

    return agent.astype(str)


def _is_baby_under_6m(nu_idade: float, tp_idade: float | str | None) -> bool:
    """Determine if patient is under 6 months old."""
    if pd.notna(tp_idade):
        return tp_idade == 1 or (tp_idade == 2 and nu_idade < 6)
    return (1000 <= nu_idade <= 1365) or (2000 <= nu_idade < 2006)


def _is_child_under_8y(nu_idade: float, tp_idade: float | str | None) -> bool:
    """Determine if patient is a child aged 6 months to 8 years."""
    if pd.notna(tp_idade):
        return (tp_idade == 2 and nu_idade >= 6) or (tp_idade == 3 and nu_idade <= 8)
    return (2006 <= nu_idade <= 2011) or (3000 <= nu_idade <= 3008)


def _classify_age_group(row: pd.Series | dict[str, Any]) -> tuple[bool, bool]:
    """Determine if patient is menor_6m or is_crianca_8y."""
    nu_idade = float(row.get("NU_IDADE_N", 0)) if pd.notna(row.get("NU_IDADE_N")) else 0
    tp_idade = row.get("TP_IDADE")
    return _is_baby_under_6m(nu_idade, tp_idade), _is_child_under_8y(nu_idade, tp_idade)


def _resolve_flu_dose_and_vacina(
    row: pd.Series | dict[str, Any],
    is_menor_6m: bool,
    is_crianca_8y: bool,
    vacina: float,
    dt_dose: str | date | pd.Timestamp | float | None,
) -> tuple[str | date | pd.Timestamp | float | None, float, str]:
    """Resolve vacina, dt_dose, and label_prefix based on age group."""
    label_prefix = "protegido"

    if is_menor_6m:
        mae_vac = row.get("MAE_VAC")
        dt_vac_mae = row.get("DT_VAC_MAE")
        with suppress(TypeError, ValueError):
            vacina = float(mae_vac) if pd.notna(mae_vac) else vacina
        dt_dose = dt_vac_mae if pd.notna(dt_vac_mae) else dt_dose
    elif is_crianca_8y:
        if pd.notna(row.get("DT_2_DOSE")):
            dt_dose = row.get("DT_2_DOSE")
            label_prefix = "dose_2"
        elif pd.notna(row.get("DT_1_DOSE")):
            dt_dose = row.get("DT_1_DOSE")
            label_prefix = "dose_1"
        elif pd.notna(row.get("DT_DOSEUNI")):
            dt_dose = row.get("DT_DOSEUNI")
            label_prefix = "dose_unica"

    return dt_dose, vacina, label_prefix


def _parse_date_safe(value: str | date | pd.Timestamp | float | None) -> date | None:
    """Parse safely and return a date or None/NaT."""
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return pd.to_datetime(value, dayfirst=True, format="mixed").date()
        except (TypeError, ValueError):
            return None
    return None


def _evaluate_vax_status_active(
    dt_dose_val: date,
    dt_sintoma_val: date,
    label_prefix: str,
    is_crianca_8y: bool,
) -> str:
    """Evaluate vaccination status logic when both dates are present and valid."""
    if dt_dose_val > dt_sintoma_val:
        return "inconsistencia"

    ano_sintoma = getattr(dt_sintoma_val, "year", None)
    if not ano_sintoma:
        return "ignorado"

    inicio_campanha = CAMPANHAS_GRIPE.get(
        ano_sintoma, pd.to_datetime(f"{ano_sintoma}-04-01").date()
    )

    if dt_dose_val >= inicio_campanha:
        return label_prefix if is_crianca_8y else "protegido"
    return "vencida"


def _parse_vacina_code(value: float | str | None) -> float:
    """Safely parse vaccination status code to float."""
    try:
        return float(value) if pd.notna(value) else np.nan
    except (TypeError, ValueError):
        return np.nan


def _handle_vacina_status(
    vacina: float,
    dt_dose: str | date | pd.Timestamp | float | None,
    dt_sintoma: str | date | pd.Timestamp | float | None,
    label_prefix: str,
    is_crianca_8y: bool,
) -> str:
    """Handle vaccination status resolution for known vacina codes."""
    if vacina == 2:
        if pd.notna(dt_dose):
            return "inconsistencia"
        return "nao_vacinado"

    if vacina == 1:
        if pd.isna(dt_dose):
            return "ignorado"

        dt_dose_val = _parse_date_safe(dt_dose)
        dt_sintoma_val = _parse_date_safe(dt_sintoma)

        if dt_sintoma_val is None or dt_dose_val is None:
            return "ignorado"

        if not hasattr(dt_dose_val, "year") or not hasattr(dt_sintoma_val, "year"):
            return "ignorado"

        return _evaluate_vax_status_active(
            dt_dose_val, dt_sintoma_val, label_prefix, is_crianca_8y
        )

    return "ignorado"


def classificar_status_gripe(row: pd.Series | dict[str, Any]) -> str:
    """Determine epidemiological status for Flu based on vaccination date and symptoms."""
    vacina = _parse_vacina_code(row.get("VACINA"))
    dt_dose: str | date | pd.Timestamp | float | None = row.get("DT_UT_DOSE")
    dt_sintoma: str | date | pd.Timestamp | float | None = row.get("DT_SIN_PRI")

    is_menor_6m, is_crianca_8y = _classify_age_group(row)
    dt_dose, vacina, label_prefix = _resolve_flu_dose_and_vacina(
        row, is_menor_6m, is_crianca_8y, vacina, dt_dose
    )

    if pd.isna(vacina) or vacina == 9:
        return "ignorado"

    return _handle_vacina_status(vacina, dt_dose, dt_sintoma, label_prefix, is_crianca_8y)


def compute_vaccine_survival(df: pd.DataFrame, vax_date_col: str) -> dict[str, list[float]]:
    """Compute Kaplan-Meier survival curve for vaccine protection."""
    if df.empty or vax_date_col not in df.columns:
        return {}

    km_df = pd.DataFrame(
        {
            "last_vax": pd.to_datetime(df[vax_date_col], errors="coerce"),
            "symptoms": pd.to_datetime(df["DT_SIN_PRI"], errors="coerce"),
        }
    ).dropna()

    km_df["months"] = (km_df["symptoms"] - km_df["last_vax"]).dt.days / 30.44
    km_df = km_df[(km_df["months"] >= 0) & (km_df["months"] <= 24)]

    if km_df.empty:
        return {}

    kmf = KaplanMeierFitter()
    kmf.fit(durations=km_df["months"], event_observed=np.ones(len(km_df)))

    surv = kmf.survival_function_.reset_index()
    ci = kmf.confidence_interval_.reset_index()

    return {
        "timeline": surv.iloc[:, 0].tolist(),
        "survival": (surv.iloc[:, 1] * 100).tolist(),
        "ci_upper": (ci.iloc[:, 1] * 100).tolist(),
        "ci_lower": (ci.iloc[:, 2] * 100).tolist(),
    }


def compute_time_series_by_virus(df: pd.DataFrame) -> pd.DataFrame:
    """Group cases by epidemiological week and virus classification for segmented trends."""
    if df.empty:
        return pd.DataFrame(columns=["epi_week", "virus", "count"])

    out = df.copy()
    out = _ensure_epi_week(out)
    out["virus"] = infer_etiologic_agent(out)

    out["epi_week"] = out["_epi_week"]

    ts = out.groupby(["epi_week", "virus"]).size().reset_index(name="count")
    # Exclui 'Não Especificada' para focar apenas em circulação viral confirmada
    ts = ts[ts["virus"] != "Não Especificada"]
    return ts.sort_values(["epi_week", "count"], ascending=[True, False])


def compute_alert_thresholds(df: pd.DataFrame) -> dict[str, int]:
    """Calculate historical alert thresholds (percentiles) for Mossoró."""
    if df.empty:
        return {"medium": 0, "high": 0, "very_high": 0}

    out = df.copy()
    out = _ensure_epi_week(out)
    out["epi_week"] = out["_epi_week"]

    weekly_volumes = out.groupby("epi_week").size()

    if len(weekly_volumes) < 4:
        return {"medium": 10, "high": 20, "very_high": 30}

    thresholds = {
        "medium": int(np.percentile(weekly_volumes, 75)),
        "high": int(np.percentile(weekly_volumes, 90)),
        "very_high": int(np.percentile(weekly_volumes, 95)),
    }

    if thresholds["high"] <= thresholds["medium"]:
        thresholds["high"] = thresholds["medium"] + 5
    if thresholds["very_high"] <= thresholds["high"]:
        thresholds["very_high"] = thresholds["high"] + 5

    return thresholds


def compute_notification_delay_series(df: pd.DataFrame) -> list[dict[Any, Any]]:
    """Calculate the timeline of delay between symptoms onset and notification."""
    if df.empty:
        return []

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out["DT_NOTIFIC"] = pd.to_datetime(out["DT_NOTIFIC"], errors="coerce")

    valid = out.dropna(subset=["DT_SIN_PRI", "DT_NOTIFIC"])
    valid = valid[valid["DT_NOTIFIC"] >= valid["DT_SIN_PRI"]]

    if valid.empty:
        return []

    valid["delay"] = (valid["DT_NOTIFIC"] - valid["DT_SIN_PRI"]).dt.days
    valid = valid[valid["delay"] <= 60]

    valid["epi_week"] = valid["_epi_week"]

    ts = (
        valid.groupby("epi_week")
        .agg(median_delay=("delay", "median"), record_count=("delay", "size"))
        .reset_index()
    )
    return ts.sort_values("epi_week").to_dict(orient="records")


def compute_positivity_trend(df: pd.DataFrame) -> list[dict[Any, Any]]:
    """Calculate weekly tested cases and positivity rate."""
    if df.empty:
        return []

    out = df.copy()
    pcr_res = pd.to_numeric(out["PCR_RESUL"], errors="coerce")
    an_res = pd.to_numeric(out["RES_AN"], errors="coerce")

    if "AMOSTRA" not in out.columns:
        out["is_tested"] = True
    else:
        out["is_tested"] = pd.to_numeric(out["AMOSTRA"], errors="coerce") == 1

    out["is_positive"] = (pcr_res == 1) | (an_res == 1)

    out = _ensure_epi_week(out)
    out["epi_week"] = out["_epi_week"]

    grouped = (
        out.groupby("epi_week")
        .agg(tested=("is_tested", "sum"), positive=("is_positive", "sum"))
        .reset_index()
    )

    # Divisão segura
    def calc_rate(row: pd.Series) -> float:
        if row["tested"] <= 0:
            return 0.0
        return round((row["positive"] / row["tested"] * 100), 1)

    grouped["positivity_rate"] = grouped.apply(calc_rate, axis=1)
    return grouped.sort_values("epi_week").to_dict(orient="records")


def compute_influenza_subtypes(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Comprehensive distribution of Influenza subtypes and lineages."""
    if df.empty:
        return []

    flu = df[df["CLASSI_FIN"] == 1].copy()
    if flu.empty:
        return []

    results = []

    flu_a_map = {
        1: "A/H1N1 pdm09",
        2: "A/H3N2",
        3: "A (Não subtipado)",
        4: "A (Não subtipável)",
        6: "A (Outro Subtipo)",
    }

    col_a = flu.get("PCR_FLUASU")
    if col_a is not None:
        flu_a_counts = pd.to_numeric(col_a, errors="coerce").map(flu_a_map).value_counts()
        for label, count in flu_a_counts.items():
            results.append({"label": label, "count": int(count)})

    flu_b_map = {1: "B (Victoria)", 2: "B (Yamagatha)", 5: "B (Outra Linhagem)"}

    col_b = flu.get("PCR_FLUBLI")
    if col_b is not None:
        flu_b_counts = pd.to_numeric(col_b, errors="coerce").map(flu_b_map).value_counts()
        for label, count in flu_b_counts.items():
            results.append({"label": label, "count": int(count)})

    results.sort(key=lambda x: x["count"], reverse=True)
    return results


def compute_antiviral_usage(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate adherence to antiviral treatment protocol."""
    if df.empty:
        return {"adherence_rate": 0, "total_indicated": 0, "treated": 0}

    flu_cases = df[df["CLASSI_FIN"] == 1]
    if flu_cases.empty:
        flu_cases = df

    treated = (pd.to_numeric(flu_cases["ANTIVIRAL"], errors="coerce") == 1).sum()
    total = len(flu_cases)

    return {
        "adherence_rate": round((treated / total * 100), 1) if total > 0 else 0,
        "total_indicated": total,
        "treated": int(treated),
    }


def compute_closure_criteria(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Distribution of closure criteria (Lab vs Clinical)."""
    if df.empty:
        return []

    criteria_map = {
        1: "Laboratorial",
        2: "Vínculo Epidemiológico",
        3: "Clínico / Imagem",
        4: "Óbito",
    }

    counts = (
        pd.to_numeric(df["CRITERIO"], errors="coerce")
        .map(criteria_map)
        .fillna("Ignorado/Em Aberto")
        .value_counts()
    )
    return [{"label": k, "count": int(v)} for k, v in counts.items()]


def compute_time_series(df: pd.DataFrame) -> pd.DataFrame:
    """Group cases by epidemiological week for trend analysis."""
    if df.empty:
        return pd.DataFrame(columns=["epi_week", "total"])

    out = df.copy()
    out = _ensure_epi_week(out)
    out["epi_week"] = out["_epi_week"]

    ts = out.groupby("epi_week").size().reset_index(name="total")
    return ts.sort_values("epi_week")


def compute_virus_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Group cases by final classification (Influenza, COVID, etc.)."""
    if df.empty:
        return pd.DataFrame()

    out = df.copy()
    out["virus"] = infer_etiologic_agent(out)

    result = out.groupby("virus").size().reset_index(name="count")
    priority = {label: idx for idx, label in enumerate(ETIOLOGIC_AGENT_PRIORITY)}
    result["_prio"] = result["virus"].map(priority).fillna(99)
    result = result.sort_values(["_prio", "count"], ascending=[True, False]).drop(
        columns=["_prio"]
    )
    return result.reset_index(drop=True)


def compute_virus_detailed_distribution(
    df: pd.DataFrame, detail_level: str = "detailed"
) -> pd.DataFrame:
    """Build detailed viral profile from laboratory fields when available."""
    if df.empty:
        return pd.DataFrame(columns=["virus", "count"])

    out = df.copy()

    if detail_level == "influenza_detailed":
        # Specific focus on Influenza subtypes
        flu = out[pd.to_numeric(out["CLASSI_FIN"], errors="coerce") == 1].copy()
        if flu.empty:
            return pd.DataFrame([{"virus": "Nenhum Influenza detectado", "count": 0}])

        # Map Influenza A subtypes
        a_map = {1: "A/H1N1 pdm09", 2: "A/H3N2", 3: "A (Não subtipado)", 4: "A (Não subtipável)"}
        flu_a = flu[pd.to_numeric(flu["TP_FLU_PCR"], errors="coerce") == 1].copy()
        flu_a["virus"] = (
            pd.to_numeric(flu_a["PCR_FLUASU"], errors="coerce").map(a_map).fillna("Influenza A")
        )

        # Map Influenza B lineages
        b_map = {1: "B/Victoria", 2: "B/Yamagata"}
        flu_b = flu[pd.to_numeric(flu["TP_FLU_PCR"], errors="coerce") == 2].copy()
        flu_b["virus"] = (
            pd.to_numeric(flu_b["PCR_FLUBLI"], errors="coerce").map(b_map).fillna("Influenza B")
        )

        # Merge results
        remaining = flu[~flu.index.isin(flu_a.index) & ~flu.index.isin(flu_b.index)].copy()
        remaining["virus"] = "Influenza (Não tipada)"

        final = pd.concat([flu_a, flu_b, remaining])
        return (
            final.groupby("virus")
            .size()
            .reset_index(name="count")
            .sort_values("count", ascending=False)
        )

    if detail_level == "covid_detailed":
        # Specific focus on COVID variants (even if empty in current base)
        covid = out[pd.to_numeric(out["CLASSI_FIN"], errors="coerce") == 5].copy()
        if covid.empty:
            return pd.DataFrame([{"virus": "Nenhum COVID-19 detectado", "count": 0}])

        variant_map = {
            1: "Ômicron",
            2: "Delta",
            3: "Alfa",
            4: "Beta",
            5: "Gama",
            6: "Recombinante",
            7: "Outra",
        }
        covid["virus"] = (
            pd.to_numeric(covid["VG_OMS"], errors="coerce")
            .map(variant_map)
            .fillna("Não sequenciado")
        )
        return (
            covid.groupby("virus")
            .size()
            .reset_index(name="count")
            .sort_values("count", ascending=False)
        )

    # Standard "detailed" logic
    out["virus"] = "Em investigacao"

    pcr_vsr = pd.to_numeric(out.get("PCR_VSR"), errors="coerce")  # type: ignore[arg-type]
    an_vsr = pd.to_numeric(out.get("AN_VSR"), errors="coerce")  # type: ignore[arg-type]
    out.loc[(pcr_vsr == 1) | (an_vsr == 1), "virus"] = "VSR"

    pcr_sars2 = pd.to_numeric(out.get("PCR_SARS2"), errors="coerce")  # type: ignore[arg-type]
    an_sars2 = pd.to_numeric(out.get("AN_SARS2"), errors="coerce")  # type: ignore[arg-type]
    out.loc[(pcr_sars2 == 1) | (an_sars2 == 1), "virus"] = "SARS-CoV-2"

    if "TP_FLU_PCR" in out.columns or "TP_FLU_AN" in out.columns:
        tp_flu_pcr = pd.to_numeric(out.get("TP_FLU_PCR"), errors="coerce")  # type: ignore[arg-type]
        tp_flu_an = pd.to_numeric(out.get("TP_FLU_AN"), errors="coerce")  # type: ignore[arg-type]
        out.loc[(tp_flu_pcr == 2) | (tp_flu_an == 2), "virus"] = "Influenza B"
        out.loc[(tp_flu_pcr == 1) | (tp_flu_an == 1), "virus"] = "Influenza A"

    classi = pd.to_numeric(out["CLASSI_FIN"], errors="coerce")
    out.loc[(out["virus"] == "Em investigacao") & (classi == 1), "virus"] = (
        "Influenza (nao tipada)"
    )
    out.loc[(out["virus"] == "Em investigacao") & (classi == 2), "virus"] = "Outros virus"
    out.loc[(out["virus"] == "Em investigacao") & (classi == 3), "virus"] = "Outro agente"
    out.loc[(out["virus"] == "Em investigacao") & (classi == 5), "virus"] = "SARS-CoV-2"
    out.loc[(out["virus"] == "Em investigacao") & (classi == 4), "virus"] = "Nao especificada"

    grouped = out.groupby("virus").size().reset_index(name="count")
    priority = {
        "VSR": 0,
        "SARS-CoV-2": 1,
        "Influenza A": 2,
        "Influenza B": 3,
        "Influenza (nao tipada)": 4,
        "Outros virus": 5,
        "Outro agente": 6,
        "Nao especificada": 7,
        "Em investigacao": 8,
    }
    grouped["_prio"] = grouped["virus"].map(priority).fillna(99)
    grouped = grouped.sort_values(["_prio", "count"], ascending=[True, False]).drop(
        columns=["_prio"]
    )
    return grouped.reset_index(drop=True)


def compute_genomic_variants(df: pd.DataFrame) -> dict[str, object]:
    """Calculate variant dominance by epidemiological week for genomic surveillance."""
    if df.empty or "VG_OMS" not in df.columns:
        return {"weeks": [], "variants": {}}

    out = df.copy()

    col_vg = out.get("VG_OMS")
    if col_vg is None:
        return {"weeks": [], "variants": {}}

    out["VG_OMS"] = pd.to_numeric(col_vg, errors="coerce")
    genomic = out[out["VG_OMS"].notna()].copy()

    if genomic.empty:
        return {"weeks": [], "variants": {}}

    variant_map = {
        1: "Ômicron",
        2: "Delta",
        3: "Alfa",
        4: "Beta",
        5: "Gama",
        6: "Recombinante",
        7: "Outra",
    }

    genomic["variant_name"] = genomic["VG_OMS"].map(variant_map).fillna("Desconhecida")

    genomic["DT_SIN_PRI"] = pd.to_datetime(genomic["DT_SIN_PRI"], errors="coerce")
    genomic = genomic.dropna(subset=["DT_SIN_PRI"])
    if genomic.empty:
        return {"weeks": [], "variants": {}}

    genomic = _ensure_epi_week(genomic)
    genomic["epi_week"] = genomic["_epi_week"]

    grouped = genomic.groupby(["epi_week", "variant_name"]).size().unstack(fill_value=0)

    row_totals = grouped.sum(axis=1)
    row_totals = row_totals.replace(0, 1)

    percentage_df = (grouped.div(row_totals, axis=0) * 100).round(1)

    weeks = percentage_df.index.tolist()
    variants_dict = {variant: percentage_df[variant].tolist() for variant in percentage_df.columns}

    return {"weeks": weeks, "variants": variants_dict}


def compute_lethality_heatmap(df: pd.DataFrame) -> dict[str, Any]:
    """Cross-tabulate Case Fatality Rate (CFR) by agent and age band."""
    from srag.data.analytics.demographics import categorize_age
    from srag.data.analytics.filters import _age_years

    if df.empty:
        return {"agents": [], "age_bands": [], "matrix": []}

    out = df.copy()
    out["agent"] = infer_etiologic_agent(out)
    out["age_val"] = _age_years(out)
    out["age_band"] = out["age_val"].apply(categorize_age)

    # Define death (EVOLUCAO == 2)
    out["is_death"] = pd.to_numeric(out["EVOLUCAO"], errors="coerce") == 2

    agents = ["VSR", "Influenza", "COVID-19", "Outros Vírus", "Outro Agente", "Não Especificada"]
    age_bands = [
        "0-1 ano",
        "2-4 anos",
        "5-9 anos",
        "10-14 anos",
        "15-19 anos",
        "20-29 anos",
        "30-39 anos",
        "40-49 anos",
        "50-59 anos",
        "60-69 anos",
        "70-79 anos",
        "80+ anos",
    ]

    matrix = []
    for agent in agents:
        row = []
        for band in age_bands:
            cell_df = out[(out["agent"] == agent) & (out["age_band"] == band)]
            if cell_df.empty:
                row.append(0.0)
                continue

            # CFR: deaths / closed cases (Cure or Death) in cell
            closed_df = cell_df[cell_df["EVOLUCAO"].isin([1, 2])]
            deaths = (closed_df["EVOLUCAO"] == 2).sum()
            total_closed = len(closed_df)

            if total_closed == 0:
                row.append(0.0)
                continue

            cfr = round((deaths / total_closed) * 100, 1)
            row.append(cfr)
        matrix.append(row)

    return {"agents": agents, "age_bands": age_bands, "matrix": matrix}


def compute_codetection_matrix(df: pd.DataFrame) -> dict[str, Any]:
    """Cross-tabulate co-occurrence of different respiratory viruses."""
    if df.empty:
        return {"labels": [], "matrix": []}

    # Focus on cases where co-detection was flagged
    # Filter only cases where CO_DETEC == 1
    out = df[pd.to_numeric(df["CO_DETEC"], errors="coerce") == 1].copy()

    virus_flags = [
        ("PCR_SARS2", "SARS-CoV-2"),
        ("PCR_VSR", "VSR"),
        ("POS_PCRFLU", "Influenza"),
        ("PCR_RINO", "Rinovírus"),
        ("PCR_METAP", "Metapneumovírus"),
        ("PCR_ADENO", "Adenovírus"),
    ]

    labels = [f[1] for f in virus_flags]
    if out.empty:
        return {"labels": labels, "matrix": []}

    # Pre-calculate boolean masks
    flags: dict[str, pd.Series] = {}
    for col, _ in virus_flags:
        if col in out.columns:
            s = pd.to_numeric(out[col], errors="coerce")
            flags[col] = s == 1
        else:
            flags[col] = pd.Series(False, index=out.index)

    matrix: list[list[int]] = []
    for row_col, _ in virus_flags:
        row_vals: list[int] = []
        row_flag = flags[row_col]
        for col_col, _ in virus_flags:
            if row_col == col_col:
                row_vals.append(0)  # Hide diagonal (identity)
                continue
            col_flag = flags[col_col]
            both = int((row_flag & col_flag).sum())
            row_vals.append(both)
        matrix.append(row_vals)

    return {"labels": labels, "matrix": matrix}


def compute_imaging_profile(df: pd.DataFrame) -> dict[str, object]:
    """Comparison of findings between X-Ray and CT scans."""
    if df.empty:
        return {"raiox": [], "tomo": []}

    out = df.copy()

    raiox_map = {1: "Normal", 2: "Infiltrado", 3: "Consolidação", 4: "Misto", 5: "Outro"}
    col_rx = out.get("RAIOX_RES")
    raiox_data = []
    if col_rx is not None:
        raiox_counts = pd.to_numeric(col_rx, errors="coerce").map(raiox_map).value_counts()
        raiox_data = [{"label": k, "count": int(v)} for k, v in raiox_counts.items()]

    tomo_map = {1: "Típico", 2: "Indeterminado", 3: "Atípico", 4: "Negativo", 5: "Outro"}
    col_tomo = out.get("TOMO_RES")
    tomo_data = []
    if col_tomo is not None:
        tomo_counts = pd.to_numeric(col_tomo, errors="coerce").map(tomo_map).value_counts()
        tomo_data = [{"label": k, "count": int(v)} for k, v in tomo_counts.items()]

    return {"raiox": raiox_data, "tomo": tomo_data}


def compute_serology_profile(df: pd.DataFrame) -> dict[str, object]:
    """Distribution of serology test types and results for SARS-CoV-2."""
    if df.empty:
        return {"types": [], "igg": [], "igm": []}

    out = df.copy()

    sor_map = {1: "Rápido", 2: "Elisa", 3: "Quimio", 4: "Outro"}
    col_sor = out.get("TP_SOR")
    if col_sor is not None:
        series_sor = pd.Series(col_sor) if not isinstance(col_sor, pd.Series) else col_sor
        type_counts = pd.to_numeric(series_sor, errors="coerce").map(sor_map).value_counts()
        types_data = [{"label": str(k), "count": int(v)} for k, v in type_counts.items()]
    else:
        types_data = []

    res_map = {1: "Reagente", 2: "Não Reagente", 3: "Inconclusivo"}
    col_igg = out.get("RES_IGG")
    if col_igg is not None:
        series_igg = pd.Series(col_igg) if not isinstance(col_igg, pd.Series) else col_igg
        igg_counts = pd.to_numeric(series_igg, errors="coerce").map(res_map).value_counts()
        igg_data = [{"label": str(k), "count": int(v)} for k, v in igg_counts.items()]
    else:
        igg_data = []

    col_igm = out.get("RES_IGM")
    if col_igm is not None:
        series_igm = pd.Series(col_igm) if not isinstance(col_igm, pd.Series) else col_igm
        igm_counts = pd.to_numeric(series_igm, errors="coerce").map(res_map).value_counts()
        igm_data = [{"label": str(k), "count": int(v)} for k, v in igm_counts.items()]
    else:
        igm_data = []

    return {"types": types_data, "igg": igg_data, "igm": igm_data}


def _count_mapped_column(
    col: pd.Series | None,
    label_map: dict[int, str],
) -> dict[str, int]:
    """Count occurrences of mapped labels in a single column."""
    counts: dict[str, int] = {}
    if col is None:
        return counts
    series = col if isinstance(col, pd.Series) else pd.Series(col)
    mapped = pd.to_numeric(series, errors="coerce").map(label_map)
    for label, count in mapped.value_counts().items():
        counts[str(label)] = int(count)
    return counts


def compute_antiviral_types(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Specific types of antiviral drugs used (Oseltamivir, etc.)."""
    flu_map = {1: "Oseltamivir", 2: "Zanamivir", 3: "Outro (Gripe)"}
    cov_map = {1: "Paxlovid", 2: "Lagevrio", 3: "Olumiant", 4: "Outro (COVID)"}
    all_labels = list(flu_map.values()) + list(cov_map.values())

    if df.empty:
        return []

    counts = {label: 0 for label in all_labels}

    tp_col = df.get("TP_ANTIVIR")
    if isinstance(tp_col, pd.Series):
        counts.update(_count_mapped_column(tp_col, flu_map))

    trat_col = df.get("TIPO_TRAT")
    if isinstance(trat_col, pd.Series):
        counts.update(_count_mapped_column(trat_col, cov_map))

    # Extract specified others details
    out_flu_specs: list[str] = []
    if "OUT_ANTIV" in df.columns and tp_col is not None:
        tp_num = pd.to_numeric(tp_col, errors="coerce")
        out_antiv_clean = df["OUT_ANTIV"].fillna("").astype(str).str.strip()
        mask = (tp_num == 3) & (out_antiv_clean != "")
        out_flu_specs = sorted(df.loc[mask, "OUT_ANTIV"].dropna().unique().tolist())

    out_cov_specs: list[str] = []
    if "OUT_TRAT" in df.columns and trat_col is not None:
        trat_num = pd.to_numeric(trat_col, errors="coerce")
        out_trat_clean = df["OUT_TRAT"].fillna("").astype(str).str.strip()
        mask = (trat_num == 4) & (out_trat_clean != "")
        out_cov_specs = sorted(df.loc[mask, "OUT_TRAT"].dropna().unique().tolist())

    results = []
    for label, count in counts.items():
        if count == 0:
            continue
        item: dict[str, Any] = {"label": label, "count": count}
        if label == "Outro (Gripe)" and out_flu_specs:
            item["specifications"] = out_flu_specs
        elif label == "Outro (COVID)" and out_cov_specs:
            item["specifications"] = out_cov_specs
        results.append(item)

    results.sort(key=lambda x: x["count"], reverse=True)
    return results


def compute_laboratory_network_summary(df: pd.DataFrame) -> dict[str, object]:
    """Summarize testing network performance by laboratory."""
    if df.empty:
        return {
            "labs": [],
            "overall": {"tested_cases": 0, "positive_rate": 0.0, "median_turnaround_days": 0.0},
        }

    out = df.copy()
    pcr_res = pd.to_numeric(out["PCR_RESUL"], errors="coerce")
    an_res = pd.to_numeric(out["RES_AN"], errors="coerce")

    tested_mask = pcr_res.isin([1, 2, 3, 5]) | an_res.isin([1, 2, 3, 5])
    tested = out[tested_mask].copy()
    if tested.empty:
        return {
            "labs": [],
            "overall": {
                "tested_cases": 0,
                "positive_rate": 0.0,
                "median_turnaround_days": 0.0,
                "avg_turnaround_days": 0.0,
                "turnaround_p90": 0.0,
                "turnaround_p99": 0.0,
                "turnaround_boxplot": [0, 0, 0, 0, 0],
                "turnaround_count": 0,
            },
        }

    lab_id = (
        tested.get("CO_LAB_AN", pd.Series(index=tested.index)).fillna("").astype(str).str.strip()
    )
    lab_name = (
        tested.get("LAB_AN", pd.Series(index=tested.index)).fillna("").astype(str).str.strip()
    )
    tested["lab_ref"] = lab_name.where(lab_name != "", lab_id)
    tested["lab_ref"] = tested["lab_ref"].replace("", "NAO INFORMADO")

    tested["is_positive"] = (pd.to_numeric(tested["PCR_RESUL"], errors="coerce") == 1) | (
        pd.to_numeric(tested["RES_AN"], errors="coerce") == 1
    )

    grouped = tested.groupby("lab_ref", as_index=False).agg(
        tested_cases=("lab_ref", "size"),
        positive_count=("is_positive", "sum"),
    )
    grouped["positive_rate"] = ((grouped["positive_count"] / grouped["tested_cases"]) * 100).round(
        2
    )
    grouped = grouped.sort_values("tested_cases", ascending=False)

    dt_coleta = pd.to_datetime(tested["DT_COLETA"], errors="coerce")
    dt_pcr = pd.to_datetime(tested["DT_PCR"], errors="coerce")
    dt_res_an = pd.to_datetime(tested["DT_RES_AN"], errors="coerce")

    turnaround = pd.concat(
        [(dt_pcr - dt_coleta).dt.days, (dt_res_an - dt_coleta).dt.days], ignore_index=True
    )
    turnaround = pd.to_numeric(turnaround, errors="coerce")
    turnaround = turnaround[(turnaround >= 0) & (turnaround <= 30)]
    median_turnaround = float(round(turnaround.median(), 1)) if not turnaround.empty else 0.0
    mean_turnaround = float(round(turnaround.mean(), 1)) if not turnaround.empty else 0.0
    p90_turnaround = float(round(turnaround.quantile(0.9), 1)) if not turnaround.empty else 0.0
    p99_turnaround = float(round(turnaround.quantile(0.99), 1)) if not turnaround.empty else 0.0
    turnaround_boxplot = (
        [
            float(round(turnaround.min(), 1)),
            float(round(turnaround.quantile(0.25), 1)),
            median_turnaround,
            float(round(turnaround.quantile(0.75), 1)),
            float(round(turnaround.max(), 1)),
        ]
        if not turnaround.empty
        else [0, 0, 0, 0, 0]
    )
    turnaround_count = int(turnaround.count())

    codetec_count = int((pd.to_numeric(out["CO_DETEC"], errors="coerce") == 1).sum())

    overall_positive = float(round((tested["is_positive"].mean() * 100), 2))

    # Cálculo de Reinfecções (Campo 96: VG_REINF == 1)
    reinfection_ts = []
    reinfection_total = 0
    if "VG_REINF" in out.columns:
        reinfection_total = int((pd.to_numeric(out["VG_REINF"], errors="coerce") == 1).sum())
        reinf_df = out[pd.to_numeric(out["VG_REINF"], errors="coerce") == 1].copy()
        if not reinf_df.empty:
            reinf_df = _ensure_epi_week(reinf_df)
            reinf_df["epi_week"] = reinf_df["_epi_week"]
            reinfection_ts = (
                reinf_df.groupby("epi_week")
                .size()
                .reset_index(name="count")
                .to_dict(orient="records")
            )

    return {
        "labs": grouped.head(15).to_dict(orient="records"),
        "overall": {
            "tested_cases": len(tested),
            "positive_rate": overall_positive,
            "median_turnaround_days": median_turnaround,
            "avg_turnaround_days": mean_turnaround,
            "turnaround_p90": p90_turnaround,
            "turnaround_p99": p99_turnaround,
            "turnaround_boxplot": turnaround_boxplot,
            "turnaround_count": turnaround_count,
            "codetection_cases": codetec_count,
            "reinfection_total": reinfection_total,
        },
        "reinfection_trend": reinfection_ts,
    }


def compute_vaccine_manufacturer_distribution(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Aggregate distribution of vaccine manufacturers from the last recorded dose."""
    if df.empty:
        return []

    # Fields to check for manufacturer (priority: latest dose)
    fab_cols = ["FAB_RE_BI", "FAB_ADIC", "FAB_COVRF2", "FAB_COVRF", "FAB_COV2", "FAB_COV1"]

    # Extract last non-null manufacturer per row
    def get_last_fab(row: pd.Series) -> str | None:
        for col in fab_cols:
            val = row.get(col)
            if pd.notna(val) and str(val).strip() != "":
                return str(val).strip().upper()
        return "NÃO INFORMADO"

    out = df.copy()
    out["last_manufacturer"] = out.apply(get_last_fab, axis=1)

    # Basic cleaning/mapping for common variants
    mapping = {
        "ASTRAZENECA": "AstraZeneca/Oxford",
        "FIOCRUZ": "AstraZeneca/Oxford",
        "CHADOX1": "AstraZeneca/Oxford",
        "PFIZER": "Pfizer/BioNTech",
        "BIONTECH": "Pfizer/BioNTech",
        "BUTANTAN": "Butantan/Sinovac",
        "CORONAVAC": "Butantan/Sinovac",
        "SINOVAC": "Butantan/Sinovac",
        "JANSSEN": "Janssen (Johnson & Johnson)",
        "JOHNSON": "Janssen (Johnson & Johnson)",
    }

    def normalize_fab(name: str | None) -> str:
        if not name or name == "NÃO INFORMADO":
            return "NÃO INFORMADO"
        for key, target in mapping.items():
            if key in name:
                return target
        return name.title()

    out["manufacturer_clean"] = out["last_manufacturer"].apply(normalize_fab)

    counts = out[out["manufacturer_clean"] != "NÃO INFORMADO"]["manufacturer_clean"].value_counts()
    return [{"label": str(k), "count": int(v)} for k, v in counts.items()]


def compute_mortality_by_treatment_agent(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate death counts by ventilatory support and etiologic agent."""
    if df.empty:
        return pd.DataFrame(columns=["treatment", "agent", "deaths"])

    out = df.copy()
    out["agent"] = infer_etiologic_agent(out)

    treatment_map = {1: "Invasivo", 2: "Não Invasivo", 3: "Sem Suporte", 9: "Ignorado"}

    col_suport = out.get("SUPORT_VEN")
    if col_suport is not None:
        out["treatment"] = (
            pd.to_numeric(col_suport, errors="coerce").map(treatment_map).fillna("Ignorado")
        )
    else:
        out["treatment"] = "Não informado"

    out = out[outcome_death_mask(out["EVOLUCAO"])]

    if out.empty:
        return pd.DataFrame(columns=["treatment", "agent", "deaths"])

    grouped = out.groupby(["treatment", "agent"]).size().reset_index(name="deaths")

    grouped["_prio"] = (
        grouped["agent"]
        .map({label: idx for idx, label in enumerate(ETIOLOGIC_AGENT_PRIORITY)})
        .fillna(99)
    )

    grouped = grouped.sort_values(
        ["treatment", "_prio", "deaths"], ascending=[True, True, False]
    ).drop(columns=["_prio"])
    return grouped.reset_index(drop=True)


def compute_vaccination_and_treatment_profile(df: pd.DataFrame) -> dict[str, float | int]:
    """Summarize COVID/Influenza vaccination and antiviral usage."""
    if df.empty:
        return {
            "covid_vaccinated_count": 0,
            "flu_vaccinated_count": 0,
            "influenza_antiviral_count": 0,
            "covid_treatment_count": 0,
        }

    covid_vac = pd.to_numeric(df["VACINA_COV"], errors="coerce")
    flu_vac = pd.to_numeric(df["VACINA"], errors="coerce")
    antivir = pd.to_numeric(df["ANTIVIRAL"], errors="coerce")
    trat_cov = pd.to_numeric(df["TRAT_COV"], errors="coerce")

    return {
        "covid_vaccinated_count": int((covid_vac == 1).sum()),
        "flu_vaccinated_count": int((flu_vac == 1).sum()),
        "influenza_antiviral_count": int((antivir == 1).sum()),
        "covid_treatment_count": int((trat_cov == 1).sum()),
    }


def _get_covid_vaccine_profile(row: pd.Series | dict[str, Any]) -> str:
    """Classify COVID vaccine profile for a row."""
    if pd.notna(row.get("DOS_RE_BI")):
        return "bivalente"
    if pd.notna(row.get("DOSE_2REF")):
        return "reforco_2"
    if pd.notna(row.get("DOSE_REF")):
        return "reforco_1"
    if pd.notna(row.get("DOSE_2_COV")):
        return "completo"
    if pd.notna(row.get("DOSE_1_COV")):
        return "dose_1"
    if row.get("VACINA_COV") == 2:
        return "nao_vacinado"
    return "ignorado"


def _compute_interval_stats(
    series: pd.Series, default_val: float | None = 0.0
) -> tuple[float | None, float | None, float | None]:
    """Compute median, P25, and P75 of a series, rounded to 1 decimal place."""
    if series.empty:
        return default_val, default_val, default_val
    med = round(float(series.median()), 1)
    p25 = round(float(series.quantile(0.25)), 1)
    p75 = round(float(series.quantile(0.75)), 1)
    return med, p25, p75


def _compute_dose_series(subset: pd.DataFrame, virus: str, dt_symptom: pd.Series) -> pd.Series:
    """Calculate the difference in days between dose and symptoms onset.

    Keeping only values in [-180, 180].
    """
    if virus == "covid":
        dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
        available_cols = [c for c in dose_cols if c in subset.columns]
        if available_cols:
            dt_dose = subset[available_cols].bfill(axis=1).iloc[:, 0]
            dt_dose = pd.to_datetime(dt_dose, errors="coerce")
        else:
            dt_dose = pd.Series(pd.NaT, index=subset.index)
    else:
        if "DT_UT_DOSE" in subset.columns:
            dt_dose = pd.to_datetime(subset["DT_UT_DOSE"], errors="coerce")
        else:
            dt_dose = pd.Series(pd.NaT, index=subset.index)

    days_dose_symp = (dt_dose - dt_symptom).dt.days
    return days_dose_symp[(days_dose_symp >= -180) & (days_dose_symp <= 180)].dropna()


def _filter_days_range(
    col_a: pd.Series, col_b: pd.Series, min_val: int = 0, max_val: int = 180
) -> pd.Series:
    """Calculate difference in days (col_a - col_b) and filter within [min_val, max_val]."""
    days = (col_a - col_b).dt.days
    return days[(days >= min_val) & (days <= max_val)].dropna()


def _compute_profile_metrics(
    subset: pd.DataFrame,
    virus: str,
    perfil: str,
    friendly_names: dict[str, str],
) -> dict[str, Any]:
    """Compute all timeline metrics for a specific vaccine profile subset."""
    count = len(subset)

    death_mask = outcome_death_mask(subset["EVOLUCAO"])
    cure_mask = subset["EVOLUCAO"] == 1

    taxa_obito = round(death_mask.sum() / count, 4) if count > 0 else 0.0
    taxa_cura = round(cure_mask.sum() / count, 4) if count > 0 else 0.0

    dt_symptom = subset["DT_SIN_PRI"]
    dt_hosp = subset["DT_INTERNA"]
    dt_outcome = subset["DT_EVOLUCA"]

    valid_dose = _compute_dose_series(subset, virus, dt_symptom)
    valid_intern = _filter_days_range(dt_hosp, dt_symptom, 0, 180)
    valid_out = _filter_days_range(dt_outcome, dt_hosp, 0, 180)

    mediana_dose_sintoma, dose_p25, dose_p75 = _compute_interval_stats(
        valid_dose, default_val=None
    )
    mediana_sintoma_internacao, intern_p25, intern_p75 = _compute_interval_stats(
        valid_intern, default_val=0.0
    )
    mediana_internacao_desfecho, desf_p25, desf_p75 = _compute_interval_stats(
        valid_out, default_val=0.0
    )

    uti_s = pd.to_numeric(subset["UTI"], errors="coerce")
    uti_pct = round((uti_s == 1).mean() * 100, 1) if not subset.empty else 0.0
    severity_score = round((taxa_obito * 0.6) + (taxa_cura * 0.4), 4)

    return {
        "perfil": friendly_names.get(perfil, perfil),
        "status_key": perfil,
        "gripe_status": perfil if virus == "gripe" else None,
        "mediana_dose_sintoma": mediana_dose_sintoma,
        "doseP25": dose_p25,
        "doseP75": dose_p75,
        "mediana_sintoma_internacao": mediana_sintoma_internacao,
        "internP25": intern_p25,
        "internP75": intern_p75,
        "mediana_internacao_desfecho": mediana_internacao_desfecho,
        "desfP25": desf_p25,
        "desfP75": desf_p75,
        "taxa_cura": taxa_cura,
        "taxa_obito": taxa_obito,
        "uti_pct": uti_pct,
        "severity_score": severity_score,
        "n": count,
        "count": count,
    }


def compute_aggregated_timeline(df: pd.DataFrame, virus: str = "covid") -> list[dict[str, Any]]:
    """Compute aggregated clinical timeline by vaccine profile."""
    if df.empty:
        return []

    out = df.copy()
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out["DT_INTERNA"] = pd.to_datetime(out["DT_INTERNA"], errors="coerce")
    out["DT_EVOLUCA"] = pd.to_datetime(out["DT_EVOLUCA"], errors="coerce")

    def classify_profile(row: pd.Series) -> str:
        if virus == "gripe":
            return classificar_status_gripe(row)
        return _get_covid_vaccine_profile(row)

    out["perfil"] = out.apply(classify_profile, axis=1)

    valid_profiles = [
        "nao_vacinado",
        "bivalente",
        "reforco_2",
        "reforco_1",
        "completo",
        "dose_1",
        "protegido",
        "dose_2",
        "dose_unica",
        "vencida",
        "ignorado",
        "inconsistencia",
    ]

    friendly_names = {
        "nao_vacinado": "Não Vacinado",
        "bivalente": "Bivalente",
        "reforco_2": "2º Reforço",
        "reforco_1": "1º Reforço",
        "completo": "Esquema Completo",
        "dose_1": "Dose 1",
        "protegido": "Protegido",
        "dose_2": "Dose 2",
        "dose_unica": "Dose Única",
        "vencida": "Vencida",
        "ignorado": "Ignorado",
        "inconsistencia": "Inconsistência",
    }

    results: list[dict[str, Any]] = []

    for perfil in valid_profiles:
        subset = out[out["perfil"] == perfil]
        if subset.empty:
            continue

        results.append(_compute_profile_metrics(subset, virus, perfil, friendly_names))

    return results


def compute_seasonal_trends(df: pd.DataFrame) -> dict[str, Any]:
    """Group SARI cases by year and epidemiological week (1 to 53) for Mossoró."""
    if df.empty:
        return {"years": [], "weeks": [], "series": {}}

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out = out.dropna(subset=["DT_SIN_PRI"])

    if out.empty:
        return {"years": [], "weeks": [], "series": {}}

    out["year"] = out["_epi_year"]
    out["week"] = out["_epi_week_int"]

    # Group by year and week to count cases
    counts = out.groupby(["year", "week"]).size().reset_index(name="count")

    years = sorted(counts["year"].unique())

    series = {}
    for y in years:
        y_counts = [0] * 53
        y_data = counts[counts["year"] == y]
        for _, row in y_data.iterrows():
            w = int(row["week"])
            if 1 <= w <= 53:
                y_counts[w - 1] = int(row["count"])
        series[str(y)] = y_counts

    return {
        "years": [str(y) for y in years],
        "weeks": list(range(1, 54)),
        "series": series,
    }


def compute_heatmap_se_age(df: pd.DataFrame) -> dict[str, Any]:
    """Group cases by epidemiological week and age group for a 2D density Heatmap."""
    from srag.data.analytics.filters import _age_years

    if df.empty:
        return {"weeks": [], "age_groups": [], "data": []}

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out = out.dropna(subset=["DT_SIN_PRI"])
    if out.empty:
        return {"weeks": [], "age_groups": [], "data": []}

    # Normalize age
    age = _age_years(out)
    if age.empty or age.isna().all():
        return {"weeks": [], "age_groups": [], "data": []}

    out["IDADE_ANOS"] = age

    bins = [0.0, 5.0, 15.0, 30.0, 45.0, 60.0, 75.0, 150.0]
    labels = [
        "0-4 anos",
        "5-14 anos",
        "15-29 anos",
        "30-44 anos",
        "45-59 anos",
        "60-74 anos",
        "75+ anos",
    ]
    out["age_group"] = pd.cut(out["IDADE_ANOS"], bins=bins, labels=labels, right=False)

    out["epi_week"] = out["_epi_week"]

    # Drop cases without a valid age group or week
    out = out.dropna(subset=["age_group", "epi_week"])
    if out.empty:
        return {"weeks": [], "age_groups": [], "data": []}

    # Group by week and age group
    grouped = (
        out.groupby(["epi_week", "age_group"], observed=False).size().reset_index(name="count")
    )

    weeks = sorted(out["epi_week"].unique())
    age_groups = labels

    week_to_idx = {w: i for i, w in enumerate(weeks)}
    age_to_idx = {g: i for i, g in enumerate(age_groups)}

    data_points = []
    for _, row in grouped.iterrows():
        w = str(row["epi_week"])
        g = str(row["age_group"])
        count = int(row["count"])
        if w in week_to_idx and g in age_to_idx and count > 0:
            # Format: [x_index, y_index, value]
            data_points.append([week_to_idx[w], age_to_idx[g], count])

    return {
        "weeks": weeks,
        "age_groups": age_groups,
        "data": data_points,
    }


def compute_ventilatory_support(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compute weekly breakdown of ventilatory support types over time."""
    if df.empty:
        return []

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out = out.dropna(subset=["DT_SIN_PRI"])
    if out.empty:
        return []

    out["epi_week"] = out["_epi_week"]

    s = pd.to_numeric(out["SUPORT_VEN"], errors="coerce").fillna(9)
    out["support_type"] = "ignorado"
    out.loc[s == 1, "support_type"] = "invasivo"
    out.loc[s == 2, "support_type"] = "nao_invasivo"
    out.loc[s == 3, "support_type"] = "sem_suporte"

    grouped = (
        out.groupby(["epi_week", "support_type"], observed=False).size().unstack(fill_value=0)
    )

    for col in ["invasivo", "nao_invasivo", "sem_suporte", "ignorado"]:
        if col not in grouped.columns:
            grouped[col] = 0

    grouped = grouped.sort_index()

    result = []
    for week, row in grouped.iterrows():
        result.append(
            {
                "epi_week": str(week),
                "invasive": int(row["invasivo"]),
                "non_invasive": int(row["nao_invasivo"]),
                "no_support": int(row["sem_suporte"]),
                "ignored": int(row["ignorado"]),
            }
        )

    return result
