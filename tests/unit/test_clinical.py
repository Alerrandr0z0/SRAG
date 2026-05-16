import pandas as pd

from srag.data.analytics.clinical import (
    compute_antiviral_latency,
    compute_antiviral_outcome_impact,
    compute_clinical_timing_metrics,
    compute_maternal_profile,
    compute_risk_factor_profile,
    compute_risk_factors_full_profile,
    compute_severity_metrics,
    compute_symptoms_heatmap,
    compute_symptoms_profile,
    compute_symptoms_signature,
)
from srag.data.references import DEATH_OUTCOMES


def test_compute_severity_metrics() -> None:
    df_empty = pd.DataFrame()
    res = compute_severity_metrics(df_empty)
    assert res == {"uti_rate": 0.0, "death_rate": 0.0}

    val = next(iter(DEATH_OUTCOMES)) if DEATH_OUTCOMES else 2
    df = pd.DataFrame(
        {
            "UTI": [1, 2, 1, pd.NA],
            "EVOLUCAO": [val, 1, 3, pd.NA],  # 1 obito (using DEATCH_OUTCOMES)
        }
    )
    res = compute_severity_metrics(df)
    assert "uti_rate" in res
    assert "death_rate" in res
    assert res["total"] == 4
    assert res["uti_rate"] == 50.0


def test_compute_clinical_timing_metrics() -> None:
    df_empty = pd.DataFrame()
    res = compute_clinical_timing_metrics(df_empty)
    assert res["cases_with_hospital_date"] == 0

    df = pd.DataFrame(
        {
            "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
            "DT_INTERNA": ["2023-01-05", pd.NA],
            "DT_ENTUTI": ["2023-01-06", pd.NA],
            "DT_EVOLUCA": ["2023-01-10", pd.NA],
            "ANTIVIRAL": [1, 2],
            "DT_ANTIVIR": ["2023-01-02", pd.NA],
        }
    )
    res = compute_clinical_timing_metrics(df)
    assert res["cases_with_hospital_date"] == 1
    assert res["median_days_symptom_to_hospital"] == 4.0
    assert res["median_days_hospital_to_icu"] == 1.0
    assert res["median_days_symptom_to_outcome"] == 9.0
    assert res["protocol_48h_adherence_rate"] == 100.0

    # Test edge case with invalid values / out of bounds
    df2 = pd.DataFrame(
        {
            "DT_SIN_PRI": ["2023-01-10", "2023-01-01"],
            "DT_INTERNA": ["2023-01-05", "2023-08-01"],  # -5 days, 212 days
            "DT_ENTUTI": [pd.NA, pd.NA],
            "DT_EVOLUCA": [pd.NA, pd.NA],
            "ANTIVIRAL": [1, 1],
            "DT_ANTIVIR": ["2023-01-15", pd.NA],  # >2 days adherence
        }
    )
    res2 = compute_clinical_timing_metrics(df2)
    assert res2["median_days_symptom_to_hospital"] == 0.0  # Out of bounds dropped
    assert res2["protocol_48h_adherence_rate"] == 0.0


def test_compute_risk_factor_profile() -> None:
    assert compute_risk_factor_profile(pd.DataFrame()) == []
    df = pd.DataFrame(
        {
            "DIABETES": [1, 2, pd.NA],
            "OBESIDADE": [1, 1, pd.NA],
            "ASMA": [2, 2, pd.NA],
        }
    )
    res = compute_risk_factor_profile(df)
    assert len(res) == 3  # only the candidates present in columns
    assert res[0]["factor"] == "Obesidade"
    assert res[0]["count"] == 2
    assert res[1]["factor"] == "Diabetes"
    assert res[1]["count"] == 1


def test_compute_risk_factors_full_profile() -> None:
    assert compute_risk_factors_full_profile(pd.DataFrame()) == []
    df = pd.DataFrame({"PUERPERA": [1, 1, 1], "CARDIOPATI": [1, pd.NA, 2]})
    res = compute_risk_factors_full_profile(df)
    assert len(res) == 14
    assert res[0]["factor"] == "Puérpera"
    assert res[0]["count"] == 3
    # Check that missing columns are added with 0
    assert any(r["factor"] == "Diabetes" and r["count"] == 0 for r in res)


def test_compute_maternal_profile() -> None:
    assert compute_maternal_profile(pd.DataFrame())["maternal_cases"] == 0

    # Test only Male
    df_male = pd.DataFrame({"CS_SEXO": ["M", "M"]})
    assert compute_maternal_profile(df_male)["maternal_cases"] == 0

    val = next(iter(DEATH_OUTCOMES)) if DEATH_OUTCOMES else 2
    df = pd.DataFrame(
        {
            "CS_SEXO": ["F", "F", "M", "F", "F", "F", "F"],
            "PUERPERA": [1, 2, 1, pd.NA, pd.NA, pd.NA, pd.NA],
            "CS_GESTANT": [pd.NA, 1, 1, 2, 3, 4, 5],
            "EVOLUCAO": [val, 1, 1, pd.NA, pd.NA, pd.NA, 1],  # val=obito, 1=cura (sem UTI)
            "UTI": [1, 2, 1, 1, 1, 1, 2],  # 1=UTI, 2=Sem UTI
        }
    )
    res = compute_maternal_profile(df)
    assert res["gestantes_total"] == 4
    assert res["puerperas_total"] == 1
    assert res["maternal_cases"] == 5
    outcomes = res["maternal_outcomes"]
    assert len(outcomes) > 0
    groups = {o["group"]: o for o in outcomes}
    assert "Puérpera" in groups
    assert groups["Puérpera"]["death"] == 1


def test_compute_antiviral_latency() -> None:
    assert compute_antiviral_latency(pd.DataFrame())["median"] == 0.0
    df = pd.DataFrame(
        {
            "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2023-01-01"],
            "DT_ANTIVIR": [
                "2023-01-02",
                "2023-01-05",
                "2023-01-20",
            ],  # 1 day, 4 days, 19 days (invalid)
            "ANTIVIRAL": [1, 1, 1],
        }
    )
    res = compute_antiviral_latency(df)
    assert res["count"] == 2
    assert res["median"] == 2.5
    assert len(res["boxplot_data"]) == 5

    # Test out of bounds (<0)
    df2 = pd.DataFrame(
        {"DT_SIN_PRI": ["2023-01-10"], "DT_ANTIVIR": ["2023-01-05"], "ANTIVIRAL": [1]}
    )
    res2 = compute_antiviral_latency(df2)
    assert "count" not in res2


def test_compute_antiviral_outcome_impact() -> None:
    assert compute_antiviral_outcome_impact(pd.DataFrame()) == []
    df = pd.DataFrame(
        {
            "ANTIVIRAL": [1, 1, 2, 2],
            "EVOLUCAO": [1, 2, 1, 2],  # 1=cura, 2=obito
        }
    )
    res = compute_antiviral_outcome_impact(df)
    assert len(res) == 2
    groups = {r["group"]: r for r in res}
    assert "Usou Antiviral" in groups
    assert "Não Usou" in groups
    assert groups["Usou Antiviral"]["cure_rate"] == 50.0


def test_compute_symptoms_profile() -> None:
    assert compute_symptoms_profile(pd.DataFrame()) == []
    df = pd.DataFrame({"FEBRE": [1, 1, 2], "TOSSE": [1, pd.NA, 2]})
    res = compute_symptoms_profile(df)
    assert len(res) == 13
    assert res[0]["count"] == 2  # Febre


def test_compute_symptoms_heatmap() -> None:
    res_empty = compute_symptoms_heatmap(pd.DataFrame())
    assert res_empty["matrix"] == []

    df = pd.DataFrame({"FEBRE": [1, 1, 2], "TOSSE": [1, 2, 2], "GARGANTA": [1, 1, 1]})
    res = compute_symptoms_heatmap(df)
    assert len(res["labels"]) == 13
    assert len(res["matrix"]) == 13
    assert len(res["matrix"][0]) == 13


def test_compute_symptoms_signature() -> None:
    res_empty = compute_symptoms_signature(pd.DataFrame())
    assert res_empty["labels"] == []

    df = pd.DataFrame(
        {
            "NU_IDADE_N": [5, 15, 30, 70],
            "TP_IDADE": [3, 3, 3, 3],
            "CLASSI_FIN": [5, 1, 2, 5],  # 5=covid, 1=gripe
            "PCR_VSR": [pd.NA, pd.NA, 1, pd.NA],  # vsr
            "FEBRE": [1, 1, 1, 1],
            "TOSSE": [1, 2, 1, 2],
        }
    )

    # Test "all"
    res = compute_symptoms_signature(df)
    assert "Criança" in res["bands"]
    assert "covid" in res["matrices"]
    assert "gripe" in res["matrices"]
    assert "vsr" in res["matrices"]

    # Test profiles
    res_c = compute_symptoms_signature(df, profile_type="crianca")
    assert "2-5 anos" in res_c["bands"]

    res_a = compute_symptoms_signature(df, profile_type="adolescente")
    assert "15-19 anos" in res_a["bands"]

    res_ad = compute_symptoms_signature(df, profile_type="adulto")
    assert "20-39 anos" in res_ad["bands"]

    res_id = compute_symptoms_signature(df, profile_type="idoso")
    assert "70-79 anos" in res_id["bands"]

    # Custom pathogen mask
    def custom_mask(d):
        return {"custom": d["NU_IDADE_N"] > 10}

    res_custom = compute_symptoms_signature(df, pathogens_mask_func=custom_mask)
    assert "custom" in res_custom["matrices"]
