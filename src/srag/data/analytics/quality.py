"""Quality and Diagnostic coverage metrics."""

from typing import Any

import numpy as np
import pandas as pd

from srag.data.cnes_lookup import lookup_unit_name
from srag.utils.epi_weeks import format_epi_week, get_epi_week


def compute_diagnostic_latency(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate quartiles for time between sample collection and PCR result for Box Plot."""
    if df.empty:
        return {"boxplot_data": [], "median": 0.0}

    out = df.copy()
    for col in ["DT_COLETA", "DT_PCR"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    # Valid range: 0 to 30 days (filter outliers/errors)
    if "DT_PCR" not in out.columns or "DT_COLETA" not in out.columns:
        return {"boxplot_data": [], "median": 0.0}

    valid = out.dropna(subset=["DT_COLETA", "DT_PCR"]).copy()
    valid["delta"] = (valid["DT_PCR"] - valid["DT_COLETA"]).dt.days
    valid = valid[(valid["delta"] >= 0) & (valid["delta"] <= 30)]

    if valid.empty:
        return {"boxplot_data": [], "median": 0.0}

    # Format for ECharts BoxPlot [min, Q1, median, Q3, max]
    deltas = valid["delta"].sort_values()
    stats = [
        float(deltas.min()),
        float(np.percentile(deltas, 25)),
        float(deltas.median()),
        float(np.percentile(deltas, 75)),
        float(deltas.max()),
    ]

    return {"boxplot_data": stats, "median": float(round(deltas.median(), 1)), "count": len(valid)}


def compute_sample_type_distribution(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Analyze TP_AMOSTRA distribution (1=Naso, 2=Lavado, etc.)."""
    if df.empty:
        return []

    col = df.get("TP_AMOSTRA")
    if col is None:
        return []

    sample_map = {
        1: "Secreção Naso/Orofaringe",
        2: "Lavado Bronco-alveolar",
        3: "Tecido post-mortem",
        4: "Outra",
        5: "LCR",
        9: "Ignorado",
    }

    # Force to series to ensure .map works even if input is single-row or scalar
    series = pd.Series(col) if not isinstance(col, pd.Series) else col
    counts = pd.to_numeric(series, errors="coerce").map(sample_map).value_counts()
    return [{"label": str(k), "count": int(v)} for k, v in counts.items()]


def compute_testing_coverage(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate what proportion of cases had samples collected."""
    if df.empty:
        return {"collected": 0, "total": 0, "rate": 0.0}

    col = df.get("AMOSTRA")
    if col is None:
        return {"collected": 0, "total": len(df), "rate": 0.0}

    total = len(df)
    series = pd.Series(col) if not isinstance(col, pd.Series) else col
    collected = (pd.to_numeric(series, errors="coerce") == 1).sum()

    return {
        "collected": int(collected),
        "total": total,
        "rate": round((collected / total * 100), 1) if total > 0 else 0.0,
    }


def compute_data_completeness(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate the completeness (non-null, non-ignored) of key SIVEP-Gripe fields.

    Calculates the percentage of valid records for multiple categories.
    """
    if df.empty:
        return []

    total = len(df)
    results = []

    def calc_rate(col: str, ignore_vals: list[Any] | None = None) -> float:
        if col not in df.columns:
            return 0.0
        series = df[col]
        denom = total

        # Gestante e Puérpera: apenas mulheres (CS_SEXO == "F")
        if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in df.columns:
            is_female = df["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
            series = series[is_female]
            denom = int(is_female.sum())

        # Considere NaN e strings vazias como incompletos
        valid = series.notna() & (series.astype(str).str.strip() != "")
        if ignore_vals:
            # Converte ignore_vals para string para comparação segura se necessário,
            # mas o SIVEP usa códigos numéricos em campos int
            ignores = ignore_vals + [str(v) for v in ignore_vals]
            valid = valid & ~series.isin(ignores)
        return round((valid.sum() / denom) * 100, 1) if denom > 0 else 100.0

    # Definição dos blocos de auditoria focados em qualidade do registro
    audit_blocks = {
        "Identificação do Caso": [
            ("Data da Notificação", calc_rate("DT_NOTIFIC")),
            ("Data dos Primeiros Sintomas", calc_rate("DT_SIN_PRI")),
            ("Sexo", calc_rate("CS_SEXO", ["I"])),
            ("Idade Normalizada", calc_rate("NU_IDADE_N")),
            ("Tipo de Idade", calc_rate("TP_IDADE")),
            ("Município de Notificação", calc_rate("ID_MUNICIP")),
            ("Unidade Notificadora", calc_rate("ID_UNIDADE")),
        ],
        "Demografia e Residência": [
            ("Raça/Cor", calc_rate("CS_RACA", [9])),
            ("Escolaridade", calc_rate("CS_ESCOL_N", [9])),
            ("Ocupação", calc_rate("PAC_DSCBO", [9, "9"])),
            ("Zona", calc_rate("CS_ZONA", [9])),
            ("Bairro", calc_rate("NM_BAIRRO")),
            ("Município de Residência", calc_rate("ID_MN_RESI")),
        ],
        "Linha do Cuidado": [
            ("Internação Hospitalar", calc_rate("HOSPITAL", [9])),
            ("Data de Internação", calc_rate("DT_INTERNA")),
            ("UTI", calc_rate("UTI", [9])),
            ("Entrada em UTI", calc_rate("DT_ENTUTI")),
            ("Suporte Ventilatório", calc_rate("SUPORT_VEN", [9])),
            ("Evolução", calc_rate("EVOLUCAO", [9])),
            ("Data de Evolução", calc_rate("DT_EVOLUCA")),
            ("Classificação Final", calc_rate("CLASSI_FIN", [9])),
            ("Critério de Confirmação", calc_rate("CRITERIO", [9])),
        ],
        "Coleta e Diagnóstico": [
            ("Amostra Coletada", calc_rate("AMOSTRA", [9])),
            ("Data de Coleta", calc_rate("DT_COLETA")),
            ("Tipo de Amostra", calc_rate("TP_AMOSTRA", [9])),
            ("Resultado PCR", calc_rate("PCR_RESUL", [9, 4, 5])),
            ("Resultado Antígeno", calc_rate("RES_AN", [9])),
            ("Data do PCR", calc_rate("DT_PCR")),
            ("Laboratório", calc_rate("LAB_AN")),
        ],
        "Vacinação e Gestação": [
            ("Vacina COVID-19", calc_rate("VACINA_COV", [9])),
            ("Dose 1 COVID", calc_rate("DOSE_1_COV", [9])),
            ("Dose 2 COVID", calc_rate("DOSE_2_COV", [9])),
            ("Reforço COVID", calc_rate("DOSE_REF", [9])),
            ("Vacina Influenza", calc_rate("VACINA", [9])),
            ("Data da Última Dose", calc_rate("DT_UT_DOSE")),
            ("Gestante", calc_rate("CS_GESTANT", [9])),
            ("Puérpera", calc_rate("PUERPERA", [9])),
        ],
    }

    for block_name, fields in audit_blocks.items():
        block_score = round(sum(f[1] for f in fields) / len(fields), 1) if fields else 0.0
        results.append(
            {
                "group": block_name,
                "overall_score": block_score,
                "fields": [{"field": f[0], "rate": f[1]} for f in fields],
            }
        )

    return results


def compute_completeness_trend(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Calculate epidemiological week trends of completeness per semantic block."""
    if df.empty:
        return []

    out = df.copy()

    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))
    out = out[out["epi_week"] != "N/A"]

    if out.empty:
        return []

    _blocks: dict[str, list[tuple[str, str, list[Any]]]] = {
        "identificacao": [
            ("Data da Notificação", "DT_NOTIFIC", []),
            ("Data dos Primeiros Sintomas", "DT_SIN_PRI", []),
            ("Sexo", "CS_SEXO", ["I"]),
            ("Idade Normalizada", "NU_IDADE_N", []),
            ("Tipo de Idade", "TP_IDADE", []),
            ("Município de Notificação", "ID_MUNICIP", []),
            ("Unidade Notificadora", "ID_UNIDADE", []),
        ],
        "demografia": [
            ("Raça/Cor", "CS_RACA", [9]),
            ("Escolaridade", "CS_ESCOL_N", [9]),
            ("Ocupação", "PAC_DSCBO", [9, "9"]),
            ("Zona", "CS_ZONA", [9]),
            ("Bairro", "NM_BAIRRO", []),
            ("Município de Residência", "ID_MN_RESI", []),
        ],
        "cuidado": [
            ("Internação Hospitalar", "HOSPITAL", [9]),
            ("Data de Internação", "DT_INTERNA", []),
            ("UTI", "UTI", [9]),
            ("Entrada em UTI", "DT_ENTUTI", []),
            ("Suporte Ventilatório", "SUPORT_VEN", [9]),
            ("Evolução", "EVOLUCAO", [9]),
            ("Data de Evolução", "DT_EVOLUCA", []),
            ("Classificação Final", "CLASSI_FIN", [9]),
            ("Critério de Confirmação", "CRITERIO", [9]),
        ],
        "diagnostico": [
            ("Amostra Coletada", "AMOSTRA", [9]),
            ("Data de Coleta", "DT_COLETA", []),
            ("Tipo de Amostra", "TP_AMOSTRA", [9]),
            ("Resultado PCR", "PCR_RESUL", [9, 4, 5]),
            ("Resultado Antígeno", "RES_AN", [9]),
            ("Data do PCR", "DT_PCR", []),
            ("Laboratório", "LAB_AN", []),
        ],
        "vacinacao": [
            ("Vacina COVID-19", "VACINA_COV", [9]),
            ("Dose 1 COVID", "DOSE_1_COV", [9]),
            ("Dose 2 COVID", "DOSE_2_COV", [9]),
            ("Reforço COVID", "DOSE_REF", [9]),
            ("Vacina Influenza", "VACINA", [9]),
            ("Data da Última Dose", "DT_UT_DOSE", []),
            ("Gestante", "CS_GESTANT", [9]),
            ("Puérpera", "PUERPERA", [9]),
        ],
    }

    _block_display = {
        "identificacao": "Identificação do Caso",
        "demografia": "Demografia e Residência",
        "cuidado": "Linha do Cuidado",
        "diagnostico": "Coleta e Diagnóstico",
        "vacinacao": "Vacinação e Gestação",
    }

    all_fields: list[tuple[str, str, list[Any]]] = []
    for fields in _blocks.values():
        all_fields.extend(fields)

    for _, col, ignore_vals in all_fields:
        valid_col = f"valid_{col}"
        if col in out.columns:
            series = out[col]
            is_valid = series.notna() & (series.astype(str).str.strip() != "")
            if ignore_vals:
                ignores = ignore_vals + [str(v) for v in ignore_vals]
                is_valid = is_valid & ~series.isin(ignores)
            if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in out.columns:
                is_female = out["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
                is_valid = is_valid | ~is_female
            out[valid_col] = is_valid
        else:
            out[valid_col] = False

    # Per-row block scores
    for bkey, fields in _blocks.items():
        vcols = [f"valid_{col}" for _, col, _ in fields]
        out[f"bs_{bkey}"] = out[vcols].mean(axis=1) * 100

    all_vcols = [f"valid_{col}" for _, col, _ in all_fields]
    out["row_score"] = out[all_vcols].mean(axis=1) * 100

    # Group by epi week
    bs_keys = [f"bs_{b}" for b in _blocks]
    trend = out.groupby("epi_week")[[*bs_keys, "row_score"]].mean().reset_index()
    trend["total"] = (
        out["epi_week"].value_counts().reindex(trend["epi_week"]).fillna(0).astype(int).values
    )
    trend = trend.sort_values("epi_week")

    return [
        {
            "epi_week": str(r.get("epi_week", "")),
            "score": round(float(r.get("row_score", 0.0)), 1),
            "total": int(r.get("total", 0)),
            "blocks": {_block_display[b]: round(float(r.get(f"bs_{b}", 0.0)), 1) for b in _blocks},
        }
        for r in trend.to_dict(orient="records")
    ]


def _geolocate_quality_units(
    unit_grouped: pd.DataFrame, df: pd.DataFrame
) -> tuple[list[str], list[str]]:
    """Resolve notifying unit locations (municipio and uf) from CNES lookup or notifications."""
    from srag.data.analytics.territorial import _resolve_mun_uf
    from srag.data.cnes_lookup import lookup_unit_record

    unit_to_mun = {}
    if "ID_UNIDADE" in df.columns and "ID_MUNICIP" in df.columns:
        has_uid = df["ID_UNIDADE"].notna()
        is_not_empty = df["ID_UNIDADE"].astype(str).str.strip() != ""
        valid_df = df[has_uid & is_not_empty]
        if not valid_df.empty:
            freq = valid_df.groupby(["ID_UNIDADE", "ID_MUNICIP"]).size().reset_index(name="sz")
            idx = freq.groupby("ID_UNIDADE")["sz"].idxmax()
            unit_to_mun = dict(
                zip(freq.loc[idx, "ID_UNIDADE"], freq.loc[idx, "ID_MUNICIP"], strict=False)
            )

    muns = []
    ufs = []
    for uid in unit_grouped["id_unidade"]:
        unit_id = str(uid)
        rec = lookup_unit_record(unit_id)
        if rec and isinstance(rec, dict) and rec.get("codigo_municipio"):
            mun, uf = _resolve_mun_uf(rec["codigo_municipio"])
        else:
            fallback_code = unit_to_mun.get(unit_id)
            mun, uf = _resolve_mun_uf(fallback_code)
        muns.append(mun)
        ufs.append(uf)

    return muns, ufs


def compute_quality_by_unit(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Group by notifying unit (CNES).

    Computes global quality score and most neglected field.
    """
    if df.empty:
        return []

    out = df.copy()
    out["ID_UNIDADE"] = out["ID_UNIDADE"].fillna("Nao informado").astype(str).str.strip()

    fields_to_audit = [
        # Label, Column, Ignore values
        ("Data da Notificação", "DT_NOTIFIC", []),
        ("Data dos Primeiros Sintomas", "DT_SIN_PRI", []),
        ("Sexo", "CS_SEXO", ["I"]),
        ("Idade Normalizada", "NU_IDADE_N", []),
        ("Tipo de Idade", "TP_IDADE", []),
        ("Município de Notificação", "ID_MUNICIP", []),
        ("Unidade Notificadora", "ID_UNIDADE", []),
        ("Raça/Cor", "CS_RACA", [9]),
        ("Escolaridade", "CS_ESCOL_N", [9]),
        ("Ocupação", "PAC_DSCBO", [9, "9"]),
        ("Zona", "CS_ZONA", [9]),
        ("Bairro", "NM_BAIRRO", []),
        ("Município de Residência", "ID_MN_RESI", []),
        ("Internação Hospitalar", "HOSPITAL", [9]),
        ("Data de Internação", "DT_INTERNA", []),
        ("UTI", "UTI", [9]),
        ("Entrada em UTI", "DT_ENTUTI", []),
        ("Suporte Ventilatório", "SUPORT_VEN", [9]),
        ("Evolução", "EVOLUCAO", [9]),
        ("Data de Evolução", "DT_EVOLUCA", []),
        ("Classificação Final", "CLASSI_FIN", [9]),
        ("Critério de Confirmação", "CRITERIO", [9]),
        ("Amostra Coletada", "AMOSTRA", [9]),
        ("Data de Coleta", "DT_COLETA", []),
        ("Tipo de Amostra", "TP_AMOSTRA", [9]),
        ("Resultado PCR", "PCR_RESUL", [9, 4, 5]),
        ("Resultado Antígeno", "RES_AN", [9]),
        ("Data do PCR", "DT_PCR", []),
        ("Laboratório", "LAB_AN", []),
        ("Vacina COVID-19", "VACINA_COV", [9]),
        ("Dose 1 COVID", "DOSE_1_COV", [9]),
        ("Dose 2 COVID", "DOSE_2_COV", [9]),
        ("Reforço COVID", "DOSE_REF", [9]),
        ("Vacina Influenza", "VACINA", [9]),
        ("Data da Última Dose", "DT_UT_DOSE", []),
        ("Gestante", "CS_GESTANT", [9]),
        ("Puérpera", "PUERPERA", [9]),
    ]

    blocks = {
        "Identificação": [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "CS_SEXO",
            "NU_IDADE_N",
            "TP_IDADE",
            "ID_MUNICIP",
            "ID_UNIDADE",
        ],
        "Demografia": [
            "CS_RACA",
            "CS_ESCOL_N",
            "PAC_DSCBO",
            "CS_ZONA",
            "NM_BAIRRO",
            "ID_MN_RESI",
        ],
        "Cuidado": [
            "HOSPITAL",
            "DT_INTERNA",
            "UTI",
            "DT_ENTUTI",
            "SUPORT_VEN",
            "EVOLUCAO",
            "DT_EVOLUCA",
            "CLASSI_FIN",
            "CRITERIO",
        ],
        "Diagnóstico": [
            "AMOSTRA",
            "DT_COLETA",
            "TP_AMOSTRA",
            "PCR_RESUL",
            "RES_AN",
            "DT_PCR",
            "LAB_AN",
        ],
        "Vacinação": [
            "VACINA_COV",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "VACINA",
            "DT_UT_DOSE",
            "CS_GESTANT",
            "PUERPERA",
        ],
    }

    # Pre-calculate boolean validity for each field
    for _, col, ignore_vals in fields_to_audit:
        valid_col = f"valid_{col}"
        if col in out.columns:
            series = out[col]
            is_valid = series.notna() & (series.astype(str).str.strip() != "")
            if ignore_vals:
                ignores = ignore_vals + [str(v) for v in ignore_vals]
                is_valid = is_valid & ~series.isin(ignores)

            # Gestante e Puérpera: apenas para mulheres
            if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in out.columns:
                is_female = out["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
                is_valid = is_valid | ~is_female

            out[valid_col] = is_valid
        else:
            out[valid_col] = False

    # Block scores per row
    block_cols = []
    for block_name, cols in blocks.items():
        block_col = f"block_score_{block_name}"
        block_cols.append(block_col)
        valid_cols = [f"valid_{col}" for col in cols]
        out[block_col] = out[valid_cols].mean(axis=1) * 100

    # Row global score: mean of block scores
    out["row_score"] = out[block_cols].mean(axis=1)

    # Group by unit
    valid_cols = [f"valid_{col}" for _, col, _ in fields_to_audit]
    agg_dict: dict[str, Any] = {col: "mean" for col in valid_cols}
    agg_dict["row_score"] = "mean"

    unit_grouped = out.groupby("ID_UNIDADE").agg(agg_dict).reset_index()
    unit_grouped = unit_grouped.rename(columns={"ID_UNIDADE": "id_unidade", "row_score": "score"})

    # Let's count occurrences per unit
    unit_counts = out["ID_UNIDADE"].value_counts().reset_index(name="total")
    unit_grouped = unit_grouped.merge(
        unit_counts, left_on="id_unidade", right_on="ID_UNIDADE"
    ).drop(columns=["ID_UNIDADE"])

    # Compute worst field and worst rate for each unit
    field_labels = {f"valid_{col}": label for label, col, _ in fields_to_audit}
    val_df = unit_grouped[valid_cols] * 100

    worst_col = val_df.idxmin(axis=1)
    worst_rate = val_df.min(axis=1)

    unit_grouped["worst_field"] = worst_col.map(field_labels)
    unit_grouped["worst_rate"] = worst_rate.round(1)
    unit_grouped["score"] = unit_grouped["score"].round(1)
    unit_grouped["nome_fantasia"] = unit_grouped["id_unidade"].apply(lookup_unit_name)

    # Resolve unit locations (municipio and uf)
    muns, ufs = _geolocate_quality_units(unit_grouped, df)
    unit_grouped["municipio"] = muns
    unit_grouped["uf"] = ufs

    result_cols = [
        "id_unidade",
        "nome_fantasia",
        "score",
        "total",
        "worst_field",
        "worst_rate",
        "municipio",
        "uf",
    ]
    unit_grouped = unit_grouped.sort_values("score", ascending=True)
    return [
        {
            "id_unidade": str(r.get("id_unidade", "")),
            "nome_fantasia": str(r.get("nome_fantasia", "")),
            "score": float(r.get("score", 0.0)),
            "total": int(r.get("total", 0)),
            "worst_field": str(r.get("worst_field", "")),
            "worst_rate": float(r.get("worst_rate", 0.0)),
            "municipio": str(r.get("municipio", "")),
            "uf": str(r.get("uf", "")),
        }
        for r in unit_grouped[result_cols].to_dict(orient="records")
    ]


def _is_eq(df: pd.DataFrame, col: str, val: object) -> pd.Series:
    if col not in df.columns:
        return pd.Series(False, index=df.index)
    series = df[col]
    return (series == val) | (series == str(val)) | (pd.to_numeric(series, errors="coerce") == val)


def _is_null_or_empty(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        return pd.Series(True, index=df.index)
    series = df[col]
    return series.isna() | (series.astype(str).str.strip() == "") | series.isin([9, "9"])


def _is_date_empty(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        return pd.Series(True, index=df.index)
    return df[col].isna() | (df[col].astype(str).str.strip() == "")


def _is_evolution_before_symptoms(df: pd.DataFrame) -> pd.Series:
    if "DT_EVOLUCA" not in df.columns or "DT_SIN_PRI" not in df.columns:
        return pd.Series(False, index=df.index)
    dt_evol = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
    dt_sint = pd.to_datetime(df["DT_SIN_PRI"], errors="coerce")
    return dt_evol.notna() & dt_sint.notna() & (dt_evol < dt_sint)


def compute_logical_inconsistencies(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Verify data logical inconsistencies cross-referencing multiple SIVEP fields."""
    if df.empty:
        return []

    total = len(df)
    results = []

    # R1: Óbito sem data
    r1_mask = _is_eq(df, "EVOLUCAO", 2) & _is_date_empty(df, "DT_EVOLUCA")

    # R2: Internação sem data
    r2_mask = _is_eq(df, "HOSPITAL", 1) & _is_date_empty(df, "DT_INTERNA")

    # R3: UTI sem entrada
    r3_mask = _is_eq(df, "UTI", 1) & _is_date_empty(df, "DT_ENTUTI")

    # R4: PCR detectável sem agente
    r4_mask = _is_eq(df, "PCR_RESUL", 1) & (
        _is_null_or_empty(df, "CLASSI_FIN") | _is_eq(df, "CLASSI_FIN", 4)
    )

    # R5: Antiviral sem data
    dt_antivir_col = (
        "DT_ANTIVIR"
        if "DT_ANTIVIR" in df.columns
        else ("DT_ANTIVIRAL" if "DT_ANTIVIRAL" in df.columns else "DT_ANTIVIR")
    )
    r5_mask = _is_eq(df, "ANTIVIRAL", 1) & _is_date_empty(df, dt_antivir_col)

    # R6: Coleta sem resultado
    r6_mask = (
        _is_eq(df, "AMOSTRA", 1)
        & _is_null_or_empty(df, "PCR_RESUL")
        & _is_null_or_empty(df, "RES_AN")
    )

    # R7: Classificação sem critério
    r7_mask = (
        ~_is_null_or_empty(df, "CLASSI_FIN")
        & ~_is_eq(df, "CLASSI_FIN", 4)
        & _is_null_or_empty(df, "CRITERIO")
    )

    # R8: Evolução incoerente com datas
    r8_mask = _is_evolution_before_symptoms(df)

    rules = [
        (
            "R1",
            "Óbito por SRAG sem data de evolução/óbito preenchida",
            r1_mask,
            "critical",
        ),
        (
            "R2",
            "Internação hospitalar marcada como Sim sem data de internação",
            r2_mask,
            "warning",
        ),
        (
            "R3",
            "Admissão em UTI marcada como Sim sem data de entrada em UTI",
            r3_mask,
            "warning",
        ),
        (
            "R4",
            "Resultado de PCR detectável mas classificação final ausente ou não especificada",
            r4_mask,
            "critical",
        ),
        (
            "R5",
            "Uso de antiviral marcado como Sim sem data de início do tratamento",
            r5_mask,
            "info",
        ),
        (
            "R6",
            "Amostra coletada mas sem resultado de PCR ou Teste Antigênico",
            r6_mask,
            "warning",
        ),
        (
            "R7",
            "Caso classificado sem indicação do critério de encerramento",
            r7_mask,
            "info",
        ),
        (
            "R8",
            "Data de evolução/óbito anterior à data de primeiros sintomas",
            r8_mask,
            "critical",
        ),
    ]

    for rule_code, desc, mask, severity in rules:
        count = int(mask.sum())
        pct = round((count / total) * 100, 1) if total > 0 else 0.0
        results.append(
            {
                "rule": rule_code,
                "description": desc,
                "count": count,
                "pct": pct,
                "severity": severity,
            }
        )

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    results.sort(key=lambda x: (severity_order[x["severity"]], -x["count"]))
    return results


def compute_quality_by_bairro(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Group by BAIRRO_REF (neighborhood/community within Mossoró)."""
    if df.empty or "BAIRRO_REF" not in df.columns:
        return []

    out = df.copy()
    out["BAIRRO_REF"] = (
        out["BAIRRO_REF"].fillna("NAO INFORMADO").astype(str).str.strip().str.upper()
    )

    fields_to_audit = [
        ("Data da Notificação", "DT_NOTIFIC", []),
        ("Data dos Primeiros Sintomas", "DT_SIN_PRI", []),
        ("Sexo", "CS_SEXO", ["I"]),
        ("Idade Normalizada", "NU_IDADE_N", []),
        ("Tipo de Idade", "TP_IDADE", []),
        ("Município de Notificação", "ID_MUNICIP", []),
        ("Raça/Cor", "CS_RACA", [9]),
        ("Escolaridade", "CS_ESCOL_N", [9]),
        ("Ocupação", "PAC_DSCBO", [9, "9"]),
        ("Zona", "CS_ZONA", [9]),
        ("Bairro", "NM_BAIRRO", []),
        ("Município de Residência", "ID_MN_RESI", []),
        ("Internação Hospitalar", "HOSPITAL", [9]),
        ("Data de Internação", "DT_INTERNA", []),
        ("UTI", "UTI", [9]),
        ("Entrada em UTI", "DT_ENTUTI", []),
        ("Suporte Ventilatório", "SUPORT_VEN", [9]),
        ("Evolução", "EVOLUCAO", [9]),
        ("Data de Evolução", "DT_EVOLUCA", []),
        ("Classificação Final", "CLASSI_FIN", [9]),
        ("Critério de Confirmação", "CRITERIO", [9]),
        ("Amostra Coletada", "AMOSTRA", [9]),
        ("Data de Coleta", "DT_COLETA", []),
        ("Tipo de Amostra", "TP_AMOSTRA", [9]),
        ("Resultado PCR", "PCR_RESUL", [9, 4, 5]),
        ("Resultado Antígeno", "RES_AN", [9]),
        ("Data do PCR", "DT_PCR", []),
        ("Laboratório", "LAB_AN", []),
        ("Vacina COVID-19", "VACINA_COV", [9]),
        ("Dose 1 COVID", "DOSE_1_COV", [9]),
        ("Dose 2 COVID", "DOSE_2_COV", [9]),
        ("Reforço COVID", "DOSE_REF", [9]),
        ("Vacina Influenza", "VACINA", [9]),
        ("Data da Última Dose", "DT_UT_DOSE", []),
        ("Gestante", "CS_GESTANT", [9]),
        ("Puérpera", "PUERPERA", [9]),
    ]

    blocks = {
        "Identificação": [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "CS_SEXO",
            "NU_IDADE_N",
            "TP_IDADE",
            "ID_MUNICIP",
        ],
        "Demografia": [
            "CS_RACA",
            "CS_ESCOL_N",
            "PAC_DSCBO",
            "CS_ZONA",
            "NM_BAIRRO",
            "ID_MN_RESI",
        ],
        "Cuidado": [
            "HOSPITAL",
            "DT_INTERNA",
            "UTI",
            "DT_ENTUTI",
            "SUPORT_VEN",
            "EVOLUCAO",
            "DT_EVOLUCA",
            "CLASSI_FIN",
            "CRITERIO",
        ],
        "Diagnóstico": [
            "AMOSTRA",
            "DT_COLETA",
            "TP_AMOSTRA",
            "PCR_RESUL",
            "RES_AN",
            "DT_PCR",
            "LAB_AN",
        ],
        "Vacinação": [
            "VACINA_COV",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "VACINA",
            "DT_UT_DOSE",
            "CS_GESTANT",
            "PUERPERA",
        ],
    }

    for _, col, ignore_vals in fields_to_audit:
        valid_col = f"valid_{col}"
        if col in out.columns:
            series = out[col]
            is_valid = series.notna() & (series.astype(str).str.strip() != "")
            if ignore_vals:
                ignores = ignore_vals + [str(v) for v in ignore_vals]
                is_valid = is_valid & ~series.isin(ignores)
            if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in out.columns:
                is_female = out["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
                is_valid = is_valid | ~is_female
            out[valid_col] = is_valid
        else:
            out[valid_col] = False

    block_cols = []
    for block_name, cols in blocks.items():
        block_col = f"block_score_{block_name}"
        block_cols.append(block_col)
        valid_cols = [f"valid_{col}" for col in cols]
        out[block_col] = out[valid_cols].mean(axis=1) * 100

    out["row_score"] = out[block_cols].mean(axis=1)

    valid_cols = [f"valid_{col}" for _, col, _ in fields_to_audit]
    agg_dict: dict[str, Any] = {col: "mean" for col in valid_cols}
    agg_dict["row_score"] = "mean"

    bairro_grouped = out.groupby("BAIRRO_REF").agg(agg_dict).reset_index()
    bairro_grouped = bairro_grouped.rename(columns={"BAIRRO_REF": "bairro", "row_score": "score"})

    bairro_counts = out["BAIRRO_REF"].value_counts().reset_index(name="total")
    bairro_grouped = bairro_grouped.merge(
        bairro_counts, left_on="bairro", right_on="BAIRRO_REF"
    ).drop(columns=["BAIRRO_REF"])

    field_labels = {f"valid_{col}": label for label, col, _ in fields_to_audit}
    val_df = bairro_grouped[valid_cols] * 100
    worst_col = val_df.idxmin(axis=1)
    worst_rate = val_df.min(axis=1)

    bairro_grouped["worst_field"] = worst_col.map(field_labels)
    bairro_grouped["worst_rate"] = worst_rate.round(1)
    bairro_grouped["score"] = bairro_grouped["score"].round(1)

    bairro_grouped = bairro_grouped.sort_values("score", ascending=True)

    result_cols = ["bairro", "score", "total", "worst_field", "worst_rate"]
    return [
        {
            "bairro": str(r.get("bairro", "")),
            "score": float(r.get("score", 0.0)),
            "total": int(r.get("total", 0)),
            "worst_field": str(r.get("worst_field", "")),
            "worst_rate": float(r.get("worst_rate", 0.0)),
        }
        for r in bairro_grouped[result_cols].to_dict(orient="records")
    ]


def compute_quality_by_laboratory(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Group by LAB_AN (antigen test laboratory)."""
    if df.empty or "LAB_AN" not in df.columns:
        return []

    out = df.copy()
    out["LAB_AN"] = out["LAB_AN"].fillna("Sem laboratório").astype(str).str.strip().str.upper()

    fields_to_audit = [
        ("Data da Notificação", "DT_NOTIFIC", []),
        ("Data dos Primeiros Sintomas", "DT_SIN_PRI", []),
        ("Sexo", "CS_SEXO", ["I"]),
        ("Idade Normalizada", "NU_IDADE_N", []),
        ("Tipo de Idade", "TP_IDADE", []),
        ("Município de Notificação", "ID_MUNICIP", []),
        ("Unidade Notificadora", "ID_UNIDADE", []),
        ("Raça/Cor", "CS_RACA", [9]),
        ("Escolaridade", "CS_ESCOL_N", [9]),
        ("Ocupação", "PAC_DSCBO", [9, "9"]),
        ("Zona", "CS_ZONA", [9]),
        ("Bairro", "NM_BAIRRO", []),
        ("Município de Residência", "ID_MN_RESI", []),
        ("Internação Hospitalar", "HOSPITAL", [9]),
        ("Data de Internação", "DT_INTERNA", []),
        ("UTI", "UTI", [9]),
        ("Entrada em UTI", "DT_ENTUTI", []),
        ("Suporte Ventilatório", "SUPORT_VEN", [9]),
        ("Evolução", "EVOLUCAO", [9]),
        ("Data de Evolução", "DT_EVOLUCA", []),
        ("Classificação Final", "CLASSI_FIN", [9]),
        ("Critério de Confirmação", "CRITERIO", [9]),
        ("Amostra Coletada", "AMOSTRA", [9]),
        ("Data de Coleta", "DT_COLETA", []),
        ("Tipo de Amostra", "TP_AMOSTRA", [9]),
        ("Resultado PCR", "PCR_RESUL", [9, 4, 5]),
        ("Resultado Antígeno", "RES_AN", [9]),
        ("Data do PCR", "DT_PCR", []),
        ("Laboratório", "LAB_AN", []),
        ("Vacina COVID-19", "VACINA_COV", [9]),
        ("Dose 1 COVID", "DOSE_1_COV", [9]),
        ("Dose 2 COVID", "DOSE_2_COV", [9]),
        ("Reforço COVID", "DOSE_REF", [9]),
        ("Vacina Influenza", "VACINA", [9]),
        ("Data da Última Dose", "DT_UT_DOSE", []),
        ("Gestante", "CS_GESTANT", [9]),
        ("Puérpera", "PUERPERA", [9]),
    ]

    blocks = {
        "Identificação": [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "CS_SEXO",
            "NU_IDADE_N",
            "TP_IDADE",
            "ID_MUNICIP",
            "ID_UNIDADE",
        ],
        "Demografia": [
            "CS_RACA",
            "CS_ESCOL_N",
            "PAC_DSCBO",
            "CS_ZONA",
            "NM_BAIRRO",
            "ID_MN_RESI",
        ],
        "Cuidado": [
            "HOSPITAL",
            "DT_INTERNA",
            "UTI",
            "DT_ENTUTI",
            "SUPORT_VEN",
            "EVOLUCAO",
            "DT_EVOLUCA",
            "CLASSI_FIN",
            "CRITERIO",
        ],
        "Diagnóstico": [
            "AMOSTRA",
            "DT_COLETA",
            "TP_AMOSTRA",
            "PCR_RESUL",
            "RES_AN",
            "DT_PCR",
            "LAB_AN",
        ],
        "Vacinação": [
            "VACINA_COV",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "VACINA",
            "DT_UT_DOSE",
            "CS_GESTANT",
            "PUERPERA",
        ],
    }

    for _, col, ignore_vals in fields_to_audit:
        valid_col = f"valid_{col}"
        if col in out.columns:
            series = out[col]
            is_valid = series.notna() & (series.astype(str).str.strip() != "")
            if ignore_vals:
                ignores = ignore_vals + [str(v) for v in ignore_vals]
                is_valid = is_valid & ~series.isin(ignores)
            if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in out.columns:
                is_female = out["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
                is_valid = is_valid | ~is_female
            out[valid_col] = is_valid
        else:
            out[valid_col] = False

    block_cols = []
    for block_name, cols in blocks.items():
        block_col = f"block_score_{block_name}"
        block_cols.append(block_col)
        valid_cols = [f"valid_{col}" for col in cols]
        out[block_col] = out[valid_cols].mean(axis=1) * 100

    out["row_score"] = out[block_cols].mean(axis=1)

    has_pcr = out.get("valid_PCR_RESUL", pd.Series(False, index=out.index))
    has_an = out.get("valid_RES_AN", pd.Series(False, index=out.index))
    out["has_resultado"] = has_pcr | has_an

    valid_cols = [f"valid_{col}" for _, col, _ in fields_to_audit]
    agg_dict: dict[str, Any] = {col: "mean" for col in valid_cols}
    agg_dict["row_score"] = "mean"
    agg_dict["block_score_Diagnóstico"] = "mean"
    agg_dict["has_resultado"] = "mean"

    lab_grouped = out.groupby("LAB_AN").agg(agg_dict).reset_index()
    lab_grouped = lab_grouped.rename(columns={"LAB_AN": "laboratorio", "row_score": "score"})

    lab_counts = out["LAB_AN"].value_counts().reset_index(name="total")
    lab_grouped = lab_grouped.merge(lab_counts, left_on="laboratorio", right_on="LAB_AN").drop(
        columns=["LAB_AN"]
    )

    lab_grouped["score"] = lab_grouped["score"].round(1)
    lab_grouped["diagnostico_score"] = lab_grouped["block_score_Diagnóstico"].round(1)
    lab_grouped["resultado_pct"] = (lab_grouped["has_resultado"] * 100).round(1)

    lab_grouped = lab_grouped.sort_values("score", ascending=True)

    result_cols = ["laboratorio", "score", "total", "diagnostico_score", "resultado_pct"]
    return [
        {
            "laboratorio": str(r.get("laboratorio", "")),
            "score": float(r.get("score", 0.0)),
            "total": int(r.get("total", 0)),
            "diagnostico_score": float(r.get("diagnostico_score", 0.0)),
            "resultado_pct": float(r.get("resultado_pct", 0.0)),
        }
        for r in lab_grouped[result_cols].to_dict(orient="records")
    ]
