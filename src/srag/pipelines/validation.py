"""Data Quality validation logic for SRAG pipelines."""

from __future__ import annotations

from datetime import date

import pandas as pd


def validate_srag_data(df: pd.DataFrame) -> tuple[bool, list[str]]:
    """Perform quality checks on the dataframe before database insertion.
    
    Returns:
        A tuple (is_valid, list_of_warnings).
    """
    warnings = []
    today = date.today()

    if df.empty:
        return False, ["O dataset está vazio."]

    # 1. Validação de Datas
    date_cols = ["DT_NOTIFIC", "DT_SIN_PRI", "DT_INTERNA", "DT_EVOLUCA"]
    for col in date_cols:
        if col in df.columns:
            # Converter para datetime se ainda não for
            temp_dt = pd.to_datetime(df[col], errors='coerce')

            # Checar datas no futuro
            future_cases = (temp_dt.dt.date > today).sum()
            if future_cases > 0:
                warnings.append(f"Detectados {future_cases} registros com data futura em {col}.")

    # 2. Consistência Clínica
    if "DT_INTERNA" in df.columns and "DT_EVOLUCA" in df.columns:
        interna = pd.to_datetime(df["DT_INTERNA"], errors='coerce')
        evoluca = pd.to_datetime(df["DT_EVOLUCA"], errors='coerce')
        inconsistent_dates = (evoluca < interna).sum()
        if inconsistent_dates > 0:
            warnings.append(f"Detectados {inconsistent_dates} registros onde o desfecho ocorre antes da internação.")

    # 3. Validação de Idade
    if "IDADE_ANOS" in df.columns:
        extreme_age = (df["IDADE_ANOS"] > 115).sum()
        if extreme_age > 0:
            warnings.append(f"Detectados {extreme_age} registros com idade superior a 115 anos.")

    # 4. Checagem de Colunas Críticas
    critical_cols = ["unique_hash", "DT_NOTIFIC", "ID_MUNICIP", "CLASSI_FIN"]
    missing_cols = [c for c in critical_cols if c not in df.columns]
    if missing_cols:
        return False, [f"Colunas críticas ausentes: {missing_cols}"]

    # Se chegamos aqui sem erros fatais, é válido (mesmo com warnings)
    return True, warnings
