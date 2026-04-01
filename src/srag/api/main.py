from datetime import datetime, timedelta, UTC
from typing import Annotated, Any
import json
import logfire

import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy import create_engine
from srag.data.database import DB_URL
from srag.data.analytics import (
    compute_time_series,
    compute_virus_distribution,
    compute_virus_detailed_distribution,
    compute_territory_distribution,
    compute_territory_week_heatmap,
    compute_unit_distribution,
    compute_severity_metrics,
    compute_zone_distribution,
    compute_citizen_profile_tree,
    compute_citizen_pyramid,
    compute_race_profile,
    compute_schooling_profile,
    compute_symptoms_signature,
    compute_risk_factors_full_profile,
    compute_laboratory_network_summary,
    compute_territory_entities_by_zone,
    apply_citizen_filters,
    classificar_status_gripe,
    compute_vaccine_survival,
)
from srag.models.forecasting import predict_next_weeks

# --- Configuração e Otimização ---

app = FastAPI(title="SRAG Mossoró API")
logfire.configure()
logfire.instrument_fastapi(app)
logfire.instrument_pydantic()
logfire.instrument_sqlalchemy(engine := create_engine(DB_URL, pool_pre_ping=True))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {"df": None, "loaded_at": None}


def sanitize_data(obj):
    """Recursively convert numpy types to native python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_data(i) for i in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif pd.isna(obj):
        return None
    return obj


def get_df():
    now = datetime.now(UTC)
    if (
        _cache["df"] is not None
        and _cache["loaded_at"]
        and (now - _cache["loaded_at"]) < timedelta(minutes=15)
    ):
        return _cache["df"]

    try:
        CORE_COLS = [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "ID_MUNICIP",
            "ID_MN_RESI",
            "CLASSI_FIN",
            "ID_UNIDADE",
            "BAIRRO_REF",
            "NM_BAIRRO",
            "ZONA",
            "CS_ZONA",
            "NU_IDADE_N",
            "TP_IDADE",
            "IDADE_ANOS",
            "CS_SEXO",
            "CS_RACA",
            "CS_ESCOL_N",
            "EVOLUCAO",
            "UTI",
            "HOSPITAL",
            "SUPORT_VEN",
            "NOSOCOMIAL",
            "CS_GESTANT",
            "PUERPERA",
            "FEBRE",
            "TOSSE",
            "GARGANTA",
            "DISPNEIA",
            "DESC_RESP",
            "SATURACAO",
            "DIARREIA",
            "VOMITO",
            "DOR_ABD",
            "FADIGA",
            "PERD_OLFT",
            "PERD_PALA",
            "OUTRO_SIN",
            "PCR_VSR",
            "AN_VSR",
            "PCR_SARS2",
            "AN_SARS2",
            "TP_FLU_PCR",
            "TP_FLU_AN",
            "PCR_RESUL",
            "RES_AN",
            "DT_PCR",
            "DT_RES_AN",
            "DT_COLETA",
            "CO_LAB_AN",
            "ASMA",
            "DIABETES",
            "OBESIDADE",
            "CARDIOPATI",
            "PNEUMOPATI",
            "RENAL",
            "IMUNODEPRE",
            "NEUROLOGIC",
            "HEMATOLOGI",
            "HEPATICA",
            "SIND_DOWN",
            "TABAG",
            "OUT_MORBI",
            "VACINA",
            "DT_UT_DOSE",
            "MAE_VAC",
            "DT_VAC_MAE",
            "DT_DOSEUNI",
            "DT_1_DOSE",
            "DT_2_DOSE",
            "VACINA_COV",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "DOSE_2REF",
            "DOSE_ADIC",
            "DOS_RE_BI",
            "DT_INTERNA",
            "DT_EVOLUCA",
            "DT_ENTUTI",
        ]
        cols_str = ", ".join(CORE_COLS)
        df = pd.read_sql(f"SELECT {cols_str} FROM casos_srag", engine)
        date_cols = [
            "DT_NOTIFIC",
            "DT_SIN_PRI",
            "DT_INTERNA",
            "DT_ENTUTI",
            "DT_EVOLUCA",
            "DT_COLETA",
            "DT_PCR",
            "DT_RES_AN",
            "DT_UT_DOSE",
            "DOSE_1_COV",
            "DOSE_2_COV",
            "DOSE_REF",
            "DOSE_2REF",
            "DOS_RE_BI",
        ]
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
        df = df[df["DT_SIN_PRI"].notna()]
        _cache["df"] = df
        _cache["loaded_at"] = now
        return df
    except Exception as e:
        print(f"ERRO BACKEND: {e}")
        return _cache["df"] if _cache["df"] is not None else pd.DataFrame()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/summary")
def get_summary():
    df = get_df()
    if df.empty:
        return {"uti_rate": 0.0, "death_rate": 0.0, "total": 0}

    total = len(df)
    uti_cases = (df["UTI"] == 1).sum()
    death_cases = (df["EVOLUCAO"] == 2).sum()

    return {
        "uti_rate": round((uti_cases / total) * 100, 2) if total > 0 else 0,
        "death_rate": round((death_cases / total) * 100, 2) if total > 0 else 0,
        "total": total,
    }


@app.get("/trends")
def get_trends(last_n_weeks: int = 26, weeks_to_predict: int = 4, lookback_weeks: int = 8):
    df = get_df()
    if df.empty:
        return {"history": [], "forecast": []}

    ts = compute_time_series(df)
    lb = None if lookback_weeks == 0 else lookback_weeks
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict, lookback_weeks=lb)

    # Slice history
    result["history"] = result["history"][-last_n_weeks:]
    return sanitize_data(result)


@app.get("/virus")
def get_virus(detail_level: str = "summary"):
    df = get_df()
    if df.empty:
        return []

    if detail_level == "detailed":
        dist = compute_virus_detailed_distribution(df)
    else:
        dist = compute_virus_distribution(df)

    return sanitize_data(dist.to_dict(orient="records"))


@app.get("/territory_bootstrap")
def territory_bootstrap(min_cases: int = 5, entities_min_cases: int = 3, entities_limit: int = 40):
    df = get_df()
    if df.empty:
        return {}

    bairros_df = compute_territory_distribution(df, min_cases=0)
    bairros_dict = dict(zip(bairros_df["BAIRRO_REF"].str.upper(), bairros_df["count"]))

    # 1. GeoJSON Base
    boundary_path = Path("data/processed/mossoro_municipality_boundary.geojson")
    boundary = (
        json.loads(boundary_path.read_text())
        if boundary_path.exists()
        else {"type": "FeatureCollection", "features": []}
    )

    # 2. Choropleth (Urban)
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

    # 3. Territory Entities (for trends context)
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


@app.get("/units")
def get_units(min_cases: int = 3):
    df = get_df()
    if df.empty:
        return []
    dist = compute_unit_distribution(df, min_cases=min_cases)
    return sanitize_data(dist.to_dict(orient="records"))


@app.get("/clinical_flow")
def clinical_flow():
    """Analisa a jornada clínica completa para o gráfico Sankey com porcentagens."""
    df = get_df()
    if df.empty:
        return {"nodes": [], "links": []}

    # 1. Definir Labels das Etapas
    df = df.copy()
    df["S_ORIGEM"] = (
        df["NOSOCOMIAL"]
        .map({1: "Infecção Hospitalar", 2: "Comunitária"})
        .fillna("Origem (Ignorado)")
    )
    df["S_UTI"] = (
        df["UTI"]
        .map({1: "Internado em UTI", 2: "Internado em Enfermaria"})
        .fillna("Internação (Ignorado)")
    )
    df["S_VENT"] = (
        df["SUPORT_VEN"]
        .map({1: "Vent. Invasiva", 2: "Vent. Não Inv.", 3: "Sem Suporte"})
        .fillna("Suporte (Ignorado)")
    )
    df["S_FIM"] = df["EVOLUCAO"].map({1: "Cura", 2: "Óbito"}).fillna("Em Aberto")

    links_raw = []

    # Função auxiliar para gerar links com porcentagem relativa à origem
    def add_flow(df_step, col_source, col_target):
        counts = df_step.groupby([col_source, col_target]).size().reset_index(name="value")
        # Soma total por nó de origem para calcular a % relativa
        source_totals = counts.groupby(col_source)["value"].transform("sum")
        counts["pct"] = (counts["value"] / source_totals * 100).round(1)
        for _, r in counts.iterrows():
            links_raw.append(
                {
                    "source": r[col_source],
                    "target": r[col_target],
                    "value": int(r["value"]),
                    "pct": float(r["pct"]),
                }
            )

    # Etapa 1: Origem -> Setor
    add_flow(df, "S_ORIGEM", "S_UTI")

    # Etapa 2: Setor -> Ventilação
    add_flow(df, "S_UTI", "S_VENT")

    # Etapa 3: Ventilação -> Desfecho
    add_flow(df, "S_VENT", "S_FIM")

    all_nodes = set()
    for l in links_raw:
        all_nodes.add(l["source"])
        all_nodes.add(l["target"])

    nodes = [{"name": n} for n in sorted(list(all_nodes))]
    return {"nodes": nodes, "links": links_raw}


@app.get("/hospitalization_duration")
def hospitalization_duration():
    """Calcula a distribuição de dias de internação (DT_EVOLUCA - DT_INTERNA)."""
    df = get_df()
    if df.empty:
        return []

    try:
        df["DT_INTERNA"] = pd.to_datetime(df["DT_INTERNA"], errors="coerce")
        df["DT_EVOLUCA"] = pd.to_datetime(df["DT_EVOLUCA"], errors="coerce")
        dur = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days
        return dur[(dur >= 0) & (dur <= 90)].dropna().tolist()
    except Exception as e:
        print(f"Erro no cálculo de duração: {e}")
        return []


@app.get("/vaccination_profile")
def vaccination_profile(
    profile: Annotated[list[str] | None, Query()] = None,
    race: Annotated[list[str] | None, Query()] = None,
):
    """Analisa o esquema vacinal detalhado de COVID-19 e Influenza com filtros."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    if df.empty:
        return {}

    # 1. Status Epidemiológico Gripe (Normalizado para chaves técnicas)
    raw_gripe = df.apply(classificar_status_gripe, axis=1).value_counts().to_dict()
    # Garantir que todas as chaves técnicas existam para o frontend
    gripe_schema = {k: int(v) for k, v in raw_gripe.items()}
    label_map = {
        "protegido": "Protegido (Campanha Atual)",
        "dose_1": "Gripe: Dose 1",
        "dose_2": "Gripe: Dose 2",
        "dose_unica": "Gripe: Dose Única",
        "vencida": "Imunidade Vencida",
        "nao_vacinado": "Não Vacinado",
        "ignorado": "Ignorado",
        "inconsistencia": "Inconsistência",
    }
    # Para o gráfico de barras lateral (Legend) usamos labels legíveis
    gripe_schema_readable = {label_map.get(k, k): v for k, v in gripe_schema.items()}
    for label in label_map.values():
        if label not in gripe_schema_readable:
            gripe_schema_readable[label] = 0

    # 2. Esquema Detalhado COVID-19
    def get_last_dose(row):
        if pd.notna(row["DOS_RE_BI"]):
            return "Bivalente"
        if pd.notna(row["DOSE_2REF"]):
            return "2º Reforço"
        if pd.notna(row["DOSE_REF"]):
            return "1º Reforço"
        if pd.notna(row["DOSE_2_COV"]):
            return "Esquema Completo"
        if pd.notna(row["DOSE_1_COV"]):
            return "Dose 1"
        if row["VACINA_COV"] == 2:
            return "Não Vacinado"
        return "Ignorado"

    covid_schema = df.apply(get_last_dose, axis=1).value_counts().to_dict()

    return sanitize_data({"gripe": gripe_schema_readable, "covid_detailed": covid_schema})


@app.get("/citizen_bootstrap")
def citizen_bootstrap(
    profile: Annotated[list[str] | None, Query()] = None,
    race: Annotated[list[str] | None, Query()] = None,
):
    """Bootstrap de dados do cidadão com filtros hierárquicos e multi-seleção."""
    df = get_df()
    df_filtered = apply_citizen_filters(df, profile, race)

    valid_profiles = [p for p in (profile or []) if p]
    heatmap_profile = valid_profiles[0] if len(valid_profiles) == 1 else "all"

    return sanitize_data(
        {
            "citizen_profiles": compute_citizen_profile_tree(df_filtered),
            "citizen_pyramid": compute_citizen_pyramid(df_filtered),
            "race_profile": compute_race_profile(df_filtered),
            "schooling_profile": compute_schooling_profile(df_filtered),
            "symptoms_signature": compute_symptoms_signature(df_filtered, heatmap_profile),
            "risk_factors_full": compute_risk_factors_full_profile(df_filtered),
        }
    )


@app.get("/vaccine_survival")
def vaccine_survival(
    profile: Annotated[list[str] | None, Query()] = None,
    race: Annotated[list[str] | None, Query()] = None,
):
    """Calcula as curvas de sobrevivência Kaplan-Meier com filtros."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    if df.empty:
        return {"covid": {}, "gripe": {}}

    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df["LAST_COV_DATE"] = df[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

    return sanitize_data(
        {
            "covid": compute_vaccine_survival(df, "LAST_COV_DATE"),
            "gripe": compute_vaccine_survival(df, "DT_UT_DOSE"),
        }
    )


@app.get("/laboratory_network")
def laboratory_network():
    df = get_df()
    if df.empty:
        return {}
    return sanitize_data(compute_laboratory_network_summary(df))


@app.get("/context_trends")
def context_trends(
    key: str, last_n_weeks: int = 26, weeks_to_predict: int = 4, lookback_weeks: int = 8
):
    df = get_df()
    if df.empty:
        return {"history": [], "forecast": []}
    if key.startswith("BAIRRO::"):
        df = df[df["BAIRRO_REF"] == key.split("::")[1]]
    elif key.startswith("ZONA::"):
        df = df[df["ZONA"].str.capitalize() == key.split("::")[1].capitalize()]
    ts = compute_time_series(df)
    lb = None if lookback_weeks == 0 else lookback_weeks
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict, lookback_weeks=lb)
    result["history"] = result["history"][-last_n_weeks:]
    return sanitize_data(result)


@app.get("/geo/macrosector_heatpoints")
def macrosector_heatpoints(zone: str = "Rural", min_cases: int = 1):
    from srag.data.geospatial import build_macrosector_heatpoints

    df = get_df()
    if df.empty:
        return {"available": False, "points": []}
    result = build_macrosector_heatpoints(df, "data/mossoro_bairros.geojson", zone, min_cases)
    return sanitize_data(result)


@app.get("/geo/rural_heatpoints")
def rural_heatpoints(min_cases: int = 1):
    """Distribuição simples dos casos rurais em 4 setores cardeais (N/S/L/O).

    - Rural = ZONA/CS_ZONA normalizado como "RURAL".
    - Sem centroides ou pontos artificiais; apenas contagens por setor para tooltip.
    - Usa a mesma base urbana: tudo que não é bairro urbano (geojson) é rural; setores são quadrantes do bbox municipal.
    """
    from srag.data.geospatial import _feature_centroid, get_municipality_boundary, _iter_coords

    bairros_geo_path = Path("data/mossoro_bairros.geojson")

    df = get_df()
    if df.empty:
        return {"available": False, "sectors": [], "center": None}

    work = df.copy()
    if "ZONA" not in work.columns and "CS_ZONA" not in work.columns:
        return {"available": False, "sectors": [], "center": None}

    work["zona_norm"] = work.get("ZONA", work.get("CS_ZONA")).map(
        lambda v: str(v).strip().upper() if pd.notna(v) else ""
    )
    work = work[work["zona_norm"] == "RURAL"]
    total_rural = int(len(work))

    boundary = get_municipality_boundary()
    center_features = boundary.get("features", []) if isinstance(boundary, dict) else []
    bbox_center = None

    # Prefer rural GeoJSON center to focus the map on the rural area
    rural_geo_path = Path("data/mossoro_rural.geojson")
    if rural_geo_path.exists():
        try:
            rural_geo = json.loads(rural_geo_path.read_text())
            rural_feat = rural_geo.get("features", [])[0]
            bbox_center = _feature_centroid(rural_feat)
        except Exception:
            bbox_center = None

    city_centroid = bbox_center or (
        _feature_centroid(center_features[0]) if center_features else (-37.34, -5.18)
    )
    cx, cy = city_centroid

    if total_rural < min_cases:
        return sanitize_data({"available": True, "sectors": [], "center": {"lat": cy, "lon": cx}})

    base = total_rural // 4
    remainder = total_rural % 4
    sector_order = ["N", "S", "L", "O"]
    sectors: list[dict[str, Any]] = []

    for idx, sec in enumerate(sector_order):
        count = base + (1 if idx < remainder else 0)
        sectors.append({"sector": sec, "count": count})

    return sanitize_data(
        {
            "available": True,
            "center": {"lat": round(cy, 6), "lon": round(cx, 6)},
            "sectors": sectors,
        }
    )


@app.get("/geo/municipality_boundary")
def get_geo_boundary():
    path = Path("data/processed/mossoro_municipality_boundary.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}


@app.get("/geo/rural_sectors")
def get_rural_sectors():
    """Retorna o GeoJSON real da zona rural dividido em 4 setores (N/S/L/O)."""
    path = Path("data/geojson/mossoro_rural_sectors.geojson")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    
    # Fallback para o antigo modo sintético caso o arquivo não exista
    from srag.data.geospatial import get_municipality_boundary, _iter_coords

    bairros_geo_path = Path("data/geojson/mossoro_bairros.geojson")

    # Preferir bbox dos bairros para alinhar rural/urbano; fallback para boundary municipal
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

    def rect(coords_list: list[tuple[float, float]]):
        return {
            "type": "Polygon",
            "coordinates": [[list(pt) for pt in coords_list + [coords_list[0]]]],
        }

    sectors = [
        {
            "sector": "N",
            "geometry": rect([(min_x, cy), (max_x, cy), (max_x, max_y), (min_x, max_y)]),
        },
        {
            "sector": "S",
            "geometry": rect([(min_x, min_y), (max_x, min_y), (max_x, cy), (min_x, cy)]),
        },
        {
            "sector": "L",
            "geometry": rect([(cx, min_y), (max_x, min_y), (max_x, max_y), (cx, max_y)]),
        },
        {
            "sector": "O",
            "geometry": rect([(min_x, min_y), (cx, min_y), (cx, max_y), (min_x, max_y)]),
        },
    ]

    feature_collection = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"sector": s["sector"]},
                "geometry": s["geometry"],
            }
            for s in sectors
        ],
    }

    return feature_collection


@app.get("/geo/bairros_choropleth")
def get_geo_bairros():
    path = Path("data/geojson/mossoro_bairros.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}


@app.get("/timeline_agg")
def timeline_agg(
    virus: str = "covid",
    profile: Annotated[list[str] | None, Query()] = None,
    race: Annotated[list[str] | None, Query()] = None,
):
    """Calcula as medianas de tempo com suporte a multi-seleção."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    df = df.copy()
    if df.empty:
        return []

    # 1. Datas fundamentais com parser robusto
    for col in ["DT_SIN_PRI", "DT_INTERNA", "DT_EVOLUCA"]:
        df[col] = pd.to_datetime(df[col], dayfirst=True, format="mixed", errors="coerce")

    if virus == "covid":
        dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
        df["DT_LAST_DOSE"] = df[dose_cols].apply(pd.to_datetime, errors="coerce").max(axis=1)

        def get_covid_label(row):
            if pd.notna(row["DOS_RE_BI"]):
                return "bivalente"
            if pd.notna(row["DOSE_2REF"]):
                return "reforco_2"
            if pd.notna(row["DOSE_REF"]):
                return "reforco_1"
            if pd.notna(row["DOSE_2_COV"]):
                return "completo"
            if pd.notna(row["DOSE_1_COV"]):
                return "dose_1"
            if row["VACINA_COV"] == 2:
                return "nao_vacinado"
            return "ignorado"

        df["perfil"] = df.apply(get_covid_label, axis=1)
    else:
        df["DT_LAST_DOSE"] = pd.to_datetime(
            df["DT_UT_DOSE"], dayfirst=True, format="mixed", errors="coerce"
        )
        df["perfil"] = df.apply(classificar_status_gripe, axis=1)

    # 2. Deltas (em dias)
    df["delta_dose"] = (df["DT_LAST_DOSE"] - df["DT_SIN_PRI"]).dt.days
    df["delta_interna"] = (df["DT_INTERNA"] - df["DT_SIN_PRI"]).dt.days
    df["delta_desfecho"] = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days

    # 3. Agregação
    results = []
    profiles = df["perfil"].unique()

    for p in profiles:
        if p in ["ignorado", "inconsistencia"]:
            continue

        sub = df[df["perfil"] == p]
        if sub.empty:
            continue

        # Limitamos a mediana da dose a no máximo 180 dias atrás para manter o foco clínico
        d_dose = sub[(sub["delta_dose"] <= 0) & (sub["delta_dose"] >= -180)]["delta_dose"].median()
        d_interna = sub[(sub["delta_interna"] >= 0) & (sub["delta_interna"] <= 60)][
            "delta_interna"
        ].median()
        d_desfecho = sub[(sub["delta_desfecho"] >= 0) & (sub["delta_desfecho"] <= 90)][
            "delta_desfecho"
        ].median()

        total_valid = sub["EVOLUCAO"].dropna().isin([1, 2]).sum()
        obito_pct = (sub["EVOLUCAO"] == 2).sum() / total_valid if total_valid > 0 else 0
        cura_pct = (sub["EVOLUCAO"] == 1).sum() / total_valid if total_valid > 0 else 0

        severity_score = obito_pct * 100 + (1 if p == "nao_vacinado" else 0)

        results.append(
            {
                "perfil": p,
                "status_key": p,
                "mediana_dose_sintoma": float(d_dose) if pd.notna(d_dose) else None,
                "mediana_sintoma_internacao": float(d_interna) if pd.notna(d_interna) else 0,
                "mediana_internacao_desfecho": float(d_desfecho) if pd.notna(d_desfecho) else 0,
                "taxa_cura": float(round(cura_pct, 2)),
                "taxa_obito": float(round(obito_pct, 2)),
                "severity_score": float(severity_score),
                "count": int(len(sub)),
            }
        )

    return sanitize_data(results)


@app.get("/icu_bottleneck")
def icu_bottleneck():
    """Calcula o tempo de espera (em dias) entre a internação e a entrada na UTI por mês."""
    df = get_df()
    if df.empty:
        return []

    df_uti = df[df["UTI"] == 1].copy()

    df_uti["DT_INTERNA"] = pd.to_datetime(df_uti["DT_INTERNA"], errors="coerce")
    df_uti["DT_ENTUTI"] = pd.to_datetime(df_uti["DT_ENTUTI"], errors="coerce")

    df_uti = df_uti.dropna(subset=["DT_INTERNA", "DT_ENTUTI"])

    df_uti["wait_days"] = (df_uti["DT_ENTUTI"] - df_uti["DT_INTERNA"]).dt.days

    # Filter clinically valid range
    df_valid = df_uti[(df_uti["wait_days"] >= 0) & (df_uti["wait_days"] <= 30)].copy()

    # Return raw date for flexible frontend grouping
    df_valid["date"] = df_valid["DT_INTERNA"].dt.strftime("%Y-%m-%d")

    df_valid = df_valid.sort_values(by="date")

    result = df_valid[["date", "wait_days"]].to_dict(orient="records")
    return sanitize_data(result)
