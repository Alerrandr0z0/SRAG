from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from srag.api.main import _cache, app

client = TestClient(app)

@pytest.fixture
def mock_df(monkeypatch):
    # Create a dummy dataframe with at least 5 cases to satisfy min_cases=5
    data = []
    for i in range(15): # More cases for trends
        data.append({
            "DT_NOTIFIC": date(2024, 5, 1 + i),
            "DT_SIN_PRI": date(2024, 4, 25),
            "ID_MUNICIP": "2408003",
            "ID_MN_RESI": "2408003",
            "CLASSI_FIN": 5, # COVID
            "ID_UNIDADE": "HOSPITAL A",
            "BAIRRO_REF": "CENTRO",
            "ZONA": "URBANA",
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "IDADE_ANOS": 30.0,
            "CS_SEXO": "M",
            "CS_RACA": 1,
            "EVOLUCAO": 1,
            "UTI": 2,
            "HOSPITAL": 1,
            "SUPORT_VEN": 3,
            "NOSOCOMIAL": 2,
            "VACINA_COV": 1,
            "DOSE_1_COV": date(2024, 1, 1),
            "DT_INTERNA": date(2024, 5, 1),
            "DT_EVOLUCA": date(2024, 5, 10),
            "DOSE_2_COV": None,
            "DOSE_REF": None,
            "DOSE_2REF": None,
            "DOS_RE_BI": None,
            "VACINA": 2,
            "DT_UT_DOSE": None,
            "PCR_VSR": 0,
            "AN_VSR": 0
        })
    df = pd.DataFrame(data)

    # Mock get_df in api.main
    import srag.api.main
    monkeypatch.setattr(srag.api.main, "get_df", lambda: df)

    # Also clear cache to be sure
    _cache["df"] = None
    return df

def test_get_summary(mock_df):
    response = client.get("/summary")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["total"] == 15
    assert "uti_rate" in json_data
    assert "death_rate" in json_data

def test_get_trends_structure(mock_df):
    response = client.get("/trends")
    assert response.status_code == 200
    json_data = response.json()
    assert "history" in json_data
    assert "forecast" in json_data
    assert "thresholds" in json_data
    assert "composition" in json_data
    if json_data["forecast"]:
        assert isinstance(json_data["forecast"][0]["predicted_cases"], int)

def test_get_territory_bootstrap(mock_df):
    response = client.get("/territory_bootstrap")
    assert response.status_code == 200
    json_data = response.json()
    assert "territory" in json_data
    assert any(b["BAIRRO_REF"] == "CENTRO" for b in json_data["territory"]["bairros"])

def test_get_timeline_agg(mock_df):
    response = client.get("/timeline_agg?virus=covid")
    assert response.status_code == 200
    json_data = response.json()
    assert isinstance(json_data, list)
