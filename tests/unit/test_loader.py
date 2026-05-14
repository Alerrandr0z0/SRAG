from pathlib import Path

import pandas as pd
import pytest

from srag.data.loader import (
    _infer_zone_from_bairro,
    _normalize_age_to_years,
    _normalize_bairro_name,
    _normalize_zone,
    export_secure_dataset,
    load_and_clean_srag_data,
)


def test_normalize_bairro_name() -> None:
    assert _normalize_bairro_name("CENTRO") == "CENTRO"
    assert _normalize_bairro_name(" centro ") == "CENTRO"
    assert _normalize_bairro_name("SANTO ANTÔNIO") == "SANTO ANTONIO"
    assert _normalize_bairro_name(None) is None
    assert _normalize_bairro_name("NAN") is None
    assert _normalize_bairro_name("IGNORADO") is None
    assert _normalize_bairro_name("SEM INFORMACAO") is None
    assert _normalize_bairro_name("  ") is None


def test_infer_zone_from_bairro() -> None:
    assert _infer_zone_from_bairro("CENTRO") == "Urbana"
    assert _infer_zone_from_bairro("ZONA RURAL") == "Rural"
    assert _infer_zone_from_bairro("SITIO SAO JOAO") == "Rural"
    assert _infer_zone_from_bairro("FAZENDA FELIZ") == "Rural"
    assert _infer_zone_from_bairro(None) is None


def test_normalize_zone() -> None:
    assert _normalize_zone(1) == "Urbana"
    assert _normalize_zone(2) == "Rural"
    assert _normalize_zone(3) == "Periurbana"
    assert _normalize_zone(9) is None
    assert _normalize_zone(None) is None


def test_normalize_age_to_years() -> None:
    # tp_idade: 1=days, 2=months, 3=years
    assert _normalize_age_to_years(365, 1) == pytest.approx(0.9993, rel=1e-3)
    assert _normalize_age_to_years(6, 2) == 0.5
    assert _normalize_age_to_years(25, 3) == 25.0
    assert _normalize_age_to_years(25, None) == 25.0
    assert _normalize_age_to_years(None, 3) is None
    assert _normalize_age_to_years(-1, 3) is None

def get_valid_srag_row():
    return {
        "NM_PACIENT": "John Doe",
        "CO_MUN_RES": "2408003", # Mossoro
        "ID_MUNICIP": "2408003",
        "DT_NOTIFIC": "01/01/2024",
        "DT_SIN_PRI": "01/01/2024",
        "CS_ZONA": "1",
        "NM_BAIRRO": "CENTRO",
        "NU_IDADE_N": "25",
        "TP_IDADE": "3",
        "CS_SEXO": "M"
    }

class TestLoadAndCleanSragData:
    def test_load_csv(self, monkeypatch) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.csv"))
        assert len(result) == 1
        assert "NM_PACIENT" not in result.columns
        assert "ID_MN_RESI" in result.columns
        assert result.iloc[0]["ID_MN_RESI"] == "2408003"
        assert result.iloc[0]["ZONA"] == "Urbana"
        assert result.iloc[0]["BAIRRO_REF"] == "CENTRO"

    def test_load_csv_fallback(self, monkeypatch) -> None:
        def mock_read_csv(filepath, sep=None, **kwargs):
            if sep is None:
                raise Exception("auto-detect failed")
            return pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_csv", mock_read_csv)
        result = load_and_clean_srag_data(Path("test.csv"))
        assert len(result) == 1

    def test_load_excel(self, monkeypatch) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_excel", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.xlsx"))
        assert len(result) == 1

    def test_load_parquet(self, monkeypatch) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_parquet", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.parquet"))
        assert len(result) == 1

    def test_unsupported_format(self) -> None:
        with pytest.raises(ValueError):
            load_and_clean_srag_data(Path("test.txt"))

    def test_filter_mossoro(self, monkeypatch) -> None:
        row1 = get_valid_srag_row()
        row2 = get_valid_srag_row()
        row2["CO_MUN_RES"] = "1234567" # Not Mossoro
        row2["ID_MUNICIP"] = "1234567" # Not Mossoro
        df_mock = pd.DataFrame([row1, row2])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.csv"), filter_mossoro=True)
        assert len(result) == 1
        assert result.iloc[0]["ID_MN_RESI"] == "2408003"

    def test_drop_sensitive(self, monkeypatch) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.csv"), drop_sensitive=False)
        assert "NM_BAIRRO" in result.columns

    def test_derive_zone_from_bairro(self, monkeypatch) -> None:
        row = get_valid_srag_row()
        row.pop("CS_ZONA")
        row["NM_BAIRRO"] = "SITIO NOVO"
        df_mock = pd.DataFrame([row])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.csv"))
        assert len(result) == 1
        assert result.iloc[0]["ZONA"] == "Rural"

    def test_invalid_records(self, monkeypatch) -> None:
        row1 = get_valid_srag_row()
        row2 = get_valid_srag_row()
        row2["DT_SIN_PRI"] = "invalid_date" # Will cause validation error
        df_mock = pd.DataFrame([row1, row2])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        result = load_and_clean_srag_data(Path("test.csv"))
        assert len(result) == 1 # Only valid record is kept

class TestExportSecureDataset:
    def test_export_csv(self, monkeypatch, tmp_path) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        out_path = tmp_path / "out.csv"
        export_secure_dataset(Path("test.csv"), out_path)
        assert out_path.exists()

    def test_export_parquet(self, monkeypatch, tmp_path) -> None:
        df_mock = pd.DataFrame([get_valid_srag_row()])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        out_path = tmp_path / "out.parquet"
        export_secure_dataset(Path("test.csv"), out_path)
        assert out_path.exists()

    def test_export_empty(self, monkeypatch, tmp_path) -> None:
        row = get_valid_srag_row()
        row["CO_MUN_RES"] = "1234567"
        row["ID_MUNICIP"] = "1234567"
        df_mock = pd.DataFrame([row])
        monkeypatch.setattr("pandas.read_csv", lambda *args, **kwargs: df_mock)
        out_path = tmp_path / "out.csv"
        export_secure_dataset(Path("test.csv"), out_path)
        assert not out_path.exists()
