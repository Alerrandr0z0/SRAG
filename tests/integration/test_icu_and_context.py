"""Unit tests for icu_bottleneck and context_trends endpoints.

These require custom DataFrames to exercise the body code paths.
"""

from datetime import UTC, date, datetime

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from srag.api.main import _cache, app

client = TestClient(app)


@pytest.fixture
def uti_df() -> pd.DataFrame:
    """A small DataFrame with 3 patients in UTI with valid timestamps."""
    df = pd.DataFrame(
        {
            "DT_NOTIFIC": [date(2024, 5, 1), date(2024, 5, 2), date(2024, 5, 3)],
            "DT_SIN_PRI": [date(2024, 4, 25), date(2024, 4, 26), date(2024, 4, 27)],
            "ID_MUNICIP": ["2408003"] * 3,
            "EVOLUCAO": [1, 1, 2],
            "UTI": [1, 1, 1],
            "DT_INTERNA": [date(2024, 5, 1), date(2024, 5, 2), date(2024, 5, 3)],
            "DT_ENTUTI": [date(2024, 5, 2), date(2024, 5, 3), date(2024, 5, 4)],
        }
    )
    _cache["df"] = df
    _cache["loaded_at"] = datetime.now(UTC)
    yield df
    _cache["df"] = None
    _cache["loaded_at"] = None


class TestIcuBottleneckBody:
    def test_with_uti_cases_returns_wait_days(self, uti_df) -> None:
        response = client.get("/icu_bottleneck")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert len(body) == 3
        for item in body:
            assert "date" in item
            assert "wait_days" in item
            assert item["wait_days"] >= 0
            assert item["wait_days"] <= 30

    def test_with_uti_cases_wait_days_matches_deltas(self, uti_df) -> None:
        response = client.get("/icu_bottleneck")
        body = response.json()
        wait_by_date = {row["date"]: row["wait_days"] for row in body}
        assert wait_by_date["2024-05-01"] == 1
        assert wait_by_date["2024-05-02"] == 1
        assert wait_by_date["2024-05-03"] == 1


class TestContextTrendsEmpty:
    def test_empty_dataframe_returns_history_empty(self, empty_srag_df) -> None:
        response = client.get("/context_trends?key=BAIRRO::CENTRO")
        assert response.status_code == 200
        body = response.json()
        assert "history" in body
        assert body["history"] == []

    def test_invalid_key_prefix_returns_422(self, mock_srag_df) -> None:
        """The key must start with BAIRRO:: or ZONA::. Anything else is 422."""
        response = client.get("/context_trends?key=CENTRO")
        assert response.status_code == 422

    def test_zona_key_returns_history(self, mock_srag_df) -> None:
        response = client.get("/context_trends?key=ZONA::URBANA")
        assert response.status_code == 200
        body = response.json()
        assert "history" in body
        assert "forecast" in body
        assert "thresholds" in body
