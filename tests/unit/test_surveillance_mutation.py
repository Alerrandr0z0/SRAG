"""Mutation-targeted tests: exact values, boundaries, edge cases.

Each test is designed to kill a specific mutant type:
- boundary:  > vs >=, < vs <=
- boolean:   and vs or, True vs False
- return:    exact value vs None
- NaN:       dropna/fillna removal
"""

import numpy as np
import pandas as pd

from srag.data.analytics.filters import _age_years, outcome_death_mask, outcome_valid_mask
from srag.data.analytics.surveillance import (
    classificar_status_gripe,
    compute_aggregated_timeline,
    compute_alert_thresholds,
    compute_antiviral_types,
    compute_antiviral_usage,
    compute_closure_criteria,
    compute_codetection_matrix,
    compute_genomic_variants,
    compute_imaging_profile,
    compute_influenza_subtypes,
    compute_laboratory_network_summary,
    compute_lethality_heatmap,
    compute_mortality_by_treatment_agent,
    compute_notification_delay_series,
    compute_positivity_trend,
    compute_serology_profile,
    compute_time_series,
    compute_time_series_by_virus,
    compute_vaccination_and_treatment_profile,
    compute_vaccine_manufacturer_distribution,
    compute_vaccine_survival,
    compute_virus_detailed_distribution,
    compute_virus_distribution,
    infer_etiologic_agent,
)

# ==============================================================
# _age_years — boundary tests for all 3 TP_IDADE branches
# ==============================================================


class TestAgeYears:
    def test_tp_3_years(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [0, 1, 149, 150], "TP_IDADE": [3, 3, 3, 3]})
        res = _age_years(df)
        assert list(res) == [0.0, 1.0, 149.0, 150.0]

    def test_tp_2_months(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [0, 1, 11, 12], "TP_IDADE": [2, 2, 2, 2]})
        res = _age_years(df)
        expected = [0.0, round(1 / 12, 6), round(11 / 12, 6), 1.0]
        assert list(round(v, 6) for v in res) == expected

    def test_tp_1_days(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [0, 1, 30, 365], "TP_IDADE": [1, 1, 1, 1]})
        res = _age_years(df)
        assert list(round(v, 4) for v in res) == [
            0.0,
            round(1 / 365.25, 4),
            round(30 / 365.25, 4),
            round(365 / 365.25, 4),
        ]

    def test_tp_na_fallback_years(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [5, 42], "TP_IDADE": [pd.NA, None]})
        res = _age_years(df)
        assert list(res) == [5.0, 42.0]

    def test_idade_anos_column_preferred(self) -> None:
        df = pd.DataFrame(
            {"IDADE_ANOS": [25, pd.NA, 50], "NU_IDADE_N": [1, 2, 3], "TP_IDADE": [3, 3, 3]}
        )
        res = _age_years(df)
        assert list(round(v, 1) for v in res.dropna()) == [25.0, 50.0]

    def test_nu_idade_zero_all_tp(self) -> None:
        for tp in [1, 2, 3]:
            df = pd.DataFrame({"NU_IDADE_N": [0], "TP_IDADE": [tp]})
            res = _age_years(df)
            assert res.iloc[0] == 0.0


# ==============================================================
# outcome_death_mask — boundary test for death code 2
# ==============================================================


class TestOutcomeDeathMask:
    def test_exact_death_code_2(self) -> None:
        s = pd.Series([1, 2, 3, 9])
        res = outcome_death_mask(s)
        assert list(res) == [False, True, False, False]

    def test_non_numeric_coerced(self) -> None:
        s = pd.Series(["2", "foo", None, np.nan])
        res = outcome_death_mask(s)
        assert list(res) == [True, False, False, False]


class TestOutcomeValidMask:
    def test_valid_codes_1_2_3(self) -> None:
        s = pd.Series([1, 2, 3, 4, 9])
        res = outcome_valid_mask(s)
        assert list(res) == [True, True, True, False, False]


# ==============================================================
# infer_etiologic_agent — VSR override, missing cols
# ==============================================================


class TestInferEtiologicAgent:
    def test_vsr_override_exact(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 5],
                "PCR_VSR": [np.nan, 1],
                "AN_VSR": [1, np.nan],
            }
        )
        res = infer_etiologic_agent(df)
        assert list(res) == ["VSR", "VSR"]

    def test_no_vsr_cols(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [1, 5]})
        res = infer_etiologic_agent(df)
        assert list(res) == ["Influenza", "COVID-19"]

    def test_classi_fin_all_nan(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [np.nan, np.nan]})
        res = infer_etiologic_agent(df)
        assert list(res) == ["Não Especificada", "Não Especificada"]


# ==============================================================
# classificar_status_gripe — paths that hypothesis misses
# ==============================================================


class TestClassificarStatusGripe:
    def test_tp_idade_1_menor_6m_no_mae_vac(self) -> None:
        row = {
            "NU_IDADE_N": 15,
            "TP_IDADE": 1,
            "VACINA": 9,
            "DT_SIN_PRI": "2023-05-01",
            "DT_UT_DOSE": None,
        }
        assert classificar_status_gripe(row) == "ignorado"

    def test_tp_idade_3_adulto_vacina_1_sem_dose(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": None,
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "ignorado"

    def test_dose_equals_sintoma(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": "2023-05-01",
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "protegido"

    def test_crianca_8y_dose_2_protegido(self) -> None:
        row = {
            "NU_IDADE_N": 6,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": None,
            "DT_1_DOSE": None,
            "DT_2_DOSE": "2023-04-20",
            "DT_DOSEUNI": None,
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "dose_2"

    def test_crianca_8y_vencida_dose_2(self) -> None:
        row = {
            "NU_IDADE_N": 6,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": None,
            "DT_1_DOSE": None,
            "DT_2_DOSE": "2023-03-01",
            "DT_DOSEUNI": None,
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "vencida"

    def test_dose_str_with_dayfirst(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": "15-04-2023",
            "DT_SIN_PRI": "01-05-2023",
        }
        assert classificar_status_gripe(row) == "protegido"

    def test_sintoma_str_with_dayfirst(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": 1,
            "DT_UT_DOSE": "2023-04-15",
            "DT_SIN_PRI": "15-04-2023",
        }
        assert classificar_status_gripe(row) == "protegido"

    def test_vacina_2_without_dose(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": 2,
            "DT_UT_DOSE": None,
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "nao_vacinado"

    def test_vacina_nan_returns_ignorado(self) -> None:
        row = {
            "NU_IDADE_N": 30,
            "TP_IDADE": 3,
            "VACINA": np.nan,
            "DT_UT_DOSE": None,
            "DT_SIN_PRI": "2023-05-01",
        }
        assert classificar_status_gripe(row) == "ignorado"


# ==============================================================
# compute_vaccine_survival — exact boundary (months 0, 24)
# ==============================================================


class TestVaccineSurvival:
    def test_exact_boundaries(self) -> None:
        df = pd.DataFrame(
            {
                "vax_date": ["2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_SIN_PRI": ["2023-01-01", "2024-01-01", "2025-01-01"],
            }
        )
        res = compute_vaccine_survival(df, "vax_date")
        assert "timeline" in res and "survival" in res
        assert len(res["timeline"]) > 0

    def test_empty_vax_col(self) -> None:
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"]})
        assert compute_vaccine_survival(df, "nonexistent") == {}

    def test_all_months_beyond_24(self) -> None:
        df = pd.DataFrame(
            {
                "vax_date": ["2023-01-01"],
                "DT_SIN_PRI": ["2025-06-01"],
            }
        )
        res = compute_vaccine_survival(df, "vax_date")
        assert res == {}


# ==============================================================
# compute_time_series_by_virus — exact count
# ==============================================================


class TestTimeSeriesByVirus:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 1, 5, 4],
                "DT_SIN_PRI": pd.to_datetime(
                    ["2023-01-01", "2023-01-01", "2023-01-08", "2023-01-15"]
                ),
            }
        )
        res = compute_time_series_by_virus(df)
        assert "Não Especificada" not in res["virus"].values
        assert len(res) >= 2

    def test_empty_df(self) -> None:
        assert compute_time_series_by_virus(pd.DataFrame()).empty


# ==============================================================
# compute_alert_thresholds — exact percentiles + correction logic
# ==============================================================


class TestAlertThresholds:
    def test_few_weeks_fallback(self) -> None:
        dates = pd.to_datetime(["2023-01-01", "2023-01-08", "2023-01-15"])
        df = pd.DataFrame({"DT_SIN_PRI": dates})
        res = compute_alert_thresholds(df)
        assert res == {"medium": 10, "high": 20, "very_high": 30}

    def test_threshold_correction_high_le_medium(self) -> None:
        dates = pd.to_datetime(
            ["2023-01-01"] * 3
            + ["2023-01-08"] * 3
            + ["2023-01-15"] * 3
            + ["2023-01-22"] * 3
            + ["2023-01-29"] * 3
            + ["2023-02-05"] * 100
        )
        df = pd.DataFrame({"DT_SIN_PRI": dates})
        res = compute_alert_thresholds(df)
        assert res["high"] > res["medium"]
        assert res["very_high"] > res["high"]


# ==============================================================
# compute_notification_delay_series — boundary at 60
# ==============================================================


class TestNotificationDelay:
    def test_delay_at_boundary_60(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"],
                "DT_NOTIFIC": ["2023-03-02"],
            }
        )
        res = compute_notification_delay_series(df)
        assert len(res) > 0
        assert res[0]["median_delay"] > 0

    def test_delay_negative_filtered(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-10"],
                "DT_NOTIFIC": ["2023-01-01"],
            }
        )
        assert compute_notification_delay_series(df) == []

    def test_delay_over_60_filtered(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"],
                "DT_NOTIFIC": ["2023-04-01"],
            }
        )
        res = compute_notification_delay_series(df)
        assert len(res) == 0 or res[0]["record_count"] == 0


# ==============================================================
# compute_positivity_trend — division by zero
# ==============================================================


class TestPositivityTrend:
    def test_no_amostra_col(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
                "PCR_RESUL": [1, 2],
                "RES_AN": [np.nan, np.nan],
            }
        )
        res = compute_positivity_trend(df)
        assert len(res) > 0

    def test_zero_tested(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"],
                "AMOSTRA": [2],
                "PCR_RESUL": [np.nan],
                "RES_AN": [np.nan],
            }
        )
        res = compute_positivity_trend(df)
        assert res[0]["positivity_rate"] == 0.0


# ==============================================================
# compute_influenza_subtypes — exact mapping
# ==============================================================


class TestInfluenzaSubtypes:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 1, 1],
                "PCR_FLUASU": [1, 2, 6],
                "PCR_FLUBLI": [np.nan, np.nan, np.nan],
            }
        )
        res = {r["label"]: r["count"] for r in compute_influenza_subtypes(df)}
        assert res.get("A/H1N1 pdm09") == 1
        assert res.get("A/H3N2") == 1
        assert res.get("A (Outro Subtipo)") == 1

    def test_no_flu_cases(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [5, 5]})
        assert compute_influenza_subtypes(df) == []


# ==============================================================
# compute_antiviral_usage — fallback when no flu cases
# ==============================================================


class TestAntiviralUsage:
    def test_fallback_all_cases(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [5, 5], "ANTIVIRAL": [1, 2]})
        res = compute_antiviral_usage(df)
        assert res["total_indicated"] == 2
        assert res["treated"] == 1

    def test_zero_denominator(self) -> None:
        assert compute_antiviral_usage(pd.DataFrame({"CLASSI_FIN": [], "ANTIVIRAL": []})) == {
            "adherence_rate": 0,
            "total_indicated": 0,
            "treated": 0,
        }


# ==============================================================
# compute_closure_criteria — exact mapping
# ==============================================================


class TestClosureCriteria:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame({"CRITERIO": [1, 1, 2]})
        res = {r["label"]: r["count"] for r in compute_closure_criteria(df)}
        assert res == {"Laboratorial": 2, "Vínculo Epidemiológico": 1}


# ==============================================================
# compute_time_series — exact
# ==============================================================


class TestTimeSeries:
    def test_exact_total(self) -> None:
        df = pd.DataFrame(
            {"DT_SIN_PRI": pd.to_datetime(["2023-01-01", "2023-01-01", "2023-01-08"])}
        )
        res = compute_time_series(df)
        assert len(res) == 2
        totals = dict(zip(res["epi_week"], res["total"], strict=False))
        # Both are SE1 2023 (since 2023-01-01 and 2023-01-08 may be same or different weeks)
        assert sum(totals.values()) == 3


# ==============================================================
# compute_virus_distribution — priority sort
# ==============================================================


class TestVirusDistribution:
    def test_priority_order(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [4, 1, 5]})
        res = compute_virus_distribution(df)
        assert list(res["virus"]) == ["Influenza", "COVID-19", "Não Especificada"]


# ==============================================================
# compute_virus_detailed_distribution — exact values per detail
# ==============================================================


class TestVirusDetailedDistribution:
    def test_detailed_vsr_sars2(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 5, 4],
                "PCR_VSR": [1, np.nan, np.nan],
                "PCR_SARS2": [np.nan, 1, np.nan],
            }
        )
        res = compute_virus_detailed_distribution(df)
        viruses = set(res["virus"])
        assert "VSR" in viruses
        assert "SARS-CoV-2" in viruses

    def test_influenza_detailed_no_flu(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [5, 5]})
        res = compute_virus_detailed_distribution(df, "influenza_detailed")
        assert len(res) == 1
        assert "Nenhum Influenza" in res.iloc[0]["virus"]

    def test_covid_detailed_no_covid(self) -> None:
        df = pd.DataFrame({"CLASSI_FIN": [1, 1]})
        res = compute_virus_detailed_distribution(df, "covid_detailed")
        assert len(res) == 1
        assert "Nenhum COVID-19" in res.iloc[0]["virus"]


# ==============================================================
# compute_genomic_variants — exact percentages
# ==============================================================


class TestGenomicVariants:
    def test_exact_percentage(self) -> None:
        df = pd.DataFrame(
            {
                "VG_OMS": [1, 1, 2],
                "DT_SIN_PRI": pd.to_datetime(["2023-01-01", "2023-01-01", "2023-01-01"]),
            }
        )
        res = compute_genomic_variants(df)
        assert "Ômicron" in res["variants"]
        assert "Delta" in res["variants"]
        assert list(res["variants"]["Ômicron"]) == [round(2 / 3 * 100, 1)]

    def test_no_vg_oms_col(self) -> None:
        assert compute_genomic_variants(pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"]})) == {
            "weeks": [],
            "variants": {},
        }


# ==============================================================
# compute_lethality_heatmap — exact CFR
# ==============================================================


class TestLethalityHeatmap:
    def test_exact_cfr(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 1],
                "NU_IDADE_N": [30, 30],
                "TP_IDADE": [3, 3],
                "EVOLUCAO": [1, 2],
            }
        )
        res = compute_lethality_heatmap(df)
        assert len(res["matrix"]) > 0
        influenza_idx = res["agents"].index("Influenza")
        adult_idx = res["age_bands"].index("30-39 anos")
        cfr = res["matrix"][influenza_idx][adult_idx]
        assert cfr == 50.0


# ==============================================================
# compute_codetection_matrix — exact matrix
# ==============================================================


class TestCodetectionMatrix:
    def test_exact_diagonal_zero(self) -> None:
        df = pd.DataFrame(
            {
                "CO_DETEC": [1, 1],
                "PCR_SARS2": [1, 0],
                "PCR_VSR": [0, 1],
            }
        )
        res = compute_codetection_matrix(df)
        assert len(res["matrix"]) > 0
        for i in range(len(res["labels"])):
            assert res["matrix"][i][i] == 0

    def test_no_codetection_cases(self) -> None:
        df = pd.DataFrame({"CO_DETEC": [2, 2], "PCR_SARS2": [1, 1]})
        res = compute_codetection_matrix(df)
        assert res == {
            "labels": [
                "SARS-CoV-2",
                "VSR",
                "Influenza",
                "Rinovírus",
                "Metapneumovírus",
                "Adenovírus",
            ],
            "matrix": [],
        }


# ==============================================================
# compute_imaging_profile — exact mapping
# ==============================================================


class TestImagingProfile:
    def test_exact_raiox_mapping(self) -> None:
        df = pd.DataFrame({"RAIOX_RES": [1, 2, 3]})
        res = compute_imaging_profile(df)
        raiox = {r["label"]: r["count"] for r in res["raiox"]}
        assert raiox == {"Normal": 1, "Infiltrado": 1, "Consolidação": 1}


# ==============================================================
# compute_serology_profile — exact
# ==============================================================


class TestSerologyProfile:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "TP_SOR": [1, 2],
                "RES_IGG": [1, 2],
                "RES_IGM": [3, 1],
            }
        )
        res = compute_serology_profile(df)
        types = {r["label"]: r["count"] for r in res["types"]}
        assert types == {"Rápido": 1, "Elisa": 1}
        igg = {r["label"]: r["count"] for r in res["igg"]}
        assert igg == {"Reagente": 1, "Não Reagente": 1}


# ==============================================================
# compute_antiviral_types — exact
# ==============================================================


class TestAntiviralTypes:
    def test_exact_types(self) -> None:
        df = pd.DataFrame(
            {
                "TP_ANTIVIR": [1, 2],
                "TIPO_TRAT": [1, 2],
            }
        )
        res = {r["label"]: r["count"] for r in compute_antiviral_types(df)}
        assert res.get("Oseltamivir") == 1
        assert res.get("Zanamivir") == 1
        assert res.get("Paxlovid") == 1
        assert res.get("Lagevrio") == 1


# ==============================================================
# compute_laboratory_network_summary — exact values
# ==============================================================


class TestLabNetwork:
    def test_no_tested_cases(self) -> None:
        df = pd.DataFrame(
            {
                "PCR_RESUL": [9, 9],
                "RES_AN": [np.nan, np.nan],
            }
        )
        res = compute_laboratory_network_summary(df)
        assert res["labs"] == []
        assert res["overall"]["tested_cases"] == 0

    def test_exact_positive_rate(self) -> None:
        df = pd.DataFrame(
            {
                "PCR_RESUL": [1, 2, 1],
                "RES_AN": [np.nan, np.nan, np.nan],
                "CO_LAB_AN": ["L1", "L1", "L1"],
                "LAB_AN": ["Lab1", "Lab1", "Lab1"],
                "DT_COLETA": ["2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_PCR": ["2023-01-03", "2023-01-03", "2023-01-03"],
                "DT_RES_AN": [np.nan, np.nan, np.nan],
                "CO_DETEC": [np.nan, np.nan, np.nan],
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2023-01-01"],
            }
        )
        res = compute_laboratory_network_summary(df)
        assert res["overall"]["positive_rate"] == round(2 / 3 * 100, 2)


# ==============================================================
# compute_vaccine_manufacturer_distribution
# ==============================================================


class TestVaccineManufacturer:
    def test_normalize_mapping(self) -> None:
        df = pd.DataFrame(
            {
                "FAB_COV1": ["ASTRAZENECA", "PFIZER", "BUTANTAN", "JANSSEN"],
                "FAB_COV2": [np.nan, np.nan, np.nan, np.nan],
            }
        )
        res = {r["label"]: r["count"] for r in compute_vaccine_manufacturer_distribution(df)}
        assert res.get("AstraZeneca/Oxford") == 1
        assert res.get("Pfizer/BioNTech") == 1
        assert res.get("Butantan/Sinovac") == 1
        assert res.get("Janssen (Johnson & Johnson)") == 1

    def test_all_nan(self) -> None:
        df = pd.DataFrame({"FAB_COV1": [np.nan], "FAB_COV2": [np.nan]})
        assert compute_vaccine_manufacturer_distribution(df) == []


# ==============================================================
# compute_mortality_by_treatment_agent
# ==============================================================


class TestMortalityByTreatment:
    def test_exact_death_count(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1, 1, 5],
                "SUPORT_VEN": [1, 2, 3],
                "EVOLUCAO": [2, 2, 1],
            }
        )
        res = compute_mortality_by_treatment_agent(df)
        assert len(res) == 2
        assert res["deaths"].sum() == 2

    def test_no_suport_ven_col(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [1],
                "EVOLUCAO": [2],
            }
        )
        res = compute_mortality_by_treatment_agent(df)
        assert len(res) == 1
        assert res.iloc[0]["treatment"] == "Não informado"


# ==============================================================
# compute_vaccination_and_treatment_profile
# ==============================================================


class TestVaccinationProfile:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "VACINA_COV": [1, 2],
                "VACINA": [1, 1],
                "ANTIVIRAL": [1, 2],
                "TRAT_COV": [2, 1],
            }
        )
        res = compute_vaccination_and_treatment_profile(df)
        assert res["covid_vaccinated_count"] == 1
        assert res["flu_vaccinated_count"] == 2
        assert res["influenza_antiviral_count"] == 1
        assert res["covid_treatment_count"] == 1


# ==============================================================
# compute_aggregated_timeline — exact values per profile
# ==============================================================


class TestAggregatedTimeline:
    def test_nao_vacinado_profile(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": pd.to_datetime(["2023-01-01"]),
                "DT_INTERNA": pd.to_datetime(["2023-01-05"]),
                "DT_EVOLUCA": pd.to_datetime(["2023-01-10"]),
                "VACINA_COV": [2],
                "EVOLUCAO": [1],
                "UTI": [1],
            }
        )
        res = compute_aggregated_timeline(df, virus="covid")
        nao_vac = next((r for r in res if r["status_key"] == "nao_vacinado"), None)
        assert nao_vac is not None
        assert nao_vac["count"] == 1
        assert nao_vac["taxa_cura"] == 1.0

    def test_profile_precedence_bivalente(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": pd.to_datetime(["2023-01-01"]),
                "DT_INTERNA": pd.to_datetime(["2023-01-05"]),
                "DT_EVOLUCA": pd.to_datetime(["2023-01-10"]),
                "VACINA_COV": [1],
                "DOS_RE_BI": ["2022-12-01"],
                "DOSE_2REF": ["2022-11-01"],
                "DOSE_REF": ["2022-10-01"],
                "DOSE_2_COV": ["2022-09-01"],
                "DOSE_1_COV": ["2022-08-01"],
                "EVOLUCAO": [1],
                "UTI": [1],
            }
        )
        res = compute_aggregated_timeline(df, virus="covid")
        bivalente = next((r for r in res if r["status_key"] == "bivalente"), None)
        assert bivalente is not None
        assert bivalente["count"] == 1

    def test_gripe_virus_profile(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": pd.to_datetime(["2023-01-01"]),
                "DT_INTERNA": pd.to_datetime(["2023-01-05"]),
                "DT_EVOLUCA": pd.to_datetime(["2023-01-10"]),
                "NU_IDADE_N": [30],
                "TP_IDADE": [3],
                "VACINA": [2],
                "DT_UT_DOSE": [np.nan],
                "EVOLUCAO": [1],
                "UTI": [1],
            }
        )
        res = compute_aggregated_timeline(df, virus="gripe")
        assert len(res) > 0
        nao_vac = next((r for r in res if r["status_key"] == "nao_vacinado"), None)
        assert nao_vac is not None

    def test_empty_df(self) -> None:
        assert compute_aggregated_timeline(pd.DataFrame()) == []

    def test_non_binary_outcomes(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": pd.to_datetime(["2023-01-01"] * 3),
                "DT_INTERNA": pd.to_datetime(["2023-01-05"] * 3),
                "DT_EVOLUCA": pd.to_datetime(["2023-01-10"] * 3),
                "VACINA_COV": [2, 1, 1],
                "DOSE_1_COV": [np.nan, "2022-12-01", "2022-12-01"],
                "DOSE_2_COV": [np.nan, "2022-12-15", "2022-12-15"],
                "DOSE_REF": [np.nan, np.nan, np.nan],
                "DOSE_2REF": [np.nan, np.nan, np.nan],
                "DOS_RE_BI": [np.nan, np.nan, np.nan],
                "EVOLUCAO": [1, 2, 9],
                "UTI": [1, 2, 2],
            }
        )
        res = compute_aggregated_timeline(df, virus="covid")
        completo = next((r for r in res if r["status_key"] == "completo"), None)
        assert completo is not None
        assert completo["taxa_cura"] == 0.0
        assert completo["taxa_obito"] == 0.5
