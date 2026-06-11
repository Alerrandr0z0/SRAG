"""Mutation-targeted tests for quality.py: exact values, boundaries, edge cases."""

import numpy as np
import pandas as pd
import pytest

from srag.data.analytics.quality import (
    compute_closure_by_agent,
    compute_completeness_trend,
    compute_data_completeness,
    compute_delay_by_unit,
    compute_diagnostic_latency,
    compute_diagnostic_latency_phases,
    compute_imaging_by_severity,
    compute_logical_inconsistencies,
    compute_positivity_by_sample_type,
    compute_quality_by_unit,
    compute_sample_type_distribution,
    compute_testing_coverage,
)


class TestDiagnosticLatency:
    def test_exact_quartiles(self) -> None:
        df = pd.DataFrame(
            {
                "DT_COLETA": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_PCR": ["2023-01-03", "2023-01-05", "2023-01-07", "2023-01-09"],
            }
        )
        res = compute_diagnostic_latency(df)
        assert len(res["boxplot_data"]) == 5
        assert res["boxplot_data"][0] == 2.0
        assert res["boxplot_data"][4] == 8.0

    def test_target_adherence_rate(self) -> None:
        df = pd.DataFrame(
            {
                "DT_COLETA": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_PCR": ["2023-01-03", "2023-01-05", "2023-01-10", "2023-01-15"],
            }
        )
        res = compute_diagnostic_latency(df)
        assert res["target_adherence_rate"] == 50.0

    def test_delta_zero_included(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-01-01"]})
        res = compute_diagnostic_latency(df)
        assert res["median"] == 0.0

    def test_p95_p99_included(self) -> None:
        deltas = list(range(0, 21))
        df = pd.DataFrame(
            {
                "DT_COLETA": ["2023-01-01"] * len(deltas),
                "DT_PCR": pd.to_datetime(["2023-01-01"] * len(deltas))
                + pd.to_timedelta(deltas, unit="D"),
            }
        )
        res = compute_diagnostic_latency(df)
        assert "p95" in res
        assert "p99" in res
        assert res["p95"] >= 18.0
        assert res["p99"] >= 19.0

    def test_delta_over_30_excluded(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-02-01"]})
        res = compute_diagnostic_latency(df)
        assert res == {
            "boxplot_data": [],
            "median": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "target_adherence_rate": 0.0,
        }

    def test_missing_date_columns(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"]})
        res = compute_diagnostic_latency(df)
        assert res == {
            "boxplot_data": [],
            "median": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "target_adherence_rate": 0.0,
        }

    def test_empty_df(self) -> None:
        res = compute_diagnostic_latency(pd.DataFrame())
        assert res == {
            "boxplot_data": [],
            "median": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "target_adherence_rate": 0.0,
        }


class TestSampleTypeDistribution:
    def test_exact_mapping(self) -> None:
        df = pd.DataFrame({"TP_AMOSTRA": [1, 2, 3, 4, 5, 9]})
        res = {r["label"]: r["count"] for r in compute_sample_type_distribution(df)}
        assert res["Secreção Naso/Orofaringe"] == 1
        assert res["Lavado Bronco-alveolar"] == 1
        assert res["Tecido post-mortem"] == 1
        assert res["Outra"] == 1
        assert res["LCR"] == 1
        assert res["Ignorado"] == 1

    def test_unmapped_code_ignored(self) -> None:
        df = pd.DataFrame({"TP_AMOSTRA": [99, 1]})
        res = {r["label"]: r["count"] for r in compute_sample_type_distribution(df)}
        assert sum(res.values()) == 1

    def test_empty_df(self) -> None:
        assert compute_sample_type_distribution(pd.DataFrame()) == []

    def test_missing_column(self) -> None:
        assert compute_sample_type_distribution(pd.DataFrame({"OUTRA": [1]})) == []


class TestTestingCoverage:
    def test_exact_rate(self) -> None:
        df = pd.DataFrame({"AMOSTRA": [1, 1, 2, 9]})
        res = compute_testing_coverage(df)
        assert res["collected"] == 2
        assert res["total"] == 4
        assert res["rate"] == 50.0

    def test_none_collected(self) -> None:
        df = pd.DataFrame({"AMOSTRA": [2, 9, np.nan]})
        res = compute_testing_coverage(df)
        assert res["collected"] == 0
        assert res["rate"] == 0.0

    def test_empty_df(self) -> None:
        res = compute_testing_coverage(pd.DataFrame())
        assert res == {"collected": 0, "total": 0, "rate": 0.0}

    def test_missing_column(self) -> None:
        df = pd.DataFrame({"OUTRA": [1, 2]})
        res = compute_testing_coverage(df)
        assert res["collected"] == 0
        assert res["total"] == 2
        assert res["rate"] == 0.0


class TestDataCompleteness:
    def test_exact_rate(self) -> None:
        df = pd.DataFrame(
            {
                "DT_NOTIFIC": ["2023-01-01", "", np.nan],
                "DT_SIN_PRI": ["2023-01-02", "", np.nan],
                "CS_SEXO": ["F", "M", "I"],
                "NU_IDADE_N": [1, 2, np.nan],
                "TP_IDADE": [3, 3, np.nan],
                "ID_MUNICIP": [1, 1, np.nan],
                "ID_UNIDADE": [10, 10, np.nan],
                "CS_RACA": [1, 9, 1],
                "CS_ESCOL_N": [1, 9, np.nan],
                "PAC_DSCBO": ["Medico", "", np.nan],
                "CS_ZONA": [1, 9, 1],
                "NM_BAIRRO": ["Centro", "", np.nan],
                "NU_CEP": ["59600-000", "", np.nan],
                "ID_MN_RESI": [1, 1, np.nan],
                "HOSPITAL": [1, 9, 1],
                "DT_INTERNA": ["2023-01-03", "", np.nan],
                "UTI": [1, 9, 2],
                "DT_ENTUTI": ["2023-01-04", "", np.nan],
                "SUPORT_VEN": [1, 9, 2],
                "EVOLUCAO": [1, 9, 1],
                "DT_EVOLUCA": ["2023-01-10", "", np.nan],
                "CLASSI_FIN": [1, 9, 1],
                "CRITERIO": [1, 9, 1],
                "AMOSTRA": [1, 9, 2],
                "TP_AMOSTRA": [1, 9, 2],
                "DT_COLETA": ["2023-01-01", "", np.nan],
                "PCR_RESUL": [1, 9, 4],
                "RES_AN": [1, 9, 4],
                "DT_PCR": ["2023-01-05", "", np.nan],
                "LAB_AN": ["L1", "", np.nan],
                "VACINA_COV": [1, 9, 2],
                "DOSE_1_COV": [1, 9, 2],
                "DOSE_2_COV": [1, 9, 2],
                "DOSE_REF": [1, 9, 2],
                "VACINA": [1, 9, 2],
                "DT_UT_DOSE": ["2023-01-01", "", np.nan],
                "CS_GESTANT": [3, 9, 1],
                "PUERPERA": [1, 9, 0],
            }
        )
        res = {r["group"]: r["overall_score"] for r in compute_data_completeness(df)}
        assert "Identificação do Caso" in res
        assert "Demografia e Residência" in res
        assert "Linha do Cuidado" in res
        assert "Coleta e Diagnóstico" in res
        assert "Vacinação e Gestação" in res
        assert res["Vacinação e Gestação"] == 70.8

    def test_empty_df(self) -> None:
        assert compute_data_completeness(pd.DataFrame()) == []


class TestCompletenessTrend:
    def test_empty_df(self) -> None:
        assert compute_completeness_trend(pd.DataFrame()) == []

    def test_completeness_trend_calculation(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-08"],
                "DT_NOTIFIC": ["2023-01-01", "2023-01-08"],
                "CS_SEXO": ["F", "F"],
                "NU_IDADE_N": [30, 30],
                "TP_IDADE": [3, 3],
                "ID_MUNICIP": ["240800", "240800"],
                "ID_UNIDADE": ["1", "1"],
                "CS_RACA": [1, 9],
                "CS_ESCOL_N": [1, 9],
                "PAC_DSCBO": ["123", ""],
                "CS_ZONA": [1, 9],
                "NM_BAIRRO": ["Centro", ""],
                "ID_MN_RESI": ["240800", "240800"],
                "HOSPITAL": [1, 9],
                "DT_INTERNA": ["2023-01-02", ""],
                "UTI": [1, 9],
                "DT_ENTUTI": ["2023-01-02", ""],
                "SUPORT_VEN": [1, 9],
                "EVOLUCAO": [1, 9],
                "DT_EVOLUCA": ["2023-01-10", ""],
                "CLASSI_FIN": [1, 9],
                "CRITERIO": [1, 9],
                "AMOSTRA": [1, 9],
                "DT_COLETA": ["2023-01-01", ""],
                "TP_AMOSTRA": [1, 9],
                "PCR_RESUL": [1, 9],
                "RES_AN": [1, 9],
                "DT_PCR": ["2023-01-01", ""],
                "LAB_AN": ["LAB A", ""],
                "VACINA_COV": [1, 9],
                "DOSE_1_COV": [1, 9],
                "DOSE_2_COV": [1, 9],
                "DOSE_REF": [1, 9],
                "VACINA": [1, 9],
                "DT_UT_DOSE": ["2023-01-01", ""],
                "CS_GESTANT": [9, 9],
                "PUERPERA": [9, 9],
            }
        )
        res = compute_completeness_trend(df)
        assert len(res) == 2
        # Row 0: 35/37 fields valid (CS_GESTANT=9 e PUERPERA=9 ignorados para mulheres)
        assert res[0]["score"] == pytest.approx(94.6, abs=0.1)
        # Row 1: 8/37 fields valid (the 7 identification + ID_MN_RESI)
        assert res[1]["score"] == pytest.approx(21.6, abs=0.1)
        assert res[0]["total"] == 1
        assert res[1]["total"] == 1
        # Blocks should be present
        for r in res:
            assert "blocks" in r
            for b in [
                "Identificação do Caso",
                "Demografia e Residência",
                "Linha do Cuidado",
                "Coleta e Diagnóstico",
                "Vacinação e Gestação",
            ]:
                assert b in r["blocks"]


class TestQualityByUnit:
    def test_empty_df(self) -> None:
        assert compute_quality_by_unit(pd.DataFrame()) == []

    def test_quality_by_unit_sorting(self) -> None:
        df = pd.DataFrame(
            {
                "ID_UNIDADE": ["UnitA", "UnitB"],
                "DT_NOTIFIC": ["2023-01-01", "2023-01-01"],
                "DT_SIN_PRI": ["2023-01-02", "2023-01-02"],
                "CS_SEXO": ["M", "I"],
                "NU_IDADE_N": [10, np.nan],
                "TP_IDADE": [3, np.nan],
                "ID_MUNICIP": [1, np.nan],
                "CS_RACA": [1, np.nan],
            }
        )
        res = compute_quality_by_unit(df)
        assert len(res) == 2
        assert res[0]["id_unidade"] == "UnitB"
        assert res[1]["id_unidade"] == "UnitA"
        assert res[0]["score"] < res[1]["score"]
        assert res[0]["total"] == 1
        assert res[1]["total"] == 1
        assert res[0]["worst_field"] is not None


class TestLogicalInconsistencies:
    def test_empty_df(self) -> None:
        assert compute_logical_inconsistencies(pd.DataFrame()) == []

    def test_inconsistencies_rules(self) -> None:
        df = pd.DataFrame(
            {
                "EVOLUCAO": [2, 1, 1, 1, 1, 1, 1, 2],
                "DT_EVOLUCA": [
                    "",
                    "2023-01-05",
                    "2023-01-05",
                    "2023-01-05",
                    "2023-01-05",
                    "2023-01-05",
                    "2023-01-05",
                    "2023-01-01",
                ],
                "HOSPITAL": [2, 1, 2, 2, 2, 2, 2, 2],
                "DT_INTERNA": ["", "", "", "", "", "", "", ""],
                "UTI": [2, 2, 1, 2, 2, 2, 2, 2],
                "DT_ENTUTI": ["", "", "", "", "", "", "", ""],
                "PCR_RESUL": [2, 2, 2, 1, 2, 9, 2, 2],
                "CLASSI_FIN": [1, 1, 1, 4, 1, 1, 1, 1],
                "ANTIVIRAL": [2, 2, 2, 2, 1, 2, 2, 2],
                "DT_ANTIVIR": ["", "", "", "", "", "", "", ""],
                "AMOSTRA": [2, 2, 2, 2, 2, 1, 2, 2],
                "RES_AN": [9, 9, 9, 9, 9, 9, 9, 9],
                "CRITERIO": [1, 1, 1, 1, 1, 1, "", 1],
                "DT_SIN_PRI": [
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-01",
                    "2023-01-10",
                ],
            }
        )
        res = compute_logical_inconsistencies(df)
        inconsistencies = {r["rule"]: r["count"] for r in res}
        assert inconsistencies["R1"] == 1
        assert inconsistencies["R2"] == 1
        assert inconsistencies["R3"] == 1
        assert inconsistencies["R4"] == 1
        assert inconsistencies["R5"] == 1
        assert inconsistencies["R6"] == 1
        assert inconsistencies["R7"] == 1
        assert inconsistencies["R8"] == 1


class TestClosureByAgent:
    def test_empty_df(self) -> None:
        assert compute_closure_by_agent(pd.DataFrame()) == []

    def test_exact_crosstab(self) -> None:
        df = pd.DataFrame(
            {
                "CLASSI_FIN": [5, 5, 1, 4],
                "CRITERIO": [1, 2, 1, 9],
            }
        )
        res = compute_closure_by_agent(df)
        assert len(res) == 3
        # Agents: COVID-19, Influenza, Não Especificada
        covid_row = next(r for r in res if r["agent"] == "COVID-19")
        assert covid_row["total"] == 2
        assert covid_row["Laboratorial"] == 1
        assert covid_row["Vínculo Epidemiológico"] == 1
        assert covid_row["Clínico / Imagem"] == 0


class TestImagingBySeverity:
    def test_empty_df(self) -> None:
        res = compute_imaging_by_severity(pd.DataFrame())
        assert res == {"raiox": [], "tomo": []}

    def test_exact_rates(self) -> None:
        df = pd.DataFrame(
            {
                "RAIOX_RES": [1, 1, 2, 2],
                "TOMO_RES": [1, 1, 5, 9],
                "UTI": [1, 2, 1, np.nan],
                "EVOLUCAO": [1, 2, 1, 9],
            }
        )
        res = compute_imaging_by_severity(df)
        assert "raiox" in res
        assert "tomo" in res
        rx_normal = next(r for r in res["raiox"] if r["finding"] == "Normal")
        assert rx_normal["total"] == 2
        assert rx_normal["uti_count"] == 1
        assert rx_normal["uti_rate"] == 50.0
        assert rx_normal["death_count"] == 1
        assert rx_normal["death_rate"] == 50.0


class TestDelayByUnit:
    def test_empty_df(self) -> None:
        assert compute_delay_by_unit(pd.DataFrame()) == []

    def test_exact_delay(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
                "DT_NOTIFIC": ["2023-01-03", "2023-01-05"],
                "ID_UNIDADE": ["U1", "U1"],
            }
        )
        res = compute_delay_by_unit(df)
        assert len(res) == 1
        assert res[0]["id_unidade"] == "U1"
        assert res[0]["total"] == 2
        assert res[0]["median_delay"] == 3.0
        assert res[0]["avg_delay"] == 3.0
        assert res[0]["delay_samples"] == [2, 4]

    def test_delay_samples_capped(self) -> None:
        delays = list(range(1, 121))
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"] * 120,
                "DT_NOTIFIC": [pd.Timestamp("2023-01-01") + pd.Timedelta(days=d) for d in delays],
                "ID_UNIDADE": ["U1"] * 120,
            }
        )
        res = compute_delay_by_unit(df)
        # Filter caps at 60 days; sample cap is 100 but only 60 fit
        assert len(res[0]["delay_samples"]) == 60
        assert res[0]["delay_samples"][0] == 1
        assert res[0]["delay_samples"][-1] == 60

    def test_delay_samples_within_max(self) -> None:
        # Verify sort + slicing in the aggregation lambda
        delays = [10, 3, 7, 1, 5, 9, 2, 8, 4, 6]
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01"] * 10,
                "DT_NOTIFIC": [pd.Timestamp("2023-01-01") + pd.Timedelta(days=d) for d in delays],
                "ID_UNIDADE": ["U1"] * 10,
            }
        )
        res = compute_delay_by_unit(df)
        assert res[0]["delay_samples"] == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


class TestPositivityBySampleType:
    def test_empty_df(self) -> None:
        assert compute_positivity_by_sample_type(pd.DataFrame()) == []

    def test_exact_positivity(self) -> None:
        df = pd.DataFrame(
            {
                "TP_AMOSTRA": [1, 1, 2],
                "AMOSTRA": [1, 1, 1],
                "PCR_RESUL": [1, 2, 2],
                "RES_AN": [2, 2, 2],
            }
        )
        res = compute_positivity_by_sample_type(df)
        naso = next(r for r in res if r["sample_type"] == "Secreção Naso/Orofaringe")
        assert naso["tested"] == 2
        assert naso["positive"] == 1
        assert naso["positivity_rate"] == 50.0


class TestDiagnosticLatencyPhases:
    def test_empty_df(self) -> None:
        res = compute_diagnostic_latency_phases(pd.DataFrame())
        assert res == {
            "symptom_to_notification": 0.0,
            "notification_to_collection": 0.0,
            "collection_to_result": 0.0,
            "symptom_to_treatment": 0.0,
        }

    def test_exact_latencies(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01"],
                "DT_NOTIFIC": ["2023-01-03", "2023-01-03"],
                "DT_COLETA": ["2023-01-05", "2023-01-05"],
                "DT_PCR": ["2023-01-08", "2023-01-10"],
                "ANTIVIRAL": [1, 2],
                "DT_ANTIVIR": ["2023-01-02", "2023-01-02"],
            }
        )
        res = compute_diagnostic_latency_phases(df)
        assert res["symptom_to_notification"] == 2.0
        assert res["notification_to_collection"] == 2.0
        assert res["collection_to_result"] == 4.0
        assert res["symptom_to_treatment"] == 1.0
