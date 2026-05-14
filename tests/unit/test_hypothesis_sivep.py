"""Hypothesis-based tests for SIVEP-Gripe business rules."""

from datetime import date

import pandas as pd
import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from srag.data.analytics import (
    apply_global_filters,
    categorize_age,
    classificar_status_gripe,
    outcome_death_mask,
)
from srag.data.loader import _normalize_age_to_years

# Strategies baseadas nas regras do dicionário SIVEP-Gripe

valid_evolucao = st.sampled_from([1, 2, 3, 9])  # 1=Cura, 2=Óbito, 3=Óbito outra causa, 9=Ignorado
valid_tp_idade = st.sampled_from([1, 2, 3])  # 1=Dias, 2=Meses, 3=Anos
valid_zona = st.sampled_from([1, 2, 3, 9])  # 1=Urbana, 2=Rural, 3=Periurbana, 9=Ignorado
valid_classi_fin = st.sampled_from(
    [1, 2, 3, 4, 5]
)  # Influenza, Outro Vírus, Outro Agente, Não Especificada, COVID-19
valid_sexo = st.sampled_from(["M", "F", "I"])  # Masculino, Feminino, Ignorado
valid_vacina = st.sampled_from([1, 2, 9])  # Sim, Não, Ignorado
valid_raca = st.sampled_from(
    [1, 2, 3, 4, 5, 9]
)  # Branca, Preta, Amarela, Parda, Indígena, Ignorado


class TestCategorizeAgeHypothesis:
    """Testes baseados nas regras de TP_IDADE e conversão de idade."""

    @given(age=st.floats(min_value=0, max_value=150, allow_nan=False, allow_infinity=False))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.differing_executors])
    def test_categorize_age_never_fails(self, age) -> None:
        """Todas as idades entre 0 e 150 devem retornar uma categoria."""
        result = categorize_age(age)
        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    @given(age=st.floats(min_value=0, max_value=1, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_categorize_age_below_1_year(self, age) -> None:
        """Idade < 1 ano deve ser categorizada como '0-1 ano'."""
        result = categorize_age(age)
        assert result == "0-1 ano"

    @given(age=st.floats(min_value=2, max_value=4.99, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_categorize_age_1_to_4_years(self, age) -> None:
        """Idade entre 2 e 4 anos deve ser '2-4 anos'."""
        result = categorize_age(age)
        assert result == "2-4 anos"

    @given(age=st.floats(min_value=60, max_value=150, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_categorize_age_elderly(self, age) -> None:
        """Idade >= 60 deve ser categorizada como '60-69 anos', '70-79 anos' ou '80+ anos'."""
        result = categorize_age(age)
        assert result in ["60-69 anos", "70-79 anos", "80+ anos"]


class TestNormalizeAgeHypothesis:
    """Testes para normalização de idade baseado nas regras SIVEP."""

    @given(nu_idade=st.integers(min_value=0, max_value=1000), tp_idade=st.sampled_from([1, 2, 3]))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.differing_executors])
    def test_normalize_age_never_fails(self, nu_idade, tp_idade) -> None:
        """Normalização de idade não deve falhar para valores válidos."""
        result = _normalize_age_to_years(nu_idade, tp_idade)
        assert result is None or isinstance(result, (int, float))

    @given(nu_idade=st.integers(min_value=1, max_value=365), tp_idade=st.just(1))
    @settings(max_examples=30)
    def test_normalize_age_days_to_years(self, nu_idade, tp_idade) -> None:
        """Conversão de dias para anos deve estar no intervalo válido."""
        result = _normalize_age_to_years(nu_idade, tp_idade)
        if result is not None:
            assert 0 < result < 2  # Menos de 2 anos

    @given(nu_idade=st.integers(min_value=1, max_value=120), tp_idade=st.just(2))
    @settings(max_examples=30)
    def test_normalize_age_months_to_years(self, nu_idade, tp_idade) -> None:
        """Conversão de meses para anos deve estar no intervalo válido."""
        result = _normalize_age_to_years(nu_idade, tp_idade)
        if result is not None:
            assert 0 < result < 11  # Menos de 11 anos

    @given(nu_idade=st.integers(min_value=1, max_value=150), tp_idade=st.just(3))
    @settings(max_examples=30)
    def test_normalize_age_years(self, nu_idade, tp_idade) -> None:
        """Conversão de anos deve manter o valor."""
        result = _normalize_age_to_years(nu_idade, tp_idade)
        assert result == float(nu_idade)

    def test_normalize_age_negative_returns_none(self) -> None:
        """Idade negativa deve retornar None."""
        assert _normalize_age_to_years(-1, 3) is None


class TestOutcomeDeathMaskHypothesis:
    """Testes para mascara de morte baseado nas regras SIVEP."""

    @given(evolucion_values=st.lists(valid_evolucao, min_size=1, max_size=20, unique=False))
    @settings(max_examples=50)
    def test_outcome_death_mask_only_counts_code_2(self, evolucion_values) -> None:
        """Apenas EVOLUCAO == 2 deve ser considerada morte."""
        series = pd.Series(evolucion_values)
        mask = outcome_death_mask(series)

        # Verifica que apenas códigos 2 são verdadeiros
        for i, val in enumerate(evolucion_values):
            if val == 2:
                assert mask.iloc[i]
            else:
                assert not mask.iloc[i]

    @given(evolucion_values=st.lists(valid_evolucao, min_size=1, max_size=20, unique=False))
    @settings(max_examples=50)
    def test_outcome_death_mask_respects_rule_3_not_death(self, evolucion_values) -> None:
        """EVOLUCAO == 3 (Óbito por outra causa) NÃO conta como morte SRAG."""
        series = pd.Series(evolucion_values)
        mask = outcome_death_mask(series)

        # Código 3 não deve ser contado como morte
        if 3 in evolucion_values:
            assert mask[series == 3].sum() == 0


class TestClassificarStatusGripeHypothesis:
    """Testes para classificação de status de gripe baseados nas regras SIVEP."""

    @given(
        dt_ut_dose=st.none() | st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)),
        dt_1_dose=st.none() | st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)),
        dt_2_dose=st.none() | st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)),
        vacinacao=valid_vacina,
        tp_idade=valid_tp_idade,
        nu_idade_n=st.integers(min_value=0, max_value=150),
        dt_sin_pri=st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)),
    )
    @settings(max_examples=30, deadline=5000)
    def test_classificar_status_gripe_valid_inputs(
        self, dt_ut_dose, dt_1_dose, dt_2_dose, vacinacao, tp_idade, nu_idade_n, dt_sin_pri
    ) -> None:
        """Testa que a função não falha com inputs válidos do SIVEP."""
        row = {
            "DT_UT_DOSE": dt_ut_dose,
            "DT_1_DOSE": dt_1_dose,
            "DT_2_DOSE": dt_2_dose,
            "VACINA": vacinacao,
            "TP_IDADE": tp_idade,
            "NU_IDADE_N": nu_idade_n,
            "DT_SIN_PRI": dt_sin_pri,
        }

        # Não deve lançar exceção
        try:
            result = classificar_status_gripe(row)
            assert result in [
                "protegido",
                "dose_1",
                "dose_2",
                "dose_unica",
                "vencida",
                "nao_vacinado",
                "ignorado",
                "inconsistencia",
            ]
        except Exception:
            pytest.fail("classificar_status_gripe falhou com input válido do SIVEP")

    @given(
        tp_idade=valid_tp_idade,
        nu_idade_n=st.integers(min_value=0, max_value=150),
        dt_sin_pri=st.dates(min_value=date(2024, 1, 1), max_value=date(2025, 12, 31)),
    )
    @settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.filter_too_much])
    def test_classificar_status_gripe_nao_vacinado(self, tp_idade, nu_idade_n, dt_sin_pri) -> None:
        """VACINA=2 (Não vaccinado) deve retornar 'nao_vacinado' se não houver dose."""
        row = {
            "DT_UT_DOSE": None,
            "DT_1_DOSE": None,
            "DT_2_DOSE": None,
            "VACINA": 2,
            "TP_IDADE": tp_idade,
            "NU_IDADE_N": nu_idade_n,
            "DT_SIN_PRI": dt_sin_pri,
        }

        result = classificar_status_gripe(row)
        assert result == "nao_vacinado"

    @given(
        nu_idade_n=st.integers(min_value=18, max_value=100),
    )
    @settings(max_examples=10, deadline=5000)
    def test_classificar_status_gripe_protegido_adulto(self, nu_idade_n) -> None:
        """Adulto vacinado depois do início da campanha deve ser 'protegido'."""
        dt_ut_dose = date(2024, 6, 15)
        dt_sin_pri = date(2024, 7, 1)

        row = {
            "DT_UT_DOSE": dt_ut_dose,
            "DT_1_DOSE": None,
            "DT_2_DOSE": None,
            "VACINA": 1,
            "TP_IDADE": 3,
            "NU_IDADE_N": nu_idade_n,
            "DT_SIN_PRI": dt_sin_pri,
        }

        result = classificar_status_gripe(row)
        assert result == "protegido"


class TestApplyGlobalFiltersHypothesis:
    """Testes para filtros globais com dados SIVEP."""

    @given(
        n_cases=st.integers(min_value=1, max_value=50),
        profile=st.lists(st.sampled_from(["crianca", "idoso", "adulto"]), max_size=3),
    )
    @settings(max_examples=30)
    def test_apply_global_filters_with_profiles(self, n_cases, profile) -> None:
        """Testa filtros por perfil demográfico."""
        ages = [5, 25, 70, 8, 65, 3]  # crianca, adulto, idoso
        df = pd.DataFrame(
            {
                "NU_IDADE_N": ages * (n_cases // 6 + 1),
                "TP_IDADE": [3] * len(ages * (n_cases // 6 + 1)),
            }
        )

        result = apply_global_filters(df, profiles=profile)
        assert len(result) >= 0
        assert len(result) <= len(df)
