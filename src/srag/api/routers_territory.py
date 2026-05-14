"""Territory API routers."""

# ruff: noqa

from typing import Any

import json
from pathlib import Path

from fastapi import APIRouter, Depends

from srag.api.dependencies import CommonFilters, get_common_filters
from srag.api.core import get_df, apply_surveillance_filters, sanitize_data
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
    min_cases: int = 5,
    entities_min_cases: int = 3,
    entities_limit: int = 40,
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
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return {}

    bairros_df = compute_territory_distribution(df, min_cases=0)
    bairros_dict = dict(zip(bairros_df["bairro"].str.upper(), bairros_df["count"]))

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
            name = feature["properties"].get("bairro", "").upper()
            feature["properties"]["count"] = bairros_dict.get(name, 0)
        choropleth = {"available": True, "feature_collection": bairros_geo}
    else:
        choropleth = {
            "available": False,
            "feature_collection": {"type": "FeatureCollection", "features": []},
        }

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
    min_cases: int = 3,
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
    df = apply_surveillance_filters(df, filters.years, filters.agents)
    if df.empty:
        return []
    dist = compute_unit_distribution(df, min_cases=min_cases)
    return sanitize_data(dist.to_dict(orient="records"))
