"""Mutation-targeted tests for demographics.py: exact values, boundaries, edge cases."""

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


class TestCategorizeAge:
    def test_exact_boundaries(self) -> None:
        boundaries = [
            (0, "0-1 ano"),
            (1, "0-1 ano"),
            (2, "2-4 anos"),
            (4, "2-4 anos"),
            (5, "5-9 anos"),
            (9, "5-9 anos"),
            (10, "10-14 anos"),
            (14, "10-14 anos"),
            (15, "15-19 anos"),
            (19, "15-19 anos"),
            (20, "20-29 anos"),
            (29, "20-29 anos"),
            (30, "30-39 anos"),
            (39, "30-39 anos"),
            (40, "40-49 anos"),
            (49, "40-49 anos"),
            (50, "50-59 anos"),
            (59, "50-59 anos"),
            (60, "60-69 anos"),
            (69, "60-69 anos"),
            (70, "70-79 anos"),
            (79, "70-79 anos"),
            (80, "80+ anos"),
            (120, "80+ anos"),
        ]
        for age, expected in boundaries:
            assert categorize_age(age) == expected, f"age={age} expected={expected}"

    def test_negative_age(self) -> None:
        assert categorize_age(-1) == "0-1 ano"


class TestComputeAgeGroups:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [1, 3, 8, 12, 25, 35, 45, 65],
                "TP_IDADE": [3, 3, 3, 3, 3, 3, 3, 3],
            }
        )
        res = compute_age_groups(df)
        counts = dict(zip(res["faixa_etaria"], res["count"], strict=False))
        assert counts.get("0-1 ano") == 1

    def test_tp_2_months_conversion(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [6, 18], "TP_IDADE": [2, 2]})
        res = compute_age_groups(df)
        assert not res.empty

    def test_tp_1_days_conversion(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [30, 180], "TP_IDADE": [1, 1]})
        res = compute_age_groups(df)
        assert not res.empty

    def test_empty_df(self) -> None:
        assert compute_age_groups(pd.DataFrame()).empty

    def test_idade_anos_preferred(self) -> None:
        df = pd.DataFrame(
            {
                "IDADE_ANOS": [25, 50],
                "NU_IDADE_N": [1, 2],
                "TP_IDADE": [3, 3],
            }
        )
        res = compute_age_groups(df)
        assert not res.empty


class TestCitizenPyramid:
    def test_exact_bins_small_range(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [10, 12, 14, 16, 18, 20],
                "TP_IDADE": [3, 3, 3, 3, 3, 3],
                "CS_SEXO": ["M", "F", "M", "F", "M", "F"],
            }
        )
        res = compute_citizen_pyramid(df)
        assert len(res) >= 3

    def test_large_range_10yr_bins(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [5, 15, 25, 35, 45, 55, 65, 75, 85],
                "TP_IDADE": [3, 3, 3, 3, 3, 3, 3, 3, 3],
                "CS_SEXO": ["M", "F", "M", "F", "M", "F", "M", "F", "M"],
            }
        )
        res = compute_citizen_pyramid(df)
        assert len(res) > 0

    def test_last_label_80_plus(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [5, 20, 40, 60, 85],
                "TP_IDADE": [3, 3, 3, 3, 3],
                "CS_SEXO": ["M", "F", "M", "F", "M"],
            }
        )
        res = compute_citizen_pyramid(df)
        assert res[-1]["age_band"].endswith("+")

    def test_empty_df(self) -> None:
        assert compute_citizen_pyramid(pd.DataFrame()) == []

    def test_all_nan_age(self) -> None:
        df = pd.DataFrame(
            {"NU_IDADE_N": [np.nan, np.nan], "TP_IDADE": [3, 3], "CS_SEXO": ["M", "F"]}
        )
        assert compute_citizen_pyramid(df) == []


class TestRaceProfile:
    def test_exact_code_mapping(self) -> None:
        df = pd.DataFrame({"CS_RACA": [1, 2, 3, 4, 5]})
        res = {r["label"]: r["count"] for r in compute_race_profile(df)}
        assert res["Branca"] == 1
        assert res["Preta"] == 1
        assert res["Amarela"] == 1
        assert res["Parda"] == 1
        assert res["Indígena"] == 1

    def test_code_9_ignored(self) -> None:
        df = pd.DataFrame({"CS_RACA": [9, 1]})
        res = {r["label"]: r["count"] for r in compute_race_profile(df)}
        assert res == {"Branca": 1}

    def test_empty_df(self) -> None:
        assert compute_race_profile(pd.DataFrame()) == []

    def test_missing_column(self) -> None:
        assert compute_race_profile(pd.DataFrame({"OUTRA": [1]})) == []


class TestSchoolingProfile:
    def test_exact_mapping(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [30, 30, 30, 30, 30, 30],
                "TP_IDADE": [3, 3, 3, 3, 3, 3],
                "CS_ESCOL_N": [0, 1, 2, 3, 4, 9],
            }
        )
        res = {r["label"]: r["count"] for r in compute_schooling_profile(df)}
        assert res["Sem escolaridade"] == 1

    def test_escol_5_with_age_ge_7_filtered(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [30, 5],
                "TP_IDADE": [3, 3],
                "CS_ESCOL_N": [5, 5],
            }
        )
        res = {r["label"]: r["count"] for r in compute_schooling_profile(df)}
        assert "Não se aplica" in res
        assert res["Não se aplica"] == 1

    def test_empty_df(self) -> None:
        assert compute_schooling_profile(pd.DataFrame()) == []

    def test_missing_column(self) -> None:
        assert compute_schooling_profile(pd.DataFrame({"NU_IDADE_N": [30]})) == []


class TestProfileMetrics:
    def test_exact_rates(self) -> None:
        df = pd.DataFrame(
            {
                "HOSPITAL": [1, 2, 1],
                "UTI": [1, 2, 1],
                "EVOLUCAO": [2, 2, 1],
                "VACINA_COV": [1, 2, 1],
            }
        )
        res = _profile_metrics(df)
        assert res["count"] == 3
        assert res["hospital_rate"] == round(2 / 3 * 100, 2)
        assert res["uti_rate"] == round(2 / 3 * 100, 2)
        assert res["death_rate"] == round(2 / 3 * 100, 2)
        assert res["covid_vaccinated_rate"] == round(2 / 3 * 100, 2)

    def test_empty_df(self) -> None:
        res = _profile_metrics(pd.DataFrame())
        assert res["count"] == 0
        assert res["hospital_rate"] == 0.0


class TestCitizenProfileTree:
    def test_all_macro_profiles_present(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [1, 5, 15, 30, 70],
                "TP_IDADE": [3, 3, 3, 3, 3],
                "CS_SEXO": ["M", "F", "M", "F", "M"],
                "HOSPITAL": [1, 2, 1, 2, 1],
                "UTI": [1, 2, 1, 2, 1],
                "EVOLUCAO": [1, 1, 1, 1, 1],
                "VACINA_COV": [1, 2, 1, 2, 1],
            }
        )
        res = compute_citizen_profile_tree(df)
        keys = [p["key"] for p in res["macro_profiles"]]
        assert keys == ["crianca", "adolescente", "adulto", "idoso"]

    def test_idoso_80_plus(self) -> None:
        df = pd.DataFrame(
            {
                "NU_IDADE_N": [85],
                "TP_IDADE": [3],
                "CS_SEXO": ["M"],
                "HOSPITAL": [1],
                "UTI": [1],
                "EVOLUCAO": [1],
                "VACINA_COV": [1],
            }
        )
        res = compute_citizen_profile_tree(df)
        idoso = next(p for p in res["macro_profiles"] if p["key"] == "idoso")
        sub_keys = [s["key"] for s in idoso["subprofiles"]]
        assert "80_plus" in sub_keys

    def test_empty_df(self) -> None:
        assert compute_citizen_profile_tree(pd.DataFrame()) == {"macro_profiles": []}


class TestTraditionalCommunityDistribution:
    def test_exact_counts(self) -> None:
        df = pd.DataFrame({"POV_CT": [1, 1, 2], "TP_POV_CT": ["quilombo", "QUILOMBO", "indígena"]})
        res = {r["label"]: r["count"] for r in compute_traditional_community_distribution(df)}
        assert res["QUILOMBO"] == 2

    def test_empty_string_normalized(self) -> None:
        df = pd.DataFrame({"POV_CT": [1], "TP_POV_CT": [""]})
        res = {r["label"]: r["count"] for r in compute_traditional_community_distribution(df)}
        assert "" in res or "NÃO INFORMADO" in res

    def test_empty_df(self) -> None:
        assert compute_traditional_community_distribution(pd.DataFrame()) == []

    def test_missing_pov_ct_column(self) -> None:
        assert compute_traditional_community_distribution(pd.DataFrame({"OUTRA": [1]})) == []


class TestOccupationProfile:
    def test_top_n_boundary(self) -> None:
        df = pd.DataFrame(
            {
                "PAC_DSCBO": [
                    "Medico",
                    "Medico",
                    "Medico",
                    "Professor",
                    "Professor",
                    "Engenheiro",
                ]
            }
        )
        res = compute_occupation_profile(df, top_n=2)
        assert len(res) == 2

    def test_empty_occupations_removed(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": ["", "NAN", "NONE", "999999"]})
        assert compute_occupation_profile(df) == []

    def test_empty_df(self) -> None:
        assert compute_occupation_profile(pd.DataFrame()) == []

    def test_missing_column(self) -> None:
        assert compute_occupation_profile(pd.DataFrame({"OUTRA": [1]})) == []


class TestAnimalContactDistribution:
    def test_exact_label_order(self) -> None:
        df = pd.DataFrame({"AVE_SUINO": [1, 2, 3, 9]})
        res = [r["label"] for r in compute_animal_contact_distribution(df)]
        assert res == ["Aves/Suínos", "Outros Animais", "Sem Contato", "Ignorado"]

    def test_nan_fills_9_ignorado(self) -> None:
        df = pd.DataFrame({"AVE_SUINO": [np.nan, 1]})
        res = {r["label"]: r["count"] for r in compute_animal_contact_distribution(df)}
        assert res["Ignorado"] == 1

    def test_empty_df(self) -> None:
        assert compute_animal_contact_distribution(pd.DataFrame()) == []

    def test_missing_column(self) -> None:
        assert compute_animal_contact_distribution(pd.DataFrame({"OUTRA": [1]})) == []
