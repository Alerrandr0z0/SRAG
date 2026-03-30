"""Low-memory backfill for SRAG SQLite using Parquet batches."""

from __future__ import annotations

from pathlib import Path
from decimal import Decimal

import pandas as pd
import pyarrow.parquet as pq

from srag.data.database import init_db, save_cases
from srag.data.loader import (
    _infer_zone_from_bairro,
    _normalize_bairro_name,
    _normalize_zone,
)

MOSSORO_CODES = {"2408003", "240800"}

DATE_COLS = [
    "DT_NOTIFIC",
    "DT_SIN_PRI",
    "DT_PCR",
    "DT_RES_AN",
    "DT_COLETA",
    "DT_INTERNA",
    "DT_ENTUTI",
    "DT_SAIDUTI",
    "DT_EVOLUCA",
    "DOSE_1_COV",
    "DOSE_2_COV",
    "DOSE_REF",
    "DOSE_2REF",
    "DOSE_ADIC",
    "DOS_RE_BI",
    "DT_UT_DOSE",
]

FIELD_MAP = {
    "DT_NOTIFIC": "DT_NOTIFIC",
    "CO_MUN_NOT": "ID_MUNICIP",
    "CO_MUN_RES": "ID_MN_RESI",
    "DT_SIN_PRI": "DT_SIN_PRI",
    "ID_UNIDADE": "ID_UNIDADE",
    "CO_UNI_NOT": "ID_UNIDADE",
    "BAIRRO_REF": "BAIRRO_REF",
    "NM_BAIRRO": "NM_BAIRRO",
    "ZONA": "ZONA",
    "CS_ZONA": "CS_ZONA",
    "NU_IDADE_N": "NU_IDADE_N",
    "TP_IDADE": "TP_IDADE",
    "CS_SEXO": "CS_SEXO",
    "CS_RACA": "CS_RACA",
    "CS_ESCOL_N": "CS_ESCOL_N",
    "CS_GESTANT": "CS_GESTANT",
    "PUERPERA": "PUERPERA",
    "CLASSI_FIN": "CLASSI_FIN",
    "PCR_VSR": "PCR_VSR",
    "AN_VSR": "AN_VSR",
    "PCR_SARS2": "PCR_SARS2",
    "AN_SARS2": "AN_SARS2",
    "TP_FLU_PCR": "TP_FLU_PCR",
    "TP_FLU_AN": "TP_FLU_AN",
    "PCR_RESUL": "PCR_RESUL",
    "RES_AN": "RES_AN",
    "DT_PCR": "DT_PCR",
    "DT_RES_AN": "DT_RES_AN",
    "DT_COLETA": "DT_COLETA",
    "LAB_AN": "LAB_AN",
    "CO_LAB_AN": "CO_LAB_AN",
    "POS_PCRFLU": "POS_PCRFLU",
    "PCR_FLUASU": "PCR_FLUASU",
    "PCR_FLUBLI": "PCR_FLUBLI",
    "PCR_RINO": "PCR_RINO",
    "PCR_METAP": "PCR_METAP",
    "PCR_ADENO": "PCR_ADENO",
    "PCR_PARA1": "PCR_PARA1",
    "PCR_PARA2": "PCR_PARA2",
    "PCR_PARA3": "PCR_PARA3",
    "PCR_PARA4": "PCR_PARA4",
    "POS_AN_OUT": "POS_AN_OUT",
    "AN_ADENO": "AN_ADENO",
    "AN_PARA1": "AN_PARA1",
    "AN_PARA2": "AN_PARA2",
    "AN_PARA3": "AN_PARA3",
    "DT_INTERNA": "DT_INTERNA",
    "DT_ENTUTI": "DT_ENTUTI",
    "DT_SAIDUTI": "DT_SAIDUTI",
    "EVOLUCAO": "EVOLUCAO",
    "DT_EVOLUCA": "DT_EVOLUCA",
    "UTI": "UTI",
    "HOSPITAL": "HOSPITAL",
    "SUPORT_VEN": "SUPORT_VEN",
    "RAIOX_RES": "RAIOX_RES",
    "TOMO_RES": "TOMO_RES",
    "ASMA": "ASMA",
    "HEMATOLOGI": "HEMATOLOGI",
    "SIND_DOWN": "SIND_DOWN",
    "HEPATICA": "HEPATICA",
    "NEUROLOGIC": "NEUROLOGIC",
    "PNEUMOPATI": "PNEUMOPATI",
    "IMUNODEPRE": "IMUNODEPRE",
    "RENAL": "RENAL",
    "DIABETES": "DIABETES",
    "OBESIDADE": "OBESIDADE",
    "TABAG": "TABAG",
    "OUT_MORBI": "OUT_MORBI",
    "FEBRE": "FEBRE",
    "TOSSE": "TOSSE",
    "GARGANTA": "GARGANTA",
    "DISPNEIA": "DISPNEIA",
    "DESC_RESP": "DESC_RESP",
    "SATURACAO": "SATURACAO",
    "DIARREIA": "DIARREIA",
    "VOMITO": "VOMITO",
    "DOR_ABD": "DOR_ABD",
    "FADIGA": "FADIGA",
    "PERD_OLFT": "PERD_OLFT",
    "PERD_PALA": "PERD_PALA",
    "OUTRO_SIN": "OUTRO_SIN",
    "VACINA_COV": "VACINA_COV",
    "VACINA": "VACINA",
    "DT_UT_DOSE": "DT_UT_DOSE",
    "ANTIVIRAL": "ANTIVIRAL",
    "TRAT_COV": "TRAT_COV",
    "NOSOCOMIAL": "NOSOCOMIAL",
    "DOSE_1_COV": "DOSE_1_COV",
    "DOSE_2_COV": "DOSE_2_COV",
    "DOSE_REF": "DOSE_REF",
    "DOSE_2REF": "DOSE_2REF",
    "DOSE_ADIC": "DOSE_ADIC",
    "DOS_RE_BI": "DOS_RE_BI",
}


def _norm_code(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().str.replace(r"\.0$", "", regex=True)


def _coalesce_column(df: pd.DataFrame, col: str) -> pd.Series:
    value = df[col]
    if isinstance(value, pd.DataFrame):
        return value.bfill(axis=1).iloc[:, 0]
    return value


def _pick_municipality_code(df: pd.DataFrame, code_col: str, text_col: str) -> pd.Series:
    if code_col in df.columns:
        return _norm_code(df[code_col])
    if text_col in df.columns:
        return _norm_code(df[text_col])
    return pd.Series("", index=df.index, dtype="object")


def _to_years(df: pd.DataFrame) -> pd.Series:
    idade = pd.to_numeric(df.get("NU_IDADE_N"), errors="coerce")
    tp = pd.to_numeric(df.get("TP_IDADE"), errors="coerce")
    out = pd.Series(pd.NA, index=df.index, dtype="Float64")
    out = out.mask(tp == 3, idade)
    out = out.mask(tp == 2, idade / 12.0)
    out = out.mask(tp == 1, idade / 365.25)
    out = out.mask(tp.isna(), idade)
    return pd.to_numeric(out, errors="coerce")


def _normalize_chunk(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {}
    for source, target in FIELD_MAP.items():
        if source in df.columns:
            renamed[source] = target
    out = df.rename(columns=renamed)

    id_municip = _pick_municipality_code(df, "CO_MUN_NOT", "ID_MUNICIP")
    id_mn_resi = _pick_municipality_code(df, "CO_MUN_RES", "ID_MN_RESI")

    mossoro_names = {"MOSSORO", "MOSSORÓ"}
    mask = (
        id_municip.isin(MOSSORO_CODES)
        | id_mn_resi.isin(MOSSORO_CODES)
        | id_municip.str.upper().isin(mossoro_names)
        | id_mn_resi.str.upper().isin(mossoro_names)
    )
    out = out[mask].copy()
    if out.empty:
        return out

    out["ID_MUNICIP"] = id_municip[mask].values
    out["ID_MN_RESI"] = id_mn_resi[mask].values

    if "BAIRRO_REF" not in out.columns and "NM_BAIRRO" in out.columns:
        out["BAIRRO_REF"] = out["NM_BAIRRO"].apply(_normalize_bairro_name)
    if "CS_ZONA" in out.columns:
        cs = pd.to_numeric(out["CS_ZONA"], errors="coerce").astype("Int64")
        out["ZONA"] = cs.apply(lambda v: _normalize_zone(int(v)) if pd.notna(v) else None)
    if "ZONA" not in out.columns and "BAIRRO_REF" in out.columns:
        out["ZONA"] = out["BAIRRO_REF"].apply(_infer_zone_from_bairro)

    out["IDADE_ANOS"] = _to_years(out)

    for col in DATE_COLS:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce").dt.date

    keep_cols = {
        "DT_NOTIFIC",
        "ID_MUNICIP",
        "ID_MN_RESI",
        "DT_SIN_PRI",
        "ID_UNIDADE",
        "BAIRRO_REF",
        "ZONA",
        "CS_ZONA",
        "NU_IDADE_N",
        "TP_IDADE",
        "IDADE_ANOS",
        "CS_SEXO",
        "CS_RACA",
        "CS_ESCOL_N",
        "CS_GESTANT",
        "PUERPERA",
        "CLASSI_FIN",
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
        "LAB_AN",
        "CO_LAB_AN",
        "POS_PCRFLU",
        "PCR_FLUASU",
        "PCR_FLUBLI",
        "PCR_RINO",
        "PCR_METAP",
        "PCR_ADENO",
        "PCR_PARA1",
        "PCR_PARA2",
        "PCR_PARA3",
        "PCR_PARA4",
        "POS_AN_OUT",
        "AN_ADENO",
        "AN_PARA1",
        "AN_PARA2",
        "AN_PARA3",
        "DT_INTERNA",
        "DT_ENTUTI",
        "DT_SAIDUTI",
        "EVOLUCAO",
        "DT_EVOLUCA",
        "UTI",
        "HOSPITAL",
        "SUPORT_VEN",
        "RAIOX_RES",
        "TOMO_RES",
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
        "ASMA",
        "HEMATOLOGI",
        "SIND_DOWN",
        "HEPATICA",
        "NEUROLOGIC",
        "PNEUMOPATI",
        "IMUNODEPRE",
        "RENAL",
        "DIABETES",
        "OBESIDADE",
        "TABAG",
        "OUT_MORBI",
        "VACINA_COV",
        "VACINA",
        "DT_UT_DOSE",
        "ANTIVIRAL",
        "TRAT_COV",
        "NOSOCOMIAL",
        "DOSE_1_COV",
        "DOSE_2_COV",
        "DOSE_REF",
        "DOSE_2REF",
        "DOSE_ADIC",
        "DOS_RE_BI",
    }
    selected = [c for c in out.columns if c in keep_cols]
    out = out[selected]
    out = out[out["DT_NOTIFIC"].notna() & out["DT_SIN_PRI"].notna()]
    return out


def run_backfill() -> None:
    init_db()

    files = [
        Path("data/raw/INFLUD19.parquet"),
        Path("data/raw/INFLUD20.parquet"),
        Path("data/raw/INFLUD21.parquet"),
        Path("data/raw/INFLUD22.parquet"),
        Path("data/raw/INFLUD23.parquet"),
        Path("data/raw/INFLUD24.parquet"),
        Path("data/raw/INFLUD25-23-03-2026.parquet"),
        Path("data/raw/INFLUD26.parquet"),
    ]

    for path in files:
        if not path.exists():
            print(f"skip missing {path}")
            continue

        pq_file = pq.ParquetFile(path)
        available = set(pq_file.schema.names)
        cols = [c for c in FIELD_MAP if c in available]

        processed_rows = 0
        added_rows = 0

        for batch in pq_file.iter_batches(batch_size=20000, columns=cols):
            batch_df = batch.to_pandas()
            normalized = _normalize_chunk(batch_df)
            if normalized.empty:
                continue
            processed_rows += len(normalized)
            records = []
            for rec in normalized.to_dict(orient="records"):
                clean = {}
                for k, v in rec.items():
                    if pd.isna(v):
                        clean[k] = None
                    elif isinstance(v, Decimal):
                        clean[k] = float(v)
                    else:
                        clean[k] = v
                records.append(clean)
            added_rows += save_cases(records)

        print(f"{path.name}: processed={processed_rows} new_or_enriched={added_rows}")


if __name__ == "__main__":
    run_backfill()
