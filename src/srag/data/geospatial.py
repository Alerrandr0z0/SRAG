"""Geospatial helpers for municipal boundary and neighborhood choropleth."""

from __future__ import annotations

import json
import math
import unicodedata
from pathlib import Path
from typing import TYPE_CHECKING, Any

import requests

from srag.data.analytics import compute_territory_distribution

if TYPE_CHECKING:
    import pandas as pd

MOSSORO_IBGE_CODE = "2408003"
MUNICIPALITY_GEO_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/"
    f"{MOSSORO_IBGE_CODE}?formato=application/vnd.geo+json"
)
BOUNDARY_CACHE_PATH = Path("data/processed/mossoro_municipality_boundary.geojson")
BAIRROS_GEOJSON_FALLBACK_PATH = Path("data/mossoro_bairros.geojson")
_BOUNDARY_MEMO: dict[str, Any] | None = None
_BOUNDARY_MEMO_MTIME_NS: int | None = None


def _norm_bairro_name(value: str | None) -> str:
    """Normalize bairro labels for robust text matching."""
    if value is None:
        return ""
    text = str(value).strip().upper()
    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    return " ".join(text.split())


def _iter_coords(value: Any):
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
    global _BOUNDARY_MEMO, _BOUNDARY_MEMO_MTIME_NS

    cache_mtime_ns = (
        BOUNDARY_CACHE_PATH.stat().st_mtime_ns if BOUNDARY_CACHE_PATH.exists() else None
    )
    if (
        _BOUNDARY_MEMO is not None
        and _BOUNDARY_MEMO_MTIME_NS is not None
        and cache_mtime_ns == _BOUNDARY_MEMO_MTIME_NS
    ):
        return _BOUNDARY_MEMO

    if BOUNDARY_CACHE_PATH.exists():
        cached = json.loads(BOUNDARY_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(cached, dict):
            _BOUNDARY_MEMO = cached
            _BOUNDARY_MEMO_MTIME_NS = cache_mtime_ns
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
        _BOUNDARY_MEMO = payload
        _BOUNDARY_MEMO_MTIME_NS = BOUNDARY_CACHE_PATH.stat().st_mtime_ns
        return payload
    except (requests.RequestException, ValueError, json.JSONDecodeError):
        fallback = _boundary_from_bairros_bbox(BAIRROS_GEOJSON_FALLBACK_PATH)
        if fallback is not None:
            _BOUNDARY_MEMO = fallback
            _BOUNDARY_MEMO_MTIME_NS = None
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
        bairro_name = _norm_bairro_name(getattr(row, "BAIRRO_REF", None))
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
                "BAIRRO_REF": key,
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
        _norm_bairro_name(getattr(row, "BAIRRO_REF", None)): int(getattr(row, "count", 0) or 0)
        for row in territory.itertuples(index=False)
    }

    if not count_map:
        work = work.copy()
        age = work.get("idade_anos")
        if age is None:
            work["idade_anos"] = 0
        work["idade_anos"] = work["idade_anos"].fillna(0)
        work["sector"] = "N"
        work.loc[work["idade_anos"] < 10, "sector"] = "NE"
        work.loc[(work["idade_anos"] >= 10) & (work["idade_anos"] < 20), "sector"] = "L"
        work.loc[(work["idade_anos"] >= 20) & (work["idade_anos"] < 30), "sector"] = "SE"
        work.loc[(work["idade_anos"] >= 30) & (work["idade_anos"] < 40), "sector"] = "S"
        work.loc[(work["idade_anos"] >= 40) & (work["idade_anos"] < 50), "sector"] = "SO"
        work.loc[(work["idade_anos"] >= 50) & (work["idade_anos"] < 60), "sector"] = "O"
        work.loc[(work["idade_anos"] >= 60), "sector"] = "NO"

        grouped = work.groupby("sector").size().reset_index(name="count")
        grouped = grouped[grouped["count"] >= min_cases]
        if grouped.empty or city_centroid is None:
            return {
                "available": True,
                "reason": "no_bairro_counts",
                "center": None,
                "points": [],
            }

        cx, cy = city_centroid
        sector_angles = {
            "N": 90,
            "NE": 45,
            "L": 0,
            "SE": 315,
            "S": 270,
            "SO": 225,
            "O": 180,
            "NO": 135,
        }
        points: list[dict[str, Any]] = []
        for row in grouped.itertuples(index=False):
            sector = row.sector
            count = int(row.count or 0)
            theta = math.radians(sector_angles.get(sector, 0))
            dx = 0.06 * math.cos(theta)
            dy = 0.04 * math.sin(theta)
            points.append(
                {
                    "sector": sector,
                    "count": count,
                    "lat": cy + dy,
                    "lon": cx + dx,
                }
            )

        points = sorted(points, key=lambda p: p["count"], reverse=True)
        return {
            "available": True,
            "reason": "fallback_no_bairro",
            "zone": zone,
            "center": {"lat": cy, "lon": cx},
            "points": points,
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
                "reason": "no_centroids",
                "center": None,
                "points": [],
            }

        work = work.copy()
        age = work.get("idade_anos")
        if age is None:
            work["idade_anos"] = 0
        work["idade_anos"] = work["idade_anos"].fillna(0)
        work["sector"] = "N"
        work.loc[work["idade_anos"] < 10, "sector"] = "NE"
        work.loc[(work["idade_anos"] >= 10) & (work["idade_anos"] < 20), "sector"] = "L"
        work.loc[(work["idade_anos"] >= 20) & (work["idade_anos"] < 30), "sector"] = "SE"
        work.loc[(work["idade_anos"] >= 30) & (work["idade_anos"] < 40), "sector"] = "S"
        work.loc[(work["idade_anos"] >= 40) & (work["idade_anos"] < 50), "sector"] = "SO"
        work.loc[(work["idade_anos"] >= 50) & (work["idade_anos"] < 60), "sector"] = "O"
        work.loc[(work["idade_anos"] >= 60), "sector"] = "NO"

        grouped = work.groupby("sector").size().reset_index(name="count")
        grouped = grouped[grouped["count"] >= min_cases]
        if grouped.empty:
            return {
                "available": True,
                "reason": "no_centroids",
                "center": None,
                "points": [],
            }

        cx, cy = city_centroid
        sector_angles = {
            "N": 90,
            "NE": 45,
            "L": 0,
            "SE": 315,
            "S": 270,
            "SO": 225,
            "O": 180,
            "NO": 135,
        }
        points: list[dict[str, Any]] = []
        for row in grouped.itertuples(index=False):
            sector = row.sector
            count = int(row.count or 0)
            theta = math.radians(sector_angles.get(sector, 0))
            dx = 0.06 * math.cos(theta)
            dy = 0.04 * math.sin(theta)
            points.append(
                {
                    "sector": sector,
                    "count": count,
                    "lat": cy + dy,
                    "lon": cx + dx,
                }
            )

        points = sorted(points, key=lambda p: p["count"], reverse=True)
        return {
            "available": True,
            "reason": "fallback_no_centroid_match",
            "zone": zone,
            "center": {"lat": cy, "lon": cx},
            "points": points,
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
