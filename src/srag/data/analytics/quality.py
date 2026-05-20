"""Quality and Diagnostic coverage metrics."""

from typing import Any

import numpy as np
import pandas as pd


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
        # Considere NaN e strings vazias como incompletos
        valid = series.notna() & (series.astype(str).str.strip() != "")
        if ignore_vals:
            # Converte ignore_vals para string para comparação segura se necessário,
            # mas o SIVEP usa códigos numéricos em campos int
            valid = valid & ~series.isin(ignore_vals)
        return round((valid.sum() / total) * 100, 1)

    # Definição dos blocos de auditoria focados em qualidade do registro
    audit_blocks = {
        "Identificação do Caso": [
            ("Data da Notificação", calc_rate("DT_NOTIFIC")),
            ("Data dos Primeiros Sintomas", calc_rate("DT_SIN_PRI")),
            ("Sexo", calc_rate("CS_SEXO", ["I"])),
            ("Data de Nascimento", calc_rate("DT_NASC")),
            ("Idade Normalizada", calc_rate("NU_IDADE_N")),
            ("Tipo de Idade", calc_rate("TP_IDADE")),
            ("Município de Notificação", calc_rate("ID_MUNICIP")),
            ("Unidade Notificadora", calc_rate("ID_UNIDADE")),
        ],
        "Demografia e Residência": [
            ("Raça/Cor", calc_rate("CS_RACA", [9])),
            ("Etnia", calc_rate("CS_ETINIA", [9])),
            ("Escolaridade", calc_rate("CS_ESCOL_N", [9])),
            ("Ocupação", calc_rate("PAC_DSCBO", [9, "9"])),
            ("Zona", calc_rate("CS_ZONA", [9])),
            ("Bairro", calc_rate("NM_BAIRRO")),
            ("CEP", calc_rate("NU_CEP")),
            ("Município de Residência", calc_rate("ID_MN_RESI")),
        ],
        "Linha do Cuidado": [
            ("Internação Hospitalar", calc_rate("HOSPITAL", [9])),
            ("Data de Internação", calc_rate("DT_INTERNA")),
            ("UTI", calc_rate("UTI", [9])),
            ("Entrada em UTI", calc_rate("DT_ENTUTI")),
            ("Saída da UTI", calc_rate("DT_SAIDUTI")),
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
