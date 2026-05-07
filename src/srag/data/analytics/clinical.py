"""Clinical metrics and timelines."""

from typing import Any

import numpy as np
import pandas as pd

from srag.data.analytics.filters import _age_years, outcome_death_mask


def compute_severity_metrics(df: pd.DataFrame) -> dict[str, float]:
    """Calculate key severity percentages for Mossoró."""
    if df.empty:
        return {"uti_rate": 0.0, "death_rate": 0.0}

    total = len(df)
    uti_count = (df["UTI"] == 1).sum()
    death_count = outcome_death_mask(df["EVOLUCAO"]).sum()

    return {
        "uti_rate": round((uti_count / total) * 100, 2),
        "death_rate": round((death_count / total) * 100, 2),
        "total": total,
    }


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

    # Calculate deltas only if columns exist
    symptom_to_hosp = pd.Series(dtype="float64")
    if "DT_INTERNA" in out.columns and "DT_SIN_PRI" in out.columns:
        symptom_to_hosp = (out["DT_INTERNA"] - out["DT_SIN_PRI"]).dt.days

    hosp_to_icu = pd.Series(dtype="float64")
    if "DT_ENTUTI" in out.columns and "DT_INTERNA" in out.columns:
        hosp_to_icu = (out["DT_ENTUTI"] - out["DT_INTERNA"]).dt.days

    symptom_to_outcome = pd.Series(dtype="float64")
    if "DT_EVOLUCA" in out.columns and "DT_SIN_PRI" in out.columns:
        symptom_to_outcome = (out["DT_EVOLUCA"] - out["DT_SIN_PRI"]).dt.days

    def safe_median(series: pd.Series) -> float:
        clean = pd.to_numeric(series, errors="coerce")
        clean = clean[(clean >= 0) & (clean <= 180)]
        if clean.empty:
            return 0.0
        return float(round(clean.median(), 1))

    antiviral_mask = pd.to_numeric(out.get("ANTIVIRAL"), errors="coerce") == 1

    # Check if necessary columns exist for the 48h adherence metric
    protocol_48h_adherence = 0.0
    if "DT_SIN_PRI" in out.columns and "DT_ANTIVIR" in out.columns:
        out_treated = out[antiviral_mask].dropna(subset=["DT_SIN_PRI", "DT_ANTIVIR"])

        if not out_treated.empty:
            days_to_antiviral = (out_treated["DT_ANTIVIR"] - out_treated["DT_SIN_PRI"]).dt.days
            adherent = (days_to_antiviral >= 0) & (days_to_antiviral <= 2)
            protocol_48h_adherence = float(round((adherent.sum() / len(out_treated)) * 100, 1))

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

    def get_maternal_group(row: pd.Series) -> str:
        puerp = pd.to_numeric(row.get("PUERPERA"), errors="coerce")
        if puerp == 1:
            return "Puérpera"
        gest = pd.to_numeric(row.get("CS_GESTANT"), errors="coerce")
        if gest == 1:
            return "Gest. 1º Tri"
        if gest == 2:
            return "Gest. 2º Tri"
        if gest == 3:
            return "Gest. 3º Tri"
        if gest == 4:
            return "Gest. IG Ignorada"
        return "Não gestante"

    fem["maternal_group"] = fem.apply(get_maternal_group, axis=1)

    def get_severity_outcome(row: pd.Series) -> str:
        if outcome_death_mask(pd.Series([row.get("EVOLUCAO")])).iloc[0]:
            return "Óbito"
        if pd.to_numeric(row.get("UTI"), errors="coerce") == 1:
            return "UTI (Sobrevivente)"
        if pd.to_numeric(row.get("EVOLUCAO"), errors="coerce") == 1:
            return "Cura (Sem UTI)"
        return "Outro/Em Aberto"

    fem["outcome"] = fem.apply(get_severity_outcome, axis=1)

    grouped = fem.groupby(["maternal_group", "outcome"]).size().unstack(fill_value=0)

    for col in ["Cura (Sem UTI)", "UTI (Sobrevivente)", "Óbito"]:
        if col not in grouped.columns:
            grouped[col] = 0

    outcomes = []
    group_order = ["Gest. 1º Tri", "Gest. 2º Tri", "Gest. 3º Tri", "Gest. IG Ignorada", "Puérpera"]

    for g in group_order:
        if g in grouped.index:
            row = grouped.loc[g]
            total = int(row.sum())
            if total == 0:
                continue
            outcomes.append(
                {
                    "group": g,
                    "cure": int(row["Cura (Sem UTI)"]),
                    "icu": int(row["UTI (Sobrevivente)"]),
                    "death": int(row["Óbito"]),
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
    antiviral_mask = pd.to_numeric(out.get("ANTIVIRAL"), errors="coerce") == 1

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


def compute_antiviral_outcome_impact(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compare Cure/Death rates between patients who used vs didn't use antivirals."""
    if df.empty:
        return []

    out = df.copy()
    out["used_antivir"] = pd.to_numeric(out.get("ANTIVIRAL"), errors="coerce").map(
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


def compute_symptoms_signature(
    df: pd.DataFrame, profile_type: str = "all", pathogens_mask_func=None
) -> dict[str, object]:
    """Calculate symptom prevalence (%) side-by-side for COVID, Flu, and VSR."""
    if df.empty:
        return {"labels": [], "bands": [], "matrices": {}}

    out = df.copy()
    age = _age_years(out)

    # 1. Define bands based on profile
    bands = []
    if profile_type == "crianca":
        bands = [
            ("<2 anos", age < 2),
            ("2-5 anos", (age >= 2) & (age < 6)),
            ("6-11 anos", (age >= 6) & (age < 12)),
        ]
    elif profile_type == "adolescente":
        bands = [
            ("12-14 anos", (age >= 12) & (age < 15)),
            ("15-19 anos", (age >= 15) & (age < 20)),
        ]
    elif profile_type == "adulto":
        bands = [
            ("20-39 anos", (age >= 20) & (age < 40)),
            ("40-59 anos", (age >= 40) & (age < 60)),
        ]
    elif profile_type == "idoso":
        bands = [
            ("60-69 anos", (age >= 60) & (age < 70)),
            ("70-79 anos", (age >= 70) & (age < 80)),
            ("80+ anos", age >= 80),
        ]
    else:  # "all" view
        bands = [
            ("Criança", age < 12),
            ("Adolescente", (age >= 12) & (age < 20)),
            ("Adulto", (age >= 20) & (age < 60)),
            ("Idoso", age >= 60),
        ]

    band_labels = [b[0] for b in bands]
    band_masks = [b[1].reindex(out.index, fill_value=False).fillna(False) for b in bands]

    # 2. Symptoms to analyze
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

    # 3. Pathogen groups
    if pathogens_mask_func is not None:
        pathogens = pathogens_mask_func(out)
    else:
        classi = pd.to_numeric(out.get("CLASSI_FIN", pd.Series(index=out.index)), errors="coerce")
        pathogens = {
            "covid": (classi == 5).reindex(out.index, fill_value=False).fillna(False),
            "gripe": (classi == 1).reindex(out.index, fill_value=False).fillna(False),
            "vsr": (
                (
                    pd.to_numeric(out.get("PCR_VSR", pd.Series(index=out.index)), errors="coerce")
                    == 1
                )
                | (
                    pd.to_numeric(out.get("AN_VSR", pd.Series(index=out.index)), errors="coerce")
                    == 1
                )
            )
            .reindex(out.index, fill_value=False)
            .fillna(False),
        }

    # 4. Calculate prevalence per pathogen, per band, per symptom
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

                has_symptom = (pd.to_numeric(subset.get(field_id), errors="coerce") == 1).sum()
                prevalence = round((has_symptom / len(subset)) * 100, 1)
                row.append([prevalence, int(has_symptom)])
                symptom_avg_freq[field_id] += prevalence
            matrix.append(row)
        matrices[p_key] = matrix

    # 5. Sort symptoms by average frequency
    sorted_symptoms = sorted(symptom_fields, key=lambda x: symptom_avg_freq[x[0]], reverse=True)

    # Reorder matrices based on sorted symptoms
    for p_key in matrices:
        reordered = []
        for field_id, _ in sorted_symptoms:
            idx = [f[0] for f in symptom_fields].index(field_id)
            reordered.append(matrices[p_key][idx])
        matrices[p_key] = reordered

    return {"labels": [s[1] for s in sorted_symptoms], "bands": band_labels, "matrices": matrices}
