"""Coverage for the last remaining uncovered paths in routers_clinical and surveillance.

Focuses on endpoints and edge cases that the existing tests missed.
"""

from fastapi.testclient import TestClient

from srag.api.main import app

client = TestClient(app)


class TestOccupations:
    def test_returns_occupation_list(self, mock_srag_df) -> None:
        response = client.get("/occupations?limit=10")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        for item in body:
            assert "label" in item
            assert "count" in item

    def test_limit_respected(self, mock_srag_df) -> None:
        response = client.get("/occupations?limit=2")
        assert response.status_code == 200
        body = response.json()
        assert len(body) <= 2

    def test_limit_too_high_returns_422(self, mock_srag_df) -> None:
        """The endpoint declares ge=1, le=500. Anything above should be rejected."""
        response = client.get("/occupations?limit=501")
        assert response.status_code == 422

    def test_limit_too_low_returns_422(self, mock_srag_df) -> None:
        response = client.get("/occupations?limit=0")
        assert response.status_code == 422

    def test_agents_filter_returns_empty_when_no_match(self, mock_srag_df) -> None:
        """Mock data has CLASSI_FIN=5 (COVID). Filtering for Influenza returns nothing."""
        response = client.get("/occupations?agents=Influenza")
        assert response.status_code == 200
        assert response.json() == []


class TestClinicalTiming:
    def test_returns_clinical_timing(self, mock_srag_df) -> None:
        response = client.get("/clinical_timing")
        assert response.status_code == 200
        body = response.json()
        for key in (
            "cases_with_hospital_date",
            "cases_with_icu_dates",
            "cases_with_outcome_date",
            "median_days_symptom_to_hospital",
            "median_days_hospital_to_icu",
            "median_days_symptom_to_outcome",
            "protocol_48h_adherence_rate",
        ):
            assert key in body

    def test_empty_dataframe(self, empty_srag_df) -> None:
        response = client.get("/clinical_timing")
        assert response.status_code == 200
        body = response.json()
        for key in (
            "cases_with_hospital_date",
            "cases_with_icu_dates",
            "cases_with_outcome_date",
        ):
            assert key in body


class TestComorbiditiesTreemap:
    def test_returns_treemap_items(self, mock_srag_df) -> None:
        response = client.get("/clinical/comorbidities_treemap")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        for item in body:
            assert "name" in item
            assert "value" in item
            assert "deaths" in item
            assert "lethality" in item

    def test_empty_dataframe(self, empty_srag_df) -> None:
        response = client.get("/clinical/comorbidities_treemap")
        assert response.status_code == 200
        assert response.json() == []


class TestIcuBottleneck:
    """The icu_bottleneck endpoint must return [] for all empty paths."""

    def test_empty_dataframe_returns_empty_list(self, empty_srag_df) -> None:
        response = client.get("/icu_bottleneck")
        assert response.status_code == 200
        assert response.json() == []

    def test_no_uti_returns_empty_list(self, mock_srag_df) -> None:
        """Mock data has UTI=2 for all rows (not in ICU), so the endpoint should return [].

        The df_uti slice is empty.
        """
        response = client.get("/icu_bottleneck")
        assert response.status_code == 200
        assert response.json() == []
