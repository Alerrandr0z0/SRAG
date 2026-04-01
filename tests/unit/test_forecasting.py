import pandas as pd
import numpy as np
from srag.models.forecasting import predict_next_weeks, compute_moving_average

def test_compute_moving_average():
    values = np.array([10, 20, 30, 40, 50])
    # window=3, center=True, min_periods=1
    ma = compute_moving_average(values, window=3)
    assert len(ma) == 5
    assert ma[0] == 15.0
    assert ma[1] == 20.0
    assert ma[2] == 30.0
    assert ma[3] == 40.0
    assert ma[4] == 45.0

def test_predict_next_weeks_empty():
    df = pd.DataFrame(columns=["epi_week", "total"])
    result = predict_next_weeks(df)
    assert result["status"] == "insufficient_data"

def test_predict_next_weeks_insufficient_data():
    df = pd.DataFrame({
        "epi_week": [f"2024-{i:02d}" for i in range(1, 6)],
        "total": [10] * 5
    })
    # Prophet needs >= 10 points in my refactored implementation
    result = predict_next_weeks(df, weeks_to_predict=2)
    assert result["status"] == "insufficient_data"

def test_predict_next_weeks_prophet_success():
    # Provide 12 weeks of data
    df = pd.DataFrame({
        "epi_week": [f"2024-{i:02d}" for i in range(1, 13)],
        "total": [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 21, 20]
    })
    result = predict_next_weeks(df, weeks_to_predict=4)
    assert result["status"] == "success"
    assert result["model_type"] == "prophet_seasonal"
    assert len(result["forecast"]) == 4
    for f in result["forecast"]:
        assert "predicted_cases" in f
        assert "predicted_cases_lower" in f
        assert "predicted_cases_upper" in f
        assert f["is_forecast"] is True

def test_predict_next_weeks_no_negative():
    # Steep downward trend
    df = pd.DataFrame({
        "epi_week": [f"2024-{i:02d}" for i in range(1, 15)],
        "total": [100, 80, 60, 40, 20, 10, 5, 2, 1, 0, 0, 0, 0, 0]
    })
    result = predict_next_weeks(df, weeks_to_predict=4)
    assert result["status"] == "success"
    for f in result["forecast"]:
        assert f["predicted_cases"] >= 0
