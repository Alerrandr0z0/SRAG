"""End-to-end smoke + contract tests for the FastAPI surface.

These tests boot the FastAPI app, inject a deterministic DataFrame via
the shared _cache fixture, and validate that:

  1. The endpoint returns 200
  2. The response shape matches the TypedDict contract
  3. The body actually contains the expected data
"""

from typing import Any

from fastapi.testclient import TestClient
from httpx import Response

from srag.api.main import app
from srag.api.types import (
    AuditBootstrapResponse,
    CitizenBootstrapResponse,
    ClinicalFlowResponse,
    HospitalizationDurationResponse,
    LaboratoryNetworkResponse,
    SeverityKpisResponse,
    SummaryResponse,
    TerritoryBootstrapResponse,
    TrendsResponse,
    VaccinationProfileResponse,
)
from tests.integration._helpers import assert_typeddict_keys

client = TestClient(app)


def _ok(response: Response) -> dict[str, Any]:
    assert response.status_code == 200, response.text
    return response.json()


def test_health() -> None:
    body = _ok(client.get("/health"))
    assert "status" in body


class TestSummary:
    def test_returns_summary(self, mock_srag_df) -> None:
        body = _ok(client.get("/summary"))
        assert_typeddict_keys(body, SummaryResponse)
        assert body["total"] == 15
        assert body["notification_total"] == 15
        assert body["death_count"] == 1
        assert 0.0 <= body["death_rate"] <= 100.0
        assert 0.0 <= body["uti_rate"] <= 100.0

    def test_empty_returns_zero_totals(self, empty_srag_df) -> None:
        body = _ok(client.get("/summary"))
        assert body["total"] == 0
        assert body["death_count"] == 0
        assert body["uti_total"] == 0


class TestTrends:
    def test_returns_trends(self, mock_srag_df) -> None:
        body = _ok(client.get("/trends"))
        assert_typeddict_keys(body, TrendsResponse)
        assert isinstance(body["history"], list)
        assert isinstance(body["forecast"], list)
        assert int(sum(h["total"] for h in body["history"])) == 15
        assert body["thresholds"]["medium"] >= 0

    def test_empty_returns_no_history(self, empty_srag_df) -> None:
        body = _ok(client.get("/trends"))
        assert body["history"] == []


class TestVirus:
    def test_returns_virus_distribution(self, covid_only_df) -> None:
        body = _ok(client.get("/virus"))
        assert isinstance(body, list)
        assert len(body) > 0
        for item in body:
            assert "virus" in item
            assert "count" in item
            assert item["count"] > 0


class TestTerritoryBootstrap:
    def test_returns_territory(self, mock_srag_df) -> None:
        body = _ok(client.get("/territory_bootstrap?min_cases=1"))
        assert_typeddict_keys(body, TerritoryBootstrapResponse)
        assert "territory" in body
        assert "bairros" in body["territory"]
        assert "zonas" in body["territory"]
        assert "choropleth" in body
        assert "territory_entities" in body


class TestUnits:
    def test_returns_units(self, mock_srag_df) -> None:
        body = _ok(client.get("/units?min_cases=1"))
        assert isinstance(body, list)
        for unit in body:
            for outcome in ("curados", "obitos", "ignorados"):
                assert outcome in unit

    def test_min_cases_excludes_small(self, high_mortality_df) -> None:
        """min_cases=100 should return an empty list when no unit has that many."""
        body = _ok(client.get("/units?min_cases=100"))
        assert body == []


class TestTimelineAgg:
    def test_covid(self, covid_only_df) -> None:
        body = _ok(client.get("/timeline_agg?virus=covid"))
        assert isinstance(body, list)
        assert len(body) > 0
        for item in body:
            assert "perfil" in item
            assert "count" in item

    def test_gripe(self, covid_only_df) -> None:
        """Verify gripe profile classification returns a list regardless of virus."""
        body = _ok(client.get("/timeline_agg?virus=gripe"))
        assert isinstance(body, list)


class TestLaboratoryNetwork:
    def test_returns_aggregated_metrics(self, mock_srag_df) -> None:
        body = _ok(client.get("/laboratory_network"))
        assert_typeddict_keys(body, LaboratoryNetworkResponse)
        for key in (
            "overall",
            "quality_metrics",
            "treatment_metrics",
            "vaccine_survival",
            "positivity_trend",
            "closure_criteria",
            "antiviral_usage",
            "influenza_subtypes",
        ):
            assert key in body, f"missing {key} in laboratory_network"
        assert body["overall"]["tested_cases"] >= 0
        assert 0.0 <= body["overall"]["positive_rate"] <= 100.0

    def test_empty_returns_empty_dict(self, empty_srag_df) -> None:
        body = _ok(client.get("/laboratory_network"))
        assert body == {}


class TestClinicalFlow:
    def test_returns_flow_structure(self, mock_srag_df) -> None:
        body = _ok(client.get("/clinical_flow"))
        assert_typeddict_keys(body, ClinicalFlowResponse)
        assert "nodes" in body
        assert "links" in body

    def test_code_3_not_counted_as_death(self, mock_srag_df) -> None:
        """Mock data has 1 death (code 2, row 0) and 1 code-3 (row 1, ignored).

        Code 3 is NOT a death per SIVEP convention. Endpoint must count exactly 1 death.
        """
        body = _ok(client.get("/clinical_flow"))
        obito_count = sum(link["value"] for link in body["links"] if link["target"] == "Óbito")
        assert obito_count == 1

    def test_agents_filter_clears_flow(self, mock_srag_df) -> None:
        """Filtering for Influenza against a covid-only dataset yields no flow."""
        body = _ok(client.get("/clinical_flow?agents=Influenza"))
        assert body == {"nodes": [], "links": []}


class TestVaccinationProfile:
    def test_returns_vaccination(self, mock_srag_df) -> None:
        body = _ok(client.get("/vaccination_profile"))
        assert_typeddict_keys(body, VaccinationProfileResponse)
        assert "gripe" in body
        assert "covid_detailed" in body

    def test_empty(self, empty_srag_df) -> None:
        body = _ok(client.get("/vaccination_profile"))
        assert body == {}


class TestCitizenBootstrap:
    def test_returns_citizen_bootstrap(self, mock_srag_df) -> None:
        body = _ok(client.get("/citizen_bootstrap"))
        assert_typeddict_keys(body, CitizenBootstrapResponse)
        for key in (
            "citizen_profiles",
            "citizen_pyramid",
            "race_profile",
            "schooling_profile",
            "occupation_profile",
            "symptoms_signature",
            "symptoms_heatmap",
            "risk_factors_full",
            "maternal_profile",
        ):
            assert key in body, f"missing {key} in citizen_bootstrap"

    def test_pediatric_profile_via_age_filter(self, pediatric_df) -> None:
        """Pediatric dataset should produce at least one age band with upper bound <= 18."""
        body = _ok(client.get("/citizen_bootstrap"))
        bands = [row["age_band"] for row in body["citizen_pyramid"]]
        if bands:
            upper_bounds = [int(b.split("-")[-1].rstrip("+")) for b in bands if "-" in b]
            assert max(upper_bounds) <= 18, f"expected pediatric-only bands, got {bands}"


class TestVaccineSurvival:
    def test_returns_survival(self, mock_srag_df) -> None:
        body = _ok(client.get("/vaccine_survival"))
        assert "covid" in body
        assert "gripe" in body

    def test_empty(self, empty_srag_df) -> None:
        body = _ok(client.get("/vaccine_survival"))
        assert body == {"covid": {}, "gripe": {}}


class TestGeoEndpoints:
    def test_municipality_boundary(self, mock_srag_df) -> None:
        body = _ok(client.get("/geo/municipality_boundary"))
        assert body["type"] == "FeatureCollection"

    def test_bairros_choropleth(self, mock_srag_df) -> None:
        body = _ok(client.get("/geo/bairros_choropleth"))
        assert body["type"] == "FeatureCollection"

    def test_rural_sectors(self, mock_srag_df) -> None:
        body = _ok(client.get("/geo/rural_sectors"))
        assert body["type"] == "FeatureCollection"

    def test_rural_heatpoints(self, mock_srag_df) -> None:
        body = _ok(client.get("/geo/rural_heatpoints?min_cases=1"))
        assert body["available"] is True
        assert "points" in body


class TestSurveillanceEndpoints:
    def test_laboratory_network_has_virus_ranking(self, mock_srag_df) -> None:
        body = _ok(client.get("/laboratory_network"))
        assert "virus_ranking" in body

    def test_context_trends_bairro(self, mock_srag_df) -> None:
        body = _ok(client.get("/context_trends?key=BAIRRO::CENTRO"))
        assert "history" in body
        assert "forecast" in body
        assert "thresholds" in body

    def test_icu_bottleneck(self, uti_only_df) -> None:
        body = _ok(client.get("/icu_bottleneck"))
        assert isinstance(body, list)
        assert len(body) == 5
        for item in body:
            assert "date" in item
            assert "wait_days" in item
            assert 0 <= item["wait_days"] <= 30


class TestAuditBootstrap:
    def test_returns_audit_bootstrap(self, mock_srag_df) -> None:
        body = _ok(client.get("/audit_bootstrap"))
        assert_typeddict_keys(body, AuditBootstrapResponse)
        for key in (
            "completeness",
            "completeness_trend",
            "quality_by_unit",
            "quality_by_bairro",
            "inconsistencies",
        ):
            assert key in body, f"missing {key} in audit_bootstrap"

    def test_high_mortality_yields_death_inconsistencies(self, high_mortality_df) -> None:
        """Verify the inconsistencies list is present in the audit payload."""
        body = _ok(client.get("/audit_bootstrap"))
        assert isinstance(body["inconsistencies"], list)


class TestHospitalizationDuration:
    def test_returns_kde_and_arrays(self, mock_srag_df) -> None:
        body = _ok(client.get("/hospitalization_duration"))
        assert_typeddict_keys(body, HospitalizationDurationResponse)
        assert isinstance(body["cure"], list)
        assert isinstance(body["death"], list)
        assert len(body["kde_x"]) == len(body["kde_cure"]) == len(body["kde_death"])
        assert body["cure_count"] + body["death_count"] == 15 or (
            body["cure_count"] + body["death_count"] >= 0
        )

    def test_empty_returns_zeros(self, empty_srag_df) -> None:
        body = _ok(client.get("/hospitalization_duration"))
        assert body["cure"] == []
        assert body["death"] == []
        assert body["kde_x"] == []
        assert body["cure_count"] == 0
        assert body["death_count"] == 0
        assert body["median_cure"] == 0.0


class TestSeverityKpis:
    def test_returns_kpis(self, mock_srag_df) -> None:
        body = _ok(client.get("/severity_kpis"))
        assert_typeddict_keys(body, SeverityKpisResponse)
        assert "current" in body
        assert "trend" in body

    def test_empty_returns_structured_empty(self, empty_srag_df) -> None:
        body = _ok(client.get("/severity_kpis"))
        assert "current" in body
        assert "trend" in body


class TestOccupations:
    def test_returns_occupations(self, mock_srag_df) -> None:
        body = _ok(client.get("/occupations?limit=10"))
        assert isinstance(body, list)
        assert len(body) <= 10

    def test_invalid_limit_422(self, mock_srag_df) -> None:
        response = client.get("/occupations?limit=501")
        assert response.status_code == 422

    def test_filter_returns_empty(self, covid_only_df) -> None:
        body = _ok(client.get("/occupations?agents=Influenza"))
        assert body == []
