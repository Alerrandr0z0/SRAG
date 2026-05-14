import json
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from srag.pipelines.surveillance import run_surveillance_pipeline
from srag.pipelines.validation import validate_srag_data
from srag.pipelines.weekly_update import (
    build_surveillance_snapshot,
    ingest_secure_file,
    load_database_dataframe,
    run_weekly_update,
)


@pytest.fixture
def empty_df():
    return pd.DataFrame()


# --- tests for srag.pipelines.validation ---

def test_validate_srag_data_empty(empty_df) -> None:
    is_valid, warnings = validate_srag_data(empty_df)
    assert not is_valid
    assert warnings == ["O dataset está vazio."]


def test_validate_srag_data_future_date() -> None:
    future_date = date.today() + timedelta(days=10)
    df = pd.DataFrame({
        "unique_hash": ["123"],
        "DT_NOTIFIC": [future_date.strftime("%Y-%m-%d")],
        "ID_MUNICIP": ["123456"],
        "CLASSI_FIN": ["1"]
    })
    is_valid, warnings = validate_srag_data(df)
    assert is_valid
    assert any("data futura" in w for w in warnings)


def test_validate_srag_data_inconsistent_dates() -> None:
    df = pd.DataFrame({
        "unique_hash": ["123"],
        "DT_NOTIFIC": ["2023-01-01"],
        "DT_INTERNA": ["2023-01-10"],
        "DT_EVOLUCA": ["2023-01-05"],
        "ID_MUNICIP": ["123456"],
        "CLASSI_FIN": ["1"]
    })
    is_valid, warnings = validate_srag_data(df)
    assert is_valid
    assert any("desfecho ocorre antes" in w for w in warnings)


def test_validate_srag_data_extreme_age() -> None:
    df = pd.DataFrame({
        "unique_hash": ["123"],
        "DT_NOTIFIC": ["2023-01-01"],
        "IDADE_ANOS": [120],
        "ID_MUNICIP": ["123456"],
        "CLASSI_FIN": ["1"]
    })
    is_valid, warnings = validate_srag_data(df)
    assert is_valid
    assert any("idade superior a 115" in w for w in warnings)


def test_validate_srag_data_missing_critical_cols() -> None:
    df = pd.DataFrame({
        "DT_NOTIFIC": ["2023-01-01"],
        "ID_MUNICIP": ["123456"]
    })
    is_valid, warnings = validate_srag_data(df)
    assert not is_valid
    assert any("Colunas críticas ausentes" in w for w in warnings)


def test_validate_srag_data_valid() -> None:
    df = pd.DataFrame({
        "unique_hash": ["123"],
        "DT_NOTIFIC": ["2023-01-01"],
        "ID_MUNICIP": ["123456"],
        "CLASSI_FIN": ["1"]
    })
    is_valid, warnings = validate_srag_data(df)
    assert is_valid
    assert not warnings


# --- tests for srag.pipelines.weekly_update ---

@patch("srag.pipelines.weekly_update.load_and_clean_srag_data")
@patch("srag.pipelines.weekly_update.save_cases")
@patch("srag.pipelines.weekly_update.init_db")
def test_ingest_secure_file_empty(mock_init, mock_save, mock_load) -> None:
    mock_load.return_value = pd.DataFrame()
    result = ingest_secure_file(Path("dummy.csv"))
    assert result == {"processed": 0, "new_cases_added": 0}
    mock_save.assert_not_called()


@patch("srag.pipelines.weekly_update.load_and_clean_srag_data")
@patch("srag.pipelines.weekly_update.save_cases")
@patch("srag.pipelines.weekly_update.init_db")
def test_ingest_secure_file_valid(mock_init, mock_save, mock_load) -> None:
    df = pd.DataFrame({"col1": [1, 2]})
    mock_load.return_value = df
    mock_save.return_value = 2
    result = ingest_secure_file(Path("dummy.csv"))
    assert result == {"processed": 2, "new_cases_added": 2}
    mock_save.assert_called_once()


@patch("srag.pipelines.weekly_update.create_engine")
@patch("srag.pipelines.weekly_update.pd.read_sql")
def test_load_database_dataframe_valid(mock_read_sql, mock_engine) -> None:
    df = pd.DataFrame({"col1": [1]})
    mock_read_sql.return_value = df
    result = load_database_dataframe()
    assert result.equals(df)


@patch("srag.pipelines.weekly_update.create_engine")
@patch("srag.pipelines.weekly_update.pd.read_sql")
def test_load_database_dataframe_exception(mock_read_sql, mock_engine) -> None:
    mock_read_sql.side_effect = Exception("DB error")
    result = load_database_dataframe()
    assert result.empty


def test_build_surveillance_snapshot_empty(empty_df) -> None:
    result = build_surveillance_snapshot(empty_df)
    assert result["summary"]["total_cases"] == 0
    assert result["trends"]["status"] == "empty"
    assert result["virus"] == []


@patch("srag.pipelines.weekly_update.compute_severity_metrics")
@patch("srag.pipelines.weekly_update.compute_time_series")
@patch("srag.pipelines.weekly_update.predict_next_weeks")
@patch("srag.pipelines.weekly_update.compute_alert_thresholds")
@patch("srag.pipelines.weekly_update.compute_virus_distribution")
def test_build_surveillance_snapshot_valid(
    mock_virus, mock_thresholds, mock_predict, mock_ts, mock_severity
) -> None:
    df = pd.DataFrame({"col1": [1, 2]})
    mock_severity.return_value = {"total": 2, "uti_rate": 0.5, "death_rate": 0.1}
    mock_ts.return_value = pd.DataFrame()
    mock_predict.return_value = {"forecast": []}
    mock_thresholds.return_value = {"alert": True}
    mock_virus.return_value = pd.DataFrame([{"virus": "Flu", "count": 2}])

    result = build_surveillance_snapshot(df)
    assert result["summary"]["total_cases"] == 2
    assert result["summary"]["uti_rate"] == 0.5
    assert result["trends"]["thresholds"] == {"alert": True}
    assert result["virus"] == [{"virus": "Flu", "count": 2}]


@patch("srag.pipelines.weekly_update.ingest_secure_file")
@patch("srag.pipelines.weekly_update.load_database_dataframe")
@patch("srag.pipelines.weekly_update.build_surveillance_snapshot")
def test_run_weekly_update_no_output(mock_build, mock_load, mock_ingest) -> None:
    mock_ingest.return_value = {"processed": 2}
    mock_load.return_value = pd.DataFrame()
    mock_build.return_value = {"summary": {}}
    result = run_weekly_update(Path("dummy.csv"))
    assert result["ingestion"] == {"processed": 2}
    assert result["snapshot"] == {"summary": {}}


@patch("srag.pipelines.weekly_update.ingest_secure_file")
@patch("srag.pipelines.weekly_update.load_database_dataframe")
@patch("srag.pipelines.weekly_update.build_surveillance_snapshot")
def test_run_weekly_update_with_output(mock_build, mock_load, mock_ingest, tmp_path) -> None:
    mock_ingest.return_value = {"processed": 2}
    mock_load.return_value = pd.DataFrame()
    mock_build.return_value = {"summary": {}}
    out_file = tmp_path / "out.json"
    run_weekly_update(Path("dummy.csv"), output=out_file)
    assert out_file.exists()
    assert json.loads(out_file.read_text())["ingestion"] == {"processed": 2}


# --- tests for srag.pipelines.surveillance ---

@patch("srag.pipelines.surveillance.validate_srag_data")
@patch("srag.pipelines.surveillance.duckdb.connect")
@patch("srag.pipelines.surveillance.sqlite3.connect")
@patch("srag.pipelines.surveillance.init_db")
def test_run_surveillance_pipeline_no_data(mock_init_db, mock_sqlite, mock_duckdb, mock_validate, tmp_path) -> None:
    # Setup mocks
    mock_con = MagicMock()
    mock_duckdb.return_value = mock_con

    mock_sqlite_conn = MagicMock()
    mock_sqlite.return_value.__enter__.return_value = mock_sqlite_conn
    mock_sqlite_conn.execute.return_value.fetchall.return_value = [(0, "unique_hash"), (1, "DT_NOTIFIC")]

    # Empty df from temp_raw
    mock_con.execute.return_value.df.return_value = pd.DataFrame()
    mock_validate.return_value = (False, ["O dataset está vazio."])

    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    result = run_surveillance_pipeline(db_path, [data_dir])
    assert result["status"] == "failed"
    assert result["errors"] == ["O dataset está vazio."]


@patch("srag.pipelines.surveillance.validate_srag_data")
@patch("srag.pipelines.surveillance.duckdb.connect")
@patch("srag.pipelines.surveillance.sqlite3.connect")
@patch("srag.pipelines.surveillance.init_db")
def test_run_surveillance_pipeline_blocked_by_warnings(mock_init_db, mock_sqlite, mock_duckdb, mock_validate, tmp_path) -> None:
    mock_con = MagicMock()
    mock_duckdb.return_value = mock_con
    mock_sqlite_conn = MagicMock()
    mock_sqlite.return_value.__enter__.return_value = mock_sqlite_conn
    mock_sqlite_conn.execute.return_value.fetchall.return_value = [(0, "unique_hash")]

    mock_con.execute.return_value.df.return_value = pd.DataFrame({"col": [1]})
    mock_validate.return_value = (True, ["Aviso teste"])

    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    result = run_surveillance_pipeline(db_path, [data_dir], force=False)
    assert result["status"] == "blocked"
    assert result["warnings"] == ["Aviso teste"]


@patch("srag.pipelines.surveillance.validate_srag_data")
@patch("srag.pipelines.surveillance.duckdb.connect")
@patch("srag.pipelines.surveillance.sqlite3.connect")
@patch("srag.pipelines.surveillance.init_db")
@patch("srag.pipelines.surveillance.pd.read_sql")
@patch("srag.pipelines.surveillance.compute_severity_metrics")
def test_run_surveillance_pipeline_success(
    mock_severity, mock_read_sql, mock_init_db, mock_sqlite, mock_duckdb, mock_validate, tmp_path
) -> None:
    mock_con = MagicMock()
    mock_duckdb.return_value = mock_con
    mock_sqlite_conn = MagicMock()
    mock_sqlite.return_value.__enter__.return_value = mock_sqlite_conn
    mock_sqlite_conn.execute.return_value.fetchall.return_value = [(0, "unique_hash")]

    # Validation passes
    mock_validate.return_value = (True, [])

    # temp_raw and final_df mock
    mock_con.execute.return_value.df.return_value = pd.DataFrame({"unique_hash": ["123"]})

    # SQLite intelligence pass mock
    mock_read_sql.return_value = pd.DataFrame({"rowid": [1], "NM_BAIRRO": ["Centro"], "CS_ZONA": [1]})

    mock_severity.return_value = {"total": 1}

    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    # Create dummy csv so it tries to read it
    csv_file = data_dir / "data.csv"
    csv_file.write_text("unique_hash,DT_NOTIFIC\n123,2023-01-01")

    # Mocks for file introspection in duckdb
    mock_con.execute.return_value.fetchall.return_value = [("unique_hash",), ("DT_NOTIFIC",)]

    result = run_surveillance_pipeline(db_path, [data_dir], force=True)
    assert result["status"] == "success"
    assert result["final_count"] == 1
    assert "snapshot" in result


@patch("srag.pipelines.surveillance.duckdb.connect")
def test_run_surveillance_pipeline_exception(mock_duckdb, tmp_path) -> None:
    mock_duckdb.side_effect = Exception("Crash")
    result = run_surveillance_pipeline(tmp_path / "db.db", [])
    assert result["status"] == "error"
    assert "Crash" in result["error"]
