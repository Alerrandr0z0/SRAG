"""Data loading and anonymization utilities for Mossoró SRAG data."""

import logging
import unicodedata
from typing import TYPE_CHECKING

import pandas as pd
from pydantic import ValidationError

from srag.data.schema import SragCase, is_mossoro_case

if TYPE_CHECKING:
    from pathlib import Path

logger = logging.getLogger(__name__)

# List of sensitive fields that MUST be dropped for LGPD compliance.
# Address fields are intentionally kept because the application uses
# territorial data for analysis and geospatial views.
SENSITIVE_FIELDS = [
    "NM_PACIENT",  # Nome do Paciente
    "NU_CPF",  # CPF
    "NU_CNS",  # Cartão Nacional de Saúde
    "NM_MAE_PAC",  # Nome da Mãe
    "NU_DDD_TEL",  # DDD Telefone
    "NU_TELEFON",  # Telefone
    "ID_RG_RESI",  # Registro de Residência
]

COLUMN_ALIASES = {
    "CO_MUN_NOT": "ID_MUNICIP",
    "CO_MUN_RES": "ID_MN_RESI",
    "CO_UNI_NOT": "ID_UNIDADE",
    "CO-DETEC": "CO_DETEC",
    "FAB_COV_1": "FAB_COV1",
    "FAB_COV_2": "FAB_COV2",
}

RURAL_KEYWORDS = [
    "RURAL",
    "SITIO",
    "ASSENTAMENTO",
    "FAZENDA",
    "PROJETO DE ASSENTAMENTO",
    "VILA RURAL",
]


def _normalize_bairro_name(value: str | None) -> str | None:
    """Normalize bairro values to a stable, privacy-preserving category."""
    if value is None:
        return None

    text = str(value).strip().upper()
    if not text or text in {"NAN", "NONE", "NULL", "IGNORADO", "SEM INFORMACAO"}:
        return None

    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    text = " ".join(text.split())
    return text


def _infer_zone_from_bairro(bairro_ref: str | None) -> str | None:
    """Infer territorial zone from bairro text using simple heuristics."""
    if bairro_ref is None:
        return None

    if any(keyword in bairro_ref for keyword in RURAL_KEYWORDS):
        return "Rural"
    return "Urbana"


def _normalize_zone(cs_zona: int | None) -> str | None:
    """Map official CS_ZONA coding to human-readable labels."""
    if cs_zona is None:
        return None
    zone_map = {
        1: "Urbana",
        2: "Rural",
        3: "Periurbana",
    }
    return zone_map.get(cs_zona)



def _normalize_age_to_years(nu_idade_n: int | None, tp_idade: int | None) -> float | None:
    """Convert SIVEP age representation into decimal years.

    SIVEP stores age value (NU_IDADE_N) with a separate type code (TP_IDADE):
    1=days, 2=months, 3=years.
    """
    if nu_idade_n is None or nu_idade_n < 0:
        return None

    if tp_idade == 1:
        return round(nu_idade_n / 365.25, 4)
    if tp_idade == 2:
        return round(nu_idade_n / 12.0, 4)
    if tp_idade == 3 or tp_idade is None:
        return float(nu_idade_n)

    return None


def load_and_clean_srag_data(
    file_path: Path,
    filter_mossoro: bool = True,
    drop_sensitive: bool = True,
) -> pd.DataFrame:
    """Load SRAG data from CSV, Excel, or Parquet, validate, and clean it.

    Args:
        file_path: Path to the input file (CSV, Excel, or Parquet).
        filter_mossoro: If True, only keeps cases related to Mossoró/RN.
        drop_sensitive: If True, removes LGPD-sensitive columns.

    Returns:
        A cleaned and validated pandas DataFrame.
    """
    logger.info(f"Loading data from {file_path}")

    # Load data - attempting to detect separator for CSV
    try:
        if file_path.suffix.lower() == ".csv":
            # Some datasets use ; others use ,
            # Trying auto-detect first, then semicolon as fallback
            try:
                df = pd.read_csv(file_path, sep=None, engine="python", dtype=str)
            except Exception:
                df = pd.read_csv(file_path, sep=";", dtype=str)
        elif file_path.suffix.lower() in [".xls", ".xlsx"]:
            df = pd.read_excel(file_path, dtype=str)
        elif file_path.suffix.lower() == ".parquet":
            df = pd.read_parquet(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
    except Exception as e:
        logger.error(f"Failed to read file {file_path}: {e}")
        raise

    # 0. Normalize known alternate SIVEP column names
    rename_map = {
        source: target
        for source, target in COLUMN_ALIASES.items()
        if source in df.columns and target not in df.columns
    }
    if rename_map:
        df = df.rename(columns=rename_map)
        logger.info(f"Normalized {len(rename_map)} alternate SIVEP column names.")

    # 0.1 Derive territorial fields before dropping sensitive columns
    if "NM_BAIRRO" in df.columns and "BAIRRO_REF" not in df.columns:
        df["BAIRRO_REF"] = df["NM_BAIRRO"].apply(_normalize_bairro_name)

    if "CS_ZONA" in df.columns:
        cs_zona_num = pd.to_numeric(df["CS_ZONA"], errors="coerce").astype("Int64")
        df["ZONA"] = cs_zona_num.apply(lambda v: _normalize_zone(int(v)) if pd.notna(v) else None)

    if "BAIRRO_REF" in df.columns and "ZONA" not in df.columns:
        df["ZONA"] = df["BAIRRO_REF"].apply(_infer_zone_from_bairro)

    if "BAIRRO_REF" in df.columns and "ZONA" in df.columns:
        missing_zone = df["ZONA"].isna()
        df.loc[missing_zone, "ZONA"] = df.loc[missing_zone, "BAIRRO_REF"].apply(
            _infer_zone_from_bairro
        )

    # 1. Drop sensitive fields immediately if requested (Privacy First)
    if drop_sensitive:
        cols_to_drop = [c for c in SENSITIVE_FIELDS if c in df.columns]
        df = df.drop(columns=cols_to_drop)
        logger.info(f"Dropped {len(cols_to_drop)} sensitive columns for LGPD compliance.")

    # 2. Validation and filtering using Pydantic
    valid_records = []
    invalid_count = 0

    # Convert DataFrame to list of dicts for Pydantic validation
    records = df.to_dict(orient="records")

    for record in records:
        try:
            # Clean empty strings and NaN to None for optional fields
            cleaned_record = {
                k: (v if str(v).strip() != "" and pd.notna(v) else None) for k, v in record.items()
            }

            case = SragCase.model_validate(cleaned_record)

            # Filter for Mossoró (IBGE 2408003) if requested
            if filter_mossoro and not is_mossoro_case(case):
                continue

            normalized_case = case.model_dump()
            normalized_case["IDADE_ANOS"] = _normalize_age_to_years(
                normalized_case.get("NU_IDADE_N"),
                normalized_case.get("TP_IDADE"),
            )
            valid_records.append(normalized_case)
        except ValidationError as e:
            invalid_count += 1
            if invalid_count < 3:  # Log only first few errors to avoid noise
                logger.debug(f"Validation error in record: {e}")

    if invalid_count > 0:
        logger.warning(
            f"Skipped {invalid_count} records due to validation errors (dates, types, etc)."
        )

    logger.info(f"Processed {len(valid_records)} valid records for Mossoró.")

    return pd.DataFrame(valid_records)


def export_secure_dataset(input_path: Path, output_path: Path) -> None:
    """Read a raw dataset and export a filtered, anonymized version for Mossoró.

    This function is designed to be the main entry point for the Mossoró health sector.
    """
    df_clean = load_and_clean_srag_data(input_path, filter_mossoro=True, drop_sensitive=True)

    if df_clean.empty:
        logger.warning("No valid Mossoró records found to export.")
        return

    # Create parent directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save as Parquet for efficiency or CSV as fallback
    if output_path.suffix == ".parquet":
        df_clean.to_parquet(output_path, index=False)
    else:
        df_clean.to_csv(output_path, index=False, encoding="utf-8")

    logger.info(f"Secure dataset exported successfully to {output_path}")
