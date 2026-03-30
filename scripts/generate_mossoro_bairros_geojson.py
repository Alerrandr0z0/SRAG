"""Generate Mossoro neighborhoods GeoJSON from geobr neighborhood package."""

from __future__ import annotations

import json
from pathlib import Path

import duckdb


def main() -> None:
    """Create `data/mossoro_bairros.geojson` from geobr GPKG source."""
    src = Path("data/neighborhoods_2022_simplified.gpkg")
    out = Path("data/mossoro_bairros.geojson")

    if not src.exists():
        raise FileNotFoundError("Arquivo nao encontrado: data/neighborhoods_2022_simplified.gpkg")

    con = duckdb.connect()
    con.execute("INSTALL spatial;")
    con.execute("LOAD spatial;")

    rows = con.execute(
        """
        SELECT name_neighborhood, ST_AsGeoJSON(geom) AS geom_json
        FROM ST_Read('data/neighborhoods_2022_simplified.gpkg')
        WHERE code_muni='2408003'
        ORDER BY name_neighborhood
        """
    ).fetchall()

    features = [
        {
            "type": "Feature",
            "properties": {"bairro": name},
            "geometry": json.loads(geom_json),
        }
        for name, geom_json in rows
    ]
    feature_collection = {"type": "FeatureCollection", "features": features}
    out.write_text(json.dumps(feature_collection, ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON gerado em: {out} ({len(features)} bairros)")


if __name__ == "__main__":
    main()
