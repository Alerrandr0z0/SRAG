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

    valid = out.dropna(subset=["DT_COLETA", "DT_PCR"])
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

    # Definição dos blocos de auditoria
    audit_blocks = {
        "Demografia e Perfil": [
            ("Idade", calc_rate("NU_IDADE_N")),
            ("Sexo", calc_rate("CS_SEXO", ["I"])),
            ("Raça/Cor", calc_rate("CS_RACA", [9])),
            ("Escolaridade", calc_rate("CS_ESCOL_N", [9])),
            ("Ocupação", calc_rate("PAC_DSCBO", [9, "9"])),
            ("Zona (Urbana/Rural)", calc_rate("CS_ZONA", [9])),
        ],
        "Sinais e Sintomas": [
            ("Data Primeiros Sintomas", calc_rate("DT_SIN_PRI")),
            ("Febre", calc_rate("FEBRE", [9])),
            ("Tosse", calc_rate("TOSSE", [9])),
            ("Dispneia", calc_rate("DISPNEIA", [9])),
            ("Saturação < 95%", calc_rate("SATURACAO", [9])),
            ("Fatores de Risco", calc_rate("FATOR_RISC", [9])),
        ],
        "Atendimento e Desfecho": [
            ("Data de Internação", calc_rate("DT_INTERNA")),
            ("Internação em UTI", calc_rate("UTI", [9])),
            ("Suporte Ventilatório", calc_rate("SUPORT_VEN", [9])),
            ("Evolução (Cura/Óbito)", calc_rate("EVOLUCAO", [9])),
            ("Data de Evolução", calc_rate("DT_EVOLUCA")),
        ],
        "Laboratório e Diagnóstico": [
            ("Coleta de Amostra", calc_rate("AMOSTRA", [9])),
            ("Tipo de Amostra", calc_rate("TP_AMOSTRA", [9])),
            ("Data de Coleta", calc_rate("DT_COLETA")),
            ("Resultado PCR", calc_rate("PCR_RESUL", [9, 4, 5])),
            ("Classificação Final", calc_rate("CLASSI_FIN", [9])),
        ],
        "Tratamento e Vacinação": [
            ("Uso de Antiviral", calc_rate("ANTIVIRAL", [9])),
            ("Vacina COVID-19", calc_rate("VACINA_COV", [9])),
            ("Vacina Gripe", calc_rate("VACINA", [9])),
        ]
    }

    for block_name, fields in audit_blocks.items():
        block_score = round(sum(f[1] for f in fields) / len(fields), 1) if fields else 0.0
        results.append({
            "group": block_name,
            "overall_score": block_score,
            "fields": [{"field": f[0], "rate": f[1]} for f in fields]
        })

    return results
