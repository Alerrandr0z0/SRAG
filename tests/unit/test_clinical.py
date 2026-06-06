"""Mutation-targeted tests for clinical.py: exact values, boundaries, edge cases."""

import numpy as np
import pandas as pd

from srag.data.analytics.clinical import (
    compute_antiviral_latency,
    compute_antiviral_outcome_impact,
    compute_clinical_timing_metrics,
    compute_comorbidities_treemap,
    compute_gravity_cascade,
    compute_maternal_profile,
    compute_risk_factor_profile,
    compute_risk_factors_full_profile,
    compute_severity_metrics,
    compute_severity_pyramid,
    compute_symptoms_heatmap,
    compute_symptoms_profile,
    compute_symptoms_signature,
)


class TestSeverityMetrics:
    def test_uti_death_exact(self) -> None:
        df = pd.DataFrame({"UTI": [1, 2, 1], "EVOLUCAO": [2, 2, 1]})
        res = compute_severity_metrics(df)
        assert res["uti_rate"] == round(2 / 3 * 100, 2)
        assert res["death_rate"] == round(2 / 3 * 100, 2)

    def test_zero_uti(self) -> None:
        df = pd.DataFrame({"UTI": [2, 2], "EVOLUCAO": [1, 1]})
        res = compute_severity_metrics(df)
        assert res["uti_rate"] == 0.0
        assert res["death_rate"] == 0.0

    def test_empty_df_zeros(self) -> None:
        res = compute_severity_metrics(pd.DataFrame())
        assert res == {"uti_rate": 0.0, "death_rate": 0.0}

    def test_evolucao_3_not_death(self) -> None:
        df = pd.DataFrame({"UTI": [1], "EVOLUCAO": [3]})
        res = compute_severity_metrics(df)
        assert res["death_rate"] == 0.0


class TestClinicalTimingMetrics:
    def test_symptom_to_hospital_boundary(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
                "DT_INTERNA": ["2023-01-02", "2023-07-01"],
                "DT_ENTUTI": [np.nan, np.nan],
                "DT_EVOLUCA": [np.nan, np.nan],
                "DT_ANTIVIR": [np.nan, np.nan],
                "ANTIVIRAL": [2, 2],
            }
        )
        res = compute_clinical_timing_metrics(df)
        assert res["cases_with_hospital_date"] == 2
        assert 1 <= res["median_days_symptom_to_hospital"] <= 180

    def test_safe_median_outside_180_filtered(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
                "DT_INTERNA": ["2023-07-02", "2023-01-05"],
                "DT_ENTUTI": [np.nan, np.nan],
                "DT_EVOLUCA": [np.nan, np.nan],
                "DT_ANTIVIR": [np.nan, np.nan],
                "ANTIVIRAL": [2, 2],
            }
        )
        res = compute_clinical_timing_metrics(df)
        assert res["median_days_symptom_to_hospital"] == 4.0

    def test_protocol_48h_exact(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_INTERNA": [np.nan, np.nan, np.nan],
                "DT_ENTUTI": [np.nan, np.nan, np.nan],
                "DT_EVOLUCA": [np.nan, np.nan, np.nan],
                "DT_ANTIVIR": ["2023-01-01", "2023-01-03", "2023-01-05"],
                "ANTIVIRAL": [1, 1, 1],
            }
        )
        res = compute_clinical_timing_metrics(df)
        assert res["protocol_48h_adherence_rate"] == round(2 / 3 * 100, 1)

    def test_empty_df(self) -> None:
        res = compute_clinical_timing_metrics(pd.DataFrame())
        assert res["cases_with_hospital_date"] == 0
        assert res["median_days_symptom_to_hospital"] == 0.0

    def test_missing_dt_interna(self) -> None:
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"], "ANTIVIRAL": [2]})
        res = compute_clinical_timing_metrics(df)
        assert res["cases_with_hospital_date"] == 0
        assert res["cases_with_icu_dates"] == 0
        assert res["cases_with_outcome_date"] == 0


class TestRiskFactorProfile:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "DIABETES": [1, 2, 1],
                "OBESIDADE": [1, np.nan, np.nan],
                "ASMA": [np.nan, np.nan, np.nan],
            }
        )
        res = {r["factor"]: r["count"] for r in compute_risk_factor_profile(df)}
        assert res["Diabetes"] == 2
        assert res["Obesidade"] == 1
        assert res["Asma"] == 0

    def test_missing_column_skipped(self) -> None:
        df = pd.DataFrame({"DIABETES": [1]})
        res = compute_risk_factor_profile(df)
        factors = [r["factor"] for r in res]
        assert "Obesidade" not in factors

    def test_empty_df(self) -> None:
        assert compute_risk_factor_profile(pd.DataFrame()) == []


class TestRiskFactorsFullProfile:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "PUERPERA": [1, 2],
                "CARDIOPATI": [1, np.nan],
                "HEMATOLOGI": [np.nan, np.nan],
            }
        )
        res = {r["factor"]: r["count"] for r in compute_risk_factors_full_profile(df)}
        assert res["Puérpera"] == 1
        assert res["Cardiopatia"] == 1
        assert res["Doença hematológica"] == 0

    def test_missing_column_returns_zero(self) -> None:
        df = pd.DataFrame({"PUERPERA": [1]})
        res = {r["factor"]: r["count"] for r in compute_risk_factors_full_profile(df)}
        assert res["Cardiopatia"] == 0

    def test_empty_df(self) -> None:
        assert compute_risk_factors_full_profile(pd.DataFrame()) == []


class TestMaternalProfile:
    def test_gestante_exact_groups(self) -> None:
        df = pd.DataFrame(
            {
                "CS_SEXO": ["F", "F", "F", "F"],
                "CS_GESTANT": [1, 2, 3, 4],
                "PUERPERA": [2, 2, 2, 2],
                "EVOLUCAO": [1, 1, 1, 1],
                "UTI": [2, 2, 2, 2],
            }
        )
        res = compute_maternal_profile(df)
        assert res["gestantes_total"] == 4
        assert res["puerperas_total"] == 0
        assert res["maternal_cases"] == 4

    def test_puerpera_outcome_death(self) -> None:
        df = pd.DataFrame(
            {
                "CS_SEXO": ["F"],
                "CS_GESTANT": [9],
                "PUERPERA": [1],
                "EVOLUCAO": [2],
                "UTI": [2],
            }
        )
        res = compute_maternal_profile(df)
        assert len(res["maternal_outcomes"]) == 1
        assert res["maternal_outcomes"][0]["death"] == 1

    def test_empty_df_defaults(self) -> None:
        res = compute_maternal_profile(pd.DataFrame())
        assert res == {
            "maternal_outcomes": [],
            "gestantes_total": 0,
            "puerperas_total": 0,
            "maternal_cases": 0,
        }

    def test_no_females(self) -> None:
        df = pd.DataFrame(
            {
                "CS_SEXO": ["M", "M"],
                "CS_GESTANT": [1, 9],
                "PUERPERA": [2, 2],
                "EVOLUCAO": [1, 1],
                "UTI": [2, 2],
            }
        )
        res = compute_maternal_profile(df)
        assert res["maternal_cases"] == 0


class TestAntiviralLatency:
    def test_exact_quartiles(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_ANTIVIR": ["2023-01-02", "2023-01-04", "2023-01-06", "2023-01-08"],
                "ANTIVIRAL": [1, 1, 1, 1],
            }
        )
        res = compute_antiviral_latency(df)
        assert len(res["boxplot_data"]) == 5
        assert res["boxplot_data"][0] == 1.0
        assert res["boxplot_data"][4] == 7.0

    def test_delta_zero_included(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"],
                "DT_ANTIVIR": ["2023-01-01"],
                "ANTIVIRAL": [1],
            }
        )
        res = compute_antiviral_latency(df)
        assert res["median"] == 0.0

    def test_delta_over_14_excluded(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"],
                "DT_ANTIVIR": ["2023-01-20"],
                "ANTIVIRAL": [1],
            }
        )
        res = compute_antiviral_latency(df)
        assert res == {"boxplot_data": [], "median": 0.0}

    def test_missing_date_columns(self) -> None:
        df = pd.DataFrame({"ANTIVIRAL": [1]})
        res = compute_antiviral_latency(df)
        assert res == {"boxplot_data": [], "median": 0.0}

    def test_empty_df(self) -> None:
        res = compute_antiviral_latency(pd.DataFrame())
        assert res == {"boxplot_data": [], "median": 0.0}


class TestAntiviralOutcomeImpact:
    def test_exact_cure_death_rates(self) -> None:
        df = pd.DataFrame(
            {
                "ANTIVIRAL": [1, 1, 1, 2, 2],
                "EVOLUCAO": [1, 1, 2, 1, 2],
            }
        )
        res = {r["group"]: r for r in compute_antiviral_outcome_impact(df)}
        assert res["Usou Antiviral"]["cure_rate"] == round(2 / 3 * 100, 1)
        assert res["Usou Antiviral"]["death_rate"] == round(1 / 3 * 100, 1)
        assert res["Não Usou"]["total"] == 2

    def test_evolucao_3_excluded(self) -> None:
        df = pd.DataFrame(
            {
                "ANTIVIRAL": [1],
                "EVOLUCAO": [3],
            }
        )
        assert compute_antiviral_outcome_impact(df) == []

    def test_empty_df(self) -> None:
        assert compute_antiviral_outcome_impact(pd.DataFrame()) == []


class TestSymptomsProfile:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame({"FEBRE": [1, 1, 2], "TOSSE": [1, np.nan, np.nan]})
        res = {r["symptom"]: r["count"] for r in compute_symptoms_profile(df)}
        assert res["Febre"] == 2
        assert res["Tosse"] == 1

    def test_missing_column_returns_zero(self) -> None:
        df = pd.DataFrame({"FEBRE": [1]})
        res = {r["symptom"]: r["count"] for r in compute_symptoms_profile(df)}
        assert res["Dor de garganta"] == 0

    def test_empty_df(self) -> None:
        assert compute_symptoms_profile(pd.DataFrame()) == []


class TestSymptomsHeatmap:
    def test_diagonal_is_self_cooccurrence(self) -> None:
        df = pd.DataFrame({"FEBRE": [1, 1], "TOSSE": [1, 2]})
        res = compute_symptoms_heatmap(df)
        assert len(res["matrix"]) == 13
        assert res["matrix"][0][0] == 2  # Febre & Febre
        assert res["matrix"][1][1] == 1  # Tosse & Tosse

    def test_no_symptoms(self) -> None:
        df = pd.DataFrame({"FEBRE": [2, 2], "TOSSE": [2, 2]})
        res = compute_symptoms_heatmap(df)
        for i in range(len(res["labels"])):
            for j in range(len(res["labels"])):
                assert res["matrix"][i][j] == 0

    def test_missing_column_uses_false(self) -> None:
        df = pd.DataFrame({"FEBRE": [1]})
        res = compute_symptoms_heatmap(df)
        assert res["matrix"][0][1] == 0

    def test_empty_df(self) -> None:
        res = compute_symptoms_heatmap(pd.DataFrame())
        assert res["labels"] is not None
        assert res["matrix"] == []


class TestSymptomsSignature:
    def test_all_profile_age_bands(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [1, 5, 15, 30, 70],
                "TP_IDADE": [3, 3, 3, 3, 3],
                "CLASSI_FIN": [5, 5, 5, 5, 5],
                "FEBRE": [1, 2, 1, 2, 1],
                "TOSSE": [1, 1, 1, 1, 1],
            }
        )
        res = compute_symptoms_signature(df)
        assert len(res["bands"]) == 4
        assert "Criança" in res["bands"]
        assert "Idoso" in res["bands"]

    def test_crianca_profile_bands(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [1, 3, 8],
                "TP_IDADE": [3, 3, 3],
                "CLASSI_FIN": [5, 5, 5],
                "FEBRE": [1, 1, 1],
            }
        )
        res = compute_symptoms_signature(df, profile_type="crianca")
        assert res["bands"] == ["<2 anos", "2-5 anos", "6-11 anos"]
        assert len(res["matrices"]["covid"]) == 13  # 13 symptoms

    def test_adolescente_profile_bands(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [13, 17],
                "TP_IDADE": [3, 3],
                "CLASSI_FIN": [1, 1],
                "FEBRE": [1, 2],
            }
        )
        res = compute_symptoms_signature(df, profile_type="adolescente")
        assert res["bands"] == ["12-14 anos", "15-19 anos"]

    def test_adulto_profile_bands(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [25, 50],
                "TP_IDADE": [3, 3],
                "CLASSI_FIN": [1, 1],
                "FEBRE": [1, 1],
            }
        )
        res = compute_symptoms_signature(df, profile_type="adulto")
        assert res["bands"] == ["20-39 anos", "40-59 anos"]

    def test_idoso_profile_bands(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [65, 75, 85],
                "TP_IDADE": [3, 3, 3],
                "CLASSI_FIN": [1, 1, 1],
                "FEBRE": [1, 1, 1],
            }
        )
        res = compute_symptoms_signature(df, profile_type="idoso")
        assert res["bands"] == ["60-69 anos", "70-79 anos", "80+ anos"]

    def test_vsr_pathogen_detected(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [30],
                "TP_IDADE": [3],
                "CLASSI_FIN": [5],
                "PCR_VSR": [1],
                "FEBRE": [1],
            }
        )
        res = compute_symptoms_signature(df)
        assert "vsr" in res["matrices"]

    def test_empty_df(self) -> None:
        res = compute_symptoms_signature(pd.DataFrame())
        assert res == {"labels": [], "bands": [], "matrices": {}}


class TestSeverityKpis:
    def test_severity_kpis_exact(self) -> None:
        from srag.data.analytics.clinical import compute_severity_kpis

        df = pd.DataFrame(
            {
                "HOSPITAL": [1, 1, 1, 2],
                "UTI": [1, 1, 2, 2],
                "SUPORT_VEN": [1, 3, np.nan, np.nan],
                "EVOLUCAO": [1, 2, 9, 3],
                "DT_SIN_PRI": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04"],
                "DT_INTERNA": ["2023-01-05", "2023-01-06", "2023-01-07", np.nan],
                "DT_EVOLUCA": ["2023-01-10", "2023-01-16", np.nan, np.nan],
                "DT_ENTUTI": ["2023-01-05", "2023-01-06", np.nan, np.nan],
                "DT_SAIDUTI": ["2023-01-09", "2023-01-12", np.nan, np.nan],
            }
        )
        res = compute_severity_kpis(df)
        current = res["current"]
        assert current["hospitalization_rate"] == 75.0  # 3/4
        assert current["uti_rate"] == 66.7  # 2/3
        assert current["ventilatory_support_rate"] == 50.0  # 1/2
        assert current["death_rate"] == 50.0  # 1/2 closed (1 and 2)
        assert current["median_hospitalization_days"] == 7.5
        assert current["median_uti_days"] == 5.0
        assert len(res["trend"]) == 1
        assert res["trend"][0]["hospitalization_rate"] == 75.0

    def test_empty_df_zeros(self) -> None:
        from srag.data.analytics.clinical import compute_severity_kpis

        res = compute_severity_kpis(pd.DataFrame())
        assert res["current"]["hospitalization_rate"] == 0.0
        assert res["trend"] == []


# ==============================================================
# compute_severity_pyramid
# ==============================================================


class TestSeverityPyramid:
    def test_empty_df(self) -> None:
        assert compute_severity_pyramid(pd.DataFrame()) == []

    def test_exact_rates(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [2, 3, 10, 80],
                "TP_IDADE": [3, 3, 3, 3],
                "UTI": [1, 2, 1, 9],
                "SUPORT_VEN": [1, 3, 2, 9],
                "EVOLUCAO": [1, 2, 1, 9],
            }
        )
        res = compute_severity_pyramid(df)
        assert len(res) == 12

        # 1-4 group: 2 patients (ages 2 and 3)
        g1_4 = next(g for g in res if g["age_group"] == "1-4 anos")
        assert g1_4["total_cases"] == 2
        # one went to UTI (50%)
        assert g1_4["uti_rate"] == 50.0
        # one had support (50%)
        assert g1_4["support_rate"] == 50.0
        # one died (50%)
        assert g1_4["death_rate"] == 50.0

        # 10-14 group: 1 patient (age 10)
        g10_14 = next(g for g in res if g["age_group"] == "10-14 anos")
        assert g10_14["total_cases"] == 1
        assert g10_14["uti_rate"] == 100.0
        assert g10_14["support_rate"] == 100.0
        assert g10_14["death_rate"] == 0.0

        # 80+ group: 1 patient (age 80)
        g80plus = next(g for g in res if g["age_group"] == "80+ anos")
        assert g80plus["total_cases"] == 1


# ==============================================================
# compute_gravity_cascade
# ==============================================================


class TestGravityCascade:
    def test_empty_df(self) -> None:
        assert compute_gravity_cascade(pd.DataFrame()) == []

    def test_exact_cascade(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": [
                    "2023-01-01",
                    "2023-01-02",
                    "2023-01-08",
                ],
                "HOSPITAL": [1, 2, 1],
                "UTI": [1, 9, 2],
                "EVOLUCAO": [1, 2, 9],
            }
        )
        res = compute_gravity_cascade(df)
        assert len(res) == 2

        w1 = next(r for r in res if r["epi_week"] == "2023-01")
        assert w1["notified"] == 2
        assert w1["hospitalized"] == 1
        assert w1["uti"] == 1
        assert w1["death"] == 1

        w2 = next(r for r in res if r["epi_week"] == "2023-02")
        assert w2["notified"] == 1
        assert w2["hospitalized"] == 1
        assert w2["uti"] == 0
        assert w2["death"] == 0


class TestComorbiditiesTreemap:
    def test_empty_df(self) -> None:
        assert compute_comorbidities_treemap(pd.DataFrame()) == []

    def test_exact_treemap(self) -> None:
        df = pd.DataFrame(
            {
                "OBESIDADE": [1, 2, 1],
                "DIABETES": [1, 1, 9],
                "EVOLUCAO": [2, 1, 1],
            }
        )
        res = compute_comorbidities_treemap(df)
        assert len(res) == 14

        obesidade = next(r for r in res if r["name"] == "Obesidade")
        assert obesidade["value"] == 2
        assert obesidade["deaths"] == 1
        assert obesidade["lethality"] == 50.0

        diabetes = next(r for r in res if r["name"] == "Diabetes")
        assert diabetes["value"] == 2
        assert diabetes["deaths"] == 1
        assert diabetes["lethality"] == 50.0
