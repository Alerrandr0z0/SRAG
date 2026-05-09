"""Surveillance metrics: Viruses, Testing, Variants, Alerts, and Vaccines."""

from contextlib import suppress
from typing import Any

import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter

from srag.data.analytics.filters import outcome_death_mask
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
                is_crianca_8y = True
        elif tp_idade == 3 and nu_idade <= 8:
            is_crianca_8y = True
    else:
        if (1000 <= nu_idade <= 1365) or (2000 <= nu_idade < 2006):
            is_menor_6m = True
        elif (2006 <= nu_idade <= 2011) or (3000 <= nu_idade <= 3008):
            is_crianca_8y = True

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
    out["virus"] = infer_etiologic_agent(out)

    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    ts = out.groupby(["epi_week", "virus"]).size().reset_index(name="count")
    # Exclui 'Não Especificada' para focar apenas em circulação viral confirmada
    ts = ts[ts["virus"] != "Não Especificada"]
    return ts.sort_values(["epi_week", "count"], ascending=[True, False])


def compute_alert_thresholds(df: pd.DataFrame) -> dict[str, int]:
    """Calculate historical alert thresholds (percentiles) for Mossoró."""
    if df.empty:
        return {"medium": 0, "high": 0, "very_high": 0}

    out = df.copy()
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

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


def compute_notification_delay_series(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate the timeline of delay between symptoms onset and notification."""
    if df.empty:
        return []

    out = df.copy()
    out["DT_SIN_PRI"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce")
    out["DT_NOTIFIC"] = pd.to_datetime(out["DT_NOTIFIC"], errors="coerce")

    valid = out.dropna(subset=["DT_SIN_PRI", "DT_NOTIFIC"])
    valid = valid[valid["DT_NOTIFIC"] >= valid["DT_SIN_PRI"]]

    if valid.empty:
        return []

    valid["delay"] = (valid["DT_NOTIFIC"] - valid["DT_SIN_PRI"]).dt.days
    valid = valid[valid["delay"] <= 60]

    valid["se_year_week"] = valid["DT_SIN_PRI"].apply(get_epi_week)
    valid["epi_week"] = valid["se_year_week"].apply(lambda x: format_epi_week(*x))

    ts = (
        valid.groupby("epi_week")
        .agg(median_delay=("delay", "median"), record_count=("delay", "size"))
        .reset_index()
    )
    return ts.sort_values("epi_week").to_dict(orient="records")


def compute_positivity_trend(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate weekly tested cases and positivity rate."""
    if df.empty:
        return []

    out = df.copy()
    pcr_res = pd.to_numeric(out.get("PCR_RESUL"), errors="coerce")
    an_res = pd.to_numeric(out.get("RES_AN"), errors="coerce")
    pd.to_numeric(out.get("AMOSTRA"), errors="coerce")

    # Apenas casos que coletaram amostra (1=Sim) são considerados para
    # o denominador de positividade
    # Fallback para o nome da coluna conforme o dicionário/schema
    col_amostra = out.get("AMOSTRA")
    if col_amostra is None:
        out["is_tested"] = True  # Fallback para considerar todos como testados se a coluna sumir
    else:
        out["is_tested"] = pd.to_numeric(col_amostra, errors="coerce") == 1

    out["is_positive"] = (pcr_res == 1) | (an_res == 1)

    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

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
    """Group cases by epidemiological week for trend analysis."""
    if df.empty:
        return pd.DataFrame(columns=["epi_week", "total"])

    out = df.copy()
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

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

    genomic["epi_week"] = genomic["DT_SIN_PRI"].dt.strftime("%Y-W%V")

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
    out["is_death"] = pd.to_numeric(out.get("EVOLUCAO"), errors="coerce") == 2

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

            # CFR: deaths / total cases in cell
            deaths = cell_df["is_death"].sum()
            total = len(cell_df)
            cfr = round((deaths / total) * 100, 1)
            row.append(cfr)
        matrix.append(row)

    return {"agents": agents, "age_bands": age_bands, "matrix": matrix}


def compute_codetection_matrix(df: pd.DataFrame) -> dict[str, Any]:
    """Cross-tabulate co-occurrence of different respiratory viruses."""
    if df.empty:
        return {"labels": [], "matrix": []}

    # Focus on cases where co-detection was flagged
    # Filter only cases where CO_DETEC == 1
    out = df[pd.to_numeric(df.get("CO_DETEC"), errors="coerce") == 1].copy()

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


def compute_antiviral_types(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Specific types of antiviral drugs used (Oseltamivir, etc.)."""
    if df.empty:
        return []

    out = df.copy()

    flu_map = {1: "Oseltamivir", 2: "Zanamivir", 3: "Outro (Gripe)"}
    cov_map = {1: "Paxlovid", 2: "Lagevrio", 3: "Olumiant", 4: "Outro (COVID)"}

    results = []

    col_tp_antivir = out.get("TP_ANTIVIR")
    if col_tp_antivir is not None:
        series_tp = (
            pd.Series(col_tp_antivir)
            if not isinstance(col_tp_antivir, pd.Series)
            else col_tp_antivir
        )
        flu_counts = pd.to_numeric(series_tp, errors="coerce").map(flu_map).value_counts()
        for label, count in flu_counts.items():
            results.append({"label": str(label), "count": int(count)})

    col_tipo_trat = out.get("TIPO_TRAT")
    if col_tipo_trat is not None:
        series_trat = (
            pd.Series(col_tipo_trat) if not isinstance(col_tipo_trat, pd.Series) else col_tipo_trat
        )
        cov_counts = pd.to_numeric(series_trat, errors="coerce").map(cov_map).value_counts()
        for label, count in cov_counts.items():
            results.append({"label": str(label), "count": int(count)})

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

    turnaround = pd.concat(
        [(dt_pcr - dt_coleta).dt.days, (dt_res_an - dt_coleta).dt.days], ignore_index=True
    )
    turnaround = pd.to_numeric(turnaround, errors="coerce")
    turnaround = turnaround[(turnaround >= 0) & (turnaround <= 30)]
    median_turnaround = float(round(turnaround.median(), 1)) if not turnaround.empty else 0.0

    codetec_count = int((pd.to_numeric(out.get("CO_DETEC"), errors="coerce") == 1).sum())

    overall_positive = float(round((tested["is_positive"].mean() * 100), 2))

    # Cálculo de Reinfecções (Campo 96: VG_REINF == 1)
    reinfection_ts = []
    if "VG_REINF" in out.columns:
        reinf_df = out[pd.to_numeric(out["VG_REINF"], errors="coerce") == 1].copy()
        if not reinf_df.empty:
            reinf_df["se_year_week"] = reinf_df["DT_SIN_PRI"].apply(get_epi_week)
            reinf_df["epi_week"] = reinf_df["se_year_week"].apply(lambda x: format_epi_week(*x))
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
            "codetection_cases": codetec_count,
            "reinfection_total": int(
                (pd.to_numeric(out.get("VG_REINF"), errors="coerce") == 1).sum()
            ),
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
        if name == "NÃO INFORMADO":
            return name
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
        "nao_vacinado",
        "bivalente",
        "reforco_2",
        "reforco_1",
        "completo",
        "dose_1",
        "protegido",
        "dose_1",
        "dose_2",
        "dose_unica",
        "vencida",
        "ignorado",
        "inconsistencia",
    ]

    results: list[dict[str, Any]] = []

    for perfil in valid_profiles:
        subset = out[out["perfil"] == perfil]
        if subset.empty:
            continue

        count = len(subset)

        death_mask = outcome_death_mask(subset["EVOLUCAO"])
        cure_mask = subset["EVOLUCAO"] == 1

        taxa_obito = round(death_mask.sum() / count, 4) if count > 0 else 0.0
        taxa_cura = round(cure_mask.sum() / count, 4) if count > 0 else 0.0

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
        dose_p25 = round(float(np.percentile(dose_to_symptom, 25)), 1) if dose_to_symptom else None
        dose_p75 = round(float(np.percentile(dose_to_symptom, 75)), 1) if dose_to_symptom else None

        mediana_sintoma_internacao = (
            round(float(np.median(symptom_to_hosp)), 1) if symptom_to_hosp else 0.0
        )
        intern_p25 = (
            round(float(np.percentile(symptom_to_hosp, 25)), 1) if symptom_to_hosp else 0.0
        )
        intern_p75 = (
            round(float(np.percentile(symptom_to_hosp, 75)), 1) if symptom_to_hosp else 0.0
        )

        mediana_internacao_desfecho = (
            round(float(np.median(hosp_to_outcome)), 1) if hosp_to_outcome else 0.0
        )
        desf_p25 = round(float(np.percentile(hosp_to_outcome, 25)), 1) if hosp_to_outcome else 0.0
        desf_p75 = round(float(np.percentile(hosp_to_outcome, 75)), 1) if hosp_to_outcome else 0.0

        uti_pct = round((pd.to_numeric(subset.get("UTI"), errors="coerce") == 1).mean() * 100, 1)

        severity_score = round((taxa_obito * 0.6) + (taxa_cura * 0.4), 4)

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

        results.append(
            {
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
                "count": count,  # Mantém compatibilidade legada se necessário
            }
        )

    return results
