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
                "AN_VSR": 0,
                "PCR_RESUL": 1,
                "RES_AN": 1,
                "PCR_FLUASU": 1,
                "PCR_FLUBLI": 1,
                "ANTIVIRAL": 1,
                "CRITERIO": 1,
                "CO_LAB_AN": "LAB A",
                "DT_COLETA": date(2024, 4, 28),
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
    assert json_data["total"] == 15
    assert "uti_rate" in json_data
    assert "death_rate" in json_data


def test_get_trends_structure(mock_df: pd.DataFrame) -> None:
    response = client.get("/trends")
    assert response.status_code == 200
    json_data = response.json()
    assert "history" in json_data
    assert "forecast" in json_data
    assert "thresholds" in json_data
    assert "composition" in json_data
    if json_data["forecast"]:
        assert isinstance(json_data["forecast"][0]["predicted_cases"], int)


def test_get_territory_bootstrap(mock_df: pd.DataFrame) -> None:
    response = client.get("/territory_bootstrap")
    assert response.status_code == 200
    json_data = response.json()
    assert "territory" in json_data
    assert any(b["bairro"] == "CENTRO" for b in json_data["territory"]["bairros"])


def test_get_timeline_agg(mock_df: pd.DataFrame) -> None:
    response = client.get("/timeline_agg?virus=covid")
    assert response.status_code == 200
    json_data = response.json()
    assert isinstance(json_data, list)


def test_get_laboratory_network(mock_df: pd.DataFrame, monkeypatch: pytest.MonkeyPatch) -> None:
    import srag.api.routers_surveillance as surveillance

    monkeypatch.setattr(
        surveillance.api,
        "compute_laboratory_network_summary",
        lambda df: {
            "labs": [{"lab_ref": "LAB A", "tested_cases": 3, "positive_rate": 33.3}],
            "overall": {
                "tested_cases": 3,
                "positive_rate": 33.3,
                "median_turnaround_days": 2.0,
                "codetection_cases": 1,
            },
        },
    )
    monkeypatch.setattr(surveillance.api, "compute_positivity_trend", lambda df: [])
    monkeypatch.setattr(surveillance.api, "compute_influenza_subtypes", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_antiviral_usage",
        lambda df: {"adherence_rate": 0.0, "total_indicated": 0, "treated": 0},
    )
    monkeypatch.setattr(surveillance.api, "compute_closure_criteria", lambda df: [])
    monkeypatch.setattr(surveillance.api, "compute_notification_delay_series", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_mortality_by_treatment_agent",
        lambda df: pd.DataFrame([{"treatment": "Sem Suporte", "agent": "COVID-19", "deaths": 1}]),
    )
    monkeypatch.setattr(
        surveillance.api, "compute_genomic_variants", lambda df: {"weeks": [], "variants": {}}
    )
    monkeypatch.setattr(
        surveillance.api,
        "compute_time_series_by_virus",
        lambda df: pd.DataFrame([{"epi_week": "2024-W18", "virus": "COVID-19", "count": 1}]),
    )
    monkeypatch.setattr(
        surveillance.api, "compute_imaging_profile", lambda df: {"raiox": [], "tomo": []}
    )
    monkeypatch.setattr(
        surveillance.api,
        "compute_serology_profile",
        lambda df: {"types": [], "igg": [], "igm": []},
    )
    monkeypatch.setattr(surveillance.api, "compute_antiviral_types", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_virus_distribution",
        lambda df: pd.DataFrame([{"virus": "COVID-19", "count": 1}]),
    )

    response = client.get("/laboratory_network")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["virus_ranking"] == [{"virus": "COVID-19", "count": 1}]


def test_clinical_flow_ignores_code_3_as_death(monkeypatch: pytest.MonkeyPatch) -> None:
    import srag.api.routers_clinical as clinical

    df = pd.DataFrame(
        [
            {
                "DT_NOTIFIC": date(2024, 5, 1),
                "DT_SIN_PRI": date(2024, 4, 25),
                "ID_MUNICIP": "2408003",
                "ID_MN_RESI": "2408003",
                "CLASSI_FIN": 5,
                "ID_UNIDADE": "HOSPITAL A",
                "BAIRRO_REF": "CENTRO",
                "ZONA": "URBANA",
                "NU_IDADE_N": 30,
                "TP_IDADE": 3,
                "CS_SEXO": "M",
                "CS_RACA": 1,
                "EVOLUCAO": 3,
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
                "AN_VSR": 0,
            }
        ]
    )

    monkeypatch.setattr(clinical.api, "get_df", lambda: df)

    response = client.get("/clinical_flow")
    assert response.status_code == 200
    json_data = response.json()
    assert all(node["name"] != "Óbito" for node in json_data["nodes"])
    assert any(link["target"] == "Em Aberto" for link in json_data["links"])


def test_vaccination_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    import srag.api.routers_clinical as clinical

    df = pd.DataFrame(
        [
            {
                "DT_NOTIFIC": date(2024, 5, 1),
                "DT_SIN_PRI": date(2024, 4, 25),
                "ID_MUNICIP": "2408003",
                "ID_MN_RESI": "2408003",
                "CLASSI_FIN": 5,
                "ID_UNIDADE": "HOSPITAL A",
                "BAIRRO_REF": "CENTRO",
                "ZONA": "URBANA",
                "NU_IDADE_N": 30,
                "TP_IDADE": 3,
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
            }
        ]
    )

    monkeypatch.setattr(clinical.api, "get_df", lambda: df)

    response = client.get("/vaccination_profile")
    assert response.status_code == 200
    json_data = response.json()
    assert "covid_detailed" in json_data


def test_citizen_bootstrap(mock_df: pd.DataFrame) -> None:
    import srag.api.routers_clinical as clinical

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(clinical.api, "get_df", lambda: mock_df)
    response = client.get("/citizen_bootstrap")
    assert response.status_code == 200
    json_data = response.json()
    assert "citizen_profiles" in json_data
    assert "maternal_profile" in json_data
    monkeypatch.undo()


def test_vaccine_survival(mock_df: pd.DataFrame) -> None:
    import srag.api.routers_clinical as clinical

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(clinical.api, "get_df", lambda: mock_df)
    response = client.get("/vaccine_survival")
    assert response.status_code == 200
    json_data = response.json()
    assert "covid" in json_data
    assert "gripe" in json_data
    monkeypatch.undo()


def test_geo_endpoints(mock_df: pd.DataFrame) -> None:
    import srag.api.routers_geo as geo

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(geo.api, "get_df", lambda: mock_df)
    response = client.get("/geo/municipality_boundary")
    assert response.status_code == 200

    response = client.get("/geo/bairros_choropleth")
    assert response.status_code == 200

    response = client.get("/geo/rural_sectors")
    assert response.status_code == 200
    monkeypatch.undo()


def test_surveillance_endpoints(mock_df: pd.DataFrame) -> None:
    import srag.api.routers_surveillance as surveillance

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(surveillance.api, "get_df", lambda: mock_df)
    monkeypatch.setattr(
        surveillance.api,
        "compute_laboratory_network_summary",
        lambda df: {"labs": [], "overall": {"tested_cases": 1, "positive_rate": 100.0}},
    )
    monkeypatch.setattr(surveillance.api, "compute_positivity_trend", lambda df: [])
    monkeypatch.setattr(surveillance.api, "compute_influenza_subtypes", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_antiviral_usage",
        lambda df: {"adherence_rate": 100.0, "total_indicated": 1, "treated": 1},
    )
    monkeypatch.setattr(surveillance.api, "compute_closure_criteria", lambda df: [])
    monkeypatch.setattr(surveillance.api, "compute_notification_delay_series", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_mortality_by_treatment_agent",
        lambda df: pd.DataFrame([{"treatment": "Sem Suporte", "agent": "COVID-19", "deaths": 0}]),
    )
    monkeypatch.setattr(
        surveillance.api, "compute_genomic_variants", lambda df: {"weeks": [], "variants": {}}
    )
    monkeypatch.setattr(
        surveillance.api,
        "compute_time_series_by_virus",
        lambda df: pd.DataFrame([{"epi_week": "2024-W18", "virus": "COVID-19", "count": 1}]),
    )
    monkeypatch.setattr(
        surveillance.api, "compute_imaging_profile", lambda df: {"raiox": [], "tomo": []}
    )
    monkeypatch.setattr(
        surveillance.api,
        "compute_serology_profile",
        lambda df: {"types": [], "igg": [], "igm": []},
    )
    monkeypatch.setattr(surveillance.api, "compute_antiviral_types", lambda df: [])
    monkeypatch.setattr(
        surveillance.api,
        "compute_virus_distribution",
        lambda df: pd.DataFrame([{"virus": "COVID-19", "count": 1}]),
    )
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
    monkeypatch.undo()
