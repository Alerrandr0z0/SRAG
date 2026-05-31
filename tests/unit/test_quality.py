"""Mutation-targeted tests for quality.py: exact values, boundaries, edge cases."""

import numpy as np
import pandas as pd

from srag.data.analytics.quality import (
    compute_completeness_trend,
    compute_data_completeness,
    compute_diagnostic_latency,
    compute_logical_inconsistencies,
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

    def test_delta_zero_included(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-01-01"]})
        res = compute_diagnostic_latency(df)
        assert res["median"] == 0.0

    def test_delta_over_30_excluded(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-02-01"]})
        res = compute_diagnostic_latency(df)
        assert res == {"boxplot_data": [], "median": 0.0}

    def test_missing_date_columns(self) -> None:
        df = pd.DataFrame({"DT_COLETA": ["2023-01-01"]})
        res = compute_diagnostic_latency(df)
        assert res == {"boxplot_data": [], "median": 0.0}

    def test_empty_df(self) -> None:
        res = compute_diagnostic_latency(pd.DataFrame())
        assert res == {"boxplot_data": [], "median": 0.0}


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
                "CLASSI_FIN": [1, 9],
                "EVOLUCAO": [1, 9],
                "AMOSTRA": [1, 9],
                "PCR_RESUL": [1, 9],
                "VACINA_COV": [1, 9],
                "CS_RACA": [1, 9],
                "UTI": [1, 9],
                "DT_COLETA": ["2023-01-01", ""],
            }
        )
        res = compute_completeness_trend(df)
        assert len(res) == 2
        assert res[0]["score"] == 100.0
        assert res[1]["score"] == 0.0
        assert res[0]["total"] == 1
        assert res[1]["total"] == 1


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
