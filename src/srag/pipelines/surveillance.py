"""Core Epidemiological Surveillance Pipeline for SRAG Mossoró.

Integrates DuckDB performance with Data Quality validation and weekly Snapshots.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from typing import TYPE_CHECKING, Any, cast

import duckdb
import pandas as pd

from srag.data.analytics import compute_severity_metrics
from srag.data.database import init_db
from srag.data.loader import _infer_zone_from_bairro, _normalize_bairro_name, _normalize_zone
from srag.data.references import MOSSORO_IBGE_CODES, MOSSORO_NAMES
from srag.pipelines.validation import validate_srag_data

if TYPE_CHECKING:
    from pathlib import Path

logger = logging.getLogger("SRAG-Surveillance")

DATE_COLS = {
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
}


def _load_surveillance_sources(con: duckdb.DuckDBPyConnection, pf: Path) -> list[str]:
    ext = pf.suffix.lower()
    if ext in {".xls", ".xlsx"}:
        sheets = pd.read_excel(pf, sheet_name=None, dtype=str)
        relation_names: list[str] = []
        for idx, (_sheet_name, df) in enumerate(sheets.items()):
            relation_name = f"xlsx_{pf.stem}_{idx}"
            con.register(relation_name, df)
            relation_names.append(relation_name)
        return relation_names

    return ["read_parquet" if ext == ".parquet" else "read_csv_auto"]


def run_surveillance_pipeline(
    db_path: Path, data_dirs: list[Path], force: bool = False
) -> dict[str, Any]:
    """Execute the full surveillance lifecycle: Ingest -> Validate -> Snapshot -> Load."""
    start_time = datetime.now()
    report: dict[str, Any] = {
        "timestamp": start_time.isoformat(),
        "steps": [],
        "status": "starting",
    }

    try:
        # 1. Setup & Extraction (DuckDB Engine)
        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute(f"ATTACH '{db_path}' AS sqlite_db (TYPE SQLITE);")

        # Ensure schema
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute("PRAGMA table_info('casos_srag')")
            target_cols = [c[1] for c in cursor.fetchall()]
            if not target_cols:
                init_db()
                cursor = conn.execute("PRAGMA table_info('casos_srag')")
                target_cols = [c[1] for c in cursor.fetchall()]

        con.execute("CREATE TABLE temp_raw AS SELECT * FROM sqlite_db.casos_srag WHERE 1=0;")

        files = []
        for d in data_dirs:
            if d.exists():
                files.extend(list(d.glob("**/*.parquet")))
                files.extend(list(d.glob("**/*.csv")))
                files.extend(list(d.glob("**/*.xls")))
                files.extend(list(d.glob("**/*.xlsx")))

        for pf in files:
            for source in _load_surveillance_sources(con, pf):
                if source.startswith("read_"):
                    cols = [
                        c[0]
                        for c in con.execute(f"DESCRIBE SELECT * FROM {source}('{pf}')").fetchall()  # nosec: B608
                    ]
                    source_expr = f"{source}('{pf}')"
                else:
                    cols = [
                        c[0]
                        for c in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()  # nosec B608
                    ]

                    source_expr = source

                file_map = {c.upper(): c for c in cols}

                def get_src(name: str, mapping: dict[str, str] = file_map) -> str:
                    return mapping.get(name.upper(), "NULL")

                s_mun = (
                    get_src("CO_MUN_NOT")
                    if get_src("CO_MUN_NOT") != "NULL"
                    else get_src("ID_MUNICIP")
                )
                s_res = (
                    get_src("CO_MUN_RES")
                    if get_src("CO_MUN_RES") != "NULL"
                    else get_src("ID_MN_RESI")
                )
                select_parts = []
                for col in target_cols:
                    col_up = col.upper()
                    if col == "unique_hash":
                        select_parts.append(
                            "md5("
                            f"COALESCE(CAST({get_src('DT_NOTIFIC')} AS VARCHAR), '') || '|' || "
                            f"COALESCE(CAST({s_mun} AS VARCHAR), '') || '|' || "
                            f"COALESCE(CAST({get_src('DT_SIN_PRI')} AS VARCHAR), '') || '|' || "
                            f"COALESCE(CAST({get_src('NU_IDADE_N')} AS VARCHAR), '') || '|' || "
                            f"COALESCE(CAST({get_src('CS_SEXO')} AS VARCHAR), '')"
                            ")"
                        )
                    elif col in ["BAIRRO_REF", "ZONA"]:
                        select_parts.append("NULL")
                    elif col == "ID_MUNICIP":
                        select_parts.append(f"CAST({s_mun} AS VARCHAR)")
                    elif col == "ID_MN_RESI":
                        select_parts.append(f"CAST({s_res} AS VARCHAR)")
                    elif col_up in DATE_COLS and get_src(col_up) != "NULL":
                        orig = get_src(col_up)
                        select_parts.append(
                            "COALESCE("
                            f"TRY_CAST({orig} AS DATE), "
                            f"TRY_CAST(strptime(CAST({orig} AS VARCHAR), '%d/%m/%Y') AS DATE)"
                            ")"
                        )
                    else:
                        select_parts.append(get_src(col_up))

                con.execute(
                    f"INSERT INTO temp_raw ({', '.join(target_cols)}) "  # nosec: B608
                    f"SELECT {', '.join(select_parts)} FROM {source_expr} "  # nosec: B608
                    f"WHERE CAST({s_mun} AS VARCHAR) IN {MOSSORO_IBGE_CODES} OR "  # nosec: B608
                    f"CAST({s_res} AS VARCHAR) IN {MOSSORO_IBGE_CODES} OR "  # nosec: B608
                    f"UPPER(CAST({s_mun} AS VARCHAR)) IN {MOSSORO_NAMES} OR "  # nosec: B608
                    f"UPPER(CAST({s_res} AS VARCHAR)) IN {MOSSORO_NAMES}"  # nosec: B608
                )
        # 2. Validation (Pandas Pass)
        df_all = con.execute("SELECT * FROM temp_raw").df()
        is_valid, warnings = validate_srag_data(df_all)
        report["steps"].append({"name": "validation", "warnings": warnings})

        if not is_valid:
            return {"status": "failed", "errors": warnings}
        if warnings and not force:
            return {"status": "blocked", "warnings": warnings}

        # 3. Load & Deduplicate
        con.execute("DELETE FROM sqlite_db.casos_srag;")
        con.execute(
            f"INSERT INTO sqlite_db.casos_srag ({', '.join(target_cols)}) "  # nosec: B608
            f"SELECT {', '.join(target_cols)} FROM ("  # nosec: B608
            "SELECT *, ROW_NUMBER() OVER (PARTITION BY unique_hash ORDER BY DT_NOTIFIC DESC) "
            "AS rn FROM temp_raw) WHERE rn = 1"
        )
        # 4. Intelligence Pass (Bairros/Zonas)
        with sqlite3.connect(db_path) as conn:
            df = pd.read_sql("SELECT rowid, NM_BAIRRO, CS_ZONA FROM casos_srag", conn)
            if not df.empty:
                df["BAIRRO_REF"] = df["NM_BAIRRO"].apply(_normalize_bairro_name)
                df["ZONA"] = (
                    cast("Any", df)
                    .apply(
                        lambda r: (
                            _normalize_zone(int(r["CS_ZONA"]))
                            if pd.notna(r["CS_ZONA"])
                            else _infer_zone_from_bairro(r["BAIRRO_REF"])
                        ),
                        axis=1,
                    )
                    .fillna("Nao informado")
                )
                conn.executemany(
                    "UPDATE casos_srag SET BAIRRO_REF = ?, ZONA = ? WHERE rowid = ?",
                    df[["BAIRRO_REF", "ZONA", "rowid"]].values.tolist(),
                )

        # 5. Snapshot generation
        final_df = con.execute("SELECT * FROM sqlite_db.casos_srag").df()
        final_count = len(final_df)
        metrics = compute_severity_metrics(final_df)
        snap_path = db_path.parent / "snapshots"
        snap_path.mkdir(parents=True, exist_ok=True)
        snap_file = snap_path / f"surveillance_snap_{start_time.strftime('%Y%m%d')}.json"
        with open(snap_file, "w") as f:
            json.dump(
                {"total": final_count, "metrics": metrics, "date": start_time.isoformat()},
                f,
                indent=2,
            )

        report.update(
            {"status": "success", "final_count": final_count, "snapshot": str(snap_file)}
        )

    except Exception as e:
        logger.exception("Pipeline crash")
        report.update({"status": "error", "error": str(e)})

    return report
