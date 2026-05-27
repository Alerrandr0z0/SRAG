from __future__ import annotations

import pandas as pd

import srag.data.geospatial as geo_mod


def test_build_rural_heatpoints_urban_points_from_cnes() -> None:
    df = pd.DataFrame(
        [
            {"ID_UNIDADE": "111", "ZONA": "RURAL"},
            {"ID_UNIDADE": "111", "ZONA": "RURAL"},
            {"ID_UNIDADE": "222", "ZONA": "RURAL"},
            {"ID_UNIDADE": "333", "ZONA": "URBANA"},
        ]
    )

    lookup: dict[str, dict[str, object]] = {
        "111": {
            "codigo_cnes": "111",
            "codigo_municipio": "240800",
            "nome_fantasia": "UBS PAU BRANCO",
            "endereco": "ASSENTAMENTO, S/N - PAU BRANCO",
            "latitude": -5.90,
            "longitude": -36.77,
        },
        "222": {
            "codigo_cnes": "222",
            "codigo_municipio": "240800",
            "nome_fantasia": "UBS SERRA",
            "endereco": "RUA A, 10 - SERRA",
            "latitude": -5.80,
            "longitude": -36.70,
        },
    }

    orig_lookup = geo_mod.lookup_unit_record
    orig_load = geo_mod._load_urban_polygons

    geo_mod.lookup_unit_record = lambda code: lookup.get(str(code).strip())
    geo_mod._load_urban_polygons = lambda _path="": []

    try:
        result = geo_mod.build_rural_heatpoints(df, min_cases=1)
    finally:
        geo_mod.lookup_unit_record = orig_lookup
        geo_mod._load_urban_polygons = orig_load

    assert result["available"] is True
    assert result["reason"] == "ok"
    assert result["urban_points"] == []
    assert result["urban_center"] is None


def test_build_rural_heatpoints_urban_point_within_bairro() -> None:
    """A unit whose coordinates fall inside a bairro polygon is urban."""
    df = pd.DataFrame(
        [
            {"ID_UNIDADE": "001", "ZONA": "URBANA"},
        ]
    )

    orig_lookup = geo_mod.lookup_unit_record
    orig_load = geo_mod._load_urban_polygons

    geo_mod.lookup_unit_record = lambda code: {
        "codigo_cnes": "001",
        "codigo_municipio": "240800",
        "nome_fantasia": "HOSPITAL CENTRAL",
        "latitude": -5.19,
        "longitude": -37.35,
    }
    geo_mod._load_urban_polygons = lambda _path="": [
        (
            "CENTRO",
            [
                [
                    (-37.36, -5.18),
                    (-37.34, -5.18),
                    (-37.34, -5.20),
                    (-37.36, -5.20),
                    (-37.36, -5.18),
                ]
            ],
        )
    ]

    try:
        result = geo_mod.build_rural_heatpoints(df, min_cases=1)
    finally:
        geo_mod.lookup_unit_record = orig_lookup
        geo_mod._load_urban_polygons = orig_load

    assert result["available"] is True
    assert len(result["urban_points"]) == 1, f"urban_points={result['urban_points']}"
    up = result["urban_points"][0]
    assert up["codigo_cnes"] == "001"
    assert up["zona"] == "URBANA"
    assert up["bairro"] == "CENTRO"
    assert up["count"] == 1


def test_build_rural_heatpoints_empty_data() -> None:
    result = geo_mod.build_rural_heatpoints(pd.DataFrame())
    assert result["available"] is True
    assert result["points"] == []
    assert result["urban_points"] == []
    assert result["urban_center"] is None


def test_build_rural_heatpoints_rural_fallback_distributed_equally() -> None:
    """All rural cases are distributed equally among N/S/L/O."""
    df = pd.DataFrame(
        [
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
            {"ID_UNIDADE": "999", "ZONA": "RURAL"},
        ]
    )

    orig_lookup = geo_mod.lookup_unit_record
    orig_polys = geo_mod._load_urban_polygons
    orig_centroid = geo_mod._municipality_centroid

    geo_mod.lookup_unit_record = lambda code: None
    geo_mod._load_urban_polygons = lambda _path="": []
    geo_mod._municipality_centroid = lambda: (-5.19, -37.34)

    try:
        result = geo_mod.build_rural_heatpoints(df, min_cases=1)
    finally:
        geo_mod.lookup_unit_record = orig_lookup
        geo_mod._load_urban_polygons = orig_polys
        geo_mod._municipality_centroid = orig_centroid

    assert result["available"] is True
    assert result["urban_points"] == []
    assert len(result["points"]) == 4, f"sectors={result['points']}"

    sectors = {p["sector"]: p["count"] for p in result["points"]}
    assert sectors == {"N": 3, "S": 3, "L": 2, "O": 2}, f"got {sectors}"
