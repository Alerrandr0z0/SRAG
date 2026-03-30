"""Reusable plotting functions for SRAG analytics outputs."""

from __future__ import annotations

from typing import TYPE_CHECKING

import matplotlib.axes
import matplotlib.pyplot as plt

if TYPE_CHECKING:
    import pandas as pd


def _build_axes(figsize: tuple[float, float]) -> matplotlib.axes.Axes:
    """Create and return a matplotlib axis with a standard style."""
    _, ax = plt.subplots(figsize=figsize)
    return ax


def plot_virus_distribution(
    virus_df: pd.DataFrame,
    *,
    figsize: tuple[float, float] = (10, 4),
) -> matplotlib.axes.Axes | None:
    """Plot virus/classification distribution as a bar chart."""
    if virus_df.empty:
        return None

    plot_df = virus_df.sort_values("count", ascending=False)
    ax = _build_axes(figsize)
    ax.bar(plot_df["virus"], plot_df["count"], color="#4e79a7")
    ax.set_title("Distribuicao de classificacao final")
    ax.set_xlabel("Virus/Agente")
    ax.set_ylabel("Casos")
    ax.tick_params(axis="x", rotation=30)
    plt.tight_layout()
    return ax


def plot_age_groups(
    age_df: pd.DataFrame,
    *,
    figsize: tuple[float, float] = (10, 4),
) -> matplotlib.axes.Axes | None:
    """Plot age group distribution as a bar chart."""
    if age_df.empty:
        return None

    plot_df = age_df.sort_values("count", ascending=False)
    ax = _build_axes(figsize)
    ax.bar(plot_df["faixa_etaria"], plot_df["count"], color="#386cb0")
    ax.set_title("Casos por faixa etaria")
    ax.set_xlabel("Faixa etaria")
    ax.set_ylabel("Casos")
    ax.tick_params(axis="x", rotation=30)
    plt.tight_layout()
    return ax


def plot_time_series(
    ts_df: pd.DataFrame,
    *,
    figsize: tuple[float, float] = (12, 4),
) -> matplotlib.axes.Axes | None:
    """Plot weekly historical SRAG time series."""
    if ts_df.empty:
        return None

    ax = _build_axes(figsize)
    ax.plot(ts_df["epi_week"], ts_df["total_cases"], marker="o", color="#1b9e77")
    ax.set_title("Serie temporal semanal (casos SRAG)")
    ax.set_xlabel("Semana epidemiologica")
    ax.set_ylabel("Casos")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    return ax


def plot_history_with_forecast(
    history_df: pd.DataFrame,
    forecast_df: pd.DataFrame,
    *,
    figsize: tuple[float, float] = (12, 4),
) -> matplotlib.axes.Axes | None:
    """Plot historical weekly series and forecasted points together."""
    if history_df.empty:
        return None

    ax = _build_axes(figsize)
    ax.plot(
        history_df["epi_week"],
        history_df["total_cases"],
        marker="o",
        color="#1b9e77",
        label="Historico",
    )

    if not forecast_df.empty:
        ax.plot(
            forecast_df["epi_week"],
            forecast_df["predicted_cases"],
            marker="o",
            linestyle="--",
            color="#d95f02",
            label="Previsao",
        )

    ax.set_title("Historico e previsao (curto prazo)")
    ax.set_xlabel("Semana epidemiologica")
    ax.set_ylabel("Casos")
    ax.legend()
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    return ax
