from datetime import date

import numpy as np
import pandas as pd

from srag.data.analytics import (
    apply_citizen_filters,
    categorize_age,
    classificar_status_gripe,
    compute_severity_metrics,
    compute_virus_distribution,
    compute_alert_thresholds,
    compute_time_series_by_virus,
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

def test_compute_alert_thresholds():
    # 10 weeks with 10 cases each
    from datetime import timedelta
    data = []
    start_date = date(2024, 1, 1)
    for i in range(1, 11):
        data.extend([{
            "DT_SIN_PRI": start_date + timedelta(weeks=i),
            "CLASSI_FIN": 5
        }] * i) # Increasing volume
    df = pd.DataFrame(data)
    thresholds = compute_alert_thresholds(df)
    assert "medium" in thresholds
    assert "high" in thresholds
    assert thresholds["high"] > thresholds["medium"]

def test_compute_time_series_by_virus():
    df = pd.DataFrame({
        "DT_SIN_PRI": [date(2024, 1, 1), date(2024, 1, 1), date(2024, 1, 10)],
        "CLASSI_FIN": [5, 1, 5]
    })
    ts = compute_time_series_by_virus(df)
    assert len(ts) == 3 # (Week 1, COVID), (Week 1, Flu), (Week 2, COVID)
    assert "virus" in ts.columns
    assert "count" in ts.columns
