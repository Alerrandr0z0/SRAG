"""Master data ingestion script for SRAG Mossoró.
Universal engine for Parquet and CSV files using DuckDB.
"""

from __future__ import annotations

from pathlib import Path
import duckdb
import sqlite3
import pandas as pd

from srag.data.database import init_db
from srag.data.loader import (
    _normalize_bairro_name,
    _normalize_zone,
    _infer_zone_from_bairro
)

# Defaults
DB_PATH = Path("data/processed/srag_mossoro.db")
DATA_DIRS = [Path("data/raw")]

# Mossoró normalization constants
MOSSORO_CODES = ('2408003', '240800', '240800.0')
MOSSORO_NAMES = ('MOSSORO', 'MOSSORÓ')

def main(db_path_override: Path | None = None, data_dirs_override: list[Path] | None = None) -> None:
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
        "DT_NOTIFIC", "DT_SIN_PRI", "DT_NASC", "DT_INTERNA", "DT_ENTUTI", 
        "DT_SAIDUTI", "DT_EVOLUCA", "DT_PCR", "DT_RES_AN", "DT_COLETA", 
        "DOSE_1_COV", "DOSE_2_COV", "DOSE_REF", "DOSE_2REF", "DOSE_ADIC", 
        "DOS_RE_BI", "DT_UT_DOSE"
    }

    # Tabela temporária para consolidação
    con.execute(f"CREATE TABLE temp_cases AS SELECT * FROM sqlite_db.casos_srag WHERE 1=0;")

    # 1. Localizar arquivos
    files = []
    for d in data_dirs:
        if d.exists():
            files.extend(list(d.glob("**/*.parquet")))
            files.extend(list(d.glob("**/*.csv")))

    if not files:
        print(f"⚠️ Nenhum dado encontrado em {data_dirs}.")
        return

    print(f"📦 Processando {len(files)} fontes de dados...")

    for pf in files:
        print(f"  -> {pf.name}")
        ext = pf.suffix.lower()
        read_func = "read_parquet" if ext == ".parquet" else "read_csv_auto"
        
        try:
            file_cols_raw = [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM {read_func}('{pf}')").fetchall()]
            file_cols = {c.upper(): c for c in file_cols_raw}
            
            def get_col(name):
                return file_cols.get(name.upper(), "NULL")

            source_mun = get_col("CO_MUN_NOT") if get_col("CO_MUN_NOT") != "NULL" else get_col("ID_MUNICIP")
            source_res = get_col("CO_MUN_RES") if get_col("CO_MUN_RES") != "NULL" else get_col("ID_MN_RESI")
            source_unit = get_col("CO_UNI_NOT") if get_col("CO_UNI_NOT") != "NULL" else get_col("ID_UNIDADE")

            select_parts = []
            for col in target_cols:
                col_up = col.upper()
                if col == "unique_hash":
                    select_parts.append(f"""
                        md5(COALESCE(CAST({get_col("DT_NOTIFIC")} AS VARCHAR), '') || '|' || COALESCE(CAST({source_mun} AS VARCHAR), '') || '|' || COALESCE(CAST({get_col("DT_SIN_PRI")} AS VARCHAR), '') || '|' || COALESCE(CAST({get_col("NU_IDADE_N")} AS VARCHAR), '') || '|' || COALESCE(CAST({get_col("CS_SEXO")} AS VARCHAR), '') || '|' || COALESCE(CAST({source_unit} AS VARCHAR), ''))
                    """)
                elif col in ["BAIRRO_REF", "ZONA"]:
                    select_parts.append("NULL")
                elif col == "ID_MUNICIP":
                    select_parts.append(f"CAST({source_mun} AS VARCHAR)")
                elif col == "ID_MN_RESI":
                    select_parts.append(f"CAST({source_res} AS VARCHAR)")
                elif col_up in date_cols and get_col(col_up) != "NULL":
                    orig = get_col(col_up)
                    select_parts.append(f"COALESCE(TRY_CAST({orig} AS DATE), TRY_CAST(strptime(CAST({orig} AS VARCHAR), '%d/%m/%Y') AS DATE))")
                else:
                    select_parts.append(get_col(col_up))

            con.execute(f"""
                INSERT INTO temp_cases ({", ".join(target_cols)})
                SELECT {", ".join(select_parts)} FROM {read_func}('{pf}')
                WHERE CAST({source_mun} AS VARCHAR) IN {MOSSORO_CODES} OR CAST({source_res} AS VARCHAR) IN {MOSSORO_CODES}
                   OR UPPER(CAST({source_mun} AS VARCHAR)) IN {MOSSORO_NAMES} OR UPPER(CAST({source_res} AS VARCHAR)) IN {MOSSORO_NAMES}
            """)
        except Exception as e:
            print(f"  ❌ Erro em {pf.name}: {e}")

    # 2. Desduplicação e Carga Final
    print("💎 Removendo duplicatas e salvando no banco final...")
    con.execute(f"""
        INSERT INTO sqlite_db.casos_srag ({", ".join(target_cols)})
        SELECT {", ".join(target_cols)} FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY unique_hash ORDER BY DT_NOTIFIC DESC) as rn
            FROM temp_cases
        ) WHERE rn = 1
    """)
    
    # 3. Normalização Inteligente (Pandas Pass)
    print("🧪 Aplicando inteligência geográfica...")
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql("SELECT rowid, NM_BAIRRO, CS_ZONA FROM casos_srag", conn)
        df["BAIRRO_REF"] = df["NM_BAIRRO"].apply(_normalize_bairro_name)
        
        def infer_zone(row):
            z = _normalize_zone(int(row["CS_ZONA"])) if pd.notna(row["CS_ZONA"]) else None
            return z or _infer_zone_from_bairro(row["BAIRRO_REF"]) or "Nao informado"
            
        df["ZONA"] = df.apply(infer_zone, axis=1)
        cursor = conn.cursor()
        cursor.executemany("UPDATE casos_srag SET BAIRRO_REF = ?, ZONA = ? WHERE rowid = ?", 
                           df[["BAIRRO_REF", "ZONA", "rowid"]].values.tolist())
        conn.commit()

    count = con.execute("SELECT count(*) FROM sqlite_db.casos_srag").fetchone()[0]
    print(f"✅ Ingestão finalizada: {count} registros únicos.")

if __name__ == "__main__":
    main()
