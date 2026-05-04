"""Core analytics and aggregation for Mossoró SRAG data."""

from contextlib import suppress
from typing import Any

import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter

from srag.data.references import DEATH_OUTCOMES, VALID_OUTCOMES
from srag.utils.epi_weeks import format_epi_week, get_epi_week

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


def apply_global_filters(
    df: pd.DataFrame,
    profiles: list[str] | None = None,
    races: list[str] | None = None,
    genders: list[str] | None = None,
    zonas: list[str] | None = None,
    bairros: list[str] | None = None,
    unidades: list[str] | None = None,
    years: list[int] | None = None,
) -> pd.DataFrame:
    """Apply hierarchy of filters with support for multi-selection."""
    if df.empty:
        return df

    out = df.copy()

    # 0. Anos
    if years:
        # Extrai o ano da coluna DT_SIN_PRI
        out["_tmp_year"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce").dt.year
        out = out[out["_tmp_year"].isin(years)]
        out = out.drop(columns=["_tmp_year"])

    # 1. Perfis (Lógica de macro-perfis)
    profiles = [p for p in (profiles or []) if p]
    races = [r for r in (races or []) if r]
    genders = [g for g in (genders or []) if g]
    zonas = [z for z in (zonas or []) if z]
    bairros = [b for b in (bairros or []) if b]
    unidades = [u for u in (unidades or []) if u]

    # 1. Macro Profiles Filter
    if profiles:
        age = _age_years(out)
        masks = []
        if "crianca" in profiles:
            masks.append(age < 12)
        if "adolescente" in profiles:
            masks.append((age >= 12) & (age < 20))
        if "adulto" in profiles:
            masks.append((age >= 20) & (age < 60))
        if "idoso" in profiles:
            masks.append(age >= 60)
        if masks:
            # Substitui o pd.concat(axis=1).any(axis=1) por uma soma lógica direta
            combined_mask = masks[0].fillna(False)
            for m in masks[1:]:
                combined_mask |= m.fillna(False)
            out = out[combined_mask]

    # 2. Race/Color Filter
    if races:
        race_map = {"Branca": 1, "Preta": 2, "Amarela": 3, "Parda": 4, "Indígena": 5}
        codes = [race_map.get(r) for r in races if r in race_map]
        if codes:
            out = out[out["CS_RACA"].isin(codes)]

    # 3. Gender Filter
    if genders:
        # SIVEP: M=Masculino, F=Feminino, I=Ignorado
        gender_codes = [g.upper() for g in genders if g.upper() in ["M", "F", "I"]]
        if gender_codes:
            out = out[out["CS_SEXO"].isin(gender_codes)]

    # 4. Zone Filter
    if zonas:
        zona_norm = [str(z).strip().upper() for z in zonas]
        out = out[out["ZONA"].fillna("").astype(str).str.upper().str.strip().isin(zona_norm)]

    # 5. Bairro Filter
    if bairros:
        bairro_norm = [str(b).strip().upper() for b in bairros]
        out = out[
            out["BAIRRO_REF"].fillna("").astype(str).str.upper().str.strip().isin(bairro_norm)
        ]

    # 6. Unit Filter
    if unidades:
        unidade_norm = [str(u).strip().upper() for u in unidades]
        out = out[
            out["ID_UNIDADE"].fillna("").astype(str).str.upper().str.strip().isin(unidade_norm)
        ]

    return out


def outcome_death_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for fatal outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(DEATH_OUTCOMES)


def outcome_valid_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for clinically resolved outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(VALID_OUTCOMES)


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
        pcr_vsr = pd.to_numeric(out.get("PCR_VSR"), errors="coerce")
        an_vsr = pd.to_numeric(out.get("AN_VSR"), errors="coerce")
        agent.loc[(pcr_vsr == 1) | (an_vsr == 1)] = "VSR"

    return agent.astype(str)


def classificar_status_gripe(row: pd.Series | dict) -> str:
    """Determine epidemiological status for Flu based on vaccination date and symptoms."""
    vacina = row.get("VACINA")
    dt_dose = row.get("DT_UT_DOSE")
    dt_sintoma = row.get("DT_SIN_PRI")

    try:
        vacina = float(vacina) if pd.notna(vacina) else np.nan
    except TypeError, ValueError:
        vacina = np.nan

    nu_idade = float(row.get("NU_IDADE_N", 0)) if pd.notna(row.get("NU_IDADE_N")) else 0
    is_menor_6m = False
    is_crianca_8y = False
    tp_idade = row.get("TP_IDADE")

    if pd.notna(tp_idade):
        if tp_idade == 1:
            is_menor_6m = True
        elif tp_idade == 2:
            if nu_idade < 6:
                is_menor_6m = True
            else:
                is_crianca_8y = True  # Between 6 months and 1 year
        elif tp_idade == 3 and nu_idade <= 8:
            is_crianca_8y = True
    else:
        if (1000 <= nu_idade <= 1365) or (2000 <= nu_idade < 2006):
            is_menor_6m = True
        elif (2006 <= nu_idade <= 2011) or (3000 <= nu_idade <= 3008):
            is_crianca_8y = True

    label_prefix = "protegido"

    # 1. Handle infants < 6 months (Mother's Vaccine)
    if is_menor_6m:
        mae_vac = row.get("MAE_VAC")
        dt_vac_mae = row.get("DT_VAC_MAE")
        with suppress(TypeError, ValueError):
            vacina = float(mae_vac) if pd.notna(mae_vac) else vacina
        dt_dose = dt_vac_mae if pd.notna(dt_vac_mae) else dt_dose

    # 2. Handle children 6m - 8y (Specific doses)
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

    if pd.isna(vacina) or vacina == 9:
        return "ignorado"

    if vacina == 2:
        if pd.notna(dt_dose):
            return "inconsistencia"
        return "nao_vacinado"

    if vacina == 1:
        if pd.isna(dt_dose):
            return "ignorado"

        dt_dose_val = dt_dose.date() if isinstance(dt_dose, pd.Timestamp) else dt_dose
        dt_sintoma_val = dt_sintoma.date() if isinstance(dt_sintoma, pd.Timestamp) else dt_sintoma

        if pd.isna(dt_sintoma_val):
            return "ignorado"

        if isinstance(dt_dose_val, str):
            try:
                dt_dose_val = pd.to_datetime(dt_dose_val, dayfirst=True, format="mixed").date()
            except TypeError, ValueError:
                return "ignorado"

        if isinstance(dt_sintoma_val, str):
            try:
                dt_sintoma_val = pd.to_datetime(
                    dt_sintoma_val, dayfirst=True, format="mixed"
                ).date()
            except TypeError, ValueError:
                return "ignorado"

        if not hasattr(dt_dose_val, "year") or not hasattr(dt_sintoma_val, "year"):
            return "ignorado"

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
        else:
            return "vencida"

    return "ignorado"


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
    # Assume all cases in this subset are events (they got sick)
    # This represents the "time to breakthrough infection"
    kmf.fit(durations=km_df["months"], event_observed=np.ones(len(km_df)))

    surv = kmf.survival_function_.reset_index()
    ci = kmf.confidence_interval_.reset_index()

    return {
        "timeline": surv.iloc[:, 0].tolist(),
        "survival": (surv.iloc[:, 1] * 100).tolist(),
        "ci_upper": (ci.iloc[:, 1] * 100).tolist(),
        "ci_lower": (ci.iloc[:, 2] * 100).tolist(),
    }


def categorize_age(age: float) -> str:
    """Map numeric age in years to epidemiological age buckets."""
    if age < 2:
        return "0-1 ano"
    if age < 5:
        return "2-4 anos"
    if age < 10:
        return "5-9 anos"
    if age < 20:
        return "10-19 anos"
    if age < 40:
        return "20-39 anos"
    if age < 60:
        return "40-59 anos"
    return "60+ anos"


def compute_time_series_by_virus(df: pd.DataFrame) -> pd.DataFrame:
    """Group cases by epidemiological week and virus classification for segmented trends.

    Returns:
        DataFrame with columns: epi_week, virus, count.
    """
    if df.empty:
        return pd.DataFrame(columns=["epi_week", "virus", "count"])

    out = df.copy()
    out["virus"] = infer_etiologic_agent(out)

    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    ts = out.groupby(["epi_week", "virus"]).size().reset_index(name="count")
    return ts.sort_values(["epi_week", "count"], ascending=[True, False])


def compute_alert_thresholds(df: pd.DataFrame) -> dict[str, int]:
    """Calculate historical alert thresholds (percentiles) for Mossoró.

    Logic based on InfoGripe: uses historical weekly volumes to define
    intensity levels (Medium, High, Very High).
    """
    if df.empty:
        return {"medium": 0, "high": 0, "very_high": 0}

    # Agrupar por semana para obter a distribuição de volumes semanais
    out = df.copy()
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    weekly_volumes = out.groupby("epi_week").size()

    if len(weekly_volumes) < 4:
        return {"medium": 10, "high": 20, "very_high": 30}  # Valores default mínimos

    # Calculamos percentis 75, 90 e 95
    thresholds = {
        "medium": int(np.percentile(weekly_volumes, 75)),
        "high": int(np.percentile(weekly_volumes, 90)),
        "very_high": int(np.percentile(weekly_volumes, 95)),
    }

    # Garantir progressão mínima
    if thresholds["high"] <= thresholds["medium"]:
        thresholds["high"] = thresholds["medium"] + 5
    if thresholds["very_high"] <= thresholds["high"]:
        thresholds["very_high"] = thresholds["high"] + 5

    return thresholds


def compute_notification_delay_series(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate the timeline of delay between symptoms onset and notification."""
    if df.empty:
        return []

    out = df.copy()
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out["DT_NOTIFIC"] = pd.to_datetime(out["DT_NOTIFIC"], errors="coerce")

    # Filter invalid dates
    valid = out.dropna(subset=["DT_SIN_PRI", "DT_NOTIFIC"])
    valid = valid[valid["DT_NOTIFIC"] >= valid["DT_SIN_PRI"]]

    if valid.empty:
        return []

    valid["delay"] = (valid["DT_NOTIFIC"] - valid["DT_SIN_PRI"]).dt.days
    # Filter extreme outliers (> 60 days usually data entry errors)
    valid = valid[valid["delay"] <= 60]

    valid["se_year_week"] = valid["DT_SIN_PRI"].apply(get_epi_week)
    valid["epi_week"] = valid["se_year_week"].apply(lambda x: format_epi_week(*x))

    # Calculate median delay per week
    ts = valid.groupby("epi_week")["delay"].median().reset_index()
    ts = ts.rename(columns={"delay": "median_delay"})
    return ts.sort_values("epi_week").to_dict(orient="records")


def compute_positivity_trend(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate weekly tested cases and positivity rate."""
    if df.empty:
        return []

    out = df.copy()
    pcr_res = pd.to_numeric(out.get("PCR_RESUL"), errors="coerce")
    an_res = pd.to_numeric(out.get("RES_AN"), errors="coerce")

    # 1=Positivo, 2=Negativo, 3=Inconclusivo, 4=Não realizado, 5=Aguardando
    out["is_tested"] = pcr_res.isin([1, 2, 3]) | an_res.isin([1, 2, 3])
    out["is_positive"] = (pcr_res == 1) | (an_res == 1)

    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    grouped = (
        out.groupby("epi_week")
        .agg(tested=("is_tested", "sum"), positive=("is_positive", "sum"))
        .reset_index()
    )

    grouped["positivity_rate"] = (grouped["positive"] / grouped["tested"] * 100).fillna(0).round(1)
    return grouped.sort_values("epi_week").to_dict(orient="records")


def compute_influenza_subtypes(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Comprehensive distribution of Influenza subtypes and lineages."""
    if df.empty:
        return []

    # Filter all Influenza cases (A and B)
    flu = df[df["CLASSI_FIN"] == 1].copy()
    if flu.empty:
        return []

    results = []

    # 1. Influenza A Subtyping (PCR_FLUASU)
    # Codes: 1=H1N1, 2=H3N2, 3=Não subtipado, 4=Não subtipável, 5=Inconclusivo, 6=Outro
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

    # 2. Influenza B Lineages (PCR_FLUBLI)
    # Codes: 1=Victoria, 2=Yamagatha, 3=Não realizado, 4=Inconclusivo, 5=Outro
    flu_b_map = {1: "B (Victoria)", 2: "B (Yamagatha)", 5: "B (Outra Linhagem)"}

    col_b = flu.get("PCR_FLUBLI")
    if col_b is not None:
        flu_b_counts = pd.to_numeric(col_b, errors="coerce").map(flu_b_map).value_counts()
        for label, count in flu_b_counts.items():
            results.append({"label": label, "count": int(count)})

    # Sort by count
    results.sort(key=lambda x: x["count"], reverse=True)
    return results


def compute_antiviral_usage(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate adherence to antiviral treatment protocol."""
    if df.empty:
        return {"adherence_rate": 0, "total_indicated": 0, "treated": 0}

    flu_cases = df[df["CLASSI_FIN"] == 1]
    if flu_cases.empty:
        flu_cases = df

    treated = (pd.to_numeric(flu_cases.get("ANTIVIRAL"), errors="coerce") == 1).sum()
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
        pd.to_numeric(df.get("CRITERIO"), errors="coerce")
        .map(criteria_map)
        .fillna("Ignorado/Em Aberto")
        .value_counts()
    )
    return [{"label": k, "count": int(v)} for k, v in counts.items()]


def compute_time_series(df: pd.DataFrame) -> pd.DataFrame:
    """Group cases by epidemiological week for trend analysis.

    Args:
        df: The cleaned SRAG DataFrame.

    Returns:
        DataFrame with columns: epi_week, total.
    """
    if df.empty:
        return pd.DataFrame(columns=["epi_week", "total"])

    # Calculate SE for each case based on date of symptoms (DT_SIN_PRI)
    out = df.copy()
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    # Aggregate
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


def compute_virus_detailed_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Build detailed viral profile from laboratory fields when available."""
    if df.empty:
        return pd.DataFrame(columns=["virus", "count"])

    out = df.copy()
    out["virus"] = "Em investigacao"

    pcr_vsr = pd.to_numeric(out.get("PCR_VSR"), errors="coerce")
    an_vsr = pd.to_numeric(out.get("AN_VSR"), errors="coerce")
    out.loc[(pcr_vsr == 1) | (an_vsr == 1), "virus"] = "VSR"

    pcr_sars2 = pd.to_numeric(out.get("PCR_SARS2"), errors="coerce")
    an_sars2 = pd.to_numeric(out.get("AN_SARS2"), errors="coerce")
    out.loc[(pcr_sars2 == 1) | (an_sars2 == 1), "virus"] = "SARS-CoV-2"

    tp_flu_pcr = pd.to_numeric(out.get("TP_FLU_PCR"), errors="coerce")
    tp_flu_an = pd.to_numeric(out.get("TP_FLU_AN"), errors="coerce")
    out.loc[(tp_flu_pcr == 2) | (tp_flu_an == 2), "virus"] = "Influenza B"
    out.loc[(tp_flu_pcr == 1) | (tp_flu_an == 1), "virus"] = "Influenza A"

    classi = pd.to_numeric(out.get("CLASSI_FIN"), errors="coerce")
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


def compute_severity_metrics(df: pd.DataFrame) -> dict[str, float]:
    """Calculate key severity percentages for Mossoró."""
    if df.empty:
        return {"uti_rate": 0.0, "death_rate": 0.0}

    total = len(df)
    # Hospitalization (HOSPITAL=1), ICU (UTI=1), Outcome (EVOLUCAO=2: Death)
    uti_count = (df["UTI"] == 1).sum()
    death_count = outcome_death_mask(df["EVOLUCAO"]).sum()

    return {
        "uti_rate": round((uti_count / total) * 100, 2),
        "death_rate": round((death_count / total) * 100, 2),
        "total": total,
    }


def compute_territory_distribution(
    df: pd.DataFrame,
    min_cases: int = 5,
) -> pd.DataFrame:
    """Aggregate cases by neighborhood reference with privacy threshold."""
    if df.empty or "BAIRRO_REF" not in df.columns:
        return pd.DataFrame(columns=["bairro", "count"])

    out = df.copy()
    out["BAIRRO_REF"] = out["BAIRRO_REF"].fillna("NAO INFORMADO")
    grouped = out.groupby("BAIRRO_REF").size().reset_index(name="count")
    grouped = grouped[grouped["count"] >= min_cases]
    grouped = grouped.rename(columns={"BAIRRO_REF": "bairro"})
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_zone_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate cases by inferred urban/rural zone."""
    if df.empty or "ZONA" not in df.columns:
        return pd.DataFrame(columns=["zona", "count"])

    out = df.copy()
    out["ZONA"] = out["ZONA"].fillna("Nao informado")
    grouped = out.groupby("ZONA").size().reset_index(name="count")
    grouped = grouped.rename(columns={"ZONA": "zona"})
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_unit_distribution(df: pd.DataFrame, min_cases: int = 3) -> pd.DataFrame:
    """Aggregate notification records by notifying unit/hospital."""
    if df.empty or "ID_UNIDADE" not in df.columns:
        return pd.DataFrame(columns=["id_unidade", "count"])

    out = df.copy()
    out["ID_UNIDADE"] = out["ID_UNIDADE"].fillna("NAO INFORMADO")
    grouped = out.groupby("ID_UNIDADE").size().reset_index(name="count")
    grouped = grouped[grouped["count"] >= min_cases]
    grouped = grouped.rename(columns={"ID_UNIDADE": "id_unidade"})
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_territory_week_heatmap(
    df: pd.DataFrame,
    top_n_bairros: int = 12,
    last_n_weeks: int = 12,
    min_cases: int = 5,
) -> pd.DataFrame:
    """Build neighborhood x epidemiological-week matrix for heatmap visualizations."""
    if df.empty:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    required = {"BAIRRO_REF", "DT_SIN_PRI"}
    if not required.issubset(set(df.columns)):
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    out = df.copy()
    out = out[out["DT_SIN_PRI"].notna()]
    out["BAIRRO_REF"] = out["BAIRRO_REF"].fillna("NAO INFORMADO")
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    bairros = (
        out.groupby("BAIRRO_REF")
        .size()
        .reset_index(name="count")
        .query("count >= @min_cases")
        .sort_values("count", ascending=False)
        .head(top_n_bairros)["BAIRRO_REF"]
        .tolist()
    )
    if not bairros:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    week_order = sorted(out["epi_week"].dropna().unique())[-last_n_weeks:]
    if not week_order:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    filtered = out[out["BAIRRO_REF"].isin(bairros) & out["epi_week"].isin(week_order)]
    grouped = filtered.groupby(["BAIRRO_REF", "epi_week"]).size().reset_index(name="count")

    full_grid = pd.MultiIndex.from_product([bairros, week_order], names=["BAIRRO_REF", "epi_week"])
    matrix = (
        grouped.set_index(["BAIRRO_REF", "epi_week"])
        .reindex(full_grid, fill_value=0)
        .reset_index()
    )
    return matrix


def compute_territory_entities_by_zone(
    df: pd.DataFrame,
    min_cases: int = 3,
    limit: int = 40,
) -> dict[str, list[dict[str, int | str]]]:
    """Return selectable urban bairros and rural communities for filters."""
    if df.empty or "BAIRRO_REF" not in df.columns or "ZONA" not in df.columns:
        return {"urban_bairros": [], "rural_comunidades": []}

    out = df.copy()
    out["BAIRRO_REF"] = out["BAIRRO_REF"].fillna("NAO INFORMADO")
    out["zona_norm"] = out["ZONA"].fillna("").astype(str).str.upper().str.strip()

    grouped = out.groupby(["zona_norm", "BAIRRO_REF"]).size().reset_index(name="count")
    grouped = grouped[grouped["count"] >= min_cases]

    urban = (
        grouped[grouped["zona_norm"] == "URBANA"].sort_values("count", ascending=False).head(limit)
    )
    rural = (
        grouped[grouped["zona_norm"] == "RURAL"].sort_values("count", ascending=False).head(limit)
    )

    return {
        "urban_bairros": [
            {"name": str(r["BAIRRO_REF"]), "count": int(r["count"])} for _, r in urban.iterrows()
        ],
        "rural_comunidades": [
            {"name": str(r["BAIRRO_REF"]), "count": int(r["count"])} for _, r in rural.iterrows()
        ],
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
    out["DT_SIN_PRI"] = pd.to_datetime(out.get("DT_SIN_PRI"), errors="coerce")
    out["DT_INTERNA"] = pd.to_datetime(out.get("DT_INTERNA"), errors="coerce")
    out["DT_ENTUTI"] = pd.to_datetime(out.get("DT_ENTUTI"), errors="coerce")
    out["DT_EVOLUCA"] = pd.to_datetime(out.get("DT_EVOLUCA"), errors="coerce")
    out["DT_ANTIVIR"] = pd.to_datetime(out.get("DT_ANTIVIR"), errors="coerce")

    symptom_to_hosp = (out["DT_INTERNA"] - out["DT_SIN_PRI"]).dt.days
    hosp_to_icu = (out["DT_ENTUTI"] - out["DT_INTERNA"]).dt.days
    symptom_to_outcome = (out["DT_EVOLUCA"] - out["DT_SIN_PRI"]).dt.days

    def safe_median(series: pd.Series) -> float:
        clean = pd.to_numeric(series, errors="coerce")
        clean = clean[(clean >= 0) & (clean <= 180)]
        if clean.empty:
            return 0.0
        return float(round(clean.median(), 1))

    antiviral_mask = pd.to_numeric(out.get("ANTIVIRAL"), errors="coerce") == 1
    out_treated = out[antiviral_mask].dropna(subset=["DT_SIN_PRI", "DT_ANTIVIR"])
    
    protocol_48h_adherence = 0.0
    if not out_treated.empty:
        days_to_antiviral = (out_treated["DT_ANTIVIR"] - out_treated["DT_SIN_PRI"]).dt.days
        adherent = (days_to_antiviral >= 0) & (days_to_antiviral <= 2)
        protocol_48h_adherence = float(round((adherent.sum() / len(out_treated)) * 100, 1))

    return {
        "cases_with_hospital_date": int(out["DT_INTERNA"].notna().sum()),
        "cases_with_icu_dates": int(out["DT_ENTUTI"].notna().sum()),
        "cases_with_outcome_date": int(out["DT_EVOLUCA"].notna().sum()),
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


def compute_vaccination_and_treatment_profile(df: pd.DataFrame) -> dict[str, float | int]:
    """Summarize COVID/Influenza vaccination and antiviral usage."""
    if df.empty:
        return {
            "covid_vaccinated_count": 0,
            "flu_vaccinated_count": 0,
            "influenza_antiviral_count": 0,
            "covid_treatment_count": 0,
        }

    covid_vac = pd.to_numeric(df.get("VACINA_COV"), errors="coerce")
    flu_vac = pd.to_numeric(df.get("VACINA"), errors="coerce")
    antivir = pd.to_numeric(df.get("ANTIVIRAL"), errors="coerce")
    trat_cov = pd.to_numeric(df.get("TRAT_COV"), errors="coerce")

    return {
        "covid_vaccinated_count": int((covid_vac == 1).sum()),
        "flu_vaccinated_count": int((flu_vac == 1).sum()),
        "influenza_antiviral_count": int((antivir == 1).sum()),
        "covid_treatment_count": int((trat_cov == 1).sum()),
    }


def _age_years(df: pd.DataFrame) -> pd.Series:
    """Normalize age into years whenever possible."""
    # Se IDADE_ANOS já existir (calculada na ingestão ou no banco), usamos ela
    if "IDADE_ANOS" in df.columns and df["IDADE_ANOS"].notna().any():
        return pd.to_numeric(df["IDADE_ANOS"], errors="coerce")

    # Fallback para cálculo dinâmico baseado em TP_IDADE e NU_IDADE_N
    idade_bruta = pd.to_numeric(df.get("NU_IDADE_N"), errors="coerce").fillna(0)
    tp = pd.to_numeric(df.get("TP_IDADE"), errors="coerce")

    # 1=Dias, 2=Meses, 3=Anos
    idade_anos = pd.Series(pd.NA, index=df.index, dtype="Float64")
    idade_anos = idade_anos.mask(tp == 3, idade_bruta)
    idade_anos = idade_anos.mask(tp == 2, idade_bruta / 12.0)
    idade_anos = idade_anos.mask(tp == 1, idade_bruta / 365.25)

    # Se TP_IDADE for nulo, assumimos Anos se idade > 0
    idade_anos = idade_anos.mask(tp.isna(), idade_bruta)

    return pd.to_numeric(idade_anos, errors="coerce")


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
    hospital = (pd.to_numeric(df.get("HOSPITAL"), errors="coerce") == 1).sum()
    uti = (pd.to_numeric(df.get("UTI"), errors="coerce") == 1).sum()
    death = outcome_death_mask(df.get("EVOLUCAO", pd.Series(index=df.index))).sum()
    covid_vac = (pd.to_numeric(df.get("VACINA_COV"), errors="coerce") == 1).sum()

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


def compute_symptoms_signature(df: pd.DataFrame, profile_type: str = "all") -> dict[str, object]:
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
    # Ensure masks match the current dataframe index to avoid reindexing warnings
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
    classi = pd.to_numeric(out.get("CLASSI_FIN"), errors="coerce")
    pathogens = {
        "covid": (classi == 5).reindex(out.index, fill_value=False).fillna(False),
        "gripe": (classi == 1).reindex(out.index, fill_value=False).fillna(False),
        "vsr": (
            (pd.to_numeric(out.get("PCR_VSR"), errors="coerce") == 1)
            | (pd.to_numeric(out.get("AN_VSR"), errors="coerce") == 1)
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
                # Filter the pathogen-specific DF by the age band mask
                # We need to slice the mask to match p_df index
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


def compute_genomic_variants(df: pd.DataFrame) -> dict[str, object]:
    """Calculate variant dominance by epidemiological week for genomic surveillance."""
    if df.empty or "VG_OMS" not in df.columns:
        return {"weeks": [], "variants": {}}

    out = df.copy()

    # Filter cases with valid genomic data
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

    # Extract Epi Week based on DT_SIN_PRI
    genomic["DT_SIN_PRI"] = pd.to_datetime(genomic["DT_SIN_PRI"], errors="coerce")
    genomic = genomic.dropna(subset=["DT_SIN_PRI"])
    if genomic.empty:
        return {"weeks": [], "variants": {}}

    genomic["epi_week"] = genomic["DT_SIN_PRI"].dt.strftime("%Y-W%V")

    # Group and pivot to get counts per week per variant
    grouped = genomic.groupby(["epi_week", "variant_name"]).size().unstack(fill_value=0)

    # Convert to 100% stacked distribution
    row_totals = grouped.sum(axis=1)
    # Avoid division by zero (shouldn't happen due to dropna and size(), but safe)
    row_totals = row_totals.replace(0, 1)

    percentage_df = (grouped.div(row_totals, axis=0) * 100).round(1)

    weeks = percentage_df.index.tolist()
    variants_dict = {variant: percentage_df[variant].tolist() for variant in percentage_df.columns}

    return {"weeks": weeks, "variants": variants_dict}


def compute_imaging_profile(df: pd.DataFrame) -> dict[str, object]:
    """Comparison of findings between X-Ray and CT scans."""
    if df.empty:
        return {"raiox": [], "tomo": []}

    out = df.copy()

    # 1. Raio-X (RAIOX_RES): 1=Normal, 2=Infiltrado, 3=Consolidação,
    # 4=Misto, 5=Outro, 6=Não realizado
    raiox_map = {1: "Normal", 2: "Infiltrado", 3: "Consolidação", 4: "Misto", 5: "Outro"}
    col_rx = out.get("RAIOX_RES")
    raiox_data = []
    if col_rx is not None:
        raiox_counts = pd.to_numeric(col_rx, errors="coerce").map(raiox_map).value_counts()
        raiox_data = [{"label": k, "count": int(v)} for k, v in raiox_counts.items()]

    # 2. Tomografia (TOMO_RES): 1=Típico, 2=Indeterminado, 3=Atípico, 4=Negativo, 5=Outro
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

    # 1. Tipos de Teste (TP_SOR): 1=Rápido, 2=Elisa, 3=Quimioluminescência, 4=Outro
    sor_map = {1: "Rápido", 2: "Elisa", 3: "Quimio", 4: "Outro"}
    type_counts = pd.to_numeric(out.get("TP_SOR"), errors="coerce").map(sor_map).value_counts()
    types_data = [{"label": k, "count": int(v)} for k, v in type_counts.items()]

    # 2. Resultados IgG (RES_IGG): 1=Reagente, 2=Não Reagente, 3=Inconclusivo
    res_map = {1: "Reagente", 2: "Não Reagente", 3: "Inconclusivo"}
    igg_counts = pd.to_numeric(out.get("RES_IGG"), errors="coerce").map(res_map).value_counts()
    igg_data = [{"label": k, "count": int(v)} for k, v in igg_counts.items()]

    # 3. Resultados IgM (RES_IGM)
    igm_counts = pd.to_numeric(out.get("RES_IGM"), errors="coerce").map(res_map).value_counts()
    igm_data = [{"label": k, "count": int(v)} for k, v in igm_counts.items()]

    return {"types": types_data, "igg": igg_data, "igm": igm_data}


def compute_antiviral_types(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Specific types of antiviral drugs used (Oseltamivir, etc.)."""
    if df.empty:
        return []

    out = df.copy()
    # TP_ANTIVIR: 1=Oseltamivir, 2=Zanamivir, 3=Outro
    # TIPO_TRAT (COVID): 1=Paxlovid, 2=Lagevrio, 3=Olumiant, 4=Outro

    flu_map = {1: "Oseltamivir", 2: "Zanamivir", 3: "Outro (Gripe)"}
    cov_map = {1: "Paxlovid", 2: "Lagevrio", 3: "Olumiant", 4: "Outro (COVID)"}

    results = []

    flu_counts = pd.to_numeric(out.get("TP_ANTIVIR"), errors="coerce").map(flu_map).value_counts()
    for label, count in flu_counts.items():
        results.append({"label": label, "count": int(count)})

    cov_counts = pd.to_numeric(out.get("TIPO_TRAT"), errors="coerce").map(cov_map).value_counts()
    for label, count in cov_counts.items():
        results.append({"label": label, "count": int(count)})

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
    pcr_res = pd.to_numeric(out.get("PCR_RESUL"), errors="coerce")
    an_res = pd.to_numeric(out.get("RES_AN"), errors="coerce")

    tested_mask = pcr_res.isin([1, 2, 3, 5]) | an_res.isin([1, 2, 3, 5])
    tested = out[tested_mask].copy()
    if tested.empty:
        return {
            "labs": [],
            "overall": {"tested_cases": 0, "positive_rate": 0.0, "median_turnaround_days": 0.0},
        }

    lab_id = (
        tested.get("CO_LAB_AN", pd.Series(index=tested.index)).fillna("").astype(str).str.strip()
    )
    lab_name = (
        tested.get("LAB_AN", pd.Series(index=tested.index)).fillna("").astype(str).str.strip()
    )
    tested["lab_ref"] = lab_name.where(lab_name != "", lab_id)
    tested["lab_ref"] = tested["lab_ref"].replace("", "NAO INFORMADO")

    tested["is_positive"] = (pd.to_numeric(tested.get("PCR_RESUL"), errors="coerce") == 1) | (
        pd.to_numeric(tested.get("RES_AN"), errors="coerce") == 1
    )

    grouped = tested.groupby("lab_ref", as_index=False).agg(
        tested_cases=("lab_ref", "size"),
        positive_count=("is_positive", "sum"),
    )
    grouped["positive_rate"] = ((grouped["positive_count"] / grouped["tested_cases"]) * 100).round(
        2
    )
    grouped = grouped.sort_values("tested_cases", ascending=False)

    dt_coleta = pd.to_datetime(tested.get("DT_COLETA"), errors="coerce")
    dt_pcr = pd.to_datetime(tested.get("DT_PCR"), errors="coerce")
    dt_res_an = pd.to_datetime(tested.get("DT_RES_AN"), errors="coerce")

    # Previne o erro "cannot assemble with duplicate keys" ignorando o índice original das séries
    turnaround = pd.concat(
        [(dt_pcr - dt_coleta).dt.days, (dt_res_an - dt_coleta).dt.days], ignore_index=True
    )
    turnaround = pd.to_numeric(turnaround, errors="coerce")
    turnaround = turnaround[(turnaround >= 0) & (turnaround <= 30)]
    median_turnaround = float(round(turnaround.median(), 1)) if not turnaround.empty else 0.0

    # Cálculo de Co-detecção (Campo 79)
    codetec_count = int((pd.to_numeric(out.get("CO_DETEC"), errors="coerce") == 1).sum())

    overall_positive = float(round((tested["is_positive"].mean() * 100), 2))

    return {
        "labs": grouped.head(15).to_dict(orient="records"),
        "overall": {
            "tested_cases": len(tested),
            "positive_rate": overall_positive,
            "median_turnaround_days": median_turnaround,
            "codetection_cases": codetec_count,
        },
    }


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

    out = out[out["EVOLUCAO"].isin(list(DEATH_OUTCOMES))]

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

    # Define dynamic bins
    if max_age - min_age <= 15:
        bins = np.arange(min_age, max_age + 2, 2)
    else:
        bins = np.arange(0, max_age + 10, 10)

    if len(bins) < 2:
        return []
    labels = [f"{int(bins[i])}-{int(bins[i + 1] - 1)}" for i in range(len(bins) - 1)]
    if bins[-1] >= 80:
        labels[-1] = f"{int(bins[-2])}+"

    out["age_bin"] = pd.cut(age, bins=bins, labels=labels, right=False)

    pyramid = []
    counts = out.groupby(["age_bin", "CS_SEXO"], observed=False).size().unstack(fill_value=0)

    for label in labels:
        male = int(counts.loc[label].get("M", 0)) if label in counts.index else 0
        female = int(counts.loc[label].get("F", 0)) if label in counts.index else 0
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
        code = int(row.cs_raca_num)
        result.append(
            {
                "code": code,
                "label": labels[code],
                "count": int(row.count or 0),
            }
        )
    return result


def compute_schooling_profile(df: pd.DataFrame) -> list[dict[str, int | str]]:
    """Schooling profile with SIVEP context rule for 'não se aplica'."""
    if df.empty or "CS_ESCOL_N" not in df.columns:
        return []

    out = df.copy()
    escol = pd.to_numeric(out.get("CS_ESCOL_N"), errors="coerce")
    age = _age_years(out)

    # SIVEP rule: code 5 (não se aplica) only valid for age < 7 years.
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

    # Focar apenas em mulheres para esta análise
    fem = df[df["CS_SEXO"] == "F"].copy()
    if fem.empty:
        return {
            "maternal_outcomes": [],
            "gestantes_total": 0,
            "puerperas_total": 0,
            "maternal_cases": 0,
        }

    # Definir grupos maternos
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

    # Definir desfecho de gravidade (Prioridade: Óbito > UTI > Cura)
    def get_severity_outcome(row: pd.Series) -> str:
        # Óbito (Prioridade Máxima)
        if outcome_death_mask(pd.Series([row.get("EVOLUCAO")])).iloc[0]:
            return "Óbito"
        # UTI (Se não morreu, mas foi pra UTI)
        if pd.to_numeric(row.get("UTI"), errors="coerce") == 1:
            return "UTI (Sobrevivente)"
        # Cura (Sem UTI)
        if pd.to_numeric(row.get("EVOLUCAO"), errors="coerce") == 1:
            return "Cura (Sem UTI)"
        return "Outro/Em Aberto"

    fem["outcome"] = fem.apply(get_severity_outcome, axis=1)

    # Agrupar
    grouped = fem.groupby(["maternal_group", "outcome"]).size().unstack(fill_value=0)

    # Garantir que todas as colunas de desfecho existam
    for col in ["Cura (Sem UTI)", "UTI (Sobrevivente)", "Óbito"]:
        if col not in grouped.columns:
            grouped[col] = 0

    outcomes = []
    # Ordem sugerida para o gráfico (apenas grupos maternos ativos)
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

    # Totais para os KPIs
    gest_mask = pd.to_numeric(fem["CS_GESTANT"], errors="coerce").isin([1, 2, 3, 4])
    puerp_mask = pd.to_numeric(fem["PUERPERA"], errors="coerce") == 1

    return {
        "maternal_outcomes": outcomes,
        "gestantes_total": int(gest_mask.sum()),
        "puerperas_total": int(puerp_mask.sum()),
        "maternal_cases": int((gest_mask | puerp_mask).sum()),
    }


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


def compute_aggregated_timeline(df: pd.DataFrame, virus: str = "covid") -> list[dict[str, Any]]:
    """Compute aggregated clinical timeline by vaccine profile."""
    if df.empty:
        return []

    out = df.copy()
    out["DT_SIN_PRI"] = pd.to_datetime(out.get("DT_SIN_PRI"), errors="coerce")
    out["DT_INTERNA"] = pd.to_datetime(out.get("DT_INTERNA"), errors="coerce")
    out["DT_EVOLUCA"] = pd.to_datetime(out.get("DT_EVOLUCA"), errors="coerce")

    def get_covid_profile(row: pd.Series) -> str:
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

    def classify_profile(row: pd.Series) -> str:
        if virus == "gripe":
            return classificar_status_gripe(row)
        return get_covid_profile(row)

    out["perfil"] = out.apply(classify_profile, axis=1)

    valid_profiles = [
        "nao_vacinado", "bivalente", "reforco_2", "reforco_1", "completo", "dose_1",
        "protegido", "dose_1", "dose_2", "dose_unica", "vencida", "ignorado", "inconsistencia"
    ]

    results: list[dict[str, Any]] = []

    for perfil in valid_profiles:
        subset = out[out["perfil"] == perfil]
        if subset.empty:
            continue

        count = len(subset)

        death_mask = outcome_death_mask(subset["EVOLUCAO"])
        cure_mask = subset["EVOLUCAO"] == 1

        taxa_obito = round((death_mask.sum() / count) * 100, 2) if count > 0 else 0.0
        taxa_cura = round((cure_mask.sum() / count) * 100, 2) if count > 0 else 0.0

        dose_to_symptom: list[float] = []
        symptom_to_hosp: list[float] = []
        hosp_to_outcome: list[float] = []

        for _, r in subset.iterrows():
            dt_dose = None
            if virus == "covid":
                dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
                for col in dose_cols:
                    if pd.notna(r.get(col)):
                        dt_dose = pd.to_datetime(r.get(col), errors="coerce")
                        break
            else:
                dt_dose = pd.to_datetime(r.get("DT_UT_DOSE"), errors="coerce")

            dt_symptom = r.get("DT_SIN_PRI")
            dt_hosp = r.get("DT_INTERNA")
            dt_outcome = r.get("DT_EVOLUCA")

            if pd.notna(dt_dose) and pd.notna(dt_symptom):
                days = (dt_dose - dt_symptom).days
                if -180 <= days <= 180:
                    dose_to_symptom.append(days)

            if pd.notna(dt_symptom) and pd.notna(dt_hosp):
                days = (dt_hosp - dt_symptom).days
                if 0 <= days <= 180:
                    symptom_to_hosp.append(days)

            if pd.notna(dt_hosp) and pd.notna(dt_outcome):
                days = (dt_outcome - dt_hosp).days
                if 0 <= days <= 180:
                    hosp_to_outcome.append(days)

        mediana_dose_sintoma = (
            round(float(np.median(dose_to_symptom)), 1) if dose_to_symptom else None
        )
        mediana_sintoma_internacao = (
            round(float(np.median(symptom_to_hosp)), 1) if symptom_to_hosp else 0.0
        )
        mediana_internacao_desfecho = (
            round(float(np.median(hosp_to_outcome)), 1) if hosp_to_outcome else 0.0
        )

        severity_score = round((taxa_obito * 0.6) + (taxa_cura * 0.4) / 100, 2)

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

        results.append({
            "perfil": friendly_names.get(perfil, perfil),
            "status_key": perfil,
            "mediana_dose_sintoma": mediana_dose_sintoma,
            "mediana_sintoma_internacao": mediana_sintoma_internacao,
            "mediana_internacao_desfecho": mediana_internacao_desfecho,
            "taxa_cura": taxa_cura,
            "taxa_obito": taxa_obito,
            "severity_score": severity_score,
            "count": count,
        })

    return results
