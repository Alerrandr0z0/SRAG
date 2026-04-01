import pandas as pd
import numpy as np
from datetime import date
from srag.data.analytics import (
    categorize_age,
    compute_virus_distribution,
    compute_virus_detailed_distribution,
    compute_severity_metrics,
    apply_citizen_filters,
    classificar_status_gripe,
)

def test_categorize_age():
    assert categorize_age(0.5) == "0-1 ano"
    assert categorize_age(1.9) == "0-1 ano"
    assert categorize_age(2) == "2-4 anos"
    assert categorize_age(5) == "5-9 anos"
    assert categorize_age(15) == "10-19 anos"
    assert categorize_age(30) == "20-39 anos"
    assert categorize_age(50) == "40-59 anos"
    assert categorize_age(70) == "60+ anos"

def test_compute_virus_distribution_empty():
    df = pd.DataFrame()
    assert compute_virus_distribution(df).empty

def test_compute_virus_distribution():
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 5, 5, 2, 4, None],
        "PCR_VSR": [0, 0, 0, 0, 0, 1] # One VSR
    })
    result = compute_virus_distribution(df)
    # VSR has priority 0, so it should be first
    assert result.iloc[0]["virus"] == "VSR"
    assert result[result["virus"] == "COVID-19"]["count"].iloc[0] == 2
    assert result[result["virus"] == "Influenza"]["count"].iloc[0] == 1

def test_compute_severity_metrics():
    df = pd.DataFrame({
        "UTI": [1, 2, 1, 9, 1], # 3 UTI
        "EVOLUCAO": [1, 2, 1, 2, 3], # 2 Deaths (2)
    })
    metrics = compute_severity_metrics(df)
    assert metrics["total"] == 5
    assert metrics["uti_rate"] == 60.0 # 3/5
    assert metrics["death_rate"] == 40.0 # 2/5

def test_apply_citizen_filters_profile():
    df = pd.DataFrame({
        "NU_IDADE_N": [5, 15, 30, 70],
        "TP_IDADE": [3, 3, 3, 3],
        "CS_RACA": [1, 2, 1, 2]
    })
    # Filter only children and elderly
    filtered = apply_citizen_filters(df, profiles=["crianca", "idoso"])
    assert len(filtered) == 2
    assert 5 in filtered["NU_IDADE_N"].values
    assert 70 in filtered["NU_IDADE_N"].values

def test_classificar_status_gripe_nao_vacinado():
    row = {"VACINA": 2, "DT_UT_DOSE": np.nan, "DT_SIN_PRI": date(2024, 5, 1)}
    assert classificar_status_gripe(row) == "nao_vacinado"

def test_classificar_status_gripe_protegido():
    # Symptom in 2024 (Campaign starts 2024-03-25)
    # Vaccine in 2024-04-01 -> Protected
    row = {
        "VACINA": 1, 
        "DT_UT_DOSE": date(2024, 4, 1), 
        "DT_SIN_PRI": date(2024, 5, 1),
        "NU_IDADE_N": 40,
        "TP_IDADE": 3
    }
    assert classificar_status_gripe(row) == "protegido"

def test_classificar_status_gripe_vencida():
    # Symptom in 2024
    # Vaccine from 2023 -> Outdated
    row = {
        "VACINA": 1, 
        "DT_UT_DOSE": date(2023, 5, 1), 
        "DT_SIN_PRI": date(2024, 5, 1),
        "NU_IDADE_N": 40,
        "TP_IDADE": 3
    }
    assert classificar_status_gripe(row) == "vencida"
