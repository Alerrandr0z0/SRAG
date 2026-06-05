"""Unit tests for src/srag/utils/pandas_helpers.py.

These helpers exist to keep Pyright strict mode happy when converting
DataFrame columns to numeric/datetime. They must be safe when the column
is missing or not a Series (e.g. None, scalar), and must coerce invalid
values to NaN rather than raising.
"""

import pandas as pd
import pytest

from srag.utils.pandas_helpers import to_datetime_series, to_numeric_series


class TestToNumericSeries:
    def test_missing_column_returns_empty_series_with_df_index(self) -> None:
        df = pd.DataFrame({"a": [1, 2, 3]})
        out = to_numeric_series(df, "does_not_exist")
        assert isinstance(out, pd.Series)
        assert len(out) == len(df)
        assert out.isna().all()
        assert list(out.index) == list(df.index)

    def test_present_column_is_coerced_to_numeric(self) -> None:
        df = pd.DataFrame({"a": ["1", "2", "3"]})
        out = to_numeric_series(df, "a")
        assert out.tolist() == [1.0, 2.0, 3.0]

    def test_invalid_strings_become_nan(self) -> None:
        df = pd.DataFrame({"a": ["1", "not-a-number", "3.5"]})
        out = to_numeric_series(df, "a")
        assert out.tolist()[0] == 1.0
        assert pd.isna(out.tolist()[1])
        assert out.tolist()[2] == 3.5

    def test_returns_numeric_dtype(self) -> None:
        df = pd.DataFrame({"a": [1, 2, 3]})
        out = to_numeric_series(df, "a")
        assert pd.api.types.is_numeric_dtype(out)
        assert out.tolist() == [1.0, 2.0, 3.0]

    def test_preserves_index_for_non_default_index(self) -> None:
        df = pd.DataFrame({"a": [1, 2, 3]}, index=[10, 20, 30])
        out = to_numeric_series(df, "does_not_exist")
        assert list(out.index) == [10, 20, 30]


class TestToDatetimeSeries:
    def test_missing_column_returns_empty_datetime_series(self) -> None:
        df = pd.DataFrame({"a": [1, 2, 3]})
        out = to_datetime_series(df, "does_not_exist")
        assert isinstance(out, pd.Series)
        assert len(out) == len(df)
        assert out.tolist() == [pd.NaT, pd.NaT, pd.NaT]
        assert "datetime64" in str(out.dtype)

    def test_present_column_is_parsed_to_datetime(self) -> None:
        df = pd.DataFrame({"a": ["2023-01-01", "2024-06-15"]})
        out = to_datetime_series(df, "a")
        assert out.iloc[0] == pd.Timestamp("2023-01-01")
        assert out.iloc[1] == pd.Timestamp("2024-06-15")

    def test_invalid_dates_become_nat(self) -> None:
        df = pd.DataFrame({"a": ["2023-01-01", "garbage", "2024-06-15"]})
        out = to_datetime_series(df, "a")
        assert out.iloc[0] == pd.Timestamp("2023-01-01")
        assert pd.isna(out.iloc[1])
        assert out.iloc[2] == pd.Timestamp("2024-06-15")

    def test_datetime_dtype_is_datetime64_ns(self) -> None:
        df = pd.DataFrame({"a": ["2023-01-01"]})
        out = to_datetime_series(df, "a")
        assert str(out.dtype) == "datetime64[ns]"

    @pytest.mark.parametrize(
        "input_col,expected",
        [
            ("a", [pd.NaT, pd.NaT]),
            ("missing", [pd.NaT, pd.NaT]),
        ],
    )
    def test_empty_dataframe_returns_empty_indexed_series(
        self, input_col: str, expected: list[pd.Timestamp]
    ) -> None:
        df = pd.DataFrame({input_col: pd.Series(dtype=object)})
        out = to_datetime_series(df, input_col)
        assert len(out) == 0
        assert "datetime64" in str(out.dtype)
