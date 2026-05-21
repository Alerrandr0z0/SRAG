"""Geospatial helpers for municipal boundary and neighborhood choropleth."""

from __future__ import annotations

import json
import math
import unicodedata
from pathlib import Path
from typing import TYPE_CHECKING, Any

import requests

from srag.data.analytics import compute_territory_distribution
from srag.data.references import MOSSORO_IBGE_CODE

if TYPE_CHECKING:
    from collections.abc import Iterator

    import pandas as pd

MUNICIPALITY_GEO_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/"
    f"{MOSSORO_IBGE_CODE}?formato=application/vnd.geo+json"
)
BOUNDARY_CACHE_PATH = Path("data/processed/mossoro_municipality_boundary.geojson")
BAIRROS_GEOJSON_FALLBACK_PATH = Path("data/geojson/mossoro_bairros.geojson")
_boundary_memo: dict[str, Any] | None = None
_boundary_mtime_ns: int | None = None


def _norm_bairro_name(value: str | None) -> str:
    """Normalize bairro labels for robust text matching."""
    if value is None:
        return ""
    text = str(value).strip().upper()
    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    return " ".join(text.split())


def _iter_coords(value: object) -> Iterator[tuple[float, float]]:
    """Yield coordinate pairs from nested GeoJSON coordinate arrays."""
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and all(isinstance(v, (int, float)) for v in value[:2]):
            yield float(value[0]), float(value[1])
            return
        for item in value:
            yield from _iter_coords(item)


def _feature_centroid(feature: dict[str, Any]) -> tuple[float, float] | None:
    """Approximate feature centroid from all geometry coordinates."""
    geometry = feature.get("geometry", {})
    points = list(_iter_coords(geometry.get("coordinates", [])))
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def _norm_zone(value: str | None) -> str:
    """Normalize zone labels for robust comparisons."""
    if value is None:
        return ""
    text = str(value).strip().upper()
    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    return " ".join(text.split())


def _angle_to_sector(theta_deg: float) -> str:
    """Map angle to one of 8 macro-sectors."""
    bins = [
        (22.5, "L"),
        (67.5, "NE"),
        (112.5, "N"),
        (157.5, "NO"),
        (202.5, "O"),
        (247.5, "SO"),
        (292.5, "S"),
        (337.5, "SE"),
        (360.0, "L"),
    ]
    for limit, label in bins:
        if theta_deg < limit:
            return label
    return "L"


def _boundary_from_bairros_bbox(path: Path) -> dict[str, Any] | None:
    """Build a simple municipality fallback polygon from bairros bbox."""
    if not path.exists():
        return None

    content = json.loads(path.read_text(encoding="utf-8"))
    features = content.get("features", [])
    if not isinstance(features, list) or len(features) == 0:
        return None

    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    for feature in features:
        geometry = feature.get("geometry", {})
        for x, y in _iter_coords(geometry.get("coordinates", [])):
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

    if not all(v not in (float("inf"), float("-inf")) for v in [min_x, max_x, min_y, max_y]):
        return None

    polygon = {
        "type": "Feature",
        "properties": {
            "source": "local_bairros_bbox_fallback",
            "municipality": "Mossoro",
            "ibge_code": MOSSORO_IBGE_CODE,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [min_x, min_y],
                    [max_x, min_y],
                    [max_x, max_y],
                    [min_x, max_y],
                    [min_x, min_y],
                ]
            ],
        },
    }
    return {"type": "FeatureCollection", "features": [polygon]}


def get_municipality_boundary() -> dict[str, Any]:
    """Return Mossoro municipality boundary with cache and offline fallback."""
    global _boundary_memo, _boundary_mtime_ns

    cache_mtime_ns = (
        BOUNDARY_CACHE_PATH.stat().st_mtime_ns if BOUNDARY_CACHE_PATH.exists() else None
    )
    if (
        _boundary_memo is not None
        and _boundary_mtime_ns is not None
        and cache_mtime_ns == _boundary_mtime_ns
    ):
        return _boundary_memo

    if BOUNDARY_CACHE_PATH.exists():
        cached = json.loads(BOUNDARY_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(cached, dict):
            _boundary_memo = cached
            _boundary_mtime_ns = cache_mtime_ns
            return cached

    try:
        response = requests.get(MUNICIPALITY_GEO_URL, timeout=(5, 12))
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Unexpected IBGE boundary payload format.")

        BOUNDARY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        BOUNDARY_CACHE_PATH.write_text(
            json.dumps(payload, ensure_ascii=False),
            encoding="utf-8",
        )
        _boundary_memo = payload
        _boundary_mtime_ns = BOUNDARY_CACHE_PATH.stat().st_mtime_ns
        return payload
    except requests.RequestException, ValueError, json.JSONDecodeError:
        fallback = _boundary_from_bairros_bbox(BAIRROS_GEOJSON_FALLBACK_PATH)
        if fallback is not None:
            _boundary_memo = fallback
            _boundary_mtime_ns = None
            return fallback

        raise


def build_bairros_choropleth(
    df: pd.DataFrame,
    geojson_path: str | Path,
    min_cases: int = 5,
) -> dict[str, Any]:
    """Join neighborhood counts to a local neighborhood GeoJSON file.

    The GeoJSON must include at least one property named like:
    `bairro`, `nome`, `name`, or `nm_bairro`.
    """
    path = geojson_path if isinstance(geojson_path, Path) else Path(geojson_path)
    if not path.exists():
        return {
            "available": False,
            "reason": "geojson_not_found",
            "feature_collection": {"type": "FeatureCollection", "features": []},
        }

    content = json.loads(path.read_text(encoding="utf-8"))
    features = content.get("features", [])
    if not isinstance(features, list):
        return {
            "available": False,
            "reason": "invalid_geojson",
            "feature_collection": {"type": "FeatureCollection", "features": []},
        }

    bairro_counts_df = compute_territory_distribution(df, min_cases=min_cases)
    count_map: dict[str, int] = {}
    for row in bairro_counts_df.itertuples(index=False):
        bairro_name = _norm_bairro_name(getattr(row, "bairro", None))
        count_value = int(getattr(row, "count", 0) or 0)
        count_map[bairro_name] = count_value

    updated_features: list[dict[str, Any]] = []
    matched = 0
    for feature in features:
        props = feature.get("properties", {})
        raw_name = (
            props.get("bairro")
            or props.get("nome")
            or props.get("name")
            or props.get("nm_bairro")
            or ""
        )
        key = _norm_bairro_name(raw_name)
        count = count_map.get(key, 0)
        if count > 0:
            matched += 1

        next_feature = {
            **feature,
            "properties": {
                **props,
                "bairro": key,
                "count": count,
            },
        }
        updated_features.append(next_feature)

    return {
        "available": True,
        "reason": "ok",
        "matched_bairros": matched,
        "feature_collection": {
            "type": "FeatureCollection",
            "features": updated_features,
        },
    }


def build_macrosector_heatpoints(
    df: pd.DataFrame,
    geojson_path: str | Path,
    zone: str,
    min_cases: int = 1,
) -> dict[str, Any]:
    """Aggregate zone cases into 8 directional macro-sectors for map heat points."""
    path = geojson_path if isinstance(geojson_path, Path) else Path(geojson_path)
    if not path.exists():
        return {
            "available": False,
            "reason": "geojson_not_found",
            "center": None,
            "points": [],
        }

    payload = json.loads(path.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    if not isinstance(features, list) or not features:
        return {
            "available": False,
            "reason": "invalid_geojson",
            "center": None,
            "points": [],
        }

    norm_zone = _norm_zone(zone)
    zone_map = {
        "URBANA": "URBANA",
        "RURAL": "RURAL",
        "PERIURBANA": "PERIURBANA",
    }
    target_zone = zone_map.get(norm_zone, norm_zone)

    center_payload = get_municipality_boundary()
    center_features = (
        center_payload.get("features", []) if isinstance(center_payload, dict) else []
    )
    city_centroid = None
    if isinstance(center_features, list) and center_features:
        city_centroid = _feature_centroid(center_features[0])

    work = df.copy()
    if "ZONA" not in work.columns:
        return {
            "available": False,
            "reason": "zone_not_available",
            "center": None,
            "points": [],
        }
    work["zona_norm"] = work["ZONA"].map(_norm_zone)
    work = work[work["zona_norm"] == target_zone]
    if work.empty:
        return {
            "available": True,
            "reason": "empty_zone",
            "center": None,
            "points": [],
        }

    territory = compute_territory_distribution(work, min_cases=min_cases)
    count_map = {
        _norm_bairro_name(getattr(row, "bairro", None)): int(getattr(row, "count", 0) or 0)
        for row in territory.itertuples(index=False)
    }

    if not count_map:
        if city_centroid is None:
            return {
                "available": True,
                "reason": "no_bairro_counts_no_centroid",
                "center": None,
                "points": [],
            }

        cx, cy = city_centroid
        total_unknown = len(work)
        return {
            "available": True,
            "reason": "no_bairro_counts_centroid_fallback",
            "zone": zone,
            "center": {"lat": cy, "lon": cx},
            "points": [
                {
                    "sector": "NAO INFORMADO",
                    "count": total_unknown,
                    "lat": cy,
                    "lon": cx,
                }
            ],
        }

    centroids: dict[str, tuple[float, float]] = {}
    centroid_values: list[tuple[float, float]] = []
    for feature in features:
        props = feature.get("properties", {})
        raw_name = (
            props.get("bairro")
            or props.get("nome")
            or props.get("name")
            or props.get("nm_bairro")
            or ""
        )
        key = _norm_bairro_name(raw_name)
        if key not in count_map:
            continue
        centroid = _feature_centroid(feature)
        if centroid is None:
            continue
        centroids[key] = centroid
        centroid_values.append(centroid)

    if not centroid_values:
        if city_centroid is None:
            return {
                "available": True,
                "reason": "no_centroids_no_city_center",
                "center": None,
                "points": [],
            }

        cx, cy = city_centroid
        total_unknown = len(work)
        return {
            "available": True,
            "reason": "no_centroids_center_fallback",
            "zone": zone,
            "center": {"lat": cy, "lon": cx},
            "points": [
                {
                    "sector": "NAO LOCALIZADO",
                    "count": total_unknown,
                    "lat": cy,
                    "lon": cx,
                }
            ],
        }

    center_x = sum(x for x, _ in centroid_values) / len(centroid_values)
    center_y = sum(y for _, y in centroid_values) / len(centroid_values)

    bucket: dict[str, dict[str, Any]] = {}
    for bairro_key, count in count_map.items():
        centroid = centroids.get(bairro_key)
        if centroid is None:
            continue
        x, y = centroid
        dx = x - center_x
        dy = y - center_y
        theta = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
        sector = _angle_to_sector(theta)
        if sector not in bucket:
            bucket[sector] = {
                "sector": sector,
                "count": 0,
                "sum_x": 0.0,
                "sum_y": 0.0,
                "n": 0,
            }
        bucket[sector]["count"] += int(count)
        bucket[sector]["sum_x"] += x
        bucket[sector]["sum_y"] += y
        bucket[sector]["n"] += 1

    points: list[dict[str, Any]] = []
    for sector, item in bucket.items():
        if item["count"] < min_cases:
            continue
        avg_x = item["sum_x"] / item["n"]
        avg_y = item["sum_y"] / item["n"]
        points.append(
            {
                "sector": sector,
                "count": int(item["count"]),
                "lat": avg_y,
                "lon": avg_x,
            }
        )

    points = sorted(points, key=lambda p: p["count"], reverse=True)
    return {
        "available": True,
        "reason": "ok",
        "zone": zone,
        "center": {"lat": center_y, "lon": center_x},
        "points": points,
    }
