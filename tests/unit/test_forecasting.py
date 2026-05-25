import pandas as pd

from srag.models.forecasting import predict_next_weeks


def test_predict_next_weeks_empty() -> None:
    df = pd.DataFrame(columns=["epi_week", "total"])
    result = predict_next_weeks(df)
    assert result["status"] == "insufficient_data"


def test_predict_next_weeks_insufficient_data() -> None:
    df = pd.DataFrame({"epi_week": [f"2024-{i:02d}" for i in range(1, 6)], "total": [10] * 5})
    # Prophet needs at least 12 points in current implementation
    result = predict_next_weeks(df, weeks_to_predict=2)
    assert result["status"] == "insufficient_data"


def test_predict_next_weeks_prophet_success() -> None:
    # Provide 12 weeks of data
    df = pd.DataFrame(
        {
            "epi_week": [f"2024-{i:02d}" for i in range(1, 13)],
            "total": [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 21, 20],
        }
    )
    result = predict_next_weeks(df, weeks_to_predict=4)
    assert result["status"] == "success"
    assert result["model_type"] == "stable_moving_average"
    assert len(result["forecast"]) == 4
    for f in result["forecast"]:
        assert isinstance(f["predicted_cases"], int)
        assert isinstance(f["predicted_cases_lower"], int)
        assert isinstance(f["predicted_cases_upper"], int)
        assert f["is_forecast"] is True


def test_predict_next_weeks_no_negative() -> None:
    # Steep downward trend
    df = pd.DataFrame(
        {
            "epi_week": [f"2024-{i:02d}" for i in range(1, 15)],
            "total": [100, 80, 60, 40, 20, 10, 5, 2, 1, 0, 0, 0, 0, 0],
        }
    )
    result = predict_next_weeks(df, weeks_to_predict=4)
    assert result["status"] == "success"
    for f in result["forecast"]:
        assert f["predicted_cases"] >= 0
