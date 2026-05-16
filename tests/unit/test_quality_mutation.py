"""Mutation-targeted tests for quality.py: exact values, boundaries, edge cases."""

import numpy as np
import pandas as pd

from srag.data.analytics.quality import (
    compute_data_completeness,
    compute_diagnostic_latency,
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
        df = pd.DataFrame(
            {"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-01-01"]}
        )
        res = compute_diagnostic_latency(df)
        assert res["median"] == 0.0

    def test_delta_over_30_excluded(self) -> None:
        df = pd.DataFrame(
            {"DT_COLETA": ["2023-01-01"], "DT_PCR": ["2023-02-01"]}
        )
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
                "NU_IDADE_N": [1, 2, np.nan],
                "CS_SEXO": ["F", "M", "I"],
                "CS_RACA": [1, 9, 1],
                "CS_ESCOL_N": [1, 9, np.nan],
                "PAC_DSCBO": ["Medico", "", np.nan],
                "CS_ZONA": [1, 9, 1],
                "DT_SIN_PRI": ["2023-01-01", "", np.nan],
                "FEBRE": [1, 9, 1],
                "TOSSE": [1, 9, np.nan],
                "DISPNEIA": [2, 9, 1],
                "SATURACAO": [1, 9, np.nan],
                "FATOR_RISC": [1, 9, 1],
                "DT_INTERNA": ["2023-01-02", "", np.nan],
                "UTI": [1, 9, 2],
                "SUPORT_VEN": [1, 9, 2],
                "EVOLUCAO": [1, 9, 1],
                "DT_EVOLUCA": ["2023-01-10", "", np.nan],
                "AMOSTRA": [1, 9, 2],
                "TP_AMOSTRA": [1, 9, 2],
                "DT_COLETA": ["2023-01-01", "", np.nan],
                "PCR_RESUL": [1, 9, 4],
                "CLASSI_FIN": [1, 9, 1],
                "ANTIVIRAL": [1, 9, 2],
                "VACINA_COV": [1, 9, 2],
                "VACINA": [1, 9, 2],
            }
        )
        res = {r["group"]: r["overall_score"] for r in compute_data_completeness(df)}
        assert "Demografia e Perfil" in res
        assert "Sinais e Sintomas" in res
        assert "Atendimento e Desfecho" in res
        assert "Laboratório e Diagnóstico" in res
        assert "Tratamento e Vacinação" in res
        assert res["Tratamento e Vacinação"] == round((2 / 3 + 2 / 3 + 2 / 3) / 3 * 100, 1)

    def test_empty_df(self) -> None:
        assert compute_data_completeness(pd.DataFrame()) == []
