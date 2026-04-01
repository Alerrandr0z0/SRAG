import pytest
import pandas as pd
from fastapi.testclient import TestClient
from srag.api.main import app, _cache
from datetime import date

client = TestClient(app)

@pytest.fixture
def mock_df(monkeypatch):
    # Create a dummy dataframe with at least 5 cases to satisfy min_cases=5
    data = []
    for i in range(5):
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
            "DOSE_2_COV": None,
            "DOSE_REF": None,
            "DOSE_2REF": None,
            "DOS_RE_BI": None,
            "VACINA": 2,
            "DT_UT_DOSE": None
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
    assert json_data["total"] == 5
    assert "uti_rate" in json_data
    assert "death_rate" in json_data

def test_get_virus_distribution(mock_df):
    response = client.get("/virus")
    assert response.status_code == 200
    json_data = response.json()
    assert any(v["virus"] == "COVID-19" for v in json_data)

def test_get_territory_bootstrap(mock_df):
    response = client.get("/territory_bootstrap")
    assert response.status_code == 200
    json_data = response.json()
    assert "territory" in json_data
    assert "bairros" in json_data["territory"]
    # Now it should have CENTRO because it has 5 cases
    assert any(b["BAIRRO_REF"] == "CENTRO" for b in json_data["territory"]["bairros"])

def test_vaccine_survival_empty_gripe(mock_df):
    response = client.get("/vaccine_survival")
    assert response.status_code == 200
    json_data = response.json()
    assert "covid" in json_data
    assert "gripe" in json_data
    assert json_data["gripe"] == {}
