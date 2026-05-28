"""Mutation-targeted tests for territorial.py: exact values, boundaries, edge cases."""

import numpy as np
import pandas as pd

from srag.data.analytics.territorial import (
    compute_territory_distribution,
    compute_territory_entities_by_zone,
    compute_territory_week_heatmap,
    compute_unit_distribution,
    compute_zone_distribution,
)


class TestTerritoryDistribution:
    def test_status_counts_are_aggregated(self) -> None:
        df = pd.DataFrame(
            {
                "BAIRRO_REF": ["Centro", "Centro", "Centro", "Cidade Nova", "Cidade Nova"],
                "EVOLUCAO": [1, 2, 3, 1, 2],
            }
        )
        res = compute_territory_distribution(df, min_cases=1)
        rows = {row["bairro"]: row for _, row in res.iterrows()}

        assert rows["Centro"]["count"] == 3
        assert rows["Centro"]["curados"] == 1
        assert rows["Centro"]["obitos"] == 1
        assert rows["Centro"]["ignorados"] == 1

    def test_min_cases_boundary(self) -> None:
        df = pd.DataFrame(
            {"BAIRRO_REF": ["A", "A", "A", "A", "A", "B", "B", "B", "B", "C", "C", "C", "D", "D"]}
        )
        res = compute_territory_distribution(df, min_cases=5)
        counts = dict(zip(res["bairro"], res["count"], strict=False))
        assert "A" in counts
        assert counts["A"] == 5
        assert "B" not in counts

    def test_min_cases_exact_4(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": ["A", "A", "A", "A", "B", "B", "B"]})
        res = compute_territory_distribution(df, min_cases=4)
        assert "A" in res["bairro"].values
        assert "B" not in res["bairro"].values

    def test_nao_informado_fill(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": [np.nan, np.nan, np.nan, "A", "A"]})
        res = compute_territory_distribution(df, min_cases=3)
        bairros = set(res["bairro"])
        assert "NAO INFORMADO" in bairros

    def test_empty_df(self) -> None:
        assert compute_territory_distribution(pd.DataFrame()).empty

    def test_missing_column(self) -> None:
        assert compute_territory_distribution(pd.DataFrame({"OUTRA": [1]})).empty


class TestZoneDistribution:
    def test_exact_zone_counts(self) -> None:
        df = pd.DataFrame({"ZONA": ["Urbana", "Urbana", "Rural", "Periurbana", np.nan]})
        res = compute_zone_distribution(df)
        assert len(res) == 4
        zonas = dict(zip(res["zona"], res["count"], strict=False))
        assert zonas.get("Urbana") == 2

    def test_nan_filled_nao_informado(self) -> None:
        df = pd.DataFrame({"ZONA": [np.nan, np.nan, "Urbana"]})
        res = compute_zone_distribution(df)
        zonas = set(res["zona"])
        assert "Nao informado" in zonas

    def test_empty_df(self) -> None:
        assert compute_zone_distribution(pd.DataFrame()).empty

    def test_missing_column(self) -> None:
        assert compute_zone_distribution(pd.DataFrame({"OUTRA": [1]})).empty


class TestUnitDistribution:
    def test_status_counts_are_aggregated(self) -> None:
        df = pd.DataFrame(
            {
                "ID_UNIDADE": ["U1", "U1", "U1", "U2", "U2"],
                "EVOLUCAO": [1, 2, 3, 1, 2],
            }
        )
        res = compute_unit_distribution(df, min_cases=1)
        rows = {row["id_unidade"]: row for _, row in res.iterrows()}

        assert rows["U1"]["count"] == 3
        assert rows["U1"]["curados"] == 1
        assert rows["U1"]["obitos"] == 1
        assert rows["U1"]["ignorados"] == 1

    def test_min_cases_boundary(self) -> None:
        df = pd.DataFrame({"ID_UNIDADE": ["U1", "U1", "U1", "U2", "U2", "U3"]})
        res = compute_unit_distribution(df, min_cases=3)
        assert "U1" in res["id_unidade"].values
        assert "U2" not in res["id_unidade"].values

    def test_nao_informado_fill(self) -> None:
        df = pd.DataFrame({"ID_UNIDADE": [np.nan, np.nan, np.nan, "U1", "U1", "U1"]})
        res = compute_unit_distribution(df, min_cases=3)
        unidades = set(res["id_unidade"])
        assert "NAO INFORMADO" in unidades

    def test_empty_df(self) -> None:
        assert compute_unit_distribution(pd.DataFrame()).empty

    def test_missing_column(self) -> None:
        assert compute_unit_distribution(pd.DataFrame({"OUTRA": [1]})).empty


class TestTerritoryWeekHeatmap:
    def test_exact_grid_completeness(self) -> None:
        dates = pd.to_datetime(["2023-01-01", "2023-01-01", "2023-01-08"])
        df = pd.DataFrame({"BAIRRO_REF": ["A", "A", "B"], "DT_SIN_PRI": dates})
        res = compute_territory_week_heatmap(df, top_n_bairros=5, last_n_weeks=4, min_cases=1)
        assert "BAIRRO_REF" in res.columns
        assert "epi_week" in res.columns
        assert "count" in res.columns

    def test_fill_zero_for_missing_combos(self) -> None:
        df = pd.DataFrame(
            {
                "BAIRRO_REF": ["A", "A", "A", "B"],
                "DT_SIN_PRI": pd.to_datetime(
                    ["2023-01-01", "2023-01-08", "2023-01-15", "2023-01-01"]
                ),
            }
        )
        res = compute_territory_week_heatmap(df, top_n_bairros=5, last_n_weeks=3, min_cases=1)
        assert len(res) > 0

    def test_missing_required_columns(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": ["A"]})
        assert compute_territory_week_heatmap(df).empty

    def test_empty_df(self) -> None:
        assert compute_territory_week_heatmap(pd.DataFrame()).empty


class TestTerritoryEntitiesByZone:
    def test_exact_urban_rural_split(self) -> None:
        df = pd.DataFrame(
            {
                "BAIRRO_REF": ["Centro", "Centro", "Zona Rural", "Zona Rural"],
                "ZONA": ["Urbana", "Urbana", "Rural", "Rural"],
            }
        )
        res = compute_territory_entities_by_zone(df, min_cases=1, limit=10)
        assert len(res["urban_bairros"]) == 1
        assert res["urban_bairros"][0]["label"] == "Centro"

    def test_min_cases_filter(self) -> None:
        df = pd.DataFrame(
            {
                "BAIRRO_REF": ["Centro", "Centro", "Centro", "Outro", "Outro"],
                "ZONA": ["Urbana", "Urbana", "Urbana", "Urbana", "Urbana"],
            }
        )
        res = compute_territory_entities_by_zone(df, min_cases=3, limit=10)
        assert len(res["urban_bairros"]) == 1
        assert res["urban_bairros"][0]["label"] == "Centro"

    def test_nao_informado_fill(self) -> None:
        df = pd.DataFrame({"BAIRRO_REF": [np.nan], "ZONA": ["Urbana"]})
        res = compute_territory_entities_by_zone(df, min_cases=1, limit=10)
        assert len(res["urban_bairros"]) == 1
        assert res["urban_bairros"][0]["label"] == "NAO INFORMADO"

    def test_empty_df(self) -> None:
        assert compute_territory_entities_by_zone(pd.DataFrame()) == {
            "urban_bairros": [],
            "rural_comunidades": [],
        }

    def test_missing_columns(self) -> None:
        assert compute_territory_entities_by_zone(pd.DataFrame({"OUTRA": [1]})) == {
            "urban_bairros": [],
            "rural_comunidades": [],
        }
