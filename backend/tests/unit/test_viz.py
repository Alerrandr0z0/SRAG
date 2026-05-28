import pandas as pd
from matplotlib.axes import Axes

from srag.viz.charts import (
    plot_age_groups,
    plot_history_with_forecast,
    plot_time_series,
    plot_virus_distribution,
)


def test_plot_virus_distribution_empty() -> None:
    df = pd.DataFrame()
    assert plot_virus_distribution(df) is None


def test_plot_virus_distribution_valid() -> None:
    df = pd.DataFrame({"virus": ["SARS-CoV-2", "Influenza"], "count": [100, 50]})
    ax = plot_virus_distribution(df)
    assert isinstance(ax, Axes)
    assert ax.get_title() == "Distribuicao de classificacao final"
    assert ax.get_xlabel() == "Virus/Agente"
    assert ax.get_ylabel() == "Casos"


def test_plot_age_groups_empty() -> None:
    df = pd.DataFrame()
    assert plot_age_groups(df) is None


def test_plot_age_groups_valid() -> None:
    df = pd.DataFrame({"faixa_etaria": ["0-10", "11-20"], "count": [30, 70]})
    ax = plot_age_groups(df)
    assert isinstance(ax, Axes)
    assert ax.get_title() == "Casos por faixa etaria"
    assert ax.get_xlabel() == "Faixa etaria"
    assert ax.get_ylabel() == "Casos"


def test_plot_time_series_empty() -> None:
    df = pd.DataFrame()
    assert plot_time_series(df) is None


def test_plot_time_series_valid() -> None:
    df = pd.DataFrame({"epi_week": ["2023W01", "2023W02"], "total_cases": [5, 10]})
    ax = plot_time_series(df)
    assert isinstance(ax, Axes)
    assert ax.get_title() == "Serie temporal semanal (casos SRAG)"
    assert ax.get_xlabel() == "Semana epidemiologica"
    assert ax.get_ylabel() == "Casos"


def test_plot_history_with_forecast_empty_history() -> None:
    history_df = pd.DataFrame()
    forecast_df = pd.DataFrame({"epi_week": ["2023W03"], "predicted_cases": [15]})
    assert plot_history_with_forecast(history_df, forecast_df) is None


def test_plot_history_with_forecast_empty_forecast() -> None:
    history_df = pd.DataFrame({"epi_week": ["2023W01", "2023W02"], "total_cases": [5, 10]})
    forecast_df = pd.DataFrame()
    ax = plot_history_with_forecast(history_df, forecast_df)
    assert isinstance(ax, Axes)
    assert ax.get_title() == "Historico e previsao (curto prazo)"


def test_plot_history_with_forecast_valid() -> None:
    history_df = pd.DataFrame({"epi_week": ["2023W01", "2023W02"], "total_cases": [5, 10]})
    forecast_df = pd.DataFrame({"epi_week": ["2023W03"], "predicted_cases": [15]})
    ax = plot_history_with_forecast(history_df, forecast_df)
    assert isinstance(ax, Axes)
    assert ax.get_title() == "Historico e previsao (curto prazo)"
