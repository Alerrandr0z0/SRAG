"""Quality and Diagnostic coverage metrics."""

from typing import Any

import numpy as np
import pandas as pd

from srag.data.cnes_lookup import lookup_unit_name
from srag.utils.epi_weeks import compute_epi_week_columns

AUDITED_FIELDS = [
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
    ("Co-detecção", "CO_DETEC", [9]),
    ("Cadeia de Surto", "SURTO_SG", [9]),
    ("Variante (OMS)", "VG_OMS", [9]),
    ("Linhagem", "VG_LIN", []),
    ("Método Lab.", "VG_MET", [9]),
    ("Possível Reinfecção", "VG_REINF", [9]),
    ("Gestante", "CS_GESTANT", [9]),
    ("Puérpera", "PUERPERA", [9]),
]

AUDIT_BLOCKS = {
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
        "CS_GESTANT",
        "PUERPERA",
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
    "Vigilância Genômica": [
        "CO_DETEC",
        "SURTO_SG",
        "VG_OMS",
        "VG_LIN",
        "VG_MET",
        "VG_REINF",
    ],
}


def _ensure_epi_week(df: pd.DataFrame) -> pd.DataFrame:
    """Add pre-computed epi_week columns if missing (e.g. when called from tests)."""
    if "_epi_week" not in df.columns and "DT_SIN_PRI" in df.columns:
        epi = compute_epi_week_columns(df["DT_SIN_PRI"])
        return pd.concat([df, epi], axis=1)
    return df


def _empty_datetime_series(index: pd.Index) -> pd.Series:
    return pd.Series(index=index, dtype="datetime64[ns]")


def _normalize_lab_name(name: str) -> str:
    name = str(name).strip().upper()
    if not name or name in ["SEM LABORATÓRIO", "SEM LAB", "NÃO INFORMADO", "NAN", "NONE", "NULL"]:
        return "SEM LABORATÓRIO"
    if "PAGUE MENOS" in name:
        return "FARMÁCIA PAGUE MENOS"
    if any(
        x in name
        for x in ["ANALISYS", "ANALYSIS", "ANALYSES", "ANALISA", "ANALISE", "ANALISES"]
    ):
        if "ULTRA" in name:
            return "ULTRANÁLISES LABORATÓRIO CLÍNICO"
        if "CENTRA" in name:
            return "CENTRANÁLISES"
        return "LABORATÓRIO ANALISYS"
    if "GLOBO" in name or "DROGAGLOBO" in name:
        return "DROGARIA GLOBO"
    if "PLASMA" in name:
        return "PLASMA DIAGNÓSTICOS"
    if "CEPAC" in name:
        return "CEPAC"
    if "RAFAEL FERNANDES" in name:
        return "HOSPITAL RAFAEL FERNANDES"
    return name


def _prepare_laboratory_quality_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["LAB_AN"] = out["LAB_AN"].fillna("SEM LABORATÓRIO").apply(_normalize_lab_name)

    dt_coleta = _empty_datetime_series(out.index)
    if "DT_COLETA" in out:
        dt_coleta = pd.to_datetime(out["DT_COLETA"], errors="coerce")

    dt_pcr = _empty_datetime_series(out.index)
    if "DT_PCR" in out:
        dt_pcr = pd.to_datetime(out["DT_PCR"], errors="coerce")

    # turnaround_days based exclusively on PCR
    out["turnaround_days"] = (dt_pcr - dt_coleta).dt.days
    out.loc[(out["turnaround_days"] < 0) | (out["turnaround_days"] > 30), "turnaround_days"] = (
        np.nan
    )
    return out


def _mark_validity_columns(out: pd.DataFrame) -> pd.DataFrame:
    for _, col, ignore_vals in AUDITED_FIELDS:
        valid_col = f"valid_{col}"
        if col in out.columns:
            series = out[col]
            is_valid = series.notna() & (series.astype(str).str.strip() != "")
            if ignore_vals:
                ignores = ignore_vals + [str(v) for v in ignore_vals]
                is_valid = is_valid & ~series.isin(ignores)
            if col == "LAB_AN":
                is_valid = is_valid & ~series.astype(str).str.upper().str.strip().isin(
                    ["SEM LABORATÓRIO", "SEM LAB", "NÃO INFORMADO"]
                )
            if col in ["CS_GESTANT", "PUERPERA"] and "CS_SEXO" in out.columns:
                is_female = out["CS_SEXO"].astype(str).str.strip().str.upper() == "F"
                is_valid = is_valid | ~is_female
            out[valid_col] = is_valid
        else:
            out[valid_col] = False

    return out


def _add_block_scores(out: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    block_cols: list[str] = []
    for block_name, cols in AUDIT_BLOCKS.items():
        block_col = f"block_score_{block_name}"
        block_cols.append(block_col)
        valid_cols = [f"valid_{col}" for col in cols]
        out[block_col] = out[valid_cols].mean(axis=1) * 100

    out["row_score"] = out[block_cols].mean(axis=1)
    return out, block_cols


def _build_laboratory_quality_rows(out: pd.DataFrame) -> list[dict[str, Any]]:
    has_pcr = out.get("valid_PCR_RESUL", pd.Series(False, index=out.index))
    has_an = out.get("valid_RES_AN", pd.Series(False, index=out.index))
    out["has_resultado"] = has_pcr | has_an

    valid_cols = [col for col in out.columns if col.startswith("valid_")]
    agg_dict: dict[str, Any] = {col: "mean" for col in valid_cols}
    agg_dict["row_score"] = "mean"
    agg_dict["block_score_Diagnóstico"] = "mean"
    agg_dict["has_resultado"] = "mean"
    agg_dict["turnaround_days"] = "median"

    lab_grouped = out.groupby("LAB_AN").agg(agg_dict).reset_index()
    lab_grouped = lab_grouped.rename(columns={"LAB_AN": "laboratorio"})

    lab_counts = out["LAB_AN"].value_counts().reset_index(name="total")
    lab_grouped = lab_grouped.merge(lab_counts, left_on="laboratorio", right_on="LAB_AN").drop(
        columns=["LAB_AN"]
    )

    lab_grouped["score"] = lab_grouped["block_score_Diagnóstico"].round(1)
    lab_grouped["diagnostico_score"] = lab_grouped["score"]
    lab_grouped["resultado_pct"] = (lab_grouped["has_resultado"] * 100).round(1)
    lab_grouped["median_turnaround_days"] = lab_grouped["turnaround_days"].round(1)
    lab_grouped = lab_grouped.sort_values("score", ascending=True)

    result_cols = [
        "laboratorio",
        "score",
        "total",
        "diagnostico_score",
        "resultado_pct",
        "median_turnaround_days",
    ]
    return [
        {
            "laboratorio": str(r.get("laboratorio", "")),
            "score": float(r.get("score", 0.0)),
            "total": int(r.get("total", 0)),
            "diagnostico_score": float(r.get("diagnostico_score", 0.0)),
            "resultado_pct": float(r.get("resultado_pct", 0.0)),
            "median_turnaround_days": float(r.get("median_turnaround_days", 0.0)),
        }
        for r in lab_grouped[result_cols].to_dict(orient="records")
    ]


def compute_diagnostic_latency(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate quartiles for time between sample collection and PCR result for Box Plot."""
    empty = {
        "boxplot_data": [],
        "median": 0.0,
        "p95": 0.0,
        "p99": 0.0,
        "target_adherence_rate": 0.0,
    }
    if df.empty:
        return empty

    out = df.copy()
    for col in ["DT_COLETA", "DT_PCR"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    # Valid range: 0 to 30 days (filter outliers/errors)
    if "DT_PCR" not in out.columns or "DT_COLETA" not in out.columns:
        return empty

    valid = out.dropna(subset=["DT_COLETA", "DT_PCR"]).copy()
    valid["delta"] = (valid["DT_PCR"] - valid["DT_COLETA"]).dt.days
    valid = valid[(valid["delta"] >= 0) & (valid["delta"] <= 30)]

    if valid.empty:
        return empty

    # Format for ECharts BoxPlot [min, Q1, median, Q3, max]
    deltas = valid["delta"].sort_values()
    stats = [
        float(deltas.min()),
        float(np.percentile(deltas, 25)),
        float(deltas.median()),
        float(np.percentile(deltas, 75)),
        float(deltas.max()),
    ]
    p95_latency = float(round(np.percentile(deltas, 95), 1))
    p99_latency = float(round(np.percentile(deltas, 99), 1))

    adherent_count = (deltas <= 7).sum()
    if len(valid) > 0:
        target_adherence_rate = float(round((adherent_count / len(valid)) * 100, 1))
    else:
        target_adherence_rate = 0.0

    return {
        "boxplot_data": stats,
        "median": float(round(deltas.median(), 1)),
        "p95": p95_latency,
        "p99": p99_latency,
        "count": len(valid),
        "target_adherence_rate": target_adherence_rate,
    }


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
            ("Gestante", calc_rate("CS_GESTANT", [9])),
            ("Puérpera", calc_rate("PUERPERA", [9])),
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
        "Vigilância Genômica e Reinfecção": [
            ("Co-detecção", calc_rate("CO_DETEC", [9])),
            ("Cadeia de Surto", calc_rate("SURTO_SG", [9])),
            ("Variante (OMS)", calc_rate("VG_OMS", [9])),
            ("Linhagem", calc_rate("VG_LIN")),
            ("Método Lab.", calc_rate("VG_MET", [9])),
            ("Possível Reinfecção", calc_rate("VG_REINF", [9])),
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

    df = _ensure_epi_week(df)
    out = df.copy()

    out["epi_week"] = out["_epi_week"]
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
            ("Gestante", "CS_GESTANT", [9]),
            ("Puérpera", "PUERPERA", [9]),
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
        "genomica": [
            ("Co-detecção", "CO_DETEC", [9]),
            ("Cadeia de Surto", "SURTO_SG", [9]),
            ("Variante (OMS)", "VG_OMS", [9]),
            ("Linhagem", "VG_LIN", []),
            ("Método Lab.", "VG_MET", [9]),
            ("Possível Reinfecção", "VG_REINF", [9]),
        ],
    }

    _block_display = {
        "identificacao": "Identificação do Caso",
        "demografia": "Demografia e Residência",
        "cuidado": "Linha do Cuidado",
        "diagnostico": "Coleta e Diagnóstico",
        "genomica": "Vigilância Genômica e Reinfecção",
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

    # Reuse mark validity and add block scores helper logic to keep things clean!
    out = _mark_validity_columns(out)
    out, _block_cols = _add_block_scores(out)

    # Let's count occurrences per unit
    unit_counts = out["ID_UNIDADE"].value_counts().reset_index(name="total")

    # Group by unit
    valid_cols = [f"valid_{col}" for _, col, _ in AUDITED_FIELDS]
    agg_dict: dict[str, Any] = {col: "mean" for col in valid_cols}
    agg_dict["row_score"] = "mean"

    unit_grouped = out.groupby("ID_UNIDADE").agg(agg_dict).reset_index()
    unit_grouped = unit_grouped.rename(columns={"ID_UNIDADE": "id_unidade", "row_score": "score"})

    unit_grouped = unit_grouped.merge(
        unit_counts, left_on="id_unidade", right_on="ID_UNIDADE"
    ).drop(columns=["ID_UNIDADE"])

    # Dynamic worst field filtering:
    # 1. Compute global completeness for all audited fields in df
    global_completeness = out[valid_cols].mean() * 100
    # 2. Keep columns with at least 1.0% global completeness
    active_audit_cols = global_completeness[global_completeness >= 1.0].index.tolist()
    if not active_audit_cols:
        # Fallback to all if somehow none are >= 1%
        active_audit_cols = valid_cols

    field_labels = {f"valid_{col}": label for label, col, _ in AUDITED_FIELDS}
    val_df = unit_grouped[active_audit_cols] * 100

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
        ("Co-detecção", "CO_DETEC", [9]),
        ("Cadeia de Surto", "SURTO_SG", [9]),
        ("Variante (OMS)", "VG_OMS", [9]),
        ("Linhagem", "VG_LIN", []),
        ("Método Lab.", "VG_MET", [9]),
        ("Possível Reinfecção", "VG_REINF", [9]),
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
        "Vigilância Genômica": [
            "CO_DETEC",
            "SURTO_SG",
            "VG_OMS",
            "VG_LIN",
            "VG_MET",
            "VG_REINF",
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

    out = _prepare_laboratory_quality_frame(df)
    out = _mark_validity_columns(out)
    out, _block_cols = _add_block_scores(out)
    return _build_laboratory_quality_rows(out)


def compute_closure_by_agent(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Cross-tabulate closure criteria (CRITERIO) by etiologic agent."""
    if df.empty:
        return []

    from srag.data.analytics.surveillance import infer_etiologic_agent

    out = df.copy()
    out["virus"] = infer_etiologic_agent(out)

    criteria_map = {
        1: "Laboratorial",
        2: "Vínculo Epidemiológico",
        3: "Clínico / Imagem",
        4: "Óbito",
    }
    out["criterio_label"] = (
        pd.to_numeric(out["CRITERIO"], errors="coerce")
        .map(criteria_map)
        .fillna("Ignorado/Em Aberto")
    )

    ct = pd.crosstab(out["virus"], out["criterio_label"])

    all_criteria = [
        "Laboratorial",
        "Vínculo Epidemiológico",
        "Clínico / Imagem",
        "Óbito",
        "Ignorado/Em Aberto",
    ]

    results = []
    for agent in ct.index:
        row = ct.loc[agent]
        total = int(row.sum())
        item = {
            "agent": str(agent),
            "total": total,
        }
        for criterion in all_criteria:
            item[criterion] = int(row.get(criterion, 0))
        results.append(item)

    return results


def compute_imaging_by_severity(df: pd.DataFrame) -> dict[str, Any]:
    """Analyze X-Ray and CT findings by clinical severity (UTI admission and lethality)."""
    if df.empty:
        return {"raiox": [], "tomo": []}

    out = df.copy()

    # closed cases mask for CFR denominator
    out["closed_case"] = out["EVOLUCAO"].isin([1, 2])
    out["is_death"] = out["EVOLUCAO"] == 2
    out["is_uti"] = out["UTI"] == 1

    raiox_map = {1: "Normal", 2: "Infiltrado", 3: "Consolidação", 4: "Misto", 5: "Outro"}
    tomo_map = {1: "Típico", 2: "Indeterminado", 3: "Atípico", 4: "Negativo", 5: "Outro"}

    def analyze_finding(col_name: str, mapping: dict[int, str]) -> list[dict[str, Any]]:
        col = out.get(col_name)
        if col is None:
            return []

        # Map findings and dropna to keep only defined findings
        temp = out.copy()
        temp["finding"] = pd.to_numeric(col, errors="coerce").map(mapping)
        temp = temp.dropna(subset=["finding"])
        if temp.empty:
            return []

        grouped = (
            temp.groupby("finding")
            .agg(
                total=("finding", "size"),
                uti_count=("is_uti", "sum"),
                death_count=("is_death", "sum"),
                closed_count=("closed_case", "sum"),
            )
            .reset_index()
        )

        results = []
        for _, r in grouped.iterrows():
            total = int(r["total"])
            uti_count = int(r["uti_count"])
            death_count = int(r["death_count"])
            closed_count = int(r["closed_count"])

            results.append(
                {
                    "finding": str(r["finding"]),
                    "total": total,
                    "uti_count": uti_count,
                    "uti_rate": round(uti_count / total * 100, 1) if total > 0 else 0.0,
                    "death_count": death_count,
                    "death_rate": (
                        round(death_count / closed_count * 100, 1) if closed_count > 0 else 0.0
                    ),
                }
            )
        return results

    return {
        "raiox": analyze_finding("RAIOX_RES", raiox_map),
        "tomo": analyze_finding("TOMO_RES", tomo_map),
    }


def compute_delay_by_unit(df: pd.DataFrame, limit: int = 30) -> list[dict[str, Any]]:
    """Compute median notification delay by notifying health unit (CNES)."""
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

    if "ID_UNIDADE" not in valid.columns:
        return []

    valid["id_unidade"] = valid["ID_UNIDADE"].fillna("Não informado").astype(str).str.strip()
    valid = valid[valid["id_unidade"] != ""]

    if valid.empty:
        return []

    grouped = (
        valid.groupby("id_unidade")
        .agg(
            median_delay=("delay", "median"),
            avg_delay=("delay", "mean"),
            total=("delay", "size"),
            delay_list=("delay", lambda s: sorted(int(v) for v in s.tolist())[:100]),
        )
        .reset_index()
    )

    grouped["nome_fantasia"] = grouped["id_unidade"].apply(lookup_unit_name)
    grouped["median_delay"] = grouped["median_delay"].round(1)
    grouped["avg_delay"] = grouped["avg_delay"].round(1)

    # Sort by total cases descending, and limit
    grouped = grouped.sort_values(by="total", ascending=False).head(limit)

    samples_by_unit: dict[str, list[int]] = {
        str(r["id_unidade"]): list(r["delay_list"]) for _, r in grouped.iterrows()
    }

    return [
        {
            "id_unidade": str(r["id_unidade"]),
            "nome_fantasia": str(r["nome_fantasia"]),
            "total": int(r["total"]),
            "median_delay": float(r["median_delay"]),
            "avg_delay": float(r["avg_delay"]),
            "delay_samples": samples_by_unit[str(r["id_unidade"])],
        }
        for _, r in grouped.iterrows()
    ]


def compute_delay_by_bairro(df: pd.DataFrame, limit: int = 30) -> list[dict[str, Any]]:
    """Compute median notification delay by bairro/localidade."""
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

    if "NM_BAIRRO" not in valid.columns:
        return []

    valid["bairro"] = valid["NM_BAIRRO"].fillna("Não informado").astype(str).str.strip()
    valid = valid[valid["bairro"] != ""]

    if valid.empty:
        return []

    grouped = (
        valid.groupby("bairro")
        .agg(
            median_delay=("delay", "median"),
            avg_delay=("delay", "mean"),
            total=("delay", "size"),
            delay_list=("delay", lambda s: sorted(int(v) for v in s.tolist())[:100]),
        )
        .reset_index()
    )

    grouped["median_delay"] = grouped["median_delay"].round(1)
    grouped["avg_delay"] = grouped["avg_delay"].round(1)

    grouped = grouped.sort_values(by="total", ascending=False).head(limit)

    samples_by_bairro: dict[str, list[int]] = {
        str(r["bairro"]): list(r["delay_list"]) for _, r in grouped.iterrows()
    }

    return [
        {
            "bairro": str(r["bairro"]),
            "total": int(r["total"]),
            "median_delay": float(r["median_delay"]),
            "avg_delay": float(r["avg_delay"]),
            "delay_samples": samples_by_bairro[str(r["bairro"])],
        }
        for _, r in grouped.iterrows()
    ]


def compute_positivity_by_sample_type(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Compute tested cases, positive cases, and positivity rate by sample type (TP_AMOSTRA)."""
    if df.empty:
        return []

    out = df.copy()
    pcr_col = out.get("PCR_RESUL")
    an_col = out.get("RES_AN")
    pcr_res = (
        pd.to_numeric(pcr_col, errors="coerce")
        if pcr_col is not None
        else pd.Series(np.nan, index=out.index)
    )
    an_res = (
        pd.to_numeric(an_col, errors="coerce")
        if an_col is not None
        else pd.Series(np.nan, index=out.index)
    )

    amostra_col = out.get("AMOSTRA")
    if amostra_col is None:
        out["is_tested"] = True
    else:
        out["is_tested"] = pd.to_numeric(amostra_col, errors="coerce") == 1

    out["is_positive"] = (pcr_res == 1) | (an_res == 1)

    tp_amostra_col = out.get("TP_AMOSTRA")
    if tp_amostra_col is None:
        return []

    sample_map = {
        1: "Secreção Naso/Orofaringe",
        2: "Lavado Bronco-alveolar",
        3: "Tecido post-mortem",
        4: "Outra",
        5: "LCR",
        9: "Ignorado",
    }

    out["sample_type"] = (
        pd.to_numeric(tp_amostra_col, errors="coerce")
        .map(sample_map)
        .fillna("Ignorado/Não Informado")
    )

    # We want to group by sample_type
    grouped = (
        out.groupby("sample_type")
        .agg(
            tested=("is_tested", "sum"),
            positive=("is_positive", "sum"),
        )
        .reset_index()
    )

    results = []
    for _, r in grouped.iterrows():
        tested = int(r["tested"])
        positive = int(r["positive"])
        rate = round((positive / tested * 100), 1) if tested > 0 else 0.0
        results.append(
            {
                "sample_type": str(r["sample_type"]),
                "tested": tested,
                "positive": positive,
                "positivity_rate": rate,
            }
        )

    return results


def _compute_phase_delay(df: pd.DataFrame, start_col: str, end_col: str, max_val: int) -> float:
    if start_col not in df.columns or end_col not in df.columns:
        return 0.0

    start_date = pd.to_datetime(df[start_col], errors="coerce")
    end_date = pd.to_datetime(df[end_col], errors="coerce")

    delta = (end_date - start_date).dt.days
    valid_delta = delta.dropna()
    valid_delta = valid_delta[(valid_delta >= 0) & (valid_delta <= max_val)]
    if valid_delta.empty:
        return 0.0
    return float(round(valid_delta.median(), 1))


def compute_diagnostic_latency_phases(df: pd.DataFrame) -> dict[str, float]:
    """Compute median days for Symptoms->Notif->Collection->Result->Treatment phases."""
    if df.empty:
        return {
            "symptom_to_notification": 0.0,
            "notification_to_collection": 0.0,
            "collection_to_result": 0.0,
            "symptom_to_treatment": 0.0,
        }

    out = df.copy()

    symptom_to_notification = _compute_phase_delay(out, "DT_SIN_PRI", "DT_NOTIFIC", 60)
    notification_to_collection = _compute_phase_delay(out, "DT_NOTIFIC", "DT_COLETA", 30)

    collection_to_result = 0.0
    if "DT_COLETA" in out.columns:
        dt_coleta = pd.to_datetime(out["DT_COLETA"], errors="coerce")
        dt_pcr = pd.to_datetime(
            out["DT_PCR"] if "DT_PCR" in out.columns else pd.Series(np.nan, index=out.index),
            errors="coerce",
        )
        dt_res_an = pd.to_datetime(
            out["DT_RES_AN"] if "DT_RES_AN" in out.columns else pd.Series(np.nan, index=out.index),
            errors="coerce",
        )

        pcr_delta = (dt_pcr - dt_coleta).dt.days
        an_delta = (dt_res_an - dt_coleta).dt.days

        combined_deltas = pd.DataFrame({"pcr": pcr_delta, "an": an_delta})
        combined_deltas[(combined_deltas < 0) | (combined_deltas > 30)] = np.nan
        min_delta = combined_deltas.min(axis=1).dropna()
        if not min_delta.empty:
            collection_to_result = float(round(min_delta.median(), 1))

    symptom_to_treatment = 0.0
    antiviral_col = out.get("ANTIVIRAL")
    if antiviral_col is not None and "DT_SIN_PRI" in out.columns and "DT_ANTIVIR" in out.columns:
        antiviral_mask = pd.to_numeric(antiviral_col, errors="coerce") == 1
        treated = out[antiviral_mask]
        symptom_to_treatment = _compute_phase_delay(treated, "DT_SIN_PRI", "DT_ANTIVIR", 14)

    return {
        "symptom_to_notification": symptom_to_notification,
        "notification_to_collection": notification_to_collection,
        "collection_to_result": collection_to_result,
        "symptom_to_treatment": symptom_to_treatment,
    }


# ---------------------------------------------------------------------------
# Timeliness flow (Sankey-ready data)
# ---------------------------------------------------------------------------

# Target thresholds in days for each surveillance phase
_TIMELINESS_TARGETS: dict[str, int] = {
    "notification": 7,  # Symptoms → Notification ≤ 7 days
    "collection": 5,  # Notification → Collection ≤ 5 days
    "result": 7,  # Collection → Result ≤ 7 days
    "treatment": 2,  # Symptoms → Antiviral treatment ≤ 2 days
}


def _compute_phase_deltas(
    df: pd.DataFrame,
    start_col: str,
    end_col: str,
    max_val: int,
) -> pd.Series:
    """Return per-case day delta clamped to [0, max_val]; NaN where unavailable."""
    if start_col not in df.columns or end_col not in df.columns:
        return pd.Series(np.nan, index=df.index)
    start_date = pd.to_datetime(df[start_col], errors="coerce")
    end_date = pd.to_datetime(df[end_col], errors="coerce")
    delta = (end_date - start_date).dt.days
    delta = delta.where(delta >= 0).where(delta <= max_val)
    return delta


def _classify_stage(delta: pd.Series, target: int) -> pd.Series:
    """Classify as 'oportuno', 'atrasado', or 'sem_dados'."""
    result = pd.Series("sem_dados", index=delta.index)
    result[delta.notna() & (delta <= target)] = "oportuno"
    result[delta.notna() & (delta > target)] = "atrasado"
    return result


def compute_timeliness_flow(df: pd.DataFrame) -> dict[str, Any]:
    """Compute Sankey-ready timeliness flow data for the Audit panel.

    Returns a dict with:
      - nodes: list of Sankey nodes
      - links: list of Sankey links with source/target/value/pct
      - kpis: list of per-stage KPI dicts (target, median, adherence_rate, count)
      - total_cases: int
    """
    empty = {"nodes": [], "links": [], "kpis": [], "total_cases": 0}
    if df.empty:
        return empty

    out = df.copy()

    # Compute per-case deltas for each phase
    delta_notification = _compute_phase_deltas(out, "DT_SIN_PRI", "DT_NOTIFIC", 60)
    delta_collection = _compute_phase_deltas(out, "DT_NOTIFIC", "DT_COLETA", 30)
    delta_result = _compute_phase_deltas(out, "DT_COLETA", "DT_PCR", 30)

    # For result, also consider DT_RES_AN if DT_PCR is missing
    if "DT_RES_AN" in out.columns:
        delta_result_an = _compute_phase_deltas(out, "DT_COLETA", "DT_RES_AN", 30)
        delta_result = pd.concat([delta_result, delta_result_an], axis=1).min(axis=1)

    # Treatment: only for antiviral cases
    delta_treatment = pd.Series(np.nan, index=out.index)
    if "ANTIVIRAL" in out.columns and "DT_SIN_PRI" in out.columns and "DT_ANTIVIR" in out.columns:
        antiviral_mask = pd.to_numeric(out["ANTIVIRAL"], errors="coerce") == 1
        treated_idx = out.index[antiviral_mask]
        delta_treatment.loc[treated_idx] = _compute_phase_deltas(
            out.loc[treated_idx], "DT_SIN_PRI", "DT_ANTIVIR", 14
        )

    # Classify each case per stage
    stage_notification = _classify_stage(delta_notification, _TIMELINESS_TARGETS["notification"])
    stage_collection = _classify_stage(delta_collection, _TIMELINESS_TARGETS["collection"])
    stage_result = _classify_stage(delta_result, _TIMELINESS_TARGETS["result"])
    stage_treatment = _classify_stage(delta_treatment, _TIMELINESS_TARGETS["treatment"])

    total = len(out)

    # --- KPIs per stage ---
    kpis: list[dict[str, Any]] = []

    def _stage_kpi(
        label: str,
        delta: pd.Series,
        stage: pd.Series,
        target: int,
        unit: str,
    ) -> dict[str, Any]:
        valid_count = int((stage != "sem_dados").sum())
        oportuno_count = int((stage == "oportuno").sum())
        adherence = round(oportuno_count / valid_count * 100, 1) if valid_count > 0 else 0.0
        valid_deltas = delta.dropna()
        median_val = float(round(valid_deltas.median(), 1)) if not valid_deltas.empty else 0.0
        return {
            "label": label,
            "target": f"≤{target}{unit}",
            "median": median_val,
            "adherence_rate": adherence,
            "count": valid_count,
            "oportuno_count": oportuno_count,
            "atrasado_count": int((stage == "atrasado").sum()),
            "sem_dados_count": int((stage == "sem_dados").sum()),
        }

    kpis.append(
        _stage_kpi(
            "Notificação",
            delta_notification,
            stage_notification,
            _TIMELINESS_TARGETS["notification"],
            "d",
        )
    )
    kpis.append(
        _stage_kpi(
            "Coleta",
            delta_collection,
            stage_collection,
            _TIMELINESS_TARGETS["collection"],
            "d",
        )
    )
    kpis.append(
        _stage_kpi(
            "Resultado",
            delta_result,
            stage_result,
            _TIMELINESS_TARGETS["result"],
            "d",
        )
    )
    kpis.append(
        _stage_kpi(
            "Tratamento Antiviral",
            delta_treatment,
            stage_treatment,
            _TIMELINESS_TARGETS["treatment"],
            "d",
        )
    )

    # --- Sankey nodes ---
    node_names = [
        "Total de Casos",
        "Notificação ≤7d",
        "Notificação >7d",
        "Sem Data Sintomas",
        "Coleta no Prazo",
        "Coleta Fora do Prazo",
        "Sem Data Coleta",
        "Resultado ≤7d",
        "Resultado >7d",
        "Sem Data Resultado",
        "Tratamento ≤48h",
        "Tratamento >48h",
        "Sem Tratamento",
    ]
    nodes = [{"name": n} for n in node_names]

    # --- Sankey links ---
    links: list[dict[str, Any]] = []

    def _add_link(source: str, target: str, count: int) -> None:
        if count > 0:
            pct = round(count / total * 100, 1) if total > 0 else 0.0
            links.append({"source": source, "target": target, "value": count, "pct": pct})

    # Level 1: Total → Notification
    n_oportuno = int((stage_notification == "oportuno").sum())
    n_atrasado = int((stage_notification == "atrasado").sum())
    n_sem_dados = int((stage_notification == "sem_dados").sum())
    _add_link("Total de Casos", "Notificação ≤7d", n_oportuno)
    _add_link("Total de Casos", "Notificação >7d", n_atrasado)
    _add_link("Total de Casos", "Sem Data Sintomas", n_sem_dados)

    # Level 2: Notification → Collection
    for notif_node, notif_class in [
        ("Notificação ≤7d", "oportuno"),
        ("Notificação >7d", "atrasado"),
        ("Sem Data Sintomas", "sem_dados"),
    ]:
        mask_notif = stage_notification == notif_class
        c_oportuno = int((stage_collection[mask_notif] == "oportuno").sum())
        c_atrasado = int((stage_collection[mask_notif] == "atrasado").sum())
        c_sem = int((stage_collection[mask_notif] == "sem_dados").sum())
        _add_link(notif_node, "Coleta no Prazo", c_oportuno)
        _add_link(notif_node, "Coleta Fora do Prazo", c_atrasado)
        _add_link(notif_node, "Sem Data Coleta", c_sem)

    # Level 3: Collection → Result
    for coll_node, coll_class in [
        ("Coleta no Prazo", "oportuno"),
        ("Coleta Fora do Prazo", "atrasado"),
        ("Sem Data Coleta", "sem_dados"),
    ]:
        mask_coll = stage_collection == coll_class
        r_oportuno = int((stage_result[mask_coll] == "oportuno").sum())
        r_atrasado = int((stage_result[mask_coll] == "atrasado").sum())
        r_sem = int((stage_result[mask_coll] == "sem_dados").sum())
        _add_link(coll_node, "Resultado ≤7d", r_oportuno)
        _add_link(coll_node, "Resultado >7d", r_atrasado)
        _add_link(coll_node, "Sem Data Resultado", r_sem)

    # Level 4: Result → Treatment
    for res_node, res_class in [
        ("Resultado ≤7d", "oportuno"),
        ("Resultado >7d", "atrasado"),
        ("Sem Data Resultado", "sem_dados"),
    ]:
        mask_res = stage_result == res_class
        t_oportuno = int((stage_treatment[mask_res] == "oportuno").sum())
        t_atrasado = int((stage_treatment[mask_res] == "atrasado").sum())
        t_sem = int((stage_treatment[mask_res] == "sem_dados").sum())
        _add_link(res_node, "Tratamento ≤48h", t_oportuno)
        _add_link(res_node, "Tratamento >48h", t_atrasado)
        _add_link(res_node, "Sem Tratamento", t_sem)

    return {
        "nodes": nodes,
        "links": links,
        "kpis": kpis,
        "total_cases": total,
    }
