import numpy as np
import pandas as pd

from srag.data.analytics.demographics import (
    _profile_metrics,
    categorize_age,
    compute_age_groups,
    compute_animal_contact_distribution,
    compute_citizen_profile_tree,
    compute_citizen_pyramid,
    compute_occupation_profile,
    compute_race_profile,
    compute_schooling_profile,
    compute_traditional_community_distribution,
)


def test_categorize_age() -> None:
    assert categorize_age(1.5) == "0-1 ano"
    assert categorize_age(4) == "2-4 anos"
    assert categorize_age(9) == "5-9 anos"
    assert categorize_age(14) == "10-14 anos"
    assert categorize_age(19) == "15-19 anos"
    assert categorize_age(29) == "20-29 anos"
    assert categorize_age(39) == "30-39 anos"
    assert categorize_age(49) == "40-49 anos"
    assert categorize_age(59) == "50-59 anos"
    assert categorize_age(69) == "60-69 anos"
    assert categorize_age(79) == "70-79 anos"
    assert categorize_age(85) == "80+ anos"


def test_compute_age_groups_empty() -> None:
    df = pd.DataFrame()
    res = compute_age_groups(df)
    assert res.empty


def test_compute_age_groups_with_idade_anos() -> None:
    df = pd.DataFrame({"IDADE_ANOS": [1.5, 4, 35, np.nan, -1]})
    res = compute_age_groups(df)
    assert not res.empty
    assert list(res["faixa_etaria"]) == ["0-1 ano", "2-4 anos", "30-39 anos"]
    assert list(res["count"]) == [1, 1, 1]


def test_compute_age_groups_with_tp_idade() -> None:
    df = pd.DataFrame({
        "TP_IDADE": [3, 2, 1, np.nan],
        "NU_IDADE_N": [40, 6, 365.25, 10]
    })
    res = compute_age_groups(df)
    assert not res.empty
    faixas = res.set_index("faixa_etaria")["count"].to_dict()
    assert faixas["40-49 anos"] == 1
    assert faixas["0-1 ano"] == 2


def test_compute_age_groups_no_valid_ages() -> None:
    df = pd.DataFrame({"IDADE_ANOS": [-1, -2]})
    res = compute_age_groups(df)
    assert list(res.columns) == ["faixa_etaria", "count"]
    assert res.empty


def test_compute_citizen_pyramid_empty() -> None:
    df = pd.DataFrame()
    assert compute_citizen_pyramid(df) == []


def test_compute_citizen_pyramid_valid() -> None:
    df = pd.DataFrame({
        "NU_IDADE_N": [30, 31, 35, 40, 85],
        "TP_IDADE": [3, 3, 3, 3, 3],
        "CS_SEXO": ["M", "F", "F", "M", "F"]
    })
    res = compute_citizen_pyramid(df)
    assert len(res) > 0
    assert any(r["age_band"] == "30-39" and r["male"] == 1 and r["female"] == 2 for r in res)
    assert any(r["age_band"] == "80+" and r["female"] == 1 for r in res)


def test_compute_race_profile_empty() -> None:
    assert compute_race_profile(pd.DataFrame()) == []
    assert compute_race_profile(pd.DataFrame({"other_col": [1, 2]})) == []


def test_compute_race_profile_valid() -> None:
    df = pd.DataFrame({"CS_RACA": [1, 2, 2, 9, np.nan]})
    res = compute_race_profile(df)
    assert len(res) == 2
    assert res[0] == {"code": 1, "label": "Branca", "count": 1}
    assert res[1] == {"code": 2, "label": "Preta", "count": 2}


def test_compute_schooling_profile_empty() -> None:
    assert compute_schooling_profile(pd.DataFrame()) == []


def test_compute_schooling_profile_valid() -> None:
    df = pd.DataFrame({
        "CS_ESCOL_N": [1, 3, 5, 5, 9, np.nan],
        "NU_IDADE_N": [10, 20, 6, 8, 30, 40],
        "TP_IDADE": [3, 3, 3, 3, 3, 3]
    })
    res = compute_schooling_profile(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["Fundamental I"] == 1
    assert res_dict["Médio"] == 1
    assert res_dict["Não se aplica"] == 1  # only age 6 is kept for 'Não se aplica', age 8 is dropped
    assert res_dict["Ignorado"] == 1


def test_profile_metrics_empty() -> None:
    res = _profile_metrics(pd.DataFrame())
    assert res == {
        "count": 0,
        "hospital_rate": 0.0,
        "uti_rate": 0.0,
        "death_rate": 0.0,
        "covid_vaccinated_rate": 0.0,
    }


def test_profile_metrics_valid() -> None:
    df = pd.DataFrame({
        "HOSPITAL": [1, 2, 1, np.nan],
        "UTI": [1, 1, 2, 9],
        "EVOLUCAO": [2, 1, 2, 9],
        "VACINA_COV": [1, 1, 1, 2]
    })
    res = _profile_metrics(df)
    assert res["count"] == 4
    assert res["hospital_rate"] == 50.0
    assert res["uti_rate"] == 50.0
    assert res["death_rate"] == 50.0
    assert res["covid_vaccinated_rate"] == 75.0


def test_compute_citizen_profile_tree_empty() -> None:
    res = compute_citizen_profile_tree(pd.DataFrame())
    assert res == {"macro_profiles": []}


def test_compute_citizen_profile_tree_valid() -> None:
    df = pd.DataFrame({
        "NU_IDADE_N": [1, 4, 8, 13, 17, 25, 45, 65, 75, 85],
        "TP_IDADE": [3] * 10,
        "HOSPITAL": [1] * 10,
        "UTI": [2] * 10,
        "EVOLUCAO": [1] * 10,
        "VACINA_COV": [1] * 10
    })
    res = compute_citizen_profile_tree(df)
    assert len(res["macro_profiles"]) == 4
    macros = {m["key"]: m for m in res["macro_profiles"]}
    assert macros["crianca"]["count"] == 3
    assert macros["adolescente"]["count"] == 2
    assert macros["adulto"]["count"] == 2
    assert macros["idoso"]["count"] == 3

    # check subprofiles
    crianca_subs = {s["key"]: s["count"] for s in macros["crianca"]["subprofiles"]}
    assert crianca_subs["lt_2y"] == 1
    assert crianca_subs["2_5y"] == 1
    assert crianca_subs["6_11y"] == 1


def test_compute_traditional_community_distribution_empty() -> None:
    assert compute_traditional_community_distribution(pd.DataFrame()) == []
    assert compute_traditional_community_distribution(pd.DataFrame({"POV_CT": [2]})) == []


def test_compute_traditional_community_distribution_valid() -> None:
    df = pd.DataFrame({
        "POV_CT": [1, 1, 1, 2, 1],
        "TP_POV_CT": ["Quilombola", " Quilombola ", "", "Indigena", np.nan]
    })
    res = compute_traditional_community_distribution(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["QUILOMBOLA"] == 2
    assert res_dict["NÃO INFORMADO"] == 1


def test_compute_occupation_profile_empty() -> None:
    assert compute_occupation_profile(pd.DataFrame()) == []


def test_compute_occupation_profile_valid() -> None:
    df = pd.DataFrame({
        "PAC_DSCBO": ["Professor", " professor ", "Medico", "999999", "", np.nan]
    })
    res = compute_occupation_profile(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["PROFESSOR"] == 2
    assert res_dict["MEDICO"] == 1
    assert "999999" not in res_dict


def test_compute_animal_contact_distribution_empty() -> None:
    assert compute_animal_contact_distribution(pd.DataFrame()) == []


def test_compute_animal_contact_distribution_valid() -> None:
    df = pd.DataFrame({"AVE_SUINO": [1, 1, 2, 3, 9, np.nan]})
    res = compute_animal_contact_distribution(df)
    res_dict = {r["label"]: r["count"] for r in res}
    assert res_dict["Aves/Suínos"] == 2
    assert res_dict["Sem Contato"] == 1
    assert res_dict["Outros Animais"] == 1
    assert res_dict["Ignorado"] == 2
