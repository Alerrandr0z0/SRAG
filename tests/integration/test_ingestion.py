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
