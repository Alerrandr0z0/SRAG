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
    compute_territory_entities_by_zone
)
from lifelines import KaplanMeierFitter
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
    if _cache["df"] is not None and _cache["loaded_at"] and (now - _cache["loaded_at"]) < timedelta(minutes=15):
        return _cache["df"]
    
    try:
        CORE_COLS = [
            "DT_NOTIFIC", "DT_SIN_PRI", "ID_MUNICIP", "ID_MN_RESI", "CLASSI_FIN", "ID_UNIDADE",
            "BAIRRO_REF", "ZONA", "CS_ZONA", "NU_IDADE_N", "TP_IDADE", "IDADE_ANOS", "CS_SEXO", "CS_RACA", "CS_ESCOL_N",
            "EVOLUCAO", "UTI", "HOSPITAL", "SUPORT_VEN", "NOSOCOMIAL", "CS_GESTANT", "PUERPERA",
            "FEBRE", "TOSSE", "GARGANTA", "DISPNEIA", "DESC_RESP", "SATURACAO", "DIARREIA", "VOMITO", "DOR_ABD", "FADIGA", "PERD_OLFT", "PERD_PALA", "OUTRO_SIN",
            "PCR_VSR", "AN_VSR", "PCR_SARS2", "AN_SARS2", "TP_FLU_PCR", "TP_FLU_AN", "PCR_RESUL", "RES_AN", "DT_PCR", "DT_RES_AN", "DT_COLETA", "CO_LAB_AN",
            "ASMA", "DIABETES", "OBESIDADE", "CARDIOPATI", "PNEUMOPATI", "RENAL", "IMUNODEPRE", "NEUROLOGIC", "HEMATOLOGI", "HEPATICA", "SIND_DOWN", "TABAG", "OUT_MORBI",
            "VACINA", "DT_UT_DOSE", "MAE_VAC", "DT_VAC_MAE", "DT_DOSEUNI", "DT_1_DOSE", "DT_2_DOSE",
            "VACINA_COV", "DOSE_1_COV", "DOSE_2_COV", "DOSE_REF", "DOSE_2REF", "DOSE_ADIC", "DOS_RE_BI", "DT_INTERNA", "DT_EVOLUCA", "DT_ENTUTI"
        ]
        cols_str = ", ".join(CORE_COLS)
        df = pd.read_sql(f"SELECT {cols_str} FROM casos_srag", engine)
        date_cols = ["DT_NOTIFIC", "DT_SIN_PRI", "DT_INTERNA", "DT_ENTUTI", "DT_EVOLUCA", "DT_COLETA", "DT_PCR", "DT_RES_AN", "DT_UT_DOSE", "DOSE_1_COV", "DOSE_2_COV", "DOSE_REF", "DOSE_2REF", "DOS_RE_BI"]
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
    if df.empty: return {"uti_rate": 0.0, "death_rate": 0.0, "total": 0}
    
    total = len(df)
    uti_cases = (df["UTI"] == 1).sum()
    death_cases = (df["EVOLUCAO"] == 2).sum()
    
    return {
        "uti_rate": round((uti_cases / total) * 100, 2) if total > 0 else 0,
        "death_rate": round((death_cases / total) * 100, 2) if total > 0 else 0,
        "total": total
    }

@app.get("/trends")
def get_trends(last_n_weeks: int = 26, weeks_to_predict: int = 4, lookback_weeks: int = 8):
    df = get_df()
    if df.empty: return {"history": [], "forecast": []}
    
    ts = compute_time_series(df)
    lb = None if lookback_weeks == 0 else lookback_weeks
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict, lookback_weeks=lb)
    
    # Slice history
    result["history"] = result["history"][-last_n_weeks:]
    return sanitize_data(result)

@app.get("/virus")
def get_virus(detail_level: str = "summary"):
    df = get_df()
    if df.empty: return []
    
    if detail_level == "detailed":
        dist = compute_virus_detailed_distribution(df)
    else:
        dist = compute_virus_distribution(df)
        
    return sanitize_data(dist.to_dict(orient="records"))

@app.get("/territory_bootstrap")
def territory_bootstrap(min_cases: int = 5, entities_min_cases: int = 3, entities_limit: int = 40):
    df = get_df()
    if df.empty: return {}
    
    bairros_df = compute_territory_distribution(df, min_cases=0)
    bairros_dict = dict(zip(bairros_df["BAIRRO_REF"].str.upper(), bairros_df["count"]))
    
    # 1. GeoJSON Base
    boundary_path = Path("data/processed/mossoro_municipality_boundary.geojson")
    boundary = json.loads(boundary_path.read_text()) if boundary_path.exists() else {"type": "FeatureCollection", "features": []}
    
    # 2. Choropleth (Urban)
    bairros_geo_path = Path("data/mossoro_bairros.geojson")
    if bairros_geo_path.exists():
        bairros_geo = json.loads(bairros_geo_path.read_text())
        for feature in bairros_geo["features"]:
            name = feature["properties"].get("bairro", "").upper()
            feature["properties"]["count"] = bairros_dict.get(name, 0)
        choropleth = {"available": True, "feature_collection": bairros_geo}
    else:
        choropleth = {"available": False, "feature_collection": {"type": "FeatureCollection", "features": []}}
        
    # 3. Territory Entities (for trends context)
    entities = compute_territory_entities_by_zone(df, entities_min_cases, entities_limit)
    
    return sanitize_data({
        "territory": {
            "bairros": bairros_df[bairros_df["count"] >= min_cases].to_dict(orient="records"),
            "zonas": compute_zone_distribution(df).to_dict(orient="records")
        },
        "boundary": boundary,
        "choropleth": choropleth,
        "territory_entities": entities
    })

@app.get("/units")
def get_units(min_cases: int = 3):
    df = get_df()
    if df.empty: return []
    dist = compute_unit_distribution(df, min_cases=min_cases)
    return sanitize_data(dist.to_dict(orient="records"))

@app.get("/clinical_flow")
def clinical_flow():
    """Analisa a jornada clínica completa para o gráfico Sankey com porcentagens."""
    df = get_df()
    if df.empty: return {"nodes": [], "links": []}
    
    # 1. Definir Labels das Etapas
    df = df.copy()
    df["S_ORIGEM"] = df["NOSOCOMIAL"].map({1: "Infecção Hospitalar", 2: "Comunitária"}).fillna("Origem (Ignorado)")
    df["S_UTI"] = df["UTI"].map({1: "Internado em UTI", 2: "Internado em Enfermaria"}).fillna("Internação (Ignorado)")
    df["S_VENT"] = df["SUPORT_VEN"].map({1: "Vent. Invasiva", 2: "Vent. Não Inv.", 3: "Sem Suporte"}).fillna("Suporte (Ignorado)")
    df["S_FIM"] = df["EVOLUCAO"].map({1: "Cura", 2: "Óbito"}).fillna("Em Aberto")

    links_raw = []
    
    # Função auxiliar para gerar links com porcentagem relativa à origem
    def add_flow(df_step, col_source, col_target):
        counts = df_step.groupby([col_source, col_target]).size().reset_index(name="value")
        # Soma total por nó de origem para calcular a % relativa
        source_totals = counts.groupby(col_source)["value"].transform("sum")
        counts["pct"] = (counts["value"] / source_totals * 100).round(1)
        for _, r in counts.iterrows():
            links_raw.append({
                "source": r[col_source],
                "target": r[col_target],
                "value": int(r["value"]),
                "pct": float(r["pct"])
            })

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
    if df.empty: return []
    
    try:
        df["DT_INTERNA"] = pd.to_datetime(df["DT_INTERNA"], errors='coerce')
        df["DT_EVOLUCA"] = pd.to_datetime(df["DT_EVOLUCA"], errors='coerce')
        dur = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days
        return dur[(dur >= 0) & (dur <= 90)].dropna().tolist()
    except Exception as e:
        print(f"Erro no cálculo de duração: {e}")
        return []

CAMPANHAS_GRIPE = {
    2019: pd.to_datetime("2019-04-10").date(),
    2020: pd.to_datetime("2020-03-23").date(),
    2021: pd.to_datetime("2021-04-12").date(),
    2022: pd.to_datetime("2022-04-04").date(),
    2023: pd.to_datetime("2023-04-10").date(),
    2024: pd.to_datetime("2024-03-25").date(),
    2025: pd.to_datetime("2025-03-20").date()
}

def classificar_status_gripe(row):
    vacina = row.get("VACINA")
    dt_dose = row.get("DT_UT_DOSE")
    dt_sintoma = row.get("DT_SIN_PRI")
    
    try: vacina = float(vacina) if pd.notna(vacina) else np.nan
    except: vacina = np.nan
        
    nu_idade = float(row.get("NU_IDADE_N", 0)) if pd.notna(row.get("NU_IDADE_N")) else 0
    is_menor_6m = False
    is_crianca_8y = False
    tp_idade = row.get("TP_IDADE")
    
    if pd.notna(tp_idade):
        if tp_idade == 1: is_menor_6m = True 
        elif tp_idade == 2:
            if nu_idade < 6: is_menor_6m = True
            else: is_crianca_8y = True # Entre 6 meses e 1 ano
        elif tp_idade == 3 and nu_idade <= 8:
            is_crianca_8y = True
    else:
        if (1000 <= nu_idade <= 1365) or (2000 <= nu_idade < 2006):
            is_menor_6m = True
        elif (2006 <= nu_idade <= 2011) or (3000 <= nu_idade <= 3008):
            is_crianca_8y = True

    # 1. Tratar menores de 6 meses (Vacina da Mãe)
    if is_menor_6m:
        mae_vac = row.get("MAE_VAC")
        dt_vac_mae = row.get("DT_VAC_MAE")
        try: vacina = float(mae_vac) if pd.notna(mae_vac) else vacina
        except: pass
        dt_dose = dt_vac_mae if pd.notna(dt_vac_mae) else dt_dose

    # 2. Tratar crianças 6m - 8y (Doses específicas)
    elif is_crianca_8y:
        # Prioridade para doses específicas do calendário infantil
        if pd.notna(row.get("DT_2_DOSE")): 
            dt_dose = row.get("DT_2_DOSE")
            label_prefix = "dose_2"
        elif pd.notna(row.get("DT_1_DOSE")): 
            dt_dose = row.get("DT_1_DOSE")
            label_prefix = "dose_1"
        elif pd.notna(row.get("DT_DOSEUNI")): 
            dt_dose = row.get("DT_DOSEUNI")
            label_prefix = "dose_unica"
        else:
            label_prefix = "protegido"
    else:
        label_prefix = "protegido"

    if pd.isna(vacina) or vacina == 9:
        return "ignorado"
        
    if vacina == 2:
        if pd.notna(dt_dose): return "inconsistencia"
        return "nao_vacinado"
        
    if vacina == 1:
        if pd.isna(dt_dose): return "ignorado"
            
        dt_dose_val = dt_dose.date() if isinstance(dt_dose, pd.Timestamp) else dt_dose
        dt_sintoma_val = dt_sintoma.date() if isinstance(dt_sintoma, pd.Timestamp) else dt_sintoma
            
        if pd.isna(dt_sintoma_val): return "ignorado"
            
        if isinstance(dt_dose_val, str):
            try: dt_dose_val = pd.to_datetime(dt_dose_val, dayfirst=True, format='mixed').date()
            except: return "ignorado"
                
        if isinstance(dt_sintoma_val, str):
            try: dt_sintoma_val = pd.to_datetime(dt_sintoma_val, dayfirst=True, format='mixed').date()
            except: return "ignorado"
            
        if not hasattr(dt_dose_val, "year") or not hasattr(dt_sintoma_val, "year"):
            return "ignorado"

        if dt_dose_val > dt_sintoma_val:
            return "inconsistencia"
            
        ano_sintoma = getattr(dt_sintoma_val, "year", None)
        if not ano_sintoma: return "ignorado"
        
        inicio_campanha = CAMPANHAS_GRIPE.get(ano_sintoma, pd.to_datetime(f"{ano_sintoma}-04-01").date())
        
        if dt_dose_val >= inicio_campanha:
            # Retorna o prefixo específico se for criança, senão apenas 'protegido'
            return label_prefix if is_crianca_8y else "protegido"
        else:
            return "vencida"

    return "ignorado"

def apply_citizen_filters(df: pd.DataFrame, profiles: list[str] = None, races: list[str] = None):
    """Aplica a hierarquia de filtros com suporte a multi-seleção."""
    if df.empty: return df
    
    # Limpar strings vazias que podem vir do frontend
    profiles = [p for p in (profiles or []) if p]
    races = [r for r in (races or []) if r]
    
    # 1. Filtro de Macro Perfis
    if profiles:
        from srag.data.analytics import _age_years
        age = _age_years(df)
        masks = []
        if "crianca" in profiles: masks.append(age < 12)
        if "adolescente" in profiles: masks.append((age >= 12) & (age < 20))
        if "adulto" in profiles: masks.append((age >= 20) & (age < 60))
        if "idoso" in profiles: masks.append(age >= 60)
        
        if masks:
            df = df[pd.concat(masks, axis=1).any(axis=1)]
        
    # 2. Filtro de Raças/Cores
    if races:
        race_map = {"Branca": 1, "Preta": 2, "Amarela": 3, "Parda": 4, "Indígena": 5}
        codes = [race_map.get(r) for r in races if r in race_map]
        if codes:
            df = df[df["CS_RACA"].isin(codes)]
        
    return df

@app.get("/vaccination_profile")
def vaccination_profile(profile: Annotated[list[str] | None, Query()] = None, 
                        race: Annotated[list[str] | None, Query()] = None):
    """Analisa o esquema vacinal detalhado de COVID-19 e Influenza com filtros."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    if df.empty: return {}
    
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
        "inconsistencia": "Inconsistência"
    }
    # Para o gráfico de barras lateral (Legend) usamos labels legíveis
    gripe_schema_readable = {label_map.get(k, k): v for k, v in gripe_schema.items()}
    for label in label_map.values():
        if label not in gripe_schema_readable: gripe_schema_readable[label] = 0
    
    # 2. Esquema Detalhado COVID-19
    def get_last_dose(row):
        if pd.notna(row["DOS_RE_BI"]): return "Bivalente"
        if pd.notna(row["DOSE_2REF"]): return "2º Reforço"
        if pd.notna(row["DOSE_REF"]):  return "1º Reforço"
        if pd.notna(row["DOSE_2_COV"]): return "Esquema Completo"
        if pd.notna(row["DOSE_1_COV"]): return "Dose 1"
        if row["VACINA_COV"] == 2: return "Não Vacinado"
        return "Ignorado"

    covid_schema = df.apply(get_last_dose, axis=1).value_counts().to_dict()
    
    return sanitize_data({
        "gripe": gripe_schema_readable,
        "covid_detailed": covid_schema
    })

@app.get("/citizen_bootstrap")
def citizen_bootstrap(profile: Annotated[list[str] | None, Query()] = None, 
                      race: Annotated[list[str] | None, Query()] = None):
    """Bootstrap de dados do cidadão com filtros hierárquicos e multi-seleção."""
    df = get_df()
    df_filtered = apply_citizen_filters(df, profile, race)
    
    valid_profiles = [p for p in (profile or []) if p]
    heatmap_profile = valid_profiles[0] if len(valid_profiles) == 1 else "all"
    
    return sanitize_data({
        "citizen_profiles": compute_citizen_profile_tree(df_filtered), 
        "citizen_pyramid": compute_citizen_pyramid(df_filtered),
        "race_profile": compute_race_profile(df_filtered), 
        "schooling_profile": compute_schooling_profile(df_filtered),
        "symptoms_signature": compute_symptoms_signature(df_filtered, heatmap_profile), 
        "risk_factors_full": compute_risk_factors_full_profile(df_filtered)
    })

@app.get("/vaccine_survival")
def vaccine_survival(profile: Annotated[list[str] | None, Query()] = None, 
                     race: Annotated[list[str] | None, Query()] = None):
    """Calcula as curvas de sobrevivência Kaplan-Meier com filtros."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    if df.empty: return {"covid": {}, "gripe": {}}
    
    def get_km_data(vax_date_col):
        km_df = pd.DataFrame({
            "last_vax": pd.to_datetime(df[vax_date_col], errors='coerce'),
            "symptoms": pd.to_datetime(df["DT_SIN_PRI"], errors='coerce')
        }).dropna()
        km_df["months"] = (km_df["symptoms"] - km_df["last_vax"]).dt.days / 30.44
        km_df = km_df[(km_df["months"] >= 0) & (km_df["months"] <= 24)]
        if km_df.empty: return {}
        kmf = KaplanMeierFitter()
        kmf.fit(durations=km_df["months"], event_observed=np.ones(len(km_df)))
        surv = kmf.survival_function_.reset_index()
        ci = kmf.confidence_interval_.reset_index()
        return {
            "timeline": surv.iloc[:, 0].tolist(),
            "survival": (surv.iloc[:, 1] * 100).tolist(),
            "ci_upper": (ci.iloc[:, 1] * 100).tolist(),
            "ci_lower": (ci.iloc[:, 2] * 100).tolist()
        }

    dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
    df["LAST_COV_DATE"] = df[dose_cols].apply(pd.to_datetime, errors='coerce').max(axis=1)
    
    return sanitize_data({
        "covid": get_km_data("LAST_COV_DATE"),
        "gripe": get_km_data("DT_UT_DOSE")
    })

@app.get("/laboratory_network")
def laboratory_network():
    df = get_df()
    if df.empty: return {}
    return sanitize_data(compute_laboratory_network_summary(df))

@app.get("/context_trends")
def context_trends(key: str, last_n_weeks: int = 26, weeks_to_predict: int = 4, lookback_weeks: int = 8):
    df = get_df()
    if df.empty: return {"history": [], "forecast": []}
    if key.startswith("BAIRRO::"): df = df[df["BAIRRO_REF"] == key.split("::")[1]]
    elif key.startswith("ZONA::"): df = df[df["ZONA"].str.capitalize() == key.split("::")[1].capitalize()]
    ts = compute_time_series(df); lb = None if lookback_weeks == 0 else lookback_weeks
    result = predict_next_weeks(ts, weeks_to_predict=weeks_to_predict, lookback_weeks=lb)
    result["history"] = result["history"][-last_n_weeks:]
    return sanitize_data(result)

@app.get("/geo/macrosector_heatpoints")
def macrosector_heatpoints(zone: str = "Rural", min_cases: int = 1):
    return {"available": False, "points": []}

@app.get("/geo/municipality_boundary")
def get_geo_boundary():
    path = Path("data/processed/mossoro_municipality_boundary.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}

@app.get("/geo/bairros_choropleth")
def get_geo_bairros():
    path = Path("data/mossoro_bairros.geojson")
    return FileResponse(path) if path.exists() else {"error": "Not found"}

@app.get("/timeline_agg")
def timeline_agg(virus: str = "covid", 
                 profile: Annotated[list[str] | None, Query()] = None, 
                 race: Annotated[list[str] | None, Query()] = None):
    """Calcula as medianas de tempo com suporte a multi-seleção."""
    df = get_df()
    df = apply_citizen_filters(df, profile, race)
    df = df.copy()
    if df.empty: return []
    
    # 1. Datas fundamentais com parser robusto
    for col in ["DT_SIN_PRI", "DT_INTERNA", "DT_EVOLUCA"]:
        df[col] = pd.to_datetime(df[col], dayfirst=True, format='mixed', errors='coerce')
    
    if virus == "covid":
        dose_cols = ["DOS_RE_BI", "DOSE_2REF", "DOSE_REF", "DOSE_2_COV", "DOSE_1_COV"]
        df["DT_LAST_DOSE"] = df[dose_cols].apply(pd.to_datetime, errors='coerce').max(axis=1)
        
        def get_covid_label(row):
            if pd.notna(row["DOS_RE_BI"]): return "bivalente"
            if pd.notna(row["DOSE_2REF"]): return "reforco_2"
            if pd.notna(row["DOSE_REF"]):  return "reforco_1"
            if pd.notna(row["DOSE_2_COV"]): return "completo"
            if pd.notna(row["DOSE_1_COV"]): return "dose_1"
            if row["VACINA_COV"] == 2: return "nao_vacinado"
            return "ignorado"
        df["perfil"] = df.apply(get_covid_label, axis=1)
    else:
        df["DT_LAST_DOSE"] = pd.to_datetime(df["DT_UT_DOSE"], dayfirst=True, format='mixed', errors='coerce')
        df["perfil"] = df.apply(classificar_status_gripe, axis=1)

    # 2. Deltas (em dias)
    df["delta_dose"] = (df["DT_LAST_DOSE"] - df["DT_SIN_PRI"]).dt.days
    df["delta_interna"] = (df["DT_INTERNA"] - df["DT_SIN_PRI"]).dt.days
    df["delta_desfecho"] = (df["DT_EVOLUCA"] - df["DT_INTERNA"]).dt.days
    
    # 3. Agregação
    results = []
    profiles = df["perfil"].unique()
    
    for p in profiles:
        if p in ["ignorado", "inconsistencia"]: continue
        
        sub = df[df["perfil"] == p]
        if sub.empty: continue
        
        # Limitamos a mediana da dose a no máximo 180 dias atrás para manter o foco clínico
        d_dose = sub[(sub["delta_dose"] <= 0) & (sub["delta_dose"] >= -180)]["delta_dose"].median()
        d_interna = sub[(sub["delta_interna"] >= 0) & (sub["delta_interna"] <= 60)]["delta_interna"].median()
        d_desfecho = sub[(sub["delta_desfecho"] >= 0) & (sub["delta_desfecho"] <= 90)]["delta_desfecho"].median()
        
        total_valid = sub["EVOLUCAO"].dropna().isin([1, 2]).sum()
        obito_pct = (sub["EVOLUCAO"] == 2).sum() / total_valid if total_valid > 0 else 0
        cura_pct = (sub["EVOLUCAO"] == 1).sum() / total_valid if total_valid > 0 else 0
        
        severity_score = obito_pct * 100 + (1 if p == "nao_vacinado" else 0)

        results.append({
            "perfil": p,
            "status_key": p, 
            "mediana_dose_sintoma": float(d_dose) if pd.notna(d_dose) else None,
            "mediana_sintoma_internacao": float(d_interna) if pd.notna(d_interna) else 0,
            "mediana_internacao_desfecho": float(d_desfecho) if pd.notna(d_desfecho) else 0,
            "taxa_cura": float(round(cura_pct, 2)),
            "taxa_obito": float(round(obito_pct, 2)),
            "severity_score": float(severity_score),
            "count": int(len(sub))
        })
        
    return sanitize_data(results)

@app.get("/icu_bottleneck")
def icu_bottleneck():
    """Calcula o tempo de espera (em dias) entre a internação e a entrada na UTI por mês."""
    df = get_df()
    if df.empty: return []
    
    df_uti = df[df["UTI"] == 1].copy()
    
    df_uti["DT_INTERNA"] = pd.to_datetime(df_uti["DT_INTERNA"], errors="coerce")
    df_uti["DT_ENTUTI"] = pd.to_datetime(df_uti["DT_ENTUTI"], errors="coerce")
    
    df_uti = df_uti.dropna(subset=["DT_INTERNA", "DT_ENTUTI"])
    
    df_uti["wait_days"] = (df_uti["DT_ENTUTI"] - df_uti["DT_INTERNA"]).dt.days
    
    # Filter clinically valid range
    df_valid = df_uti[(df_uti["wait_days"] >= 0) & (df_uti["wait_days"] <= 30)].copy()
    
    # Return raw date for flexible frontend grouping
    df_valid["date"] = df_valid["DT_INTERNA"].dt.strftime('%Y-%m-%d')
    
    df_valid = df_valid.sort_values(by="date")
    
    result = df_valid[["date", "wait_days"]].to_dict(orient="records")
    return sanitize_data(result)

