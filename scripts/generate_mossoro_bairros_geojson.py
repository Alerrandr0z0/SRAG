"""Generate Mossoro neighborhoods and rural boundary GeoJSONs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

# Add src to path to import geospatial helpers
sys.path.append(str(Path(__file__).parent.parent / "src"))
try:
    from srag.data.geospatial import get_municipality_boundary
except ImportError:
    print("Warning: Could not import srag.data.geospatial. Boundary fetching might fail.")
    def get_municipality_boundary():
        path = Path("data/processed/mossoro_municipality_boundary.geojson")
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        raise FileNotFoundError("Municipality boundary not found and import failed.")

def main() -> None:
    """Create visualization GeoJSONs in `data/geojson/`."""
    src_gpkg = Path("data/external/geospacial/neighborhoods_2022_simplified.gpkg")
    out_dir = Path("data/geojson")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    out_urban = out_dir / "mossoro_bairros.geojson"
    out_rural = out_dir / "mossoro_rural.geojson"
    out_rural_sectors = out_dir / "mossoro_rural_sectors.geojson"

    if not src_gpkg.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {src_gpkg}")

    print("Iniciando processamento geoespacial...")
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")

    # 1. Carregar Bairros (Urban)
    print("Carregando bairros urbanos...")
    rows = con.execute(
        f"""
        SELECT name_neighborhood, ST_AsGeoJSON(geom) AS geom_json, geom
        FROM ST_Read('{src_gpkg}')
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
        for name, geom_json, _ in rows
    ]
    out_urban.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON urbano gerado em: {out_urban}")

    # 2. Gerar Zona Rural (Complemento)
    print("Gerando zona rural como complemento...")
    try:
        boundary_geo = get_municipality_boundary()
        con.execute(f"CREATE TABLE urban_neighborhoods AS SELECT geom FROM ST_Read('{src_gpkg}') WHERE code_muni='2408003' AND ST_Area(geom) > 0.00001;")
        con.execute(f"CREATE TABLE municipality_boundary AS SELECT ST_GeomFromGeoJSON('{json.dumps(boundary_geo['features'][0]['geometry'])}') as geom;")
        con.execute("""
            CREATE TABLE rural_base AS 
            SELECT ST_Difference(
                (SELECT geom FROM municipality_boundary),
                (SELECT ST_Buffer(ST_Buffer(ST_Union_Agg(geom), 0.0005), -0.0005) FROM urban_neighborhoods)
            ) as geom;
        """)
        
        rural_geom_json = con.execute("SELECT ST_AsGeoJSON(geom) FROM rural_base").fetchone()[0]
        rural_fc = {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"zone": "RURAL", "name": "Zona Rural"}, "geometry": json.loads(rural_geom_json)}],
        }
        out_rural.write_text(json.dumps(rural_fc, ensure_ascii=False), encoding="utf-8")
        print(f"GeoJSON rural gerado em: {out_rural}")

        # 3. Setores Rurais
        print("Gerando fatias de 90°...")
        bbox = con.execute("SELECT ST_XMin(geom), ST_XMax(geom), ST_YMin(geom), ST_YMax(geom) FROM municipality_boundary").fetchone()
        min_x, max_x, min_y, max_y = bbox
        cx, cy = (min_x + max_x) / 2, (min_y + max_y) / 2
        dx, dy = (max_x - min_x) * 2, (max_y - min_y) * 2

        sector_defs = [
            ("N", f"ST_MakePolygon(ST_GeomFromText('LINESTRING({cx} {cy}, {min_x-dx} {max_y+dy}, {max_x+dx} {max_y+dy}, {cx} {cy})'))"),
            ("S", f"ST_MakePolygon(ST_GeomFromText('LINESTRING({cx} {cy}, {min_x-dx} {min_y-dy}, {max_x+dx} {min_y-dy}, {cx} {cy})'))"),
            ("L", f"ST_MakePolygon(ST_GeomFromText('LINESTRING({cx} {cy}, {max_x+dx} {max_y+dy}, {max_x+dx} {min_y-dy}, {cx} {cy})'))"),
            ("O", f"ST_MakePolygon(ST_GeomFromText('LINESTRING({cx} {cy}, {min_x-dx} {max_y+dy}, {min_x-dx} {min_y-dy}, {cx} {cy})'))"),
        ]

        sector_features = []
        for name, poly_sql in sector_defs:
            res = con.execute(f"SELECT ST_AsGeoJSON(ST_Intersection(geom, {poly_sql})) FROM rural_base").fetchone()
            if res and res[0]:
                sector_features.append({"type": "Feature", "properties": {"sector": name}, "geometry": json.loads(res[0])})
        
        out_rural_sectors.write_text(json.dumps({"type": "FeatureCollection", "features": sector_features}, ensure_ascii=False), encoding="utf-8")
        print(f"GeoJSON setores rurais gerado em: {out_rural_sectors}")
        
    except Exception as e:
        print(f"Erro geoespacial: {e}")

if __name__ == "__main__":
    main()
