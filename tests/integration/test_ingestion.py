import sqlite3
import sys
from pathlib import Path

import pandas as pd

# Add scripts directory to path for import
scripts_path = Path(__file__).parent.parent.parent / "scripts"
if str(scripts_path) not in sys.path:
    sys.path.insert(0, str(scripts_path))

from scripts.ingest_data import main as ingest_main


def test_run_ingestion_duckdb(tmp_path, monkeypatch) -> None:
    # 1. Setup paths
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()

    db_path = processed_dir / "srag_mossoro.db"
    csv_file = raw_dir / "test_data.csv"

    # Minimal columns required for DuckDB ingestion logic
    df = pd.DataFrame(
        {
            "DT_NOTIFIC": ["01/05/2024", "01/05/2024"],  # Duplicate test
            "CO_MUN_NOT": ["2408003", "2408003"],
            "CO_MUN_RES": ["2408003", "2408003"],
            "DT_SIN_PRI": ["25/04/2024", "25/04/2024"],
            "NU_IDADE_N": [30, 30],
            "CS_SEXO": ["M", "M"],
            "ID_UNIDADE": ["UPA", "UPA"],
            "NM_BAIRRO": ["CENTRO", "CENTRO"],
            "CS_ZONA": [1, 1],
        }
    )
    df.to_csv(csv_file, index=False)

    # 2. Patch constants to use tmp_path
    import scripts.ingest_data

    import srag.data.database

    monkeypatch.setattr(scripts.ingest_data, "DB_PATH", db_path)
    monkeypatch.setattr(scripts.ingest_data, "DATA_DIRS", [raw_dir])
    monkeypatch.setattr(srag.data.database, "DB_URL", f"sqlite:///{db_path}")

    # 3. Run main
    ingest_main(db_path_override=db_path, data_dirs_override=[raw_dir])

    # 4. Verify results
    with sqlite3.connect(db_path) as conn:
        res = pd.read_sql("SELECT BAIRRO_REF, ZONA FROM casos_srag", conn)
        assert len(res) == 1  # Deduplicated
        assert res.iloc[0]["BAIRRO_REF"] == "CENTRO"
        assert res.iloc[0]["ZONA"] == "Urbana"


def test_run_ingestion_reads_all_excel_sheets(tmp_path, monkeypatch) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()

    db_path = processed_dir / "srag_mossoro.db"
    xlsx_file = raw_dir / "SRAG Ufersa.xlsx"
    xlsx_file.touch()

    df_2021 = pd.DataFrame(
        {
            "DT_NOTIFIC": ["01/01/2021"],
            "CO_MUN_NOT": ["2408003"],
            "CO_MUN_RES": ["2408003"],
            "DT_SIN_PRI": ["01/01/2021"],
            "NU_IDADE_N": [30],
            "CS_SEXO": ["M"],
            "ID_UNIDADE": ["UPA"],
            "NM_BAIRRO": ["CENTRO"],
            "CS_ZONA": [1],
        }
    )
    df_2025 = pd.DataFrame(
        {
            "DT_NOTIFIC": ["01/01/2025"],
            "CO_MUN_NOT": ["2408003"],
            "CO_MUN_RES": ["2408003"],
            "DT_SIN_PRI": ["01/01/2025"],
            "NU_IDADE_N": [31],
            "CS_SEXO": ["F"],
            "ID_UNIDADE": ["UPA"],
            "NM_BAIRRO": ["CENTRO"],
            "CS_ZONA": [1],
        }
    )

    import scripts.ingest_data
    import srag.data.database

    monkeypatch.setattr(
        "pandas.read_excel",
        lambda *args, **kwargs: {"2021 Mossoró": df_2021, "2025 Mossoró": df_2025},
    )
    monkeypatch.setattr(scripts.ingest_data, "DB_PATH", db_path)
    monkeypatch.setattr(scripts.ingest_data, "DATA_DIRS", [raw_dir])
    monkeypatch.setattr(srag.data.database, "DB_URL", f"sqlite:///{db_path}")

    ingest_main(db_path_override=db_path, data_dirs_override=[raw_dir])

    with sqlite3.connect(db_path) as conn:
        res = pd.read_sql("SELECT DT_NOTIFIC FROM casos_srag ORDER BY DT_NOTIFIC", conn)
        assert len(res) == 2
        assert res.iloc[0]["DT_NOTIFIC"] == "2021-01-01"
        assert res.iloc[1]["DT_NOTIFIC"] == "2025-01-01"


def test_run_ingestion_normalizes_case_hash_across_formats(tmp_path, monkeypatch) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()

    db_path = processed_dir / "srag_mossoro.db"

    csv_df = pd.DataFrame(
        {
            "DT_NOTIFIC": ["01/01/2024"],
            "CO_MUN_NOT": ["2408003"],
            "CO_MUN_RES": ["2408003"],
            "DT_SIN_PRI": ["01/01/2024"],
            "NU_IDADE_N": [30],
            "CS_SEXO": ["M"],
            "ID_UNIDADE": ["UPA"],
        }
    )
    xlsx_df = csv_df.copy()

    csv_file = raw_dir / "case.csv"
    xlsx_file = raw_dir / "case.xlsx"
    csv_df.to_csv(csv_file, index=False)
    xlsx_file.touch()

    import scripts.ingest_data
    import srag.data.database

    def fake_read_excel(*args, **kwargs):
        return {"Sheet1": xlsx_df}

    monkeypatch.setattr("pandas.read_excel", fake_read_excel)
    monkeypatch.setattr(scripts.ingest_data, "DB_PATH", db_path)
    monkeypatch.setattr(scripts.ingest_data, "DATA_DIRS", [raw_dir])
    monkeypatch.setattr(srag.data.database, "DB_URL", f"sqlite:///{db_path}")

    ingest_main(db_path_override=db_path, data_dirs_override=[raw_dir])

    with sqlite3.connect(db_path) as conn:
        res = pd.read_sql("SELECT COUNT(*) AS total FROM casos_srag", conn)
        assert res.iloc[0]["total"] == 1
