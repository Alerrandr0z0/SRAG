"""Integration tests for the /hospitalization_duration endpoint.

Boots the FastAPI app, injects a controlled DataFrame via the shared
_cache, and verifies the EMPTY payload contract on the no-data path.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from srag.api.main import _cache, app

client = TestClient(app)


def test_empty_dataframe_returns_empty_hospitalization_payload() -> None:
    """The endpoint must return the EMPTY_HOSPITALIZATION shape, not raise."""
    _cache["df"] = __import__("pandas").DataFrame()
    _cache["loaded_at"] = datetime.now(UTC)
    try:
        response = client.get("/hospitalization_duration")
        assert response.status_code == 200
        body = response.json()
        for key in (
            "cure",
            "death",
            "kde_x",
            "kde_cure",
            "kde_death",
        ):
            assert body[key] == []
        for key in (
            "median_cure",
            "median_death",
            "difference",
            "ratio",
        ):
            assert body[key] == 0.0
        assert body["cure_count"] == 0
        assert body["death_count"] == 0
    finally:
        _cache["df"] = None
        _cache["loaded_at"] = None
