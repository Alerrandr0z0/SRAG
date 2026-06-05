"""Unit tests for src/srag/api/routers_geo.py.

Focus on edge cases and file-IO fallbacks that are not exercised by the
existing integration tests (which use a single happy-path fixture).
"""

import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from srag.api.main import _cache, app
from srag.data.geospatial import build_macrosector_heatpoints, build_rural_heatpoints

if TYPE_CHECKING:
    from pathlib import Path

client = TestClient(app)


@pytest.fixture
def empty_df() -> pd.DataFrame:
    """Inject an empty DataFrame into the shared in-memory cache.

    Routers bind `get_df` at import time, so function-level patches in
    one module do not reach them. The cache injection works because all
    routers share the same `_cache` dict.
    """
    df = pd.DataFrame()
    _cache["df"] = df
    _cache["loaded_at"] = datetime.now(UTC)
    yield df
    _cache["df"] = None
    _cache["loaded_at"] = None


class TestGeoBoundaryFileMissing:
    def test_returns_error_when_boundary_file_missing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        response = client.get("/geo/municipality_boundary")
        assert response.status_code == 200
        assert response.json() == {"error": "Not found"}


class TestGeoBairrosChoroplethFileMissing:
    def test_returns_error_when_bairros_geojson_missing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        response = client.get("/geo/bairros_choropleth")
        assert response.status_code == 200
        assert response.json() == {"error": "Not found"}


class TestRuralSectorsFallback:
    def test_generates_triangle_sectors_when_no_geojson(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        (tmp_path / "data" / "processed").mkdir(parents=True)
        (tmp_path / "data" / "geojson").mkdir(parents=True)

        boundary = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [-37.5, -5.0],
                                [-37.0, -5.0],
                                [-37.0, -4.5],
                                [-37.5, -4.5],
                                [-37.5, -5.0],
                            ]
                        ],
                    },
                }
            ],
        }
        (tmp_path / "data" / "processed" / "mossoro_municipality_boundary.geojson").write_text(
            json.dumps(boundary)
        )

        response = client.get("/geo/rural_sectors")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        sector_names = sorted(f["properties"]["sector"] for f in data["features"])
        assert sector_names == ["L", "N", "O", "S"]
        for feature in data["features"]:
            assert feature["geometry"]["type"] == "Polygon"
            assert len(feature["geometry"]["coordinates"][0]) == 4

    def test_returns_boundary_error_when_no_data(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """When no GeoJSON is on disk and the IBGE fetch returns an empty FeatureCollection.

        The endpoint returns the structured error.
        """
        from unittest.mock import MagicMock

        import srag.data.geospatial as geo

        monkeypatch.chdir(tmp_path)
        (tmp_path / "data").mkdir()
        saved_memo = geo._boundary_memo
        saved_mtime = geo._boundary_mtime_ns
        geo._boundary_memo = None
        geo._boundary_mtime_ns = None

        fake_response = MagicMock()
        fake_response.json.return_value = {"type": "FeatureCollection", "features": []}
        fake_response.raise_for_status = MagicMock()
        monkeypatch.setattr("requests.get", lambda *_a, **_kw: fake_response)
        try:
            response = client.get("/geo/rural_sectors")
            assert response.status_code == 200
            assert response.json() == {"error": "boundary_not_found"}
        finally:
            geo._boundary_memo = saved_memo
            geo._boundary_mtime_ns = saved_mtime


class TestMacrosectorHeatpointsEmpty:
    def test_empty_dataframe_without_zone_column_returns_unavailable(
        self, empty_df: pd.DataFrame
    ) -> None:
        """Empty df lacks the 'ZONA' column, so the endpoint must return available=False.

        The reason is 'zone_not_available'.
        """
        response = client.get("/geo/macrosector_heatpoints?zone=Rural&min_cases=1")
        assert response.status_code == 200
        body = response.json()
        assert body.get("available") is False
        assert body.get("points") == []


class TestRuralHeatpointsEmpty:
    def test_empty_dataframe_returns_empty_lists(self, empty_df: pd.DataFrame) -> None:
        """build_rural_heatpoints is structurally tolerant: with no data it still returns available=True.

        But with empty points lists. The contract is 'no crash, no data leaked'.
        """
        response = client.get("/geo/rural_heatpoints?min_cases=1")
        assert response.status_code == 200
        body = response.json()
        assert body.get("available") is True
        assert body.get("points") == []
        assert body.get("urban_points") == []


class TestGeospatialBuildFunctions:
    def test_build_rural_heatpoints_empty_df(self) -> None:
        result = build_rural_heatpoints(pd.DataFrame(), min_cases=1)
        assert isinstance(result, dict)
        assert result["available"] is True
        assert result["points"] == []
        assert result["urban_points"] == []

    def test_build_macrosector_heatpoints_missing_geojson(self, tmp_path: Path) -> None:
        result = build_macrosector_heatpoints(
            pd.DataFrame(), str(tmp_path / "missing.geojson"), "Rural", 1
        )
        assert isinstance(result, dict)
        assert result["available"] is False
