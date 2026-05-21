"""Mutation-targeted tests for filters.py: apply_global_filters."""

import numpy as np
import pandas as pd

from srag.data.analytics.filters import (
    _age_years,
    apply_global_filters,
    outcome_death_mask,
    outcome_valid_mask,
)


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


class TestApplyGlobalFiltersEmpty:
    def test_empty_df_returns_empty(self) -> None:
        res = apply_global_filters(pd.DataFrame(), years=[2023])
        assert len(res) == 0

    def test_none_filters_returns_original(self) -> None:
        df = pd.DataFrame({"A": [1, 2]})
        res = apply_global_filters(df, years=None, profiles=None)
        assert list(res["A"]) == [1, 2]


class TestYearsFilter:
    def test_exact_year_match(self) -> None:
        # Dec 31, 2023 belongs to SE 1 of 2024
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-06-01", "2024-01-01", "2023-12-31"]})
        res = apply_global_filters(df, years=[2023])
        assert len(res) == 1
        assert res.iloc[0]["DT_SIN_PRI"] == "2023-06-01"

    def test_year_boundary_se_logic(self) -> None:
        # Jan 1, 2022 (Saturday) belongs to SE 52 of 2021
        df = pd.DataFrame({"DT_SIN_PRI": ["2021-12-31", "2022-01-01", "2022-01-02"]})
        
        # Filtering for 2021 should include Jan 1, 2022
        res_2021 = apply_global_filters(df, years=[2021])
        assert len(res_2021) == 2
        assert "2022-01-01" in res_2021["DT_SIN_PRI"].values
        
        # Filtering for 2022 should NOT include Jan 1, 2022
        res_2022 = apply_global_filters(df, years=[2022])
        assert len(res_2022) == 1
        assert res_2022.iloc[0]["DT_SIN_PRI"] == "2022-01-02"

    def test_year_boundary_jan1(self) -> None:
        # Jan 1, 2024 (Monday) is SE 1 of 2024
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01", "2024-01-01"]})
        res = apply_global_filters(df, years=[2024])
        assert len(res) == 1
        assert res.iloc[0]["DT_SIN_PRI"] == "2024-01-01"

    def test_year_invalid_date_ignored(self) -> None:
        df = pd.DataFrame({"DT_SIN_PRI": ["invalid", "2023-06-01"]})
        res = apply_global_filters(df, years=[2023])
        assert len(res) == 1

    def test_years_empty_list(self) -> None:
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"]})
        res = apply_global_filters(df, years=[])
        assert len(res) == 1

    def test_years_non_digit_string_excludes_all(self) -> None:
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-01-01"]})
        res = apply_global_filters(df, years=["abc"])  # type: ignore
        assert len(res) == 0


class TestProfilesBoundary:
    def test_crianca_exact_11(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [11], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["crianca"])
        assert len(res) == 1

    def test_crianca_exact_12_excluded(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [12], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["crianca"])
        assert len(res) == 0

    def test_adolescente_exact_12(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [12], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adolescente"])
        assert len(res) == 1

    def test_adolescente_exact_19(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [19], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adolescente"])
        assert len(res) == 1

    def test_adolescente_exact_20_excluded(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [20], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adolescente"])
        assert len(res) == 0

    def test_adulto_exact_20(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [20], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adulto"])
        assert len(res) == 1

    def test_adulto_exact_59(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [59], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adulto"])
        assert len(res) == 1

    def test_adulto_exact_60_excluded(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [60], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["adulto"])
        assert len(res) == 0

    def test_idoso_exact_60(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [60], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["idoso"])
        assert len(res) == 1

    def test_idoso_exact_120(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [120], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=["idoso"])
        assert len(res) == 1


class TestProfilesCombined:
    def test_multiple_profiles_union(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [10, 15, 30, 65], "TP_IDADE": [3, 3, 3, 3]})
        res = apply_global_filters(df, profiles=["crianca", "idoso"])
        assert len(res) == 2
        assert list(res["NU_IDADE_N"]) == [10, 65]

    def test_all_profiles_union(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [5, 15, 30, 70], "TP_IDADE": [3, 3, 3, 3]})
        res = apply_global_filters(df, profiles=["crianca", "adolescente", "adulto", "idoso"])
        assert len(res) == 4

    def test_profiles_with_nan_age(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [10, None], "TP_IDADE": [3, 3]})
        res = apply_global_filters(df, profiles=["crianca"])
        assert 10 in res["NU_IDADE_N"].values

    def test_profiles_empty_list(self) -> None:
        df = pd.DataFrame({"NU_IDADE_N": [10], "TP_IDADE": [3]})
        res = apply_global_filters(df, profiles=[])
        assert len(res) == 1


class TestRaces:
    def test_exact_race_mapping(self) -> None:
        df = pd.DataFrame({"CS_RACA": [1, 2, 3, 4, 5, 9]})
        res = apply_global_filters(df, races=["Branca", "Preta"])
        assert list(res["CS_RACA"]) == [1, 2]

    def test_race_unknown_label_ignored(self) -> None:
        df = pd.DataFrame({"CS_RACA": [1, 9]})
        res = apply_global_filters(df, races=["Branca", "Nonexistent"])
        assert len(res) == 1

    def test_race_empty_filter(self) -> None:
        df = pd.DataFrame({"CS_RACA": [1, 2]})
        res = apply_global_filters(df, races=[])
        assert len(res) == 2


class TestGenders:
    def test_gender_male(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F", "I"]})
        res = apply_global_filters(df, genders=["M"])
        assert list(res["CS_SEXO"]) == ["M"]

    def test_gender_female_only(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F", "I"]})
        res = apply_global_filters(df, genders=["F"])
        assert list(res["CS_SEXO"]) == ["F"]

    def test_gender_female_with_maternal_none(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F"], "CS_GESTANT": [1, 5]})
        res = apply_global_filters(df, genders=["F"], maternal=None)
        assert len(res) == 2

    def test_gender_female_with_maternal_gestante(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F", "M"], "CS_GESTANT": [1, 5, 1]})
        res = apply_global_filters(df, genders=["F"], maternal=["gestante"])
        assert len(res) == 1

    def test_gender_m_and_i_only(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F", "I"]})
        res = apply_global_filters(df, genders=["M", "I"])
        assert list(res["CS_SEXO"]) == ["M", "I"]

    def test_gender_m_f_with_maternal(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F", "F", "I"], "CS_GESTANT": [1, 1, 5, 1]})
        res = apply_global_filters(df, genders=["M", "F"], maternal=["gestante"])
        assert len(res) == 2
        assert list(res["CS_SEXO"]) == ["M", "F"]

    def test_gender_m_f_with_maternal_puerpera(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F", "F"], "CS_GESTANT": [1, 6, 5]})
        res = apply_global_filters(df, genders=["M", "F"], maternal=["puerpera"])
        assert len(res) == 2
        assert list(res["CS_SEXO"]) == ["M", "F"]

    def test_gender_unknown_code_ignored(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "X"]})
        res = apply_global_filters(df, genders=["M", "X"])
        assert list(res["CS_SEXO"]) == ["M"]

    def test_gender_empty_genders_list(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M"]})
        res = apply_global_filters(df, genders=[])
        assert len(res) == 1

    def test_gender_f_maternal_not_marked_as_handled(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F"], "CS_GESTANT": [1, 6]})
        res = apply_global_filters(df, genders=["F"], maternal=["gestante", "puerpera"])
        assert len(res) == 2

    def test_gender_f_maternal_gestante_and_puerpera_or(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F", "F"], "CS_GESTANT": [1, 6, 5]})
        res = apply_global_filters(df, genders=["F"], maternal=["gestante", "puerpera"])
        assert len(res) == 2
        assert list(res["CS_GESTANT"]) == [1, 6]


class TestMaternal:
    def test_maternal_gestante_code_1(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [1]})
        res = apply_global_filters(df, maternal=["gestante"])
        assert len(res) == 1

    def test_maternal_gestante_code_4(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [4]})
        res = apply_global_filters(df, maternal=["gestante"])
        assert len(res) == 1

    def test_maternal_gestante_code_5_excluded(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [5]})
        res = apply_global_filters(df, maternal=["gestante"])
        assert len(res) == 0

    def test_maternal_puerpera_code_6(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [6]})
        res = apply_global_filters(df, maternal=["puerpera"])
        assert len(res) == 1

    def test_maternal_puerpera_code_1_excluded(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [1]})
        res = apply_global_filters(df, maternal=["puerpera"])
        assert len(res) == 0

    def test_maternal_gestante_and_puerpera_union(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F"], "CS_GESTANT": [1, 6]})
        res = apply_global_filters(df, maternal=["gestante", "puerpera"])
        assert len(res) == 2

    def test_maternal_enforces_female(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["M", "F"], "CS_GESTANT": [1, 1]})
        res = apply_global_filters(df, maternal=["gestante"])
        assert len(res) == 1
        assert res.iloc[0]["CS_SEXO"] == "F"

    def test_maternal_empty_list(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F"], "CS_GESTANT": [1]})
        res = apply_global_filters(df, maternal=[])
        assert len(res) == 1

    def test_maternal_nan_gestant_not_included(self) -> None:
        df = pd.DataFrame({"CS_SEXO": ["F", "F"], "CS_GESTANT": [None, 1]})
        res = apply_global_filters(df, maternal=["gestante"])
        assert len(res) == 1


class TestOccupations:
    def test_occupation_case_normalized(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": ["MEDICO", "Medico", "MEDICO"]})
        res = apply_global_filters(df, occupations=["MEDICO"])
        assert len(res) == 3

    def test_occupation_strip_whitespace(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": ["  MEDICO  "]})
        res = apply_global_filters(df, occupations=["MEDICO"])
        assert len(res) == 1

    def test_occupation_nan_filled(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": [None, "MEDICO"]})
        res = apply_global_filters(df, occupations=["MEDICO"])
        assert len(res) == 1

    def test_occupation_empty_list(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": ["MEDICO"]})
        res = apply_global_filters(df, occupations=[])
        assert len(res) == 1

    def test_occupation_empty_string_excluded(self) -> None:
        df = pd.DataFrame({"PAC_DSCBO": ["", "MEDICO"]})
        res = apply_global_filters(df, occupations=["MEDICO"])
        assert len(res) == 1


class TestZonas:
    def test_zona_case_normalized(self) -> None:
        df = pd.DataFrame({"ZONA": ["URBANA", "Urbana", "urbana"]})
        res = apply_global_filters(df, zonas=["URBANA"])
        assert len(res) == 3

    def test_zona_strip_whitespace(self) -> None:
        df = pd.DataFrame({"ZONA": ["  Rural  "]})
        res = apply_global_filters(df, zonas=["RURAL"])
        assert len(res) == 1

    def test_zona_nan_filled(self) -> None:
        df = pd.DataFrame({"ZONA": [None, "Urbana"]})
        res = apply_global_filters(df, zonas=["URBANA"])
        assert len(res) == 1

    def test_zona_empty_list(self) -> None:
        df = pd.DataFrame({"ZONA": ["Urbana"]})
        res = apply_global_filters(df, zonas=[])
        assert len(res) == 1


class TestBairros:
    def test_bairro_case_normalized(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": ["CENTRO", "Centro", "centro"]})
        res = apply_global_filters(df, bairros=["CENTRO"])
        assert len(res) == 3

    def test_bairro_nan_filled(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": [None, "Centro"]})
        res = apply_global_filters(df, bairros=["CENTRO"])
        assert len(res) == 1

    def test_bairro_empty_list(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": ["Centro"]})
        res = apply_global_filters(df, bairros=[])
        assert len(res) == 1

    def test_bairro_empty_string_excluded(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": ["", "Centro"]})
        res = apply_global_filters(df, bairros=["CENTRO"])
        assert len(res) == 1


class TestUnidades:
    def test_unidade_case_normalized(self) -> None:
        df = pd.DataFrame({"ID_UNIDADE": ["UPA", "Upa", "upa"]})
        res = apply_global_filters(df, unidades=["UPA"])
        assert len(res) == 3

    def test_unidade_nan_filled(self) -> None:
        df = pd.DataFrame({"ID_UNIDADE": [None, "UPA"]})
        res = apply_global_filters(df, unidades=["UPA"])
        assert len(res) == 1

    def test_unidade_empty_list(self) -> None:
        df = pd.DataFrame({"ID_UNIDADE": ["UPA"]})
        res = apply_global_filters(df, unidades=[])
        assert len(res) == 1


class TestCombinedFilters:
    def test_years_and_profiles_together(self) -> None:
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": ["2023-01-01", "2023-01-01", "2024-01-01"],
                "NU_IDADE_N": [10, 65, 10],
                "TP_IDADE": [3, 3, 3],
            }
        )
        res = apply_global_filters(df, years=[2023], profiles=["crianca"])
        assert len(res) == 1

    def test_races_and_genders_together(self) -> None:
        df = pd.DataFrame(
            {
                "CS_RACA": [1, 2, 1],
                "CS_SEXO": ["M", "F", "M"],
            }
        )
        res = apply_global_filters(df, races=["Branca"], genders=["M"])
        assert len(res) == 2

    def test_zonas_and_bairros_together(self) -> None:
        df = pd.DataFrame(
            {
                "ZONA": ["Urbana", "Urbana", "Rural"],
                "BAIRRO_REF": ["Centro", "Abolição", "Centro"],
            }
        )
        res = apply_global_filters(df, zonas=["URBANA"], bairros=["CENTRO"])
        assert len(res) == 1

    def test_all_filters_none(self) -> None:
        df = pd.DataFrame({"A": [1]})
        res = apply_global_filters(df)
        assert len(res) == 1
