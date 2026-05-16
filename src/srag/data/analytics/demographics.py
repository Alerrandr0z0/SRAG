"""Demographic analysis (Age, Race, Schooling, Profiles)."""

from typing import Any

import numpy as np
import pandas as pd

from srag.data.analytics.filters import _age_years, outcome_death_mask


def categorize_age(age: float) -> str:
    """Map numeric age in years to epidemiological age buckets with high granularity."""
    if age < 2:
        return "0-1 ano"
    if age < 5:
        return "2-4 anos"
    if age < 10:
        return "5-9 anos"
    if age < 15:
        return "10-14 anos"
    if age < 20:
        return "15-19 anos"
    if age < 30:
        return "20-29 anos"
    if age < 40:
        return "30-39 anos"
    if age < 50:
        return "40-49 anos"
    if age < 60:
        return "50-59 anos"
    if age < 70:
        return "60-69 anos"
    if age < 80:
        return "70-79 anos"
    return "80+ anos"


def compute_age_groups(df: pd.DataFrame) -> pd.DataFrame:
    """Categorize cases by age groups common in epidemiology."""
    if df.empty:
        return pd.DataFrame()

    df = df.copy()

    if "IDADE_ANOS" not in df.columns:
        if "TP_IDADE" in df.columns:
            tp = pd.to_numeric(df["TP_IDADE"], errors="coerce")
            idade_bruta = pd.to_numeric(df["NU_IDADE_N"], errors="coerce")
            idade_anos = pd.Series(pd.NA, index=df.index, dtype="Float64")
            idade_anos = idade_anos.mask(tp == 3, idade_bruta)
            idade_anos = idade_anos.mask(tp == 2, idade_bruta / 12.0)
            idade_anos = idade_anos.mask(tp == 1, idade_bruta / 365.25)
            df["IDADE_ANOS"] = idade_anos
        else:
            df["IDADE_ANOS"] = pd.to_numeric(df["NU_IDADE_N"], errors="coerce")

    age_series = pd.to_numeric(df["IDADE_ANOS"], errors="coerce")
    age_series = age_series[age_series >= 0]

    if age_series.empty:
        return pd.DataFrame(columns=["faixa_etaria", "count"])

    age_df = pd.DataFrame({"IDADE_ANOS": age_series})
    age_df["faixa_etaria"] = age_df["IDADE_ANOS"].apply(categorize_age)

    return age_df.groupby("faixa_etaria").size().reset_index(name="count")


def compute_citizen_pyramid(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Build a single dynamic age pyramid based on the current filtered dataframe."""
    if df.empty:
        return []

    out = df.copy()
    age = _age_years(out)
    if age.empty or age.isna().all():
        return []

    min_age = int(age.min())
    max_age = int(age.max())

    if max_age - min_age <= 15:
        bins = np.arange(min_age, max_age + 2, 2)
    else:
        bins = np.arange(0, max_age + 10, 10)

    if len(bins) < 2:
        return []
    labels = [f"{int(bins[i])}-{int(bins[i + 1] - 1)}" for i in range(len(bins) - 1)]
    if bins[-1] >= 80:
        labels[-1] = f"{int(bins[-2])}+"

    out["age_bin"] = pd.cut(age, bins=[float(b) for b in bins], labels=labels, right=False)

    pyramid = []
    counts = out.groupby(["age_bin", "CS_SEXO"], observed=False).size().unstack(fill_value=0)

    for label in labels:
        male = int(counts.loc[label].get("M", 0)) if label in counts.index else 0  # type: ignore[arg-type]
        female = int(counts.loc[label].get("F", 0)) if label in counts.index else 0  # type: ignore[arg-type]
        pyramid.append({"age_band": label, "male": male, "female": female})

    return pyramid


def compute_race_profile(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Aggregate race/color profile using official SIVEP CS_RACA codes."""
    if df.empty or "CS_RACA" not in df.columns:
        return []

    labels = {
        1: "Branca",
        2: "Preta",
        3: "Amarela",
        4: "Parda",
        5: "Indígena",
    }

    out = df.copy()
    out["cs_raca_num"] = pd.to_numeric(out["CS_RACA"], errors="coerce")
    out = out[out["cs_raca_num"].isin(labels.keys())]
    if out.empty:
        return []

    grouped = out.groupby("cs_raca_num").size().reset_index(name="count")
    grouped = grouped.sort_values("cs_raca_num")

    result: list[dict[str, int | str]] = []
    for row in grouped.itertuples(index=False):
        code = int(row.cs_raca_num)  # type: ignore[arg-type]
        result.append(
            {
                "code": code,
                "label": labels[code],
                "count": int(row.count),  # type: ignore[arg-type]
            }
        )
    return result


def compute_schooling_profile(df: pd.DataFrame) -> list[dict[Any, Any]]:
    """Schooling profile with SIVEP context rule for 'não se aplica'."""
    if df.empty or "CS_ESCOL_N" not in df.columns:
        return []

    out = df.copy()
    escol = pd.to_numeric(out["CS_ESCOL_N"], errors="coerce")
    age = _age_years(out)

    valid = escol.notna()
    valid = valid & (~((escol == 5) & (age >= 7)))
    work = pd.DataFrame({"escol": escol[valid]})
    if work.empty:
        return []

    labels = {
        0: "Sem escolaridade",
        1: "Fundamental I",
        2: "Fundamental II",
        3: "Médio",
        4: "Superior",
        5: "Não se aplica",
        9: "Ignorado",
    }
    work["label"] = work["escol"].map(lambda v: labels.get(int(v), "Outro"))
    grouped = work.groupby("label").size().reset_index(name="count")
    grouped = grouped.sort_values("count", ascending=False)
    return grouped.to_dict(orient="records")


def _profile_metrics(df: pd.DataFrame) -> dict[str, float | int]:
    """Compute severity and prevention summary for a profile slice."""
    if df.empty:
        return {
            "count": 0,
            "hospital_rate": 0.0,
            "uti_rate": 0.0,
            "death_rate": 0.0,
            "covid_vaccinated_rate": 0.0,
        }

    total = len(df)
    hospital = (pd.to_numeric(df["HOSPITAL"], errors="coerce") == 1).sum()
    uti = (pd.to_numeric(df["UTI"], errors="coerce") == 1).sum()
    death = outcome_death_mask(df["EVOLUCAO"]).sum()
    covid_vac = (pd.to_numeric(df["VACINA_COV"], errors="coerce") == 1).sum()

    return {
        "count": int(total),
        "hospital_rate": round((hospital / total) * 100, 2),
        "uti_rate": round((uti / total) * 100, 2),
        "death_rate": round((death / total) * 100, 2),
        "covid_vaccinated_rate": round((covid_vac / total) * 100, 2),
    }


def compute_citizen_profile_tree(df: pd.DataFrame) -> dict[str, object]:
    """Build hierarchical citizen profiles for dashboard drilldown."""
    if df.empty:
        return {"macro_profiles": []}

    out = df.copy()
    age = _age_years(out)
    is_child = age < 12
    is_adolescent = (age >= 12) & (age < 20)
    is_adult = (age >= 20) & (age < 60)
    is_elderly = age >= 60

    macro_defs = [
        ("crianca", "Criança", is_child),
        ("adolescente", "Adolescente", is_adolescent),
        ("adulto", "Adulto", is_adult),
        ("idoso", "Idoso", is_elderly),
    ]

    profiles: list[dict[str, object]] = []
    for key, label, mask in macro_defs:
        subset = out[mask.fillna(False)]
        subprofiles: list[dict[str, object]] = []

        if key == "crianca":
            c_age = _age_years(subset)
            p1 = subset[c_age < 2]
            p2 = subset[(c_age >= 2) & (c_age < 6)]
            p3 = subset[(c_age >= 6) & (c_age < 12)]
            subprofiles = [
                {"key": "lt_2y", "label": "<2 anos", **_profile_metrics(p1)},
                {"key": "2_5y", "label": "2-5 anos", **_profile_metrics(p2)},
                {"key": "6_11y", "label": "6-11 anos", **_profile_metrics(p3)},
            ]
        elif key == "adolescente":
            a_age = _age_years(subset)
            p1 = subset[(a_age >= 12) & (a_age < 15)]
            p2 = subset[(a_age >= 15) & (a_age < 20)]
            subprofiles = [
                {"key": "12_14y", "label": "12-14 anos", **_profile_metrics(p1)},
                {"key": "15_19y", "label": "15-19 anos", **_profile_metrics(p2)},
            ]
        elif key == "adulto":
            ad_age = _age_years(subset)
            p1 = subset[(ad_age >= 20) & (ad_age < 40)]
            p2 = subset[(ad_age >= 40) & (ad_age < 60)]
            subprofiles = [
                {"key": "20_39y", "label": "20-39 anos", **_profile_metrics(p1)},
                {"key": "40_59y", "label": "40-59 anos", **_profile_metrics(p2)},
            ]
        elif key == "idoso":
            old_age = _age_years(subset)
            p1 = subset[(old_age >= 60) & (old_age <= 69)]
            p2 = subset[(old_age >= 70) & (old_age <= 79)]
            p3 = subset[old_age >= 80]
            subprofiles = [
                {"key": "60_69y", "label": "60-69 anos", **_profile_metrics(p1)},
                {"key": "70_79y", "label": "70-79 anos", **_profile_metrics(p2)},
                {"key": "80_plus", "label": "80+ anos", **_profile_metrics(p3)},
            ]

        profiles.append(
            {
                "key": key,
                "label": label,
                **_profile_metrics(subset),
                "subprofiles": subprofiles,
            }
        )

    return {"macro_profiles": profiles}


def compute_traditional_community_distribution(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Aggregate distribution of traditional communities (POV_CT)."""
    if df.empty:
        return []

    # Filter only cases belonging to a traditional community (POV_CT == 1)
    if "POV_CT" not in df.columns:
        return []
    pov_ct = pd.to_numeric(df["POV_CT"], errors="coerce")
    subset = df.loc[pov_ct == 1].copy()

    if subset.empty:
        return []

    # Normalization: handle empty or NaN strings
    subset["TP_POV_CT"] = (
        subset["TP_POV_CT"].fillna("NÃO INFORMADO").astype(str).str.strip().str.upper()
    )

    counts = subset["TP_POV_CT"].value_counts()

    return [{"label": str(k), "count": int(v)} for k, v in counts.items()]


def compute_occupation_profile(df: pd.DataFrame, top_n: int = 15) -> list[dict[str, Any]]:
    """Aggregate cases by occupation (CBO description)."""
    if df.empty or "PAC_DSCBO" not in df.columns:
        return []

    # Filter out empty or common non-informative values
    valid = df["PAC_DSCBO"].replace(["", "NAN", "NONE", "999999"], pd.NA).dropna()
    if valid.empty:
        return []

    counts = valid.str.strip().str.upper().value_counts().head(top_n)
    return [{"label": str(k), "count": int(v)} for k, v in counts.items()]


def compute_animal_contact_distribution(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Analyze risk factor regarding contact with animals (Field 33)."""
    if df.empty or "AVE_SUINO" not in df.columns:
        return []

    labels = {1: "Aves/Suínos", 2: "Sem Contato", 3: "Outros Animais", 9: "Ignorado"}

    out = df.copy()
    out["ave_suino_num"] = pd.to_numeric(out["AVE_SUINO"], errors="coerce").fillna(9)

    counts = out["ave_suino_num"].map(labels).value_counts()

    # Sort by established order
    order = ["Aves/Suínos", "Outros Animais", "Sem Contato", "Ignorado"]
    result = []
    for label in order:
        if label in counts:
            result.append({"label": label, "count": int(counts[label])})

    return result
