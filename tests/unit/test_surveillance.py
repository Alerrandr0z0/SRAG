import numpy as np
import pandas as pd

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


def test_infer_etiologic_agent_empty() -> None:
    df = pd.DataFrame()
    assert infer_etiologic_agent(df).empty


def test_infer_etiologic_agent_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 2, 3, 4, 5, np.nan],
        "PCR_VSR": [np.nan, 1, np.nan, np.nan, np.nan, np.nan],
        "AN_VSR": [np.nan, np.nan, np.nan, 1, np.nan, np.nan]
    })
    res = infer_etiologic_agent(df)
    assert res.tolist() == ["Influenza", "VSR", "Outro Agente", "VSR", "COVID-19", "Não Especificada"]


def test_classificar_status_gripe() -> None:
    # Menor que 6 meses
    row_menor_6m = pd.Series({
        "NU_IDADE_N": 3, "TP_IDADE": 2, "VACINA": 1, "MAE_VAC": 1, "DT_VAC_MAE": "2023-04-15", "DT_SIN_PRI": "2023-05-01"
    })
    assert classificar_status_gripe(row_menor_6m) == "protegido"

    # Nao vacinado
    row_nao_vac = pd.Series({
        "NU_IDADE_N": 30, "TP_IDADE": 3, "VACINA": 2, "DT_SIN_PRI": "2023-05-01"
    })
    assert classificar_status_gripe(row_nao_vac) == "nao_vacinado"

    # Ignorado
    row_ign = pd.Series({
        "NU_IDADE_N": 30, "TP_IDADE": 3, "VACINA": 9, "DT_SIN_PRI": "2023-05-01"
    })
    assert classificar_status_gripe(row_ign) == "ignorado"


def test_compute_vaccine_survival_empty() -> None:
    assert compute_vaccine_survival(pd.DataFrame(), "vax_date") == {}


def test_compute_vaccine_survival_valid() -> None:
    df = pd.DataFrame({
        "vax_date": ["2023-01-01", "2023-02-01", "2023-03-01"],
        "DT_SIN_PRI": ["2023-01-15", "2023-05-01", "2023-06-01"]
    })
    res = compute_vaccine_survival(df, "vax_date")
    assert "timeline" in res
    assert "survival" in res


def test_compute_time_series_by_virus_empty() -> None:
    assert compute_time_series_by_virus(pd.DataFrame()).empty


def test_compute_time_series_by_virus_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 5, 4, 1],
        "DT_SIN_PRI": [pd.to_datetime("2023-01-01"), pd.to_datetime("2023-01-02"), pd.to_datetime("2023-01-03"), pd.to_datetime("2023-02-01")]
    })
    res = compute_time_series_by_virus(df)
    assert len(res) == 3
    assert "Influenza" in res["virus"].values
    assert "COVID-19" in res["virus"].values
    assert "Não Especificada" not in res["virus"].values


def test_compute_alert_thresholds_empty() -> None:
    res = compute_alert_thresholds(pd.DataFrame())
    assert res == {"medium": 0, "high": 0, "very_high": 0}


def test_compute_alert_thresholds_valid() -> None:
    dates = pd.date_range("2023-01-01", periods=10, freq="W")
    df = pd.DataFrame({"DT_SIN_PRI": np.random.choice(dates, size=100)})
    res = compute_alert_thresholds(df)
    assert res["medium"] >= 0
    assert res["high"] > res["medium"]
    assert res["very_high"] > res["high"]


def test_compute_notification_delay_series_empty() -> None:
    assert compute_notification_delay_series(pd.DataFrame()) == []


def test_compute_notification_delay_series_valid() -> None:
    df = pd.DataFrame({
        "DT_SIN_PRI": ["2023-01-01", "2023-01-02", "2023-01-03"],
        "DT_NOTIFIC": ["2023-01-05", "2023-01-10", "2023-01-01"] # third is delay=-2 (should be ignored)
    })
    res = compute_notification_delay_series(df)
    assert len(res) > 0
    assert "median_delay" in res[0]
    assert "epi_week" in res[0]


def test_compute_positivity_trend_empty() -> None:
    assert compute_positivity_trend(pd.DataFrame()) == []


def test_compute_positivity_trend_valid() -> None:
    df = pd.DataFrame({
        "DT_SIN_PRI": ["2023-01-01", "2023-01-02", "2023-01-03"],
        "AMOSTRA": [1, 1, 2],
        "PCR_RESUL": [1, 2, 1],
        "RES_AN": [np.nan, np.nan, np.nan]
    })
    res = compute_positivity_trend(df)
    assert len(res) > 0
    assert res[0]["tested"] == 2
    assert res[0]["positive"] == 2
    assert res[0]["positivity_rate"] == 100.0


def test_compute_influenza_subtypes_empty() -> None:
    assert compute_influenza_subtypes(pd.DataFrame()) == []


def test_compute_influenza_subtypes_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 1, 1, 5],
        "PCR_FLUASU": [1, 2, np.nan, np.nan],
        "PCR_FLUBLI": [np.nan, np.nan, 1, np.nan]
    })
    res = compute_influenza_subtypes(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["A/H1N1 pdm09"] == 1
    assert res_dict["A/H3N2"] == 1
    assert res_dict["B (Victoria)"] == 1


def test_compute_antiviral_usage_empty() -> None:
    res = compute_antiviral_usage(pd.DataFrame())
    assert res == {"adherence_rate": 0, "total_indicated": 0, "treated": 0}


def test_compute_antiviral_usage_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 1, 1, 5],
        "ANTIVIRAL": [1, 2, 9, 1]
    })
    res = compute_antiviral_usage(df)
    assert res["total_indicated"] == 3
    assert res["treated"] == 1
    assert res["adherence_rate"] == 33.3


def test_compute_closure_criteria_empty() -> None:
    assert compute_closure_criteria(pd.DataFrame()) == []


def test_compute_closure_criteria_valid() -> None:
    df = pd.DataFrame({"CRITERIO": [1, 2, 3, 4, 5, np.nan]})
    res = compute_closure_criteria(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["Laboratorial"] == 1
    assert res_dict["Óbito"] == 1
    assert res_dict["Ignorado/Em Aberto"] == 2


def test_compute_time_series_empty() -> None:
    assert compute_time_series(pd.DataFrame()).empty


def test_compute_time_series_valid() -> None:
    df = pd.DataFrame({
        "DT_SIN_PRI": ["2023-01-01", "2023-01-02"]
    })
    res = compute_time_series(df)
    assert not res.empty
    assert "total" in res.columns


def test_compute_virus_distribution_empty() -> None:
    assert compute_virus_distribution(pd.DataFrame()).empty


def test_compute_virus_distribution_valid() -> None:
    df = pd.DataFrame({"CLASSI_FIN": [1, 5, 4]})
    res = compute_virus_distribution(df)
    assert len(res) == 3
    assert res.iloc[0]["virus"] == "Influenza"


def test_compute_virus_detailed_distribution_empty() -> None:
    assert compute_virus_detailed_distribution(pd.DataFrame()).empty


def test_compute_virus_detailed_distribution_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 5, 2],
        "TP_FLU_PCR": [1, np.nan, np.nan],
        "PCR_SARS2": [np.nan, 1, np.nan],
        "PCR_FLUASU": [1, np.nan, np.nan],
        "PCR_FLUBLI": [np.nan, np.nan, np.nan],
        "VG_OMS": [np.nan, 1, np.nan]
    })
    res = compute_virus_detailed_distribution(df)
    assert len(res) > 0
    viruses = res["virus"].values
    assert "Influenza A" in viruses
    assert "SARS-CoV-2" in viruses
    assert "Outros virus" in viruses

    res_flu = compute_virus_detailed_distribution(df, "influenza_detailed")
    assert len(res_flu) > 0

    res_cov = compute_virus_detailed_distribution(df, "covid_detailed")
    assert len(res_cov) > 0


def test_compute_genomic_variants_empty() -> None:
    assert compute_genomic_variants(pd.DataFrame()) == {"weeks": [], "variants": {}}


def test_compute_genomic_variants_valid() -> None:
    df = pd.DataFrame({
        "VG_OMS": [1, 2, 1],
        "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2023-01-15"]
    })
    res = compute_genomic_variants(df)
    assert len(res["weeks"]) == 2
    assert "Ômicron" in res["variants"]


def test_compute_lethality_heatmap_empty() -> None:
    assert compute_lethality_heatmap(pd.DataFrame()) == {"agents": [], "age_bands": [], "matrix": []}


def test_compute_lethality_heatmap_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 1, 5],
        "NU_IDADE_N": [30, 35, 75],
        "TP_IDADE": [3, 3, 3],
        "EVOLUCAO": [1, 2, 2]
    })
    res = compute_lethality_heatmap(df)
    assert len(res["agents"]) > 0
    assert len(res["age_bands"]) > 0
    assert len(res["matrix"]) > 0


def test_compute_codetection_matrix_empty() -> None:
    assert compute_codetection_matrix(pd.DataFrame()) == {"labels": [], "matrix": []}


def test_compute_codetection_matrix_valid() -> None:
    df = pd.DataFrame({
        "CO_DETEC": [1, 1, 2],
        "PCR_SARS2": [1, 1, 1],
        "PCR_VSR": [1, 0, 0]
    })
    res = compute_codetection_matrix(df)
    assert len(res["labels"]) > 0
    assert len(res["matrix"]) > 0


def test_compute_imaging_profile_empty() -> None:
    assert compute_imaging_profile(pd.DataFrame()) == {"raiox": [], "tomo": []}


def test_compute_imaging_profile_valid() -> None:
    df = pd.DataFrame({
        "RAIOX_RES": [1, 2, 9],
        "TOMO_RES": [1, 3, 9]
    })
    res = compute_imaging_profile(df)
    assert len(res["raiox"]) > 0
    assert len(res["tomo"]) > 0


def test_compute_serology_profile_empty() -> None:
    assert compute_serology_profile(pd.DataFrame()) == {"types": [], "igg": [], "igm": []}


def test_compute_serology_profile_valid() -> None:
    df = pd.DataFrame({
        "TP_SOR": [1, 2],
        "RES_IGG": [1, 2],
        "RES_IGM": [3, 1]
    })
    res = compute_serology_profile(df)
    assert len(res["types"]) > 0
    assert len(res["igg"]) > 0
    assert len(res["igm"]) > 0


def test_compute_antiviral_types_empty() -> None:
    assert compute_antiviral_types(pd.DataFrame()) == []


def test_compute_antiviral_types_valid() -> None:
    df = pd.DataFrame({
        "TP_ANTIVIR": [1, 2],
        "TIPO_TRAT": [1, 2]
    })
    res = compute_antiviral_types(df)
    assert len(res) > 0


def test_compute_laboratory_network_summary_empty() -> None:
    res = compute_laboratory_network_summary(pd.DataFrame())
    assert res["labs"] == []


def test_compute_laboratory_network_summary_valid() -> None:
    df = pd.DataFrame({
        "PCR_RESUL": [1, 2],
        "RES_AN": [np.nan, np.nan],
        "CO_LAB_AN": ["L1", "L2"],
        "LAB_AN": ["Lab 1", ""],
        "DT_COLETA": ["2023-01-01", "2023-01-01"],
        "DT_PCR": ["2023-01-03", "2023-01-02"],
        "DT_RES_AN": [np.nan, np.nan],
        "CO_DETEC": [1, np.nan],
        "VG_REINF": [1, np.nan],
        "DT_SIN_PRI": ["2023-01-01", "2023-01-01"]
    })
    res = compute_laboratory_network_summary(df)
    assert len(res["labs"]) == 2
    assert res["overall"]["tested_cases"] == 2
    assert res["overall"]["positive_rate"] == 50.0
    assert len(res["reinfection_trend"]) > 0


def test_compute_vaccine_manufacturer_distribution_empty() -> None:
    assert compute_vaccine_manufacturer_distribution(pd.DataFrame()) == []


def test_compute_vaccine_manufacturer_distribution_valid() -> None:
    df = pd.DataFrame({
        "FAB_COV1": ["PFIZER", "BUTANTAN", "UNKNOWN", np.nan],
        "FAB_COV2": [np.nan, "CORONAVAC", np.nan, np.nan]
    })
    res = compute_vaccine_manufacturer_distribution(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["Pfizer/BioNTech"] == 1
    assert res_dict["Butantan/Sinovac"] == 1
    assert res_dict["Unknown"] == 1


def test_compute_mortality_by_treatment_agent_empty() -> None:
    assert compute_mortality_by_treatment_agent(pd.DataFrame()).empty


def test_compute_mortality_by_treatment_agent_valid() -> None:
    df = pd.DataFrame({
        "CLASSI_FIN": [1, 5, 4],
        "SUPORT_VEN": [1, 2, 3],
        "EVOLUCAO": [2, 2, 1]
    })
    res = compute_mortality_by_treatment_agent(df)
    assert len(res) == 2


def test_compute_vaccination_and_treatment_profile_empty() -> None:
    res = compute_vaccination_and_treatment_profile(pd.DataFrame())
    assert res == {
        "covid_vaccinated_count": 0,
        "flu_vaccinated_count": 0,
        "influenza_antiviral_count": 0,
        "covid_treatment_count": 0,
    }


def test_compute_vaccination_and_treatment_profile_valid() -> None:
    df = pd.DataFrame({
        "VACINA_COV": [1, 2, 1],
        "VACINA": [1, 1, 2],
        "ANTIVIRAL": [1, 2, 9],
        "TRAT_COV": [2, 1, 1]
    })
    res = compute_vaccination_and_treatment_profile(df)
    assert res["covid_vaccinated_count"] == 2
    assert res["flu_vaccinated_count"] == 2
    assert res["influenza_antiviral_count"] == 1
    assert res["covid_treatment_count"] == 2


def test_compute_aggregated_timeline_empty() -> None:
    assert compute_aggregated_timeline(pd.DataFrame()) == []


def test_compute_aggregated_timeline_valid() -> None:
    df = pd.DataFrame({
        "DT_SIN_PRI": pd.to_datetime(["2023-01-01", "2023-01-01", "2023-01-01"]),
        "DT_INTERNA": pd.to_datetime(["2023-01-05", "2023-01-06", "2023-01-07"]),
        "DT_EVOLUCA": pd.to_datetime(["2023-01-10", "2023-01-12", "2023-01-15"]),
        "VACINA_COV": [2, 1, 1],
        "DOSE_1_COV": [np.nan, "2022-12-01", "2022-11-01"],
        "DOSE_2_COV": [np.nan, "2022-12-15", "2022-11-15"], # Both "Esquema Completo"
        "EVOLUCAO": [1, 2, 2],
        "UTI": [1, 2, 1]
    })
    res = compute_aggregated_timeline(df, virus="covid")
    assert len(res) > 0
    
    # Check "Esquema Completo" profile
    vax_profile = next(r for r in res if r["perfil"] == "Esquema Completo")
    
    assert vax_profile["n"] == 2
    assert vax_profile["uti_pct"] == 50.0 # 1 out of 2 in UTI
    
    # Quantiles for symp_to_hosp [5, 6] -> median=5.5
    assert vax_profile["mediana_sintoma_internacao"] == 5.5
    
    # Quantiles for hosp_to_outcome [6, 8] -> median=7.0
    assert vax_profile["mediana_internacao_desfecho"] == 7.0
