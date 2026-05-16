import pandas as pd

from srag.data.analytics.filters import (
    _age_years,
    apply_global_filters,
    outcome_death_mask,
    outcome_valid_mask,
)
from srag.data.references import DEATH_OUTCOMES, VALID_OUTCOMES


def test_age_years_empty() -> None:
    df = pd.DataFrame()
    res = _age_years(df)
    assert res.empty


def test_age_years_idade_anos() -> None:
    df = pd.DataFrame({"IDADE_ANOS": [10, 20, pd.NA]})
    res = _age_years(df)
    assert list(res.dropna()) == [10.0, 20.0]


def test_age_years_precise_normalization() -> None:
    df = pd.DataFrame(
        {
            "NU_IDADE_N": [12, 365.25, 10],
            "TP_IDADE": [2, 1, pd.NA],  # 2=Months, 1=Days, NA=Fallback to years
        }
    )
    res = _age_years(df)
    assert res.iloc[0] == 1.0  # 12 months = 1 year
    assert res.iloc[1] == 1.0  # 365.25 days = 1 year
    assert res.iloc[2] == 10.0  # Fallback


def test_apply_global_filters_all_params_none() -> None:
    df = pd.DataFrame({"A": [1, 2]})
    res = apply_global_filters(df)
    assert res.equals(df)


def test_apply_global_filters_invalid_year_type() -> None:
    df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"]})
    # Should handle years as strings gracefully and return the record
    res = apply_global_filters(df, years=["2023"])  # type: ignore
    assert len(res) == 1

    # Test with integers as well
    res2 = apply_global_filters(df, years=[2023])
    assert len(res2) == 1


def test_apply_global_filters_empty() -> None:
    df = pd.DataFrame()
    res = apply_global_filters(df, years=[2023])
    assert res.empty


def test_apply_global_filters_years() -> None:
    df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01", "2022-01-01", "invalid"]})
    res = apply_global_filters(df, years=[2023])
    assert len(res) == 1
    assert res.iloc[0]["DT_SIN_PRI"] == "2023-01-01"


def test_apply_global_filters_profiles() -> None:
    # profiles: crianca (<12), adolescente (12-19), adulto (20-59), idoso (>=60)
    df = pd.DataFrame({"NU_IDADE_N": [10, 15, 30, 65, 8], "TP_IDADE": [3, 3, 3, 3, 3]})
    res = apply_global_filters(df, profiles=["crianca", "idoso"])
    assert len(res) == 3
    assert list(res["NU_IDADE_N"]) == [10, 65, 8]

    res2 = apply_global_filters(df, profiles=["adolescente", "adulto"])
    assert len(res2) == 2
    assert list(res2["NU_IDADE_N"]) == [15, 30]


def test_apply_global_filters_races() -> None:
    # 1=Branca, 2=Preta, 3=Amarela, 4=Parda, 5=Indígena
    df = pd.DataFrame({"CS_RACA": [1, 2, 3, 4, 5, 9]})
    res = apply_global_filters(df, races=["Branca", "Parda", "Indígena", "Invalid"])
    assert len(res) == 3
    assert list(res["CS_RACA"]) == [1, 4, 5]


def test_apply_global_filters_genders() -> None:
    df = pd.DataFrame({"CS_SEXO": ["M", "F", "I", "U"]})
    res = apply_global_filters(df, genders=["M", "i"])
    assert len(res) == 2
    assert list(res["CS_SEXO"]) == ["M", "I"]


def test_apply_global_filters_genders_and_maternal_complex() -> None:
    df = pd.DataFrame({"CS_SEXO": ["F", "F", "M", "I", "F"], "CS_GESTANT": [1, 5, 1, 5, 6]})

    # 1) 'F' + maternal (should handle F automatically via maternal)
    res = apply_global_filters(df, genders=["F"], maternal=["gestante"])
    assert len(res) == 1
    assert res.iloc[0]["CS_SEXO"] == "F" and res.iloc[0]["CS_GESTANT"] == 1

    # 2) 'M' + 'F' + maternal
    res2 = apply_global_filters(df, genders=["F", "M"], maternal=["gestante", "puerpera"])
    assert len(res2) == 3  # M=1, F=2 (gestante=1, puerpera=6)

    # 3) Only maternal (implied F)
    res3 = apply_global_filters(df, maternal=["gestante"])
    assert len(res3) == 1

    # 4) maternal puerpera only
    res4 = apply_global_filters(df, maternal=["puerpera"])
    assert len(res4) == 1


def test_apply_global_filters_occupations() -> None:
    df = pd.DataFrame({"PAC_DSCBO": ["  Doctor  ", "Nurse", ""]})
    res = apply_global_filters(df, occupations=["doctor"])
    assert len(res) == 1
    assert res.iloc[0]["PAC_DSCBO"] == "  Doctor  "


def test_apply_global_filters_zonas() -> None:
    df = pd.DataFrame({"ZONA": ["Urbana", "Rural", pd.NA]})
    res = apply_global_filters(df, zonas=["urbana"])
    assert len(res) == 1
    assert res.iloc[0]["ZONA"] == "Urbana"


def test_apply_global_filters_bairros() -> None:
    df = pd.DataFrame({"BAIRRO_REF": ["Centro", "Abolição", ""]})
    res = apply_global_filters(df, bairros=["centro"])
    assert len(res) == 1
    assert res.iloc[0]["BAIRRO_REF"] == "Centro"


def test_apply_global_filters_unidades() -> None:
    df = pd.DataFrame({"ID_UNIDADE": ["UPA", "Hospital", ""]})
    res = apply_global_filters(df, unidades=["upa"])
    assert len(res) == 1
    assert res.iloc[0]["ID_UNIDADE"] == "UPA"


def test_outcome_death_mask() -> None:
    val = next(iter(DEATH_OUTCOMES)) if DEATH_OUTCOMES else 2
    s = pd.Series([val, 999, pd.NA])
    res = outcome_death_mask(s)
    assert res.iloc[0]
    assert not res.iloc[1]
    assert not res.iloc[2]


def test_outcome_valid_mask() -> None:
    val = next(iter(VALID_OUTCOMES)) if VALID_OUTCOMES else 1
    s = pd.Series([val, 999, pd.NA])
    res = outcome_valid_mask(s)
    assert res.iloc[0]
    assert not res.iloc[1]
    assert not res.iloc[2]
