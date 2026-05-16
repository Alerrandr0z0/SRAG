"""Master data ingestion script for SRAG Mossoró.

DuckDB handles CSV and Parquet; XLSX is loaded via pandas.
"""

from __future__ import annotations

import sqlite3
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
import pandas as pd

# Path adjustment for local imports
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


if TYPE_CHECKING:
    from collections.abc import Iterable


# Defaults
DB_PATH = Path("data/processed/srag_mossoro.db")
DATA_DIRS = [Path("data/raw")]

# Mossoró normalization constants
MOSSORO_CODES = ("2408003", "240800", "240800.0")
MOSSORO_NAMES = ("MOSSORO", "MOSSORÓ")


def _load_source_frames(pf: Path) -> Iterable[tuple[str, pd.DataFrame]]:
    """Load one file as one or more DataFrames.

    Args:
        pf: Path to the source file.

    Yields:
        Tuples of (source_name, DataFrame).
    """
    ext = pf.suffix.lower()
    if ext == ".xlsx":
        sheets = pd.read_excel(pf, sheet_name=None, dtype=str)
        for sheet_name, df in sheets.items():
            yield f"{pf.name}::{sheet_name}", df
        return

    if ext == ".parquet":
        yield pf.name, pd.read_parquet(pf)
        return

    yield pf.name, pd.read_csv(pf, sep=None, engine="python", dtype=str)


def main(
    db_path_override: Path | None = None, data_dirs_override: list[Path] | None = None
) -> None:
    """Run the master ingestion pipeline.

    Args:
        db_path_override: Optional path to the SQLite database.
        data_dirs_override: Optional list of directories to search for data.
    """
    from srag.data.database import build_case_hash_sql, init_db
    from srag.data.loader import _infer_zone_from_bairro, _normalize_bairro_name, _normalize_zone

    db_path = db_path_override or DB_PATH
    data_dirs = data_dirs_override or DATA_DIRS

    print(f"🚀 Iniciando motor universal de ingestão (DB: {db_path})...")

    init_db()
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute(f"ATTACH '{db_path}' AS sqlite_db (TYPE SQLITE);")

    print("🧹 Limpando dados antigos...")
    con.execute("DELETE FROM sqlite_db.casos_srag;")

    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("PRAGMA table_info('casos_srag')")
        target_cols = [c[1] for c in cursor.fetchall()]

    date_cols = {
        "DT_NOTIFIC",
        "DT_SIN_PRI",
        "DT_NASC",
        "DT_INTERNA",
        "DT_ENTUTI",
        "DT_SAIDUTI",
        "DT_EVOLUCA",
        "DT_PCR",
        "DT_RES_AN",
        "DT_COLETA",
        "DOSE_1_COV",
        "DOSE_2_COV",
        "DOSE_REF",
        "DOSE_2REF",
        "DOSE_ADIC",
        "DOS_RE_BI",
        "DT_UT_DOSE",
        "DT_1_DOSE",
        "DT_2_DOSE",
        "DT_DOSEUNI",
        "DT_VAC_MAE",
        "DT_ANTIVIR",
    }

    # Tabela temporária para consolidação
    con.execute("CREATE TABLE temp_cases AS SELECT * FROM sqlite_db.casos_srag WHERE 1=0;")

    # 1. Localizar arquivos
    files = []
    for d in data_dirs:
        if d.exists():
            files.extend(list(d.glob("**/*.parquet")))
            files.extend(list(d.glob("**/*.csv")))
            files.extend(list(d.glob("**/*.xlsx")))

    if not files:
        print(f"⚠️ Nenhum dado encontrado em {data_dirs}.")
        return

    print(f"📦 Processando {len(files)} fontes de dados...")

    for pf in files:
        try:
            for source_name, source_df in _load_source_frames(pf):
                print(f"  -> {source_name}")
                file_cols = {str(c).upper(): c for c in source_df.columns}

                def get_col(name: str, current_cols: dict[str, str] = file_cols) -> str:
                    return current_cols.get(name.upper(), "NULL")

                source_mun = (
                    get_col("CO_MUN_NOT")
                    if get_col("CO_MUN_NOT") != "NULL"
                    else get_col("ID_MUNICIP")
                )
                source_res = (
                    get_col("CO_MUN_RES")
                    if get_col("CO_MUN_RES") != "NULL"
                    else get_col("ID_MN_RESI")
                )

                def resolve_hash_field(
                    field: str,
                    current_mun: str = source_mun,
                    current_cols: dict[str, str] = file_cols,
                ) -> str:
                    if field == "ID_MUNICIP":
                        return current_mun
                    return current_cols.get(field.upper(), "NULL")

                select_parts = []
                for col in target_cols:
                    col_up = col.upper()
                    if col == "unique_hash":
                        # Hash logic MUST match srag.data.database.generate_case_hash.
                        select_parts.append(build_case_hash_sql(resolve_hash_field))
                    elif col in ["BAIRRO_REF", "ZONA"]:
                        select_parts.append("NULL")
                    elif col == "ID_MUNICIP":
                        select_parts.append(f"CAST({source_mun} AS VARCHAR)")
                    elif col == "ID_MN_RESI":
                        select_parts.append(f"CAST({source_res} AS VARCHAR)")
                    elif col_up in date_cols:
                        orig = get_col(col_up)
                        if orig == "NULL":
                            select_parts.append("NULL")
                        else:
                            # Tenta vários formatos: ISO Date, ISO Timestamp, Brasileiro
                            p1 = "strptime(SUBSTR(CAST({orig} AS VARCHAR), 1, 10), '%d/%m/%Y')"
                            p2 = "strptime(SUBSTR(CAST({orig} AS VARCHAR), 1, 10), '%Y-%m-%d')"
                            select_parts.append(f"""
                                COALESCE(
                                    TRY_CAST({orig} AS DATE),
                                    TRY_CAST({p1} AS DATE),
                                    TRY_CAST({p2} AS DATE)
                                )
                            """)
                    elif col_up == "CO_DETEC":
                        # Tenta os dois nomes: CO-DETEC (dicionário) vs CO_DETEC (alguns anos)
                        orig = (
                            get_col("CO-DETEC")
                            if get_col("CO-DETEC") != "NULL"
                            else get_col("CO_DETEC")
                        )
                        select_parts.append(orig)
                    elif col_up == "FAB_COV1":
                        orig = (
                            get_col("FAB_COV_1")
                            if get_col("FAB_COV_1") != "NULL"
                            else get_col("FAB_COV1")
                        )
                        select_parts.append(orig)
                    elif col_up == "FAB_COV2":
                        orig = (
                            get_col("FAB_COV_2")
                            if get_col("FAB_COV_2") != "NULL"
                            else get_col("FAB_COV2")
                        )
                        select_parts.append(orig)
                    else:
                        select_parts.append(get_col(col_up))

                con.register("source_frame", source_df)
                # FILTRO AMPLIADO: Garante captura de códigos IBGE curtos e longos + nomes
                con.execute(f"""
                    INSERT INTO temp_cases ({", ".join(target_cols)})
                    SELECT {", ".join(select_parts)} FROM source_frame
                    WHERE
                        CAST({source_mun} AS VARCHAR) LIKE '240800%' OR
                        CAST({source_res} AS VARCHAR) LIKE '240800%' OR
                        UPPER(CAST({source_mun} AS VARCHAR)) IN {MOSSORO_NAMES} OR
                        UPPER(CAST({source_res} AS VARCHAR)) IN {MOSSORO_NAMES}
                """)  # nosec B608

        except Exception as e:
            print(f"  ❌ Erro em {pf.name}: {e}")

    # 2. Desduplicação e Carga Final
    print("💎 Removendo duplicatas e salvando no banco final...")
    temp_row = con.execute("SELECT count(*) FROM temp_cases").fetchone()
    assert temp_row is not None
    temp_count = temp_row[0]
    con.execute(f"""
        INSERT INTO sqlite_db.casos_srag ({", ".join(target_cols)})
        SELECT {", ".join(target_cols)} FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY unique_hash ORDER BY DT_NOTIFIC DESC) as rn
            FROM temp_cases
        ) WHERE rn = 1
    """)  # nosec B608
    final_row = con.execute("SELECT count(*) FROM sqlite_db.casos_srag").fetchone()
    assert final_row is not None
    final_count = final_row[0]
    duplicates = temp_count - final_count
    print(
        "📊 Ingestão consolidada: "
        f"temp_cases={temp_count}, unique_cases={final_count}, duplicates_removed={duplicates}"
    )

    # 3. Normalização Inteligente (Pandas Pass)
    print("🧪 Aplicando inteligência geográfica...")
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql("SELECT rowid, NM_BAIRRO, CS_ZONA FROM casos_srag", conn)
        df["BAIRRO_REF"] = df["NM_BAIRRO"].apply(_normalize_bairro_name)
        zona_from_code = df["CS_ZONA"].apply(
            lambda value: _normalize_zone(int(value)) if pd.notna(value) else None
        )
        zona_from_bairro = df["BAIRRO_REF"].apply(_infer_zone_from_bairro)
        df["ZONA"] = zona_from_code.combine_first(zona_from_bairro).fillna("Nao informado")
        cursor = conn.cursor()
        cursor.executemany(
            "UPDATE casos_srag SET BAIRRO_REF = ?, ZONA = ? WHERE rowid = ?",
            df[["BAIRRO_REF", "ZONA", "rowid"]].values.tolist(),
        )
        conn.commit()

    print(f"✅ Ingestão finalizada: {final_count} registros únicos.")


if __name__ == "__main__":
    main()
