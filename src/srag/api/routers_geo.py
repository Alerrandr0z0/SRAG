"""Geo API routers."""

# ruff: noqa

from typing import Any, Literal

import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.analytics import apply_global_filters
from srag.data.geospatial import (
    build_macrosector_heatpoints,
    build_rural_heatpoints,
    get_municipality_boundary,
    _iter_coords,
)

router = APIRouter()


@router.get("/geo/macrosector_heatpoints")
def macrosector_heatpoints(
    zone: Literal["Urbana", "Rural", "Periurbana"] = Query("Rural"),
    min_cases: int = Query(1, ge=1),
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    if df.empty:
        return {"available": False, "points": []}
    result = build_macrosector_heatpoints(
        df, "data/geojson/mossoro_bairros.geojson", zone, min_cases
    )
    return sanitize_data(result)


@router.get("/geo/rural_heatpoints")
def rural_heatpoints(
    min_cases: int = 1,
    filters: CommonFilters = Depends(get_common_filters),
) -> Any:
    df = get_df()
    df = apply_global_filters(
        df,
        filters.profile,
        filters.race,
        filters.gender,
        filters.zonas,
        filters.bairros,
        filters.unidades,
        maternal=filters.maternal,
        occupations=filters.occupations,
    )
    df = apply_surveillance_filters(
        df, filters.years, filters.agents, filters.months, filters.days
    )
    return sanitize_data(build_rural_heatpoints(df, min_cases=min_cases))


@router.get("/geo/municipality_boundary")
def get_geo_boundary() -> Any:
    path = Path("data/processed/mossoro_municipality_boundary.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}


@router.get("/geo/rural_sectors")
def get_rural_sectors() -> Any:
    path = Path("data/geojson/mossoro_rural_sectors.geojson")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    bairros_geo_path = Path("data/geojson/mossoro_bairros.geojson")

    coords: list[tuple[float, float]] = []
    if bairros_geo_path.exists():
        try:
            geo = json.loads(bairros_geo_path.read_text())
            for feat in geo.get("features", []):
                coords.extend(_iter_coords(feat.get("geometry", {}).get("coordinates", [])))
        except Exception:
            coords = []

    if not coords:
        boundary = get_municipality_boundary()
        features = boundary.get("features", []) if isinstance(boundary, dict) else []
        if not features:
            return {"error": "boundary_not_found"}
        coords = list(_iter_coords(features[0].get("geometry", {}).get("coordinates", [])))

    if not coords:
        return {"error": "invalid_boundary"}

    xs = [p[0] for p in coords]
    ys = [p[1] for p in coords]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    dx_far = (max_x - min_x) * 2
    dy_far = (max_y - min_y) * 2

    def triangle(pts: list[tuple[float, float]]) -> dict[str, object]:
        return {"type": "Polygon", "coordinates": [[list(pt) for pt in pts + [pts[0]]]]}

    sectors = [
        {
            "sector": "N",
            "geometry": triangle(
                [(cx, cy), (min_x - dx_far, max_y + dy_far), (max_x + dx_far, max_y + dy_far)]
            ),
        },
        {
            "sector": "S",
            "geometry": triangle(
                [(cx, cy), (min_x - dx_far, min_y - dy_far), (max_x + dx_far, min_y - dy_far)]
            ),
        },
        {
            "sector": "L",
            "geometry": triangle(
                [(cx, cy), (max_x + dx_far, max_y + dy_far), (max_x + dx_far, min_y - dy_far)]
            ),
        },
        {
            "sector": "O",
            "geometry": triangle(
                [(cx, cy), (min_x - dx_far, max_y + dy_far), (min_x - dx_far, min_y - dy_far)]
            ),
        },
    ]

    feature_collection = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"sector": s["sector"]}, "geometry": s["geometry"]}
            for s in sectors
        ],
    }

    return feature_collection


@router.get("/geo/bairros_choropleth")
def get_geo_bairros() -> Any:
    path = Path("data/geojson/mossoro_bairros.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}
