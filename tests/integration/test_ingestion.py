import pytest
import pandas as pd
from pathlib import Path
from scripts.ingest_data import run_ingestion
import sqlite3

def test_run_ingestion_csv(tmp_path):
    # 1. Create a dummy CSV file in a temp directory
    data_dir = tmp_path / "raw"
    data_dir.mkdir()
    csv_file = data_dir / "test_data.csv"
    
    # Minimal columns required for ingestion and hash
    df = pd.DataFrame({
        "DT_NOTIFIC": ["01/05/2024", "01/05/2024"], # Duplicate hash test
        "CO_MUN_NOT": ["2408003", "2408003"],
        "CO_MUN_RES": ["2408003", "2408003"],
        "DT_SIN_PRI": ["25/04/2024", "25/04/2024"],
        "NU_IDADE_N": [30, 30],
        "CS_SEXO": ["M", "M"],
        "ID_UNIDADE": ["UPA", "UPA"],
        "NM_BAIRRO": ["CENTRO", "CENTRO"],
        "CS_ZONA": [1, 1]
    })
    df.to_csv(csv_file, index=False)
    
    # 2. Run ingestion using a temp DB path
    db_path = tmp_path / "test_srag.db"
    count = run_ingestion(db_path, [data_dir])
    
    # 3. Verify results
    assert count == 1 # Duplicate should be removed
    
    # Connect to the temp DB and check normalization
    with sqlite3.connect(db_path) as conn:
        res = pd.read_sql("SELECT BAIRRO_REF, ZONA FROM casos_srag", conn)
        assert len(res) == 1
        assert res.iloc[0]["BAIRRO_REF"] == "CENTRO"
        assert res.iloc[0]["ZONA"] == "Urbana"

def test_run_ingestion_no_data(tmp_path):
    db_path = tmp_path / "empty.db"
    count = run_ingestion(db_path, [tmp_path / "non_existent"])
    assert count == 0
