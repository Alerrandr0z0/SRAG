from datetime import UTC, datetime, timedelta
from typing import Any, cast

import numpy as np
import pandas as pd
from sqlalchemy import create_engine

from srag.data.analytics import infer_etiologic_agent
from srag.data.database import DB_URL

engine = create_engine(DB_URL, pool_pre_ping=True)

_cache: dict[str, Any] = {"df": None, "loaded_at": None}


def sanitize_data(obj: object) -> object:
    """Recursively convert numpy types to native python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_data(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_data(i) for i in obj]
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return sanitize_data(obj.tolist())
    if obj is None:
        return None
    try:
        if pd.isna(obj):  # type: ignore[call-overload]
            return None
    except TypeError:
        pass
    return obj


def apply_surveillance_filters(
    df: pd.DataFrame,
    years: list[int] | None = None,
    agents: list[str] | None = None,
) -> pd.DataFrame:
    """Apply year and etiologic-agent filters consistently across surveillance endpoints."""
    out = df
    if years and "DT_SIN_PRI" in out.columns:
        year_values = {int(y) for y in years if y is not None}
        out = out[pd.to_datetime(out["DT_SIN_PRI"], errors="coerce").dt.year.isin(year_values)]
    if agents:
        agent_norm = {str(a).strip().upper() for a in agents if a}
        out = out[infer_etiologic_agent(out).str.upper().isin(agent_norm)]
    return out


def get_df() -> pd.DataFrame:
    """Load and cache the working SRAG dataframe from the database."""
    now = datetime.now(UTC)
    if (
        _cache["df"] is not None
        and _cache["loaded_at"]
        and (now - _cache["loaded_at"]) < timedelta(minutes=15)
    ):
        return _cache["df"]  # type: ignore[no-any-return]

    try:
        core_cols = [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "ID_MUNICIP",
            "ID_MN_RESI",
            "CLASSI_FIN",
            "ID_UNIDADE",
            "BAIRRO_REF",
            "NM_BAIRRO",
            "ZONA",
            "CS_ZONA",
            "NU_IDADE_N",
            "TP_IDADE",
            "IDADE_ANOS",
            "CS_SEXO",
            "CS_RACA",
            "CS_ESCOL_N",
            "EVOLUCAO",
            "UTI",
            "HOSPITAL",
            "SUPORT_VEN",
            "NOSOCOMIAL",
            "CS_GESTANT",
            "PUERPERA",
            "FEBRE",
            "TOSSE",
            "GARGANTA",
            "DISPNEIA",
            "DESC_RESP",
            "SATURACAO",
            "DIARREIA",
            "VOMITO",
            "DOR_ABD",
            "FADIGA",
            "PERD_OLFT",
            "PERD_PALA",
            "OUTRO_SIN",
            "PCR_VSR",
            "AN_VSR",
            "PCR_SARS2",
            "AN_SARS2",
            "TP_FLU_PCR",
            "TP_FLU_AN",
            "PCR_RESUL",
            "RES_AN",
            "DT_PCR",
            "DT_RES_AN",
            "DT_COLETA",
            "CO_LAB_AN",
            "ASMA",
            "DIABETES",
            "OBESIDADE",
            "CARDIOPATI",
            "PNEUMOPATI",
            "RENAL",
            "IMUNODEPRE",
            "NEUROLOGIC",
            "HEMATOLOGI",
            "HEPATICA",
            "SIND_DOWN",
            "TABAG",
            "OUT_MORBI",
            "VACINA",
            "DT_UT_DOSE",
            "DT_1_DOSE",
            "MAE_VAC",
            "DT_VAC_MAE",
            "DT_DOSEUNI",
            "ANTIVIRAL",
            "CRITERIO",
            "DT_2_DOSE",
            "DT_INTERNA",
            "DT_ENTUTI",
            "VACINA_COV",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "DOSE_2REF",
            "DOSE_ADIC",
            "DOS_RE_BI",
            "VG_OMS",
            "VG_LIN",
            "VG_MET",
            "VG_REINF",
            "CO_DETEC",
            "PCR_FLUASU",
            "PCR_FLUBLI",
            "RAIOX_RES",
            "TOMO_RES",
            "TP_SOR",
            "RES_IGG",
            "RES_IGM",
            "RES_IGA",
            "TP_ANTIVIR",
            "TIPO_TRAT",
            "SURTO_SG",
            "DT_ANTIVIR",
            "DT_INTERNA",
            "DT_EVOLUCA",
            "DT_ENTUTI",
        ]
        unique_cols = list(dict.fromkeys(core_cols))
        cols_str = ", ".join(unique_cols)
        df = pd.read_sql(f"SELECT {cols_str} FROM casos_srag", engine)
        df = df.reset_index(drop=True)
        date_cols = [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "DT_INTERNA",
            "DT_ENTUTI",
            "DT_EVOLUCA",
            "DT_COLETA",
            "DT_PCR",
            "DT_RES_AN",
            "DT_UT_DOSE",
            "DT_1_DOSE",
            "DT_ANTIVIR",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "DOSE_2REF",
            "DOS_RE_BI",
        ]
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
        df = df[df["DT_SIN_PRI"].notna()]
        _cache["df"] = df
        _cache["loaded_at"] = now
        return df
    except Exception as e:
        print(f"ERRO BACKEND: {e}")
        cached = _cache["df"]
        if cached is not None:
            return cast("pd.DataFrame", cached)
        return pd.DataFrame()
