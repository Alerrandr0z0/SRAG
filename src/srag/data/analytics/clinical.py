from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import numpy as np
import pandas as pd

from srag.data.analytics.filters import _age_years, outcome_death_mask
from srag.utils.epi_weeks import compute_epi_week_columns

if TYPE_CHECKING:
    from collections.abc import Callable


def _ensure_epi_week(df: pd.DataFrame) -> pd.DataFrame:
    if "_epi_week" not in df.columns and "DT_SIN_PRI" in df.columns:
        epi = compute_epi_week_columns(df["DT_SIN_PRI"])
        return pd.concat([df, epi], axis=1)
    return df


def compute_severity_metrics(df: pd.DataFrame) -> dict[str, float]:
    """Calculate key severity percentages for Mossoró.

    Lethality (death_rate) is calculated over closed cases (Cure or Death)
    to avoid underestimation from open cases.
    """
    if df.empty:
        return {"uti_rate": 0.0, "death_rate": 0.0}

    total = len(df)
    uti_count = (df["UTI"] == 1).sum()

    # Standard Epidemiological Lethality: deaths / (cure + deaths)
    closed_cases_mask = df["EVOLUCAO"].isin([1, 2])
    closed_count = closed_cases_mask.sum()
    death_count = (df["EVOLUCAO"] == 2).sum()

    return {
        "uti_rate": round((uti_count / total) * 100, 2),
        "death_rate": round((death_count / closed_count * 100), 2) if closed_count > 0 else 0.0,
        "total": total,
        "closed_cases": int(closed_count),
    }


def _compute_date_deltas(df: pd.DataFrame, col_a: str, col_b: str) -> pd.Series:
    """Calculate date difference in days between col_a and col_b if they exist."""
    if col_a in df.columns and col_b in df.columns:
        return (df[col_a] - df[col_b]).dt.days
    return pd.Series(dtype="float64")


def _compute_protocol_adherence(df: pd.DataFrame) -> float:
    """Calculate the antiviral 48h protocol adherence rate."""
    antiviral_mask = pd.to_numeric(df["ANTIVIRAL"], errors="coerce") == 1
    if "DT_SIN_PRI" in df.columns and "DT_ANTIVIR" in df.columns:
        out_treated = df[antiviral_mask].dropna(subset=["DT_SIN_PRI", "DT_ANTIVIR"])
        if not out_treated.empty:
            days_to_antiviral = (out_treated["DT_ANTIVIR"] - out_treated["DT_SIN_PRI"]).dt.days
            adherent = (days_to_antiviral >= 0) & (days_to_antiviral <= 2)
            return float(round((adherent.sum() / len(out_treated)) * 100, 1))
    return 0.0


def compute_clinical_timing_metrics(df: pd.DataFrame) -> dict[str, float | int]:
    """Compute key timing indicators for hospitalization, ICU, and outcome."""
    if df.empty:
        return {
            "cases_with_hospital_date": 0,
            "cases_with_icu_dates": 0,
            "cases_with_outcome_date": 0,
            "median_days_symptom_to_hospital": 0.0,
            "median_days_hospital_to_icu": 0.0,
            "median_days_symptom_to_outcome": 0.0,
            "protocol_48h_adherence_rate": 0.0,
        }

    out = df.copy()
    for col in ["DT_SIN_PRI", "DT_INTERNA", "DT_ENTUTI", "DT_EVOLUCA", "DT_ANTIVIR"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    symptom_to_hosp = _compute_date_deltas(out, "DT_INTERNA", "DT_SIN_PRI")
    hosp_to_icu = _compute_date_deltas(out, "DT_ENTUTI", "DT_INTERNA")
    symptom_to_outcome = _compute_date_deltas(out, "DT_EVOLUCA", "DT_SIN_PRI")

    def safe_median(series: pd.Series) -> float:
        clean = pd.to_numeric(series, errors="coerce")
        clean = clean[(clean >= 0) & (clean <= 180)]
        if clean.empty:
            return 0.0
        return float(round(clean.median(), 1))

    protocol_48h_adherence = _compute_protocol_adherence(out)

    return {
        "cases_with_hospital_date": int(out["DT_INTERNA"].notna().sum())
        if "DT_INTERNA" in out.columns
        else 0,
        "cases_with_icu_dates": int(out["DT_ENTUTI"].notna().sum())
        if "DT_ENTUTI" in out.columns
        else 0,
        "cases_with_outcome_date": int(out["DT_EVOLUCA"].notna().sum())
        if "DT_EVOLUCA" in out.columns
        else 0,
        "median_days_symptom_to_hospital": safe_median(symptom_to_hosp),
        "median_days_hospital_to_icu": safe_median(hosp_to_icu),
        "median_days_symptom_to_outcome": safe_median(symptom_to_outcome),
        "protocol_48h_adherence_rate": protocol_48h_adherence,
    }


def compute_risk_factor_profile(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Aggregate prevalence of selected risk factors/comorbidities."""
    if df.empty:
        return []

    candidates = [
        ("DIABETES", "Diabetes"),
        ("OBESIDADE", "Obesidade"),
        ("ASMA", "Asma"),
        ("IMUNODEPRE", "Imunodepressão"),
        ("RENAL", "Doença renal"),
    ]
    out: list[dict[str, int | str]] = []
    for col, label in candidates:
        if col not in df.columns:
            continue
        s = pd.to_numeric(df[col], errors="coerce")
        out.append(
            {
                "factor": label,
                "count": int((s == 1).sum()),
            }
        )

    out.sort(key=lambda x: int(x["count"]), reverse=True)
    return out


def compute_risk_factors_full_profile(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Aggregate full SIVEP risk-factor set as frequencies."""
    if df.empty:
        return []

    risk_fields = [
        ("PUERPERA", "Puérpera"),
        ("CARDIOPATI", "Cardiopatia"),
        ("HEMATOLOGI", "Doença hematológica"),
        ("SIND_DOWN", "Síndrome de Down"),
        ("HEPATICA", "Doença hepática"),
        ("ASMA", "Asma"),
        ("DIABETES", "Diabetes"),
        ("NEUROLOGIC", "Doença neurológica"),
        ("PNEUMOPATI", "Pneumopatia"),
        ("IMUNODEPRE", "Imunodepressão"),
        ("RENAL", "Doença renal"),
        ("OBESIDADE", "Obesidade"),
        ("TABAG", "Tabagismo"),
        ("OUT_MORBI", "Outros fatores"),
    ]

    out: list[dict[str, int | str]] = []
    for col, label in risk_fields:
        if col not in df.columns:
            out.append({"factor": label, "count": 0})
            continue
        s = pd.to_numeric(df[col], errors="coerce")
        out.append({"factor": label, "count": int((s == 1).sum())})
    out.sort(key=lambda x: int(x["count"]), reverse=True)
    return out


def compute_comorbidities_treemap(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Aggregate SIVEP risk-factors with frequencies and lethality (CFR)."""
    if df.empty:
        return []

    risk_fields = [
        ("PUERPERA", "Puérpera"),
        ("CARDIOPATI", "Cardiopatia"),
        ("HEMATOLOGI", "Doença hematológica"),
        ("SIND_DOWN", "Síndrome de Down"),
        ("HEPATICA", "Doença hepática"),
        ("ASMA", "Asma"),
        ("DIABETES", "Diabetes"),
        ("NEUROLOGIC", "Doença neurológica"),
        ("PNEUMOPATI", "Pneumopatia"),
        ("IMUNODEPRE", "Imunodepressão"),
        ("RENAL", "Doença renal"),
        ("OBESIDADE", "Obesidade"),
        ("TABAG", "Tabagismo"),
        ("OUT_MORBI", "Outros fatores"),
    ]

    out = []
    from srag.data.analytics.filters import outcome_death_mask, outcome_valid_mask

    resolved_mask = (
        outcome_valid_mask(df["EVOLUCAO"])
        if "EVOLUCAO" in df.columns
        else pd.Series(False, index=df.index)
    )
    death_mask = (
        outcome_death_mask(df["EVOLUCAO"])
        if "EVOLUCAO" in df.columns
        else pd.Series(False, index=df.index)
    )

    for col, label in risk_fields:
        if col not in df.columns:
            out.append(
                {
                    "name": label,
                    "value": 0,
                    "deaths": 0,
                    "lethality": 0.0,
                }
            )
            continue

        s = pd.to_numeric(df[col], errors="coerce")
        factor_mask = s == 1

        count = int(factor_mask.sum())
        resolved_count = int((factor_mask & resolved_mask).sum())
        deaths = int((factor_mask & death_mask).sum())

        lethality = round((deaths / resolved_count) * 100, 2) if resolved_count > 0 else 0.0

        out.append(
            {
                "name": label,
                "value": count,
                "deaths": deaths,
                "lethality": lethality,
            }
        )

    out.sort(key=lambda x: x["value"], reverse=True)
    return out


def compute_maternal_profile(df: pd.DataFrame) -> dict[str, object]:
    """Aggregate maternal status (Gestational + Puerperal) with severity outcomes."""
    if df.empty:
        return {
            "maternal_outcomes": [],
            "gestantes_total": 0,
            "puerperas_total": 0,
            "maternal_cases": 0,
        }

    fem = df[df["CS_SEXO"] == "F"].copy()
    if fem.empty:
        return {
            "maternal_outcomes": [],
            "gestantes_total": 0,
            "puerperas_total": 0,
            "maternal_cases": 0,
        }

    puerp = pd.to_numeric(fem["PUERPERA"], errors="coerce")
    gest = pd.to_numeric(fem["CS_GESTANT"], errors="coerce")

    fem["maternal_group"] = np.select(
        [puerp == 1, gest == 1, gest == 2, gest == 3, gest == 4],
        ["Puérpera", "Gest. 1º Tri", "Gest. 2º Tri", "Gest. 3º Tri", "Gest. IG Ignorada"],
        default="Não gestante",
    )

    evol = pd.to_numeric(fem["EVOLUCAO"], errors="coerce")
    uti = pd.to_numeric(fem["UTI"], errors="coerce")
    is_death = outcome_death_mask(fem["EVOLUCAO"])

    fem["outcome"] = np.select(
        [is_death, uti == 1, evol == 1],
        ["Óbito", "UTI (Sobrevivente)", "Cura (Sem UTI)"],
        default="Outro/Em Aberto",
    )

    grouped = fem.groupby(["maternal_group", "outcome"]).size().unstack(fill_value=0)

    for col in ["Cura (Sem UTI)", "UTI (Sobrevivente)", "Óbito"]:
        if col not in grouped.columns:
            grouped[col] = 0

    outcomes = []
    group_order = ["Gest. 1º Tri", "Gest. 2º Tri", "Gest. 3º Tri", "Gest. IG Ignorada", "Puérpera"]

    for g in group_order:
        if g in grouped.index:
            row = grouped.loc[g]
            total = int(row.sum())  # type: ignore[arg-type]
            if total == 0:
                continue
            outcomes.append(
                {
                    "group": g,
                    "cure": int(row["Cura (Sem UTI)"]),  # type: ignore[arg-type]
                    "icu": int(row["UTI (Sobrevivente)"]),  # type: ignore[arg-type]
                    "death": int(row["Óbito"]),  # type: ignore[arg-type]
                    "total": total,
                }
            )

    gest_mask = pd.to_numeric(fem["CS_GESTANT"], errors="coerce").isin([1, 2, 3, 4])
    puerp_mask = pd.to_numeric(fem["PUERPERA"], errors="coerce") == 1

    return {
        "maternal_outcomes": outcomes,
        "gestantes_total": int(gest_mask.sum()),
        "puerperas_total": int(puerp_mask.sum()),
        "maternal_cases": int((gest_mask | puerp_mask).sum()),
    }


def compute_antiviral_latency(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate quartiles for time between symptoms and antiviral start for Box Plot."""
    if df.empty:
        return {"boxplot_data": [], "median": 0.0}

    out = df.copy()
    for col in ["DT_SIN_PRI", "DT_ANTIVIR"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    # Filter only treated cases with valid therapeutic window (0 to 14 days)
    antiviral_mask = pd.to_numeric(out["ANTIVIRAL"], errors="coerce") == 1

    if "DT_SIN_PRI" not in out.columns or "DT_ANTIVIR" not in out.columns:
        return {"boxplot_data": [], "median": 0.0}

    valid = out[antiviral_mask].dropna(subset=["DT_SIN_PRI", "DT_ANTIVIR"])
    valid["delta"] = (valid["DT_ANTIVIR"] - valid["DT_SIN_PRI"]).dt.days
    valid = valid[(valid["delta"] >= 0) & (valid["delta"] <= 14)]

    if valid.empty:
        return {"boxplot_data": [], "median": 0.0}

    deltas = valid["delta"].sort_values()
    stats = [
        float(deltas.min()),
        float(np.percentile(deltas, 25)),
        float(deltas.median()),
        float(np.percentile(deltas, 75)),
        float(deltas.max()),
    ]

    return {"boxplot_data": stats, "median": float(round(deltas.median(), 1)), "count": len(valid)}


_ANTIVIRAL_FLU_MAP = {1: "Oseltamivir", 2: "Zanamivir", 3: "Outro (Gripe)"}
_ANTIVIRAL_COV_MAP = {1: "Paxlovid", 2: "Lagevrio", 3: "Olumiant", 4: "Outro (COVID)"}
_MAX_ANTIVIRAL_SAMPLES = 200


def _resolve_antiviral_drug_label(row: pd.Series) -> str | None:
    try:
        tp_antivir = float(row.get("TP_ANTIVIR", float("nan")))
    except TypeError, ValueError:
        tp_antivir = float("nan")
    if not np.isnan(tp_antivir) and int(tp_antivir) in _ANTIVIRAL_FLU_MAP:
        return _ANTIVIRAL_FLU_MAP[int(tp_antivir)]
    try:
        tipo_trat = float(row.get("TIPO_TRAT", float("nan")))
    except TypeError, ValueError:
        tipo_trat = float("nan")
    if not np.isnan(tipo_trat) and int(tipo_trat) in _ANTIVIRAL_COV_MAP:
        return _ANTIVIRAL_COV_MAP[int(tipo_trat)]
    return None


def compute_antiviral_age_profile(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Age samples per antiviral drug for KDE-based profile visualisation."""
    if df.empty:
        return []
    out = df.copy()
    antiviral_mask = pd.to_numeric(out["ANTIVIRAL"], errors="coerce") == 1
    out = out[antiviral_mask]
    if out.empty:
        return []

    out["_drug"] = out.apply(_resolve_antiviral_drug_label, axis=1)
    out = out.dropna(subset=["_drug"])
    if out.empty:
        return []

    if "IDADE_ANOS" in out.columns and out["IDADE_ANOS"].notna().any():
        out["_age"] = pd.to_numeric(out["IDADE_ANOS"], errors="coerce")
    else:
        out["_age"] = out.apply(
            lambda row: _normalize_age_years(
                row.get("NU_IDADE_N"),
                row.get("TP_IDADE"),
            ),
            axis=1,
        )
    out = out.dropna(subset=["_age"])

    results: list[dict[str, Any]] = []
    for drug, group in out.groupby("_drug", sort=True):
        ages = [float(a) for a in group["_age"].tolist()]
        if not ages:
            continue
        ages_sorted = sorted(ages)
        capped = ages_sorted[:_MAX_ANTIVIRAL_SAMPLES]
        results.append(
            {
                "drug": str(drug),
                "age_samples": capped,
                "count": len(ages_sorted),
            }
        )

    results.sort(key=lambda r: r["count"], reverse=True)
    return results


def _normalize_age_years(
    nu_idade_n: int | float | str | None,
    tp_idade: int | float | str | None,
) -> float | None:
    nu_raw = pd.to_numeric(pd.Series([nu_idade_n]), errors="coerce").iloc[0]
    tp_raw = pd.to_numeric(pd.Series([tp_idade]), errors="coerce").iloc[0]
    if pd.isna(nu_raw):
        return None
    nu = int(nu_raw)
    if nu < 0:
        return None
    if pd.isna(tp_raw):
        return float(nu)
    tp = int(tp_raw)
    if tp == 1:
        return round(nu / 365.25, 4)
    if tp == 2:
        return round(nu / 12.0, 4)
    return float(nu)


def _extract_specs(df: pd.DataFrame, out_col: str, type_col: str, code: int) -> list[str]:
    if out_col not in df.columns or type_col not in df.columns:
        return []
    t_num = pd.to_numeric(df[type_col], errors="coerce")
    c_vals = df[out_col].fillna("").astype(str).str.strip()
    mask = (t_num == code) & (c_vals != "")
    return sorted(df.loc[mask, out_col].dropna().unique().tolist())


def _populate_samples(valid: pd.DataFrame, drug_data: dict[str, dict[str, Any]]) -> None:
    for drug, group in valid.groupby("_drug", sort=True):
        if drug not in drug_data:
            continue
        deltas = [int(d) for d in group["delta"].tolist()]
        if deltas:
            drug_data[str(drug)].update(
                {
                    "latency_samples": sorted(deltas)[:_MAX_ANTIVIRAL_SAMPLES],
                    "median": float(round(pd.Series(deltas).median(), 1)),
                    "count": len(deltas),
                }
            )


def compute_antiviral_latency_per_drug(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Latency (days, sintomas→antiviral) samples per drug for KDE-based visualisation."""
    if df.empty:
        return []
    all_drugs = [
        "Oseltamivir",
        "Zanamivir",
        "Outro (Gripe)",
        "Paxlovid",
        "Lagevrio",
        "Olumiant",
        "Outro (COVID)",
    ]
    drug_data: dict[str, dict[str, Any]] = {
        d: {
            "drug": d,
            "latency_samples": [],
            "median": 0.0,
            "count": 0,
        }
        for d in all_drugs
    }

    # Extract specified others details
    out_flu_specs = _extract_specs(df, "OUT_ANTIV", "TP_ANTIVIR", 3)
    out_cov_specs = _extract_specs(df, "OUT_TRAT", "TIPO_TRAT", 4)

    if out_flu_specs:
        drug_data["Outro (Gripe)"]["specifications"] = out_flu_specs
    if out_cov_specs:
        drug_data["Outro (COVID)"]["specifications"] = out_cov_specs

    if "DT_SIN_PRI" in df.columns and "DT_ANTIVIR" in df.columns and "ANTIVIRAL" in df.columns:
        out = df.copy()
        antiviral_mask = pd.to_numeric(out["ANTIVIRAL"], errors="coerce") == 1
        if antiviral_mask.any():
            out = out[antiviral_mask].copy()
            out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
            out["DT_ANTIVIR"] = pd.to_datetime(out["DT_ANTIVIR"], errors="coerce")
            out["_drug"] = out.apply(_resolve_antiviral_drug_label, axis=1)
            valid = out.dropna(subset=["_drug", "DT_SIN_PRI", "DT_ANTIVIR"])
            if not valid.empty:
                valid["delta"] = (valid["DT_ANTIVIR"] - valid["DT_SIN_PRI"]).dt.days
                valid = valid[(valid["delta"] >= 0) & (valid["delta"] <= 14)]
                _populate_samples(valid, drug_data)

    results = [r for r in drug_data.values() if r["count"] > 0]
    results.sort(key=lambda r: r["count"], reverse=True)
    return results


def compute_antiviral_outcome_impact(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compare Cure/Death rates between patients who used vs didn't use antivirals."""
    if df.empty:
        return []

    out = df.copy()
    out["used_antivir"] = pd.to_numeric(out["ANTIVIRAL"], errors="coerce").map(
        {1: "Usou Antiviral", 2: "Não Usou"}
    )
    out = out[out["used_antivir"].notna()]

    # 1=Cura, 2=Óbito
    out["outcome"] = out["EVOLUCAO"].map({1: "Cura", 2: "Óbito"})
    out = out[out["outcome"].notna()]

    if out.empty:
        return []

    grouped = out.groupby(["used_antivir", "outcome"]).size().unstack(fill_value=0)

    results = []
    for label in grouped.index:
        row = grouped.loc[label]
        total = int(row.sum())
        results.append(
            {
                "group": label,
                "cure_rate": round((row.get("Cura", 0) / total * 100), 1) if total > 0 else 0,
                "death_rate": round((row.get("Óbito", 0) / total * 100), 1) if total > 0 else 0,
                "total": total,
            }
        )

    return results


_TREATMENT_WINDOW_LABELS = ["≤ 1d", "2d", "3-5d", "> 5d", "s/ antiviral"]


def _scalar_int(value: pd.Series | int | float | np.integer) -> int:
    """Coerce pandas-aware value (Series | int) to a plain Python int."""
    if isinstance(value, pd.Series):
        return int(value.iloc[0])
    return int(value)


def _classify_treatment_window(days: float | int | None) -> str | None:
    if days is None or pd.isna(days):
        return None
    if days <= 1:
        return "≤ 1d"
    if days <= 2:
        return "2d"
    if days <= 5:
        return "3-5d"
    return "> 5d"


def _classify_treated_windows(out: pd.DataFrame) -> pd.DataFrame:
    """Tag treated patients with their therapeutic window label."""
    treated = out[out["used_antivir"]].copy()
    has_dates = "DT_SIN_PRI" in treated.columns and "DT_ANTIVIR" in treated.columns
    if not has_dates:
        treated["window"] = None
        return treated
    for col in ("DT_SIN_PRI", "DT_ANTIVIR"):
        treated[col] = pd.to_datetime(treated[col], errors="coerce")
    if treated.empty:
        treated["window"] = None
        return treated
    treated["delta"] = (treated["DT_ANTIVIR"] - treated["DT_SIN_PRI"]).dt.days
    treated = treated[(treated["delta"] >= 0) & (treated["delta"] <= 14)]
    treated["window"] = treated["delta"].apply(_classify_treatment_window)
    return treated


def _empty_window_results() -> list[dict[str, Any]]:
    return [
        {"window": label, "total": 0, "cure_rate": 0.0, "death_rate": 0.0, "margin": 0.0}
        for label in _TREATMENT_WINDOW_LABELS
    ]


def _row_to_window_stats(
    row: pd.Series | None,
    label: str,
) -> dict[str, Any]:
    if row is None:
        return {"window": label, "total": 0, "cure_rate": 0.0, "death_rate": 0.0, "margin": 0.0}
    total = _scalar_int(row.sum())
    cure = _scalar_int(row.get("Cura", 0))
    death = _scalar_int(row.get("Óbito", 0))
    cure_rate = round(cure / total * 100, 1) if total > 0 else 0.0
    death_rate = round(death / total * 100, 1) if total > 0 else 0.0
    return {
        "window": label,
        "total": total,
        "cure_rate": cure_rate,
        "death_rate": death_rate,
        "margin": round(cure_rate - death_rate, 1),
    }


def compute_treatment_window_outcomes(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Outcome (cure / death) per treatment window: 1d, 2d, 3-5d, >5d, no antiviral."""
    if df.empty:
        return []

    required = {"ANTIVIRAL", "EVOLUCAO"}
    if not required.issubset(df.columns):
        return _empty_window_results()

    out = df.copy()
    out["used_antivir"] = pd.to_numeric(out["ANTIVIRAL"], errors="coerce") == 1
    out["outcome"] = out["EVOLUCAO"].map({1: "Cura", 2: "Óbito"})
    out = out[out["outcome"].notna()]

    treated = _classify_treated_windows(out)[["outcome", "window"]]
    no_antiviral = out[~out["used_antivir"]].copy()
    no_antiviral["window"] = "s/ antiviral"
    no_antiviral = no_antiviral[["outcome", "window"]]

    combined = pd.concat([treated, no_antiviral], ignore_index=True)
    combined = combined.dropna(subset=["window"])
    if combined.empty:
        return _empty_window_results()

    grouped = combined.groupby(["window", "outcome"]).size().unstack(fill_value=0)
    return [
        _row_to_window_stats(
            cast("pd.Series", grouped.loc[label]) if label in grouped.index else None,
            label,
        )
        for label in _TREATMENT_WINDOW_LABELS
    ]


def compute_symptoms_profile(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Aggregate all SIVEP symptom flags as frequencies."""
    if df.empty:
        return []

    symptom_fields = [
        ("FEBRE", "Febre"),
        ("TOSSE", "Tosse"),
        ("GARGANTA", "Dor de garganta"),
        ("DISPNEIA", "Dispneia"),
        ("DESC_RESP", "Desconforto respiratório"),
        ("SATURACAO", "Saturação <95%"),
        ("DIARREIA", "Diarreia"),
        ("VOMITO", "Vômito"),
        ("DOR_ABD", "Dor abdominal"),
        ("FADIGA", "Fadiga"),
        ("PERD_OLFT", "Perda de olfato"),
        ("PERD_PALA", "Perda de paladar"),
        ("OUTRO_SIN", "Outros sintomas"),
    ]

    out: list[dict[str, int | str]] = []
    for col, label in symptom_fields:
        if col not in df.columns:
            out.append({"symptom": label, "count": 0})
            continue
        s = pd.to_numeric(df[col], errors="coerce")
        out.append({"symptom": label, "count": int((s == 1).sum())})
    return out


def compute_symptoms_heatmap(df: pd.DataFrame) -> dict[str, object]:
    """Build symptom co-occurrence matrix for heatmap rendering."""
    symptoms = [
        ("FEBRE", "Febre"),
        ("TOSSE", "Tosse"),
        ("GARGANTA", "Dor de garganta"),
        ("DISPNEIA", "Dispneia"),
        ("DESC_RESP", "Desconforto respiratório"),
        ("SATURACAO", "Saturação <95%"),
        ("DIARREIA", "Diarreia"),
        ("VOMITO", "Vômito"),
        ("DOR_ABD", "Dor abdominal"),
        ("FADIGA", "Fadiga"),
        ("PERD_OLFT", "Perda de olfato"),
        ("PERD_PALA", "Perda de paladar"),
        ("OUTRO_SIN", "Outros sintomas"),
    ]

    labels = [label for _, label in symptoms]
    if df.empty:
        return {"labels": labels, "matrix": []}

    flags: dict[str, pd.Series] = {}
    for col, _ in symptoms:
        if col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce")
            flags[col] = s == 1
        else:
            flags[col] = pd.Series(False, index=df.index)

    matrix: list[list[int]] = []
    for row_col, _ in symptoms:
        row_vals: list[int] = []
        row_flag = flags[row_col]
        for col_col, _ in symptoms:
            col_flag = flags[col_col]
            both = int((row_flag & col_flag).sum())
            row_vals.append(both)
        matrix.append(row_vals)

    return {"labels": labels, "matrix": matrix}


def _build_age_bands(age: pd.Series, profile_type: str) -> list[tuple[str, pd.Series]]:
    """Return a list of (label, mask) tuples based on profile type."""
    if profile_type == "crianca":
        return [
            ("<2 anos", age < 2),
            ("2-5 anos", (age >= 2) & (age < 6)),
            ("6-11 anos", (age >= 6) & (age < 12)),
        ]
    if profile_type == "adolescente":
        return [
            ("12-14 anos", (age >= 12) & (age < 15)),
            ("15-19 anos", (age >= 15) & (age < 20)),
        ]
    if profile_type == "adulto":
        return [
            ("20-39 anos", (age >= 20) & (age < 40)),
            ("40-59 anos", (age >= 40) & (age < 60)),
        ]
    if profile_type == "idoso":
        return [
            ("60-69 anos", (age >= 60) & (age < 70)),
            ("70-79 anos", (age >= 70) & (age < 80)),
            ("80+ anos", age >= 80),
        ]
    # "all" view default
    return [
        ("Criança", age < 12),
        ("Adolescente", (age >= 12) & (age < 20)),
        ("Adulto", (age >= 20) & (age < 60)),
        ("Idoso", age >= 60),
    ]


def _build_pathogen_masks(
    df: pd.DataFrame,
    pathogens_mask_func: Callable[..., Any] | None = None,
) -> dict[str, pd.Series]:
    """Build boolean masks for each pathogen group."""
    if pathogens_mask_func is not None:
        return pathogens_mask_func(df)

    classi = pd.to_numeric(df.get("CLASSI_FIN", pd.Series(index=df.index)), errors="coerce")
    pcr_vsr = pd.to_numeric(df.get("PCR_VSR", pd.Series(index=df.index)), errors="coerce")
    an_vsr = pd.to_numeric(df.get("AN_VSR", pd.Series(index=df.index)), errors="coerce")

    vsr_mask = (pcr_vsr == 1) | (an_vsr == 1)
    return {
        "covid": (classi == 5).reindex(df.index, fill_value=False).fillna(False),
        "gripe": (classi == 1).reindex(df.index, fill_value=False).fillna(False),
        "vsr": vsr_mask.reindex(df.index, fill_value=False).fillna(False),
    }


def compute_symptoms_signature(
    df: pd.DataFrame,
    profile_type: str = "all",
    pathogens_mask_func: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    """Calculate symptom prevalence (%) side-by-side for COVID, Flu, and VSR."""
    if df.empty:
        return {"labels": [], "bands": [], "matrices": {}}

    out = df.copy()
    age = _age_years(out)

    bands = _build_age_bands(age, profile_type)
    band_labels = [b[0] for b in bands]
    band_masks = [b[1].reindex(out.index, fill_value=False).fillna(False) for b in bands]

    symptom_fields = [
        ("FEBRE", "Febre"),
        ("TOSSE", "Tosse"),
        ("GARGANTA", "Dor de garganta"),
        ("DISPNEIA", "Dispneia"),
        ("DESC_RESP", "Desconforto respiratório"),
        ("SATURACAO", "Saturação <95%"),
        ("DIARREIA", "Diarreia"),
        ("VOMITO", "Vômito"),
        ("DOR_ABD", "Dor abdominal"),
        ("FADIGA", "Fadiga"),
        ("PERD_OLFT", "Perda de olfato"),
        ("PERD_PALA", "Perda de paladar"),
        ("OUTRO_SIN", "Outros sintomas"),
    ]

    pathogens = _build_pathogen_masks(out, pathogens_mask_func)

    matrices = {}
    symptom_avg_freq = {field[0]: 0.0 for field in symptom_fields}

    for p_key, p_mask in pathogens.items():
        matrix = []
        p_df = out[p_mask]

        for field_id, _ in symptom_fields:
            row = []
            for b_mask in band_masks:
                current_band_mask = b_mask.loc[p_df.index]
                subset = p_df[current_band_mask]

                if subset.empty:
                    row.append([0.0, 0])
                    continue

                has_symptom = (pd.to_numeric(subset.get(field_id), errors="coerce") == 1).sum()  # type: ignore[arg-type]
                prevalence = round((has_symptom / len(subset)) * 100, 1)
                row.append([prevalence, int(has_symptom)])
                symptom_avg_freq[field_id] += prevalence
            matrix.append(row)
        matrices[p_key] = matrix

    sorted_symptoms = sorted(symptom_fields, key=lambda x: symptom_avg_freq[x[0]], reverse=True)

    for p_key in matrices:
        reordered = []
        for field_id, _ in sorted_symptoms:
            idx = [f[0] for f in symptom_fields].index(field_id)
            reordered.append(matrices[p_key][idx])
        matrices[p_key] = reordered

    return {"labels": [s[1] for s in sorted_symptoms], "bands": band_labels, "matrices": matrices}


def _calculate_kpis(subset: pd.DataFrame) -> dict[str, float]:
    if subset.empty:
        return {
            "hospitalization_rate": 0.0,
            "uti_rate": 0.0,
            "ventilatory_support_rate": 0.0,
            "death_rate": 0.0,
            "median_hospitalization_days": 0.0,
            "median_uti_days": 0.0,
        }

    total = len(subset)

    # 1. Hospitalization rate: HOSPITAL == 1 / total
    hosp_col = subset.get("HOSPITAL")
    hospitalized_cases = (
        subset[hosp_col == 1] if hosp_col is not None else subset[subset["HOSPITAL"] == 1]
    )
    hosp_count = len(hospitalized_cases)
    hosp_rate = round((hosp_count / total) * 100, 1) if total > 0 else 0.0

    # 2. UTI rate: UTI == 1 / hospitalized
    uti_cases = hospitalized_cases[hospitalized_cases["UTI"] == 1]
    uti_count = len(uti_cases)
    uti_rate = round((uti_count / hosp_count) * 100, 1) if hosp_count > 0 else 0.0

    # 3. Ventilatory support rate: SUPORT_VEN in (1, 2) / UTI == 1
    # Note: SUPORT_VEN: 1=Sim, invasivo, 2=Sim, não invasivo, 3=Não, 9=Ignorado
    vent_cases = uti_cases[uti_cases["SUPORT_VEN"].isin([1, 2])]
    vent_count = len(vent_cases)
    vent_rate = round((vent_count / uti_count) * 100, 1) if uti_count > 0 else 0.0

    # 4. Letalidade (CFR): EVOLUCAO == 2 / closed cases (1 or 2)
    closed_cases = subset[subset["EVOLUCAO"].isin([1, 2])]
    closed_count = len(closed_cases)
    death_count = (closed_cases["EVOLUCAO"] == 2).sum()
    death_rate = round((death_count / closed_count) * 100, 1) if closed_count > 0 else 0.0

    # 5. Median days of hospitalization: DT_EVOLUCA - DT_INTERNA
    dt_interna = pd.to_datetime(subset["DT_INTERNA"], errors="coerce")
    dt_evoluca = pd.to_datetime(subset["DT_EVOLUCA"], errors="coerce")
    hosp_days = (dt_evoluca - dt_interna).dt.days
    hosp_days = hosp_days[(hosp_days >= 0) & (hosp_days <= 180)]
    median_hosp = float(round(hosp_days.median(), 1)) if not hosp_days.empty else 0.0

    # 6. Median days of UTI: DT_SAIDUTI - DT_ENTUTI
    if "DT_ENTUTI" in subset.columns and "DT_SAIDUTI" in subset.columns:
        dt_entuti = pd.to_datetime(subset["DT_ENTUTI"], errors="coerce")
        dt_saiduti = pd.to_datetime(subset["DT_SAIDUTI"], errors="coerce")
        uti_days = (dt_saiduti - dt_entuti).dt.days
        uti_days = uti_days[(uti_days >= 0) & (uti_days <= 180)]
        median_uti = float(round(uti_days.median(), 1)) if not uti_days.empty else 0.0
    else:
        median_uti = 0.0

    return {
        "hospitalization_rate": hosp_rate,
        "uti_rate": uti_rate,
        "ventilatory_support_rate": vent_rate,
        "death_rate": death_rate,
        "median_hospitalization_days": median_hosp,
        "median_uti_days": median_uti,
    }


def compute_severity_kpis(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate severity KPIs overall and trends for the last 12 weeks."""
    current = _calculate_kpis(df)
    if df.empty:
        return {"current": current, "trend": []}

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out = out.dropna(subset=["DT_SIN_PRI"])
    if out.empty:
        return {"current": current, "trend": []}

    out["epi_week"] = out["_epi_week"]

    unique_weeks = sorted(out["epi_week"].unique())
    last_12_weeks = unique_weeks[-12:]

    trend = []
    for week in last_12_weeks:
        week_df = out[out["epi_week"] == week]
        week_kpis = _calculate_kpis(week_df)
        week_kpis["epi_week"] = week
        trend.append(week_kpis)

    return {"current": current, "trend": trend}


def compute_severity_pyramid(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compute severity rates (UTI, ventilatory support, death) by age groups."""
    if df.empty:
        return []

    out = df.copy()
    age = _age_years(out)
    if age.empty or age.isna().all():
        return []

    out["IDADE_ANOS"] = age

    # Define more granular bins and labels
    bins = [0.0, 1.0, 5.0, 10.0, 15.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 150.0]
    labels = [
        "0 anos",
        "1-4 anos",
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

    out["age_bin"] = pd.cut(out["IDADE_ANOS"], bins=bins, labels=labels, right=False)

    # Convert columns to numeric/correct types for calculations
    uti = pd.to_numeric(out["UTI"], errors="coerce")
    suport = pd.to_numeric(
        out.get("SUPORT_VEN", pd.Series(np.nan, index=out.index)), errors="coerce"
    )
    evol = pd.to_numeric(out["EVOLUCAO"], errors="coerce")

    out["is_uti"] = uti == 1
    out["is_support"] = suport.isin([1, 2])
    out["is_death"] = outcome_death_mask(evol)

    grouped = out.groupby("age_bin", observed=False)

    pyramid = []
    for label in labels:
        try:
            subset = grouped.get_group(label)
        except KeyError:
            pyramid.append(
                {
                    "age_group": label,
                    "total_cases": 0,
                    "uti_rate": 0.0,
                    "support_rate": 0.0,
                    "death_rate": 0.0,
                }
            )
            continue

        total = len(subset)
        if total == 0:
            pyramid.append(
                {
                    "age_group": label,
                    "total_cases": 0,
                    "uti_rate": 0.0,
                    "support_rate": 0.0,
                    "death_rate": 0.0,
                }
            )
            continue

        uti_rate = float(round((subset["is_uti"].sum() / total) * 100, 2))
        support_rate = float(round((subset["is_support"].sum() / total) * 100, 2))
        death_rate = float(round((subset["is_death"].sum() / total) * 100, 2))

        pyramid.append(
            {
                "age_group": label,
                "total_cases": int(total),
                "uti_rate": uti_rate,
                "support_rate": support_rate,
                "death_rate": death_rate,
            }
        )

    return pyramid


def compute_gravity_cascade(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compute weekly counts of cases, hospitalizations, UTI admissions, and deaths."""
    if df.empty:
        return []

    out = df.copy()
    out = _ensure_epi_week(out)
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out = out.dropna(subset=["DT_SIN_PRI"])
    if out.empty:
        return []

    out["epi_week"] = out["_epi_week"]

    # Convert to numeric for clean comparisons
    hosp = pd.to_numeric(out["HOSPITAL"], errors="coerce")
    uti = pd.to_numeric(out["UTI"], errors="coerce")
    evol = pd.to_numeric(out["EVOLUCAO"], errors="coerce")

    out["is_hosp"] = hosp == 1
    out["is_uti"] = uti == 1
    out["is_death"] = outcome_death_mask(evol)

    grouped = out.groupby("epi_week")
    counts = grouped.size()
    hosp_counts = grouped["is_hosp"].sum()
    uti_counts = grouped["is_uti"].sum()
    death_counts = grouped["is_death"].sum()

    result = []
    for week in sorted(counts.index):
        result.append(
            {
                "epi_week": str(week),
                "notified": int(counts[week]),
                "hospitalized": int(hosp_counts[week]),
                "uti": int(uti_counts[week]),
                "death": int(death_counts[week]),
            }
        )

    return result
