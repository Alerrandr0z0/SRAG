import numpy as np
import pandas as pd

from srag.data.analytics.quality import (
    compute_data_completeness,
    compute_diagnostic_latency,
    compute_sample_type_distribution,
    compute_testing_coverage,
)


def test_diagnostic_latency_empty() -> None:
    df = pd.DataFrame()
    res = compute_diagnostic_latency(df)
    assert res == {"boxplot_data": [], "median": 0.0}

def test_diagnostic_latency_missing_cols() -> None:
    df = pd.DataFrame({"DT_COLETA": ["2023-01-01"]})
    res = compute_diagnostic_latency(df)
    assert res == {"boxplot_data": [], "median": 0.0}

def test_diagnostic_latency_valid() -> None:
    df = pd.DataFrame({
        "DT_COLETA": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01", "invalid"],
        "DT_PCR": ["2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-10", "2023-01-01"]
    })
    res = compute_diagnostic_latency(df)
    assert res["count"] == 5
    assert res["median"] == 3.0
    assert len(res["boxplot_data"]) == 5
    assert res["boxplot_data"][0] == 1.0  # min
    assert res["boxplot_data"][-1] == 9.0 # max

def test_diagnostic_latency_outliers() -> None:
    df = pd.DataFrame({
        "DT_COLETA": ["2023-01-10", "2023-01-01", "2023-01-01"],
        "DT_PCR": ["2023-01-01", "2023-03-01", "2023-01-05"] # 1st is negative delta, 2nd is > 30, 3rd is valid
    })
    res = compute_diagnostic_latency(df)
    assert res["count"] == 1
    assert res["median"] == 4.0

def test_sample_type_distribution_empty() -> None:
    df = pd.DataFrame()
    res = compute_sample_type_distribution(df)
    assert res == []

def test_sample_type_distribution_missing_col() -> None:
    df = pd.DataFrame({"OUTRA_COLUNA": [1]})
    res = compute_sample_type_distribution(df)
    assert res == []

def test_sample_type_distribution_valid() -> None:
    df = pd.DataFrame({
        "TP_AMOSTRA": [1, 1, 2, "3", 9, 10, "invalid"]
    })
    res = compute_sample_type_distribution(df)
    res_dict = {item["label"]: item["count"] for item in res}
    assert res_dict.get("Secreção Naso/Orofaringe") == 2
    assert res_dict.get("Lavado Bronco-alveolar") == 1
    assert res_dict.get("Tecido post-mortem") == 1
    assert res_dict.get("Ignorado") == 1
    # 10 and 'invalid' should be ignored/dropped by map

def test_testing_coverage_empty() -> None:
    df = pd.DataFrame()
    res = compute_testing_coverage(df)
    assert res == {"collected": 0, "total": 0, "rate": 0.0}

def test_testing_coverage_missing_col() -> None:
    df = pd.DataFrame({"OUTRA": [1, 2]})
    res = compute_testing_coverage(df)
    assert res == {"collected": 0, "total": 2, "rate": 0.0}

def test_testing_coverage_valid() -> None:
    df = pd.DataFrame({
        "AMOSTRA": [1, "1", 2, 9, "invalid", None]
    })
    res = compute_testing_coverage(df)
    assert res["total"] == 6
    assert res["collected"] == 2
    assert res["rate"] == round((2/6)*100, 1)

def test_data_completeness_empty() -> None:
    df = pd.DataFrame()
    res = compute_data_completeness(df)
    assert res == []

def test_data_completeness_missing_cols() -> None:
    df = pd.DataFrame({"OUTRA": [1, 2, 3]})
    res = compute_data_completeness(df)
    assert len(res) == 5
    for group in res:
        assert group["overall_score"] == 0.0
        for field in group["fields"]:
            assert field["rate"] == 0.0

def test_data_completeness_valid() -> None:
    df = pd.DataFrame({
        "NU_IDADE_N": [10, 20, np.nan, 40], # 3 valid
        "CS_SEXO": ["M", "F", "I", ""],     # 2 valid (I is ignored, "" is empty)
        "CS_RACA": [1, 2, 9, 4],            # 3 valid (9 is ignored)
        "CS_ESCOL_N": ["1", "2", "9", np.nan], # 2 valid (9 ignored, nan invalid)
        "PAC_DSCBO": ["Ocupacao", "9", 9, ""], # 1 valid
        "CS_ZONA": [1, 2, 9, 3],            # 3 valid

        "DT_SIN_PRI": ["2023", "2023", None, "2023"], # 3 valid
        "FEBRE": [1, 2, 9, 1], # 3 valid
        "TOSSE": [1, 1, 9, 2], # 3 valid
        "DISPNEIA": [1, 2, 9, 1], # 3 valid
        "SATURACAO": [1, 2, 9, 1], # 3 valid
        "FATOR_RISC": ["S", "N", 9, "S"], # 3 valid

        "DT_INTERNA": ["2023", None, None, None], # 1 valid
        "UTI": [1, 2, 9, 9], # 2 valid
        "SUPORT_VEN": [1, 2, 3, 9], # 3 valid
        "EVOLUCAO": [1, 2, 9, np.nan], # 2 valid
        "DT_EVOLUCA": ["2023", "2023", None, None], # 2 valid

        "AMOSTRA": [1, 2, 9, 1], # 3 valid
        "TP_AMOSTRA": [1, 2, 9, 3], # 3 valid
        "DT_COLETA": ["2023", None, "2023", "2023"], # 3 valid
        "PCR_RESUL": [1, 2, 9, 4], # 2 valid
        "CLASSI_FIN": [1, 2, 3, 9], # 3 valid

        "ANTIVIRAL": [1, 2, 9, 1], # 3 valid
        "VACINA_COV": [1, 2, 9, 1], # 3 valid
        "VACINA": [1, 2, 9, 1], # 3 valid
    })
    res = compute_data_completeness(df)

    assert len(res) == 5
    demo_group = next(g for g in res if g["group"] == "Demografia e Perfil")
    idade_rate = next(f["rate"] for f in demo_group["fields"] if f["field"] == "Idade")
    assert idade_rate == 75.0 # 3/4
    sexo_rate = next(f["rate"] for f in demo_group["fields"] if f["field"] == "Sexo")
    assert sexo_rate == 50.0 # 2/4
