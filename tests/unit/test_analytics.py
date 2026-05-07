from datetime import date

import pandas as pd

from srag.data.analytics import (
    apply_global_filters,
    categorize_age,
    classificar_status_gripe,
    compute_alert_thresholds,
    compute_clinical_timing_metrics,
    compute_severity_metrics,
    compute_symptoms_signature,
    compute_time_series_by_virus,
    compute_time_series,
    compute_virus_distribution,
    infer_etiologic_agent,
    outcome_death_mask,
    outcome_valid_mask,
)


def test_categorize_age():
    assert categorize_age(0.5) == "0-1 ano"
    assert categorize_age(1.9) == "0-1 ano"
    assert categorize_age(2) == "2-4 anos"
    assert categorize_age(5) == "5-9 anos"
    assert categorize_age(15) == "15-19 anos"
    assert categorize_age(30) == "30-39 anos"
    assert categorize_age(50) == "50-59 anos"
    assert categorize_age(70) == "70-79 anos"
    assert categorize_age(85) == "80+ anos"


def test_compute_virus_distribution_empty():
    df = pd.DataFrame()
    assert compute_virus_distribution(df).empty


def test_compute_virus_distribution():
    df = pd.DataFrame(
        {
            "CLASSI_FIN": [1, 5, 5, 2, 4, None],
            "PCR_VSR": [0, 0, 0, 0, 0, 1],  # One VSR
        }
    )
    result = compute_virus_distribution(df)
    # VSR has priority 0, so it should be first
    assert result.iloc[0]["virus"] == "VSR"
    assert result[result["virus"] == "COVID-19"]["count"].iloc[0] == 2
    assert result[result["virus"] == "Influenza"]["count"].iloc[0] == 1


def test_compute_severity_metrics():
    df = pd.DataFrame(
        {
            "UTI": [1, 2, 1, 9, 1],  # 3 UTI
            "EVOLUCAO": [1, 2, 1, 2, 3],  # code 3 must not count as death
        }
    )
    metrics = compute_severity_metrics(df)
    assert metrics["total"] == 5
    assert metrics["uti_rate"] == 60.0  # 3/5
    assert metrics["death_rate"] == 40.0  # 2/5


def test_apply_citizen_filters_profile():
    df = pd.DataFrame(
        {"NU_IDADE_N": [5, 15, 30, 70], "TP_IDADE": [3, 3, 3, 3], "CS_RACA": [1, 2, 1, 2]}
    )
    # Filter only children and elderly
    filtered = apply_global_filters(df, profiles=["crianca", "idoso"])
    assert len(filtered) == 2
    assert 5 in filtered["NU_IDADE_N"].values
    assert 70 in filtered["NU_IDADE_N"].values


def test_compute_alert_thresholds():
    # 10 weeks with 10 cases each
    from datetime import timedelta

    data = []
    start_date = date(2024, 1, 1)
    for i in range(1, 11):
        data.extend(
            [{"DT_SIN_PRI": start_date + timedelta(weeks=i), "CLASSI_FIN": 5}] * i
        )  # Increasing volume
    df = pd.DataFrame(data)
    thresholds = compute_alert_thresholds(df)
    assert "medium" in thresholds
    assert "high" in thresholds
    assert thresholds["high"] > thresholds["medium"]


def test_compute_time_series_by_virus():
    df = pd.DataFrame(
        {
            "DT_SIN_PRI": [date(2024, 1, 1), date(2024, 1, 1), date(2024, 1, 10)],
            "CLASSI_FIN": [5, 1, 5],
        }
    )
    ts = compute_time_series_by_virus(df)
    assert len(ts) == 3  # (Week 1, COVID), (Week 1, Flu), (Week 2, COVID)
    assert "virus" in ts.columns
    assert "count" in ts.columns


def test_outcome_death_mask():
    values = pd.Series([1, 2, 3, None, 2, 1])
    mask = outcome_death_mask(values)
    assert mask.sum() == 2  # Only code 2 should be True
    assert not mask.iloc[0]  # code 1 = cure, not death
    assert not mask.iloc[2]  # code 3 should NOT count as death
    assert mask.iloc[1]  # code 2 = death


def test_outcome_valid_mask():
    values = pd.Series([1, 2, 3, None, 9, 2])
    mask = outcome_valid_mask(values)
    assert mask.sum() == 4  # codes 1, 2, 3, 2 are valid (1,2,3,2)
    assert not mask.iloc[3]  # None is not valid
    assert not mask.iloc[4]  # 9 is not valid


def test_infer_etiologic_agent():
    df = pd.DataFrame(
        {
            "CLASSI_FIN": [5, 5, 5, 1, 1, 2],
            "PCR_VSR": [1, 0, 0, 0, 0, 0],
            "AN_VSR": [0, 1, 0, 0, 0, 0],
        }
    )
    agents = infer_etiologic_agent(df)
    assert agents.iloc[0] == "VSR"
    assert agents.iloc[2] == "COVID-19"
    assert agents.iloc[3] == "Influenza"


def test_classificar_status_gripe():
    row_with_dose = {
        "VACINA": 1,
        "DT_UT_DOSE": date(2024, 5, 1),
        "DT_SIN_PRI": date(2024, 6, 1),
        "DT_1_DOSE": None,
        "DT_2_DOSE": None,
        "TP_IDADE": 3,
        "NU_IDADE_N": 30,
    }
    result = classificar_status_gripe(row_with_dose)
    assert result == "protegido"

    row_no_vaccine = {
        "VACINA": 2,
        "DT_UT_DOSE": None,
        "DT_1_DOSE": None,
        "DT_2_DOSE": None,
        "TP_IDADE": 3,
        "NU_IDADE_N": 30,
    }
    result = classificar_status_gripe(row_no_vaccine)
    assert result == "nao_vacinado"


def test_compute_time_series():
    df = pd.DataFrame({"DT_SIN_PRI": [date(2024, 1, 1), date(2024, 1, 5), date(2024, 1, 15)]})
    ts = compute_time_series(df)
    assert len(ts) >= 1
    assert "epi_week" in ts.columns
    assert "total" in ts.columns


def test_compute_clinical_timing_metrics():
    df = pd.DataFrame(
        {
            "DT_SIN_PRI": [date(2024, 1, 1), date(2024, 1, 1), date(2024, 1, 1)],
            "DT_INTERNA": [date(2024, 1, 2), date(2024, 1, 3), None],
            "DT_ENTUTI": [date(2024, 1, 3), None, None],
            "DT_EVOLUCA": [date(2024, 1, 10), None, None],
            "ANTIVIRAL": [1, 1, 2],
            "DT_ANTIVIR": [
                date(2024, 1, 2),
                date(2024, 1, 5),
                None,
            ],  # 1 dia (aderente), 4 dias (não aderente)
        }
    )
    metrics = compute_clinical_timing_metrics(df)

    assert metrics["cases_with_hospital_date"] == 2
    assert metrics["median_days_symptom_to_hospital"] == 1.5  # (1 + 2) / 2
    assert metrics["protocol_48h_adherence_rate"] == 50.0  # 1 de 2 casos tratados é aderente


def test_compute_symptoms_signature():
    df = pd.DataFrame(
        {
            "NU_IDADE_N": [30, 30, 30],
            "TP_IDADE": [3, 3, 3],
            "CLASSI_FIN": [5, 1, 4],  # COVID, Flu, Other
            "FEBRE": [1, 1, 0],
            "TOSSE": [1, 0, 1],
        }
    )
    result = compute_symptoms_signature(df)
    assert "labels" in result
    assert "matrices" in result
    assert "covid" in result["matrices"]
    assert "gripe" in result["matrices"]
    # Check if we have data (matrices are list of lists of [prev, count])
    covid_matrix = result["matrices"]["covid"]
    assert len(covid_matrix) > 0
    # The 'Adulto' band (age 30) is the 3rd band in the 'all' view
    # Matrix structure: matrix[symptom_idx][band_idx] -> [prevalence, count]
    found_prev = any(symptom_row[2][0] == 100.0 for symptom_row in covid_matrix)
    assert found_prev
