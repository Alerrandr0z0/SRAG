"""Mutation-targeted tests for filters.py: apply_global_filters."""

import pandas as pd

from srag.data.analytics.filters import apply_global_filters


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
        df = pd.DataFrame({"DT_SIN_PRI": ["2023-06-01", "2024-01-01", "2023-12-31"]})
        res = apply_global_filters(df, years=[2023])
        assert len(res) == 2

    def test_year_boundary_jan1(self) -> None:
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
        # NaN age normalizes to 0 years, which is < 12, so both rows match
        assert len(res) == 2

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

    def test_race_missing_column_raises(self) -> None:
        import pytest
        df = pd.DataFrame({"A": [1]})
        with pytest.raises(KeyError):
            apply_global_filters(df, races=["Branca"])


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
