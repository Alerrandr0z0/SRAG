"""Benchmarks for performance-critical functions."""

from datetime import date, timedelta

import pandas as pd

from srag.data.analytics import (
    apply_global_filters,
    categorize_age,
    classificar_status_gripe,
    compute_alert_thresholds,
    compute_severity_metrics,
    compute_time_series,
    compute_virus_distribution,
    infer_etiologic_agent,
    outcome_death_mask,
)
from srag.data.loader import _normalize_age_to_years


def generate_test_data(n_rows: int = 1000) -> pd.DataFrame:
    """Generate test data for benchmarks."""
    return pd.DataFrame(
        {
            "DT_SIN_PRI": [date(2024, 1, 1) + timedelta(days=i) for i in range(n_rows)],
            "CLASSI_FIN": [(i % 5) + 1 for i in range(n_rows)],
            "PCR_VSR": [i % 2 for i in range(n_rows)],
            "UTI": [(i % 4) + 1 for i in range(n_rows)],
            "EVOLUCAO": [(i % 4) + 1 for i in range(n_rows)],
            "NU_IDADE_N": [i % 100 for i in range(n_rows)],
            "TP_IDADE": [3] * n_rows,
            "CS_RACA": [(i % 6) + 1 for i in range(n_rows)],
            "CS_SEXO": ["M" if i % 2 == 0 else "F" for i in range(n_rows)],
        }
    )


class TestCategorizeAgeBenchmark:
    def test_categorize_age_single(self, benchmark):
        """Benchmark: categorize single age."""
        result = benchmark(categorize_age, 30.5)
        assert result == "30-39 anos"

    def test_categorize_age_batch(self, benchmark):
        """Benchmark: categorize 1000 ages."""
        ages = [i % 100 for i in range(1000)]
        result = benchmark(lambda: [categorize_age(a) for a in ages])
        assert len(result) == 1000


class TestNormalizeAgeBenchmark:
    def test_normalize_age_years(self, benchmark):
        """Benchmark: normalize age in years (most common)."""
        result = benchmark(_normalize_age_to_years, 30, 3)
        assert result == 30.0

    def test_normalize_age_batch(self, benchmark):
        """Benchmark: normalize 1000 ages."""
        data = [(i % 100, 3) for i in range(1000)]
        result = benchmark(lambda: [_normalize_age_to_years(age, tp) for age, tp in data])
        assert len(result) == 1000


class TestOutcomeDeathMaskBenchmark:
    def test_outcome_death_mask_small(self, benchmark):
        """Benchmark: death mask with 100 records."""
        df = generate_test_data(100)
        result = benchmark(outcome_death_mask, df["EVOLUCAO"])
        assert len(result) == 100

    def test_outcome_death_mask_large(self, benchmark):
        """Benchmark: death mask with 10000 records."""
        df = generate_test_data(10000)
        result = benchmark(outcome_death_mask, df["EVOLUCAO"])
        assert len(result) == 10000


class TestInferEtiologicAgentBenchmark:
    def test_infer_etiologic_agent_small(self, benchmark):
        """Benchmark: infer agent with 100 records."""
        df = generate_test_data(100)
        result = benchmark(infer_etiologic_agent, df)
        assert len(result) == 100

    def test_infer_etiologic_agent_large(self, benchmark):
        """Benchmark: infer agent with 10000 records."""
        df = generate_test_data(10000)
        result = benchmark(infer_etiologic_agent, df)
        assert len(result) == 10000


class TestComputeVirusDistributionBenchmark:
    def test_compute_virus_distribution_small(self, benchmark):
        """Benchmark: compute virus distribution with 100 records."""
        df = generate_test_data(100)
        result = benchmark(compute_virus_distribution, df)
        assert not result.empty

    def test_compute_virus_distribution_large(self, benchmark):
        """Benchmark: compute virus distribution with 10000 records."""
        df = generate_test_data(10000)
        result = benchmark(compute_virus_distribution, df)
        assert not result.empty


class TestComputeTimeSeriesBenchmark:
    def test_compute_time_series_small(self, benchmark):
        """Benchmark: compute time series with 100 records."""
        df = generate_test_data(100)
        result = benchmark(compute_time_series, df)
        assert len(result) >= 0

    def test_compute_time_series_large(self, benchmark):
        """Benchmark: compute time series with 10000 records."""
        df = generate_test_data(10000)
        result = benchmark(compute_time_series, df)
        assert len(result) >= 0


class TestComputeAlertThresholdsBenchmark:
    def test_compute_alert_thresholds(self, benchmark):
        """Benchmark: compute alert thresholds."""
        df = generate_test_data(1000)
        result = benchmark(compute_alert_thresholds, df)
        assert "medium" in result
        assert "high" in result


class TestComputeSeverityMetricsBenchmark:
    def test_compute_severity_metrics(self, benchmark):
        """Benchmark: compute severity metrics."""
        df = generate_test_data(1000)
        result = benchmark(compute_severity_metrics, df)
        assert "total" in result
        assert "uti_rate" in result
        assert "death_rate" in result


class TestApplyGlobalFiltersBenchmark:
    def test_apply_global_filters_by_profile(self, benchmark):
        """Benchmark: apply global filters by profile."""
        df = generate_test_data(5000)
        result = benchmark(apply_global_filters, df, profiles=["idoso"])
        assert len(result) <= len(df)

    def test_apply_global_filters_by_gender(self, benchmark):
        """Benchmark: apply global filters by gender."""
        df = generate_test_data(5000)
        result = benchmark(apply_global_filters, df, genders=["M"])
        assert len(result) <= len(df)


class TestClassificarStatusGripeBenchmark:
    def test_classificar_status_gripe(self, benchmark):
        """Benchmark: classify vaccination status for flu."""
        row = {
            "VACINA": 1,
            "DT_UT_DOSE": date(2024, 6, 1),
            "DT_1_DOSE": None,
            "DT_2_DOSE": None,
            "TP_IDADE": 3,
            "NU_IDADE_N": 30,
            "DT_SIN_PRI": date(2024, 7, 1),
        }
        result = benchmark(classificar_status_gripe, row)
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
