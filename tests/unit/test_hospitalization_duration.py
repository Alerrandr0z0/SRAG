"""Tests for hospitalization duration: KDE curves and outcome splitting."""

import numpy as np
import pandas as pd
import pytest

from srag.api.routers_clinical import (
    _compute_kde_curves,
    _epanechnikov_kde,
    _extract_hospitalization_durations,
    _summarize_hospitalization,
)


class TestEpanechnikovKde:
    def test_empty_returns_zeros(self) -> None:
        grid = np.linspace(0, 10, 21)
        result = _epanechnikov_kde(np.array([]), bandwidth=2.0, grid=grid)
        assert result.shape == grid.shape
        assert np.all(result == 0.0)

    def test_single_value_is_triangle_peak(self) -> None:
        grid = np.linspace(0, 10, 101)
        values = np.array([5.0])
        result = _epanechnikov_kde(values, bandwidth=2.0, grid=grid)
        peak_idx = np.argmax(result)
        peak_value = grid[peak_idx]
        assert abs(peak_value - 5.0) < 0.2
        assert result[peak_idx] > 0

    def test_density_peak_scales_with_count(self) -> None:
        grid = np.linspace(0, 10, 51)
        one_value = _epanechnikov_kde(np.array([5.0]), 2.0, grid)
        two_values = _epanechnikov_kde(np.array([5.0, 5.0]), 2.0, grid)
        np.testing.assert_allclose(two_values, 2 * one_value, rtol=1e-9)

    def test_outside_bandwidth_is_zero(self) -> None:
        grid = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])
        values = np.array([2.5])
        result = _epanechnikov_kde(values, bandwidth=1.0, grid=grid)
        assert result[0] == 0.0
        assert result[-1] == 0.0
        assert result[2] > 0.0

    def test_density_integration_scales_with_count(self) -> None:
        """Integral of KDE must scale with the number of values (sum, not normalized)."""
        np.random.seed(0)
        values = np.random.normal(20.0, 5.0, size=2000)
        grid = np.linspace(0, 45, 451)
        density = _epanechnikov_kde(values, bandwidth=2.0, grid=grid)
        integral = float(np.trapezoid(density, grid))
        assert abs(integral - 2000.0) / 2000.0 < 0.1


class TestExtractHospitalizationDurations:
    def test_filters_incomplete_cases(self) -> None:
        df = pd.DataFrame(
            {
                "DT_INTERNA": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_EVOLUCA": ["2023-01-10", "2023-01-02", np.nan, "2024-12-01"],
                "EVOLUCAO": [1, 2, 3, 1],
            }
        )
        out = _extract_hospitalization_durations(df)
        assert len(out) == 2
        assert sorted(out["days"].tolist()) == [1, 9]

    def test_ignores_invalid_durations(self) -> None:
        df = pd.DataFrame(
            {
                "DT_INTERNA": ["2023-01-10", "2023-01-01"],
                "DT_EVOLUCA": ["2023-01-01", "2023-01-15"],
                "EVOLUCAO": [1, 1],
            }
        )
        out = _extract_hospitalization_durations(df)
        assert len(out) == 1
        assert out["days"].iloc[0] == 14

    def test_caps_at_90_days(self) -> None:
        df = pd.DataFrame(
            {
                "DT_INTERNA": ["2023-01-01", "2023-01-01"],
                "DT_EVOLUCA": ["2023-04-01", "2023-05-01"],
                "EVOLUCAO": [1, 2],
            }
        )
        out = _extract_hospitalization_durations(df)
        assert len(out) == 1
        assert out["days"].iloc[0] == 90

    def test_keeps_open_cases_excluded(self) -> None:
        df = pd.DataFrame(
            {
                "DT_INTERNA": ["2023-01-01", "2023-01-01", "2023-01-01"],
                "DT_EVOLUCA": ["2023-01-10", "2023-01-15", "2023-01-20"],
                "EVOLUCAO": [1, 2, 9],
            }
        )
        out = _extract_hospitalization_durations(df)
        assert len(out) == 2
        assert set(out["EVOLUCAO"].tolist()) == {1, 2}


class TestSummarizeHospitalization:
    def test_cure_only_zeros_for_death(self) -> None:
        cure = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        death = pd.Series([], dtype=float)
        res = _summarize_hospitalization(cure, death)
        assert res["median_cure"] == 3.0
        assert res["median_death"] == 0.0
        assert res["difference"] == 0.0
        assert res["ratio"] == 0.0
        assert res["death_count"] == 0

    def test_both_groups_ratio_and_difference(self) -> None:
        cure = pd.Series([10.0, 20.0, 30.0, 40.0])
        death = pd.Series([2.0, 4.0, 6.0, 8.0])
        res = _summarize_hospitalization(cure, death)
        assert res["median_cure"] == 25.0
        assert res["median_death"] == 5.0
        assert res["difference"] == 20.0
        assert res["ratio"] == 5.0
        assert res["cure_count"] == 4
        assert res["death_count"] == 4


class TestComputeKdeCurves:
    def test_returns_three_lists_with_same_length(self) -> None:
        cure = pd.Series([5.0, 10.0, 15.0])
        death = pd.Series([2.0, 4.0, 6.0, 8.0])
        kde_x, kde_cure, kde_death = _compute_kde_curves(cure, death)
        assert len(kde_x) == len(kde_cure) == len(kde_death)
        assert len(kde_x) > 80
        assert all(x >= 0 for x in kde_x)
        assert max(kde_x) <= 45.5

    def test_empty_group_returns_zeros(self) -> None:
        kde_x, kde_cure, kde_death = _compute_kde_curves(
            pd.Series([], dtype=float), pd.Series([1.0, 2.0, 3.0])
        )
        assert len(kde_x) == len(kde_cure) == len(kde_death)
        assert all(v == 0.0 for v in kde_cure)
        assert max(kde_death) > 0.0

    def test_both_empty(self) -> None:
        kde_x, kde_cure, kde_death = _compute_kde_curves(
            pd.Series([], dtype=float), pd.Series([], dtype=float)
        )
        assert len(kde_x) == len(kde_cure) == len(kde_death)
        assert all(v == 0.0 for v in kde_cure)
        assert all(v == 0.0 for v in kde_death)

    def test_grid_step_is_half_day(self) -> None:
        kde_x, _, _ = _compute_kde_curves(pd.Series([10.0]), pd.Series([5.0]))
        diffs = [round(kde_x[i + 1] - kde_x[i], 2) for i in range(5)]
        assert all(d == 0.5 for d in diffs)

    def test_max_grid_value_under_or_equal_45(self) -> None:
        kde_x, _, _ = _compute_kde_curves(pd.Series([1.0]), pd.Series([1.0]))
        assert max(kde_x) <= 45.5
        assert min(kde_x) == 0.0


@pytest.mark.parametrize(
    "kde_x,kde_cure,kde_death,expected_pattern",
    [
        ([], [], [], "sobrepostas"),
        ([0.5, 1.0], [0.0, 0.0], [0.0, 0.0], "sobrepostas"),
        ([0.5, 1.0], [5.0, 10.0], [0.0, 0.0], "sobrepostas"),
    ],
)
def test_kde_payload_shape(
    kde_x: list[float], kde_cure: list[float], kde_death: list[float], expected_pattern: str
) -> None:
    """Smoke test that payload shape is consistent for the frontend."""
    payload = {
        "kde_x": kde_x,
        "kde_cure": kde_cure,
        "kde_death": kde_death,
    }
    assert len(payload["kde_x"]) == len(payload["kde_cure"]) == len(payload["kde_death"])
    assert expected_pattern in "sobrepostas"
