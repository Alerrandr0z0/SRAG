from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from srag.api.main import _cache, app

client = TestClient(app)


@pytest.fixture
def mock_df(monkeypatch: pytest.MonkeyPatch) -> pd.DataFrame:
    # Create a dummy dataframe with at least 5 cases to satisfy min_cases=5
    data = []
    for i in range(15):  # More cases for trends
        evolucao = 1  # Cura
        if i == 0:
            evolucao = 2  # Óbito por SRAG
        elif i == 1:
            evolucao = 3  # Óbito por outras causas (Deve ser ignorado no fluxo final como óbito)

        data.append(
            {
                "DT_NOTIFIC": date(2024, 5, 1 + i),
                "DT_SIN_PRI": date(2024, 4, 25),
                "ID_MUNICIP": "2408003",
                "ID_MN_RESI": "2408003",
                "CLASSI_FIN": 5,  # COVID
                "ID_UNIDADE": "HOSPITAL A",
                "BAIRRO_REF": "CENTRO",
                "ZONA": "URBANA",
                "NU_IDADE_N": 30,
                "TP_IDADE": 3,
                "IDADE_ANOS": 30.0,
                "CS_SEXO": "M",
                "CS_RACA": 1,
                "EVOLUCAO": evolucao,
                "UTI": 2,
                "HOSPITAL": 1,
                "SUPORT_VEN": 3,
                "NOSOCOMIAL": 2,
                "VACINA_COV": 1,
                "DOSE_1_COV": date(2024, 1, 1),
                "DT_INTERNA": date(2024, 5, 1) if i % 2 == 0 else None,
                "DT_EVOLUCA": date(2024, 5, 10) if i % 2 == 0 else None,
                "DT_ENTUTI": date(2024, 5, 2) if i % 4 == 0 else None,
                "DOSE_2_COV": None,
                "DOSE_REF": None,
                "DOSE_2REF": None,
                "DOS_RE_BI": None,
                "VACINA": 2,
                "DT_UT_DOSE": None,
                "PCR_VSR": 0,
                "AN_VSR": 0,
                "PCR_RESUL": 1,
                "RES_AN": 1,
                "PCR_FLUASU": 1,
                "PCR_FLUBLI": 1,
                "ANTIVIRAL": 1 if i % 2 == 0 else 2,
                "DT_ANTIVIR": date(2024, 4, 27) if i % 2 == 0 else None,
                "TRAT_COV": 2,
                "TIPO_TRAT": None,
                "CRITERIO": 1,
                "CO_LAB_AN": "LAB A",
                "DT_COLETA": date(2024, 4, 28),
                "DT_PCR": date(2024, 4, 30) if i % 3 == 0 else None,
                "DT_RES_AN": None,
                "TP_AMOSTRA": 1,
                "AMOSTRA": 1,
                "CO_DETEC": 0,
            }
        )
    df = pd.DataFrame(data)

    # Mock get_df in api.main
    import srag.api.main

    monkeypatch.setattr(srag.api.main, "get_df", lambda: df)

    # Also clear cache to be sure
    _cache["df"] = None
    return df


def test_get_summary(mock_df: pd.DataFrame) -> None:
    response = client.get("/summary")
    assert response.status_code == 200
    json_data = response.json()
    assert "total" in json_data
    assert json_data["total"] == len(mock_df)


def test_get_trends_structure(mock_df: pd.DataFrame) -> None:
    response = client.get("/trends")
    assert response.status_code == 200
    json_data = response.json()
    assert "history" in json_data
    assert "forecast" in json_data


def test_get_territory_bootstrap(mock_df: pd.DataFrame) -> None:
    response = client.get("/territory_bootstrap?min_cases=1")
    assert response.status_code == 200
    json_data = response.json()
    assert "territory" in json_data
    assert "choropleth" in json_data


def test_get_timeline_agg(mock_df: pd.DataFrame) -> None:
    response = client.get("/timeline_agg?virus=covid")
    assert response.status_code == 200
    json_data = response.json()
    assert isinstance(json_data, list)


def test_get_laboratory_network(mock_df: pd.DataFrame) -> None:
    response = client.get("/laboratory_network")
    assert response.status_code == 200
    json_data = response.json()
    assert "virus_ranking" in json_data
    assert "overall" in json_data
    assert "quality_metrics" in json_data
    assert "treatment_metrics" in json_data


def test_clinical_flow_ignores_code_3_as_death(mock_df: pd.DataFrame) -> None:
    response = client.get("/clinical_flow")
    assert response.status_code == 200
    json_data = response.json()

    assert "nodes" in json_data
    assert "links" in json_data

    {n["name"]: n for n in json_data["nodes"]}

    # Baseado no nosso mock_df, criamos 1 óbito por SRAG (código 2, i=0)
    # e 1 Óbito por outras causas (código 3, i=1). O resto são curas.
    # Como confirmado: Para Quantidade de óbitos (82) estamos utilizando apenas parametro 2.
    # O SIVEP-Gripe regra diz que código 3 NÃO PODE ser listado no nó final
    # de "Óbito" como mortalidade pela doença.

    obito_count = sum(link["value"] for link in json_data["links"] if link["target"] == "Óbito")
    assert obito_count == 1

    cura_count = sum(link["value"] for link in json_data["links"] if link["target"] == "Cura")
    assert cura_count <= 13


def test_vaccination_profile(mock_df: pd.DataFrame) -> None:
    response = client.get("/vaccination_profile")
    assert response.status_code == 200
    json_data = response.json()
    assert "gripe" in json_data
    assert "covid_detailed" in json_data


def test_citizen_bootstrap(mock_df: pd.DataFrame) -> None:
    response = client.get("/citizen_bootstrap")
    assert response.status_code == 200
    json_data = response.json()
    assert "citizen_profiles" in json_data
    assert "symptoms_signature" in json_data


def test_vaccine_survival(mock_df: pd.DataFrame) -> None:
    response = client.get("/vaccine_survival")
    assert response.status_code == 200
    json_data = response.json()
    assert "covid" in json_data
    assert "gripe" in json_data


def test_geo_endpoints(mock_df: pd.DataFrame) -> None:
    response = client.get("/geo/municipality_boundary")
    assert response.status_code == 200

    response = client.get("/geo/bairros_choropleth")
    assert response.status_code == 200

    response = client.get("/geo/rural_sectors")
    assert response.status_code == 200

    response = client.get("/geo/rural_heatpoints?min_cases=1")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["available"] is True


def test_surveillance_endpoints(mock_df: pd.DataFrame) -> None:
    response = client.get("/laboratory_network")
    assert response.status_code == 200
    json_data = response.json()
    assert "virus_ranking" in json_data

    response = client.get("/context_trends?key=BAIRRO::CENTRO")
    assert response.status_code == 200
    json_data = response.json()
    assert "history" in json_data

    response = client.get("/icu_bottleneck")
    assert response.status_code == 200
