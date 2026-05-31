"""Territory API routers."""

# ruff: noqa

from typing import Any, cast

import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
from srag.data.geospatial import (
    _norm_bairro_name,
)
from srag.data.analytics import (
    apply_global_filters,
    compute_territory_distribution,
    compute_territory_entities_by_zone,
    compute_unit_distribution,
    compute_zone_distribution,
)

router = APIRouter()


@router.get("/territory_bootstrap")
def territory_bootstrap(
    min_cases: int = Query(5, ge=1),
    entities_min_cases: int = Query(3, ge=1),
    entities_limit: int = Query(40, ge=1, le=500),
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

    # Define default/empty structures for contract stability
    empty_result = sanitize_data(
        {
            "territory": {"bairros": [], "zonas": []},
            "boundary": {"type": "FeatureCollection", "features": []},
            "choropleth": {
                "available": False,
                "feature_collection": {"type": "FeatureCollection", "features": []},
            },
            "territory_entities": {"urban_bairros": [], "rural_comunidades": []},
        }
    )

    if df.empty:
        return empty_result

    bairros_df = compute_territory_distribution(df, min_cases=0)
    # Correct aggregation: SUM counts if multiple raw names normalize to the same key
    bairros_dict: dict[str, int] = {}
    for r in bairros_df.to_dict(orient="records"):
        raw_bairro = cast(str | None, r.get("bairro"))
        norm = _norm_bairro_name(raw_bairro)
        bairros_dict[norm] = bairros_dict.get(norm, 0) + int(r.get("count", 0))

    boundary_path = Path("data/processed/mossoro_municipality_boundary.geojson")
    boundary = (
        json.loads(boundary_path.read_text())
        if boundary_path.exists()
        else {"type": "FeatureCollection", "features": []}
    )

    bairros_geo_path = Path("data/geojson/mossoro_bairros.geojson")
    if bairros_geo_path.exists():
        bairros_geo = json.loads(bairros_geo_path.read_text())
        for feature in bairros_geo["features"]:
            raw_name = feature["properties"].get("bairro", "")
            norm_name = _norm_bairro_name(raw_name)
            feature["properties"]["count"] = bairros_dict.get(norm_name, 0)
            feature["properties"]["bairro"] = norm_name
        choropleth = {"available": True, "feature_collection": bairros_geo}
    else:
        choropleth = empty_result["choropleth"]

    entities = compute_territory_entities_by_zone(df, entities_min_cases, entities_limit)

    return sanitize_data(
        {
            "territory": {
                "bairros": bairros_df[bairros_df["count"] >= min_cases].to_dict(orient="records"),
                "zonas": compute_zone_distribution(df).to_dict(orient="records"),
            },
            "boundary": boundary,
            "choropleth": choropleth,
            "territory_entities": entities,
        }
    )


@router.get("/units")
def get_units(
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
    if df.empty:
        return []
    dist = compute_unit_distribution(df, min_cases=min_cases)
    return sanitize_data(dist.to_dict(orient="records"))
