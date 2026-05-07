from datetime import date

import numpy as np
import pandas as pd

from srag.api.core import apply_surveillance_filters, sanitize_data


class TestSanitizeData:
    def test_sanitize_dict(self):
        data = {"key": "value", "count": np.int64(5), "rate": np.float64(3.14)}
        result = sanitize_data(data)
        assert result == {"key": "value", "count": 5, "rate": 3.14}
        assert isinstance(result["count"], int)
        assert isinstance(result["rate"], float)

    def test_sanitize_list(self):
        data = [np.int64(1), np.int32(2), np.float64(1.5)]
        result = sanitize_data(data)
        assert result == [1, 2, 1.5]

    def test_sanitize_nested(self):
        data = {"items": [{"value": np.float64(1.0)}, {"value": np.int64(2)}]}
        result = sanitize_data(data)
        assert result == {"items": [{"value": 1.0}, {"value": 2}]}

    def test_sanitize_numpy_array(self):
        data = np.array([1, 2, 3])
        result = sanitize_data(data)
        assert result == [1, 2, 3]

    def test_sanitize_none(self):
        assert sanitize_data(None) is None

    def test_sanitize_pandas_na(self):
        assert sanitize_data(pd.NA) is None
        assert sanitize_data(np.nan) is None


class TestApplySurveillanceFilters:
    def test_filter_by_years(self):
        df = pd.DataFrame({"DT_SIN_PRI": [date(2023, 1, 1), date(2024, 1, 1), date(2025, 1, 1)]})
        result = apply_surveillance_filters(df, years=[2024])
        assert len(result) == 1
        assert result.iloc[0]["DT_SIN_PRI"] == date(2024, 1, 1)

    def test_filter_by_years_empty(self):
        df = pd.DataFrame({"DT_SIN_PRI": [date(2023, 1, 1)]})
        result = apply_surveillance_filters(df, years=[2025])
        assert len(result) == 0

    def test_filter_by_agents(self, monkeypatch):
        monkeypatch.setattr(
            "srag.api.core.infer_etiologic_agent",
            lambda df: pd.Series(["COVID-19", "Influenza", "COVID-19"]),
        )
        df = pd.DataFrame({"CLASSI_FIN": [1, 5, 1]})
        result = apply_surveillance_filters(df, agents=["COVID-19"])
        assert len(result) == 2

    def test_filter_by_both(self, monkeypatch):
        df = pd.DataFrame(
            {
                "DT_SIN_PRI": [date(2024, 1, 1), date(2024, 1, 1)],
                "CLASSI_FIN": [1, 5],
            }
        )
        monkeypatch.setattr(
            "srag.api.core.infer_etiologic_agent",
            lambda df: pd.Series(["COVID-19", "Influenza"]),
        )
        result = apply_surveillance_filters(df, years=[2024], agents=["COVID-19"])
        assert len(result) == 1

    def test_no_filters_returns_original(self):
        df = pd.DataFrame({"DT_SIN_PRI": [date(2024, 1, 1)]})
        result = apply_surveillance_filters(df)
        assert len(result) == 1
