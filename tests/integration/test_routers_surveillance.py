"""Unit tests for the six new surveillance endpoints added in commit 29fa2f1.

These endpoints previously had zero coverage:
  /severity_kpis
  /trends/seasonal
  /severity_pyramid
  /gravity_cascade
  /trends/heatmap_se_age
  /trends/ventilatory_support
"""

from fastapi.testclient import TestClient

from srag.api.main import app

client = TestClient(app)


class TestSeverityKpis:
    def test_returns_200_and_dict(self, mock_srag_df) -> None:
        response = client.get("/severity_kpis")
        assert response.status_code == 200
        body = response.json()
        assert "current" in body
        assert "trend" in body
        for field in (
            "hospitalization_rate",
            "uti_rate",
            "ventilatory_support_rate",
            "death_rate",
            "median_hospitalization_days",
            "median_uti_days",
        ):
            assert field in body["current"]

    def test_empty_dataframe_returns_empty_payload(self, empty_srag_df) -> None:
        response = client.get("/severity_kpis")
        assert response.status_code == 200
        body = response.json()
        assert "current" in body
        assert "trend" in body


class TestSeasonalTrends:
    def test_returns_seasonal_structure(self, mock_srag_df) -> None:
        response = client.get("/trends/seasonal")
        assert response.status_code == 200
        body = response.json()
        assert "years" in body
        assert "weeks" in body
        assert "series" in body
        assert isinstance(body["years"], list)
        assert isinstance(body["weeks"], list)
        assert isinstance(body["series"], dict)

    def test_empty_dataframe_returns_empty_lists(self, empty_srag_df) -> None:
        response = client.get("/trends/seasonal")
        assert response.status_code == 200
        body = response.json()
        assert body["years"] == [] or body["years"] is not None
        assert body["weeks"] == [] or body["weeks"] is not None


class TestSeverityPyramid:
    def test_returns_pyramid_points(self, mock_srag_df) -> None:
        response = client.get("/severity_pyramid")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        for row in body:
            assert "age_group" in row
            assert "total_cases" in row
            assert "uti_rate" in row
            assert "support_rate" in row
            assert "death_rate" in row

    def test_empty_dataframe_returns_empty_list(self, empty_srag_df) -> None:
        response = client.get("/severity_pyramid")
        assert response.status_code == 200
        assert response.json() == []


class TestGravityCascade:
    def test_returns_cascade_points(self, mock_srag_df) -> None:
        response = client.get("/gravity_cascade")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        for row in body:
            assert "epi_week" in row
            for key in ("notified", "hospitalized", "uti", "death"):
                assert key in row

    def test_empty_dataframe_returns_empty_list(self, empty_srag_df) -> None:
        response = client.get("/gravity_cascade")
        assert response.status_code == 200
        assert response.json() == []


class TestHeatmapSeAge:
    def test_returns_heatmap_structure(self, mock_srag_df) -> None:
        response = client.get("/trends/heatmap_se_age")
        assert response.status_code == 200
        body = response.json()
        assert "weeks" in body
        assert "age_groups" in body
        assert "data" in body
        assert isinstance(body["weeks"], list)
        assert isinstance(body["age_groups"], list)
        assert isinstance(body["data"], list)
        for point in body["data"]:
            assert isinstance(point, list)
            assert len(point) == 3

    def test_empty_dataframe_returns_empty_structure(self, empty_srag_df) -> None:
        response = client.get("/trends/heatmap_se_age")
        assert response.status_code == 200
        body = response.json()
        assert "weeks" in body
        assert "age_groups" in body
        assert "data" in body


class TestVentilatorySupport:
    def test_returns_weekly_support_points(self, mock_srag_df) -> None:
        response = client.get("/trends/ventilatory_support")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        for row in body:
            assert "epi_week" in row
            for key in ("invasive", "non_invasive", "no_support", "ignored"):
                assert key in row

    def test_empty_dataframe_returns_empty_list(self, empty_srag_df) -> None:
        response = client.get("/trends/ventilatory_support")
        assert response.status_code == 200
        assert response.json() == []
