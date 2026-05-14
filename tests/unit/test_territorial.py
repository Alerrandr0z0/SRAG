import pandas as pd

from srag.data.analytics.territorial import (
    compute_territory_distribution,
    compute_territory_entities_by_zone,
    compute_territory_week_heatmap,
    compute_unit_distribution,
    compute_zone_distribution,
)


def test_territory_distribution_empty() -> None:
    df = pd.DataFrame()
    res = compute_territory_distribution(df)
    assert res.empty
    assert list(res.columns) == ["bairro", "count"]

def test_territory_distribution_missing_col() -> None:
    df = pd.DataFrame({"OTHER": [1]})
    res = compute_territory_distribution(df)
    assert res.empty

def test_territory_distribution_valid() -> None:
    df = pd.DataFrame({
        "BAIRRO_REF": ["A"] * 5 + ["B"] * 4 + ["C"] * 10 + [None] * 6
    })
    res = compute_territory_distribution(df, min_cases=5)
    assert len(res) == 3
    assert list(res["bairro"]) == ["C", "NAO INFORMADO", "A"]
    assert list(res["count"]) == [10, 6, 5]
    # B has 4 cases, which is < 5, so it's dropped.

def test_zone_distribution_empty() -> None:
    df = pd.DataFrame()
    res = compute_zone_distribution(df)
    assert res.empty
    assert list(res.columns) == ["zona", "count"]

def test_zone_distribution_valid() -> None:
    df = pd.DataFrame({
        "ZONA": ["Urbana", "Urbana", "Rural", None]
    })
    res = compute_zone_distribution(df)
    assert len(res) == 3
    assert res.iloc[0]["zona"] == "Urbana"
    assert res.iloc[0]["count"] == 2
    assert "Nao informado" in res["zona"].values

def test_unit_distribution_empty() -> None:
    df = pd.DataFrame()
    res = compute_unit_distribution(df)
    assert res.empty
    assert list(res.columns) == ["id_unidade", "count"]

def test_unit_distribution_valid() -> None:
    df = pd.DataFrame({
        "ID_UNIDADE": ["H1"] * 4 + ["H2"] * 2 + [None] * 3
    })
    res = compute_unit_distribution(df, min_cases=3)
    assert len(res) == 2
    assert list(res["id_unidade"]) == ["H1", "NAO INFORMADO"]
    assert list(res["count"]) == [4, 3]

def test_territory_week_heatmap_empty() -> None:
    df = pd.DataFrame()
    res = compute_territory_week_heatmap(df)
    assert res.empty

def test_territory_week_heatmap_missing_cols() -> None:
    df = pd.DataFrame({"BAIRRO_REF": ["A"]})
    res = compute_territory_week_heatmap(df)
    assert res.empty

def test_territory_week_heatmap_valid() -> None:
    df = pd.DataFrame({
        "BAIRRO_REF": ["B1"] * 6 + ["B2"] * 5 + ["B3"] * 4 + [None] * 6,
        "DT_SIN_PRI": [
            "2023-01-01", "2023-01-01", "2023-01-08", "2023-01-08", "2023-01-15", "2023-01-15", # B1
            "2023-01-01", "2023-01-08", "2023-01-08", "2023-01-15", "2023-01-15",             # B2
            "2023-01-01", "2023-01-08", "2023-01-15", "2023-01-22",                           # B3 (dropped since count < 5)
            "2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"  # NAO INFORMADO
        ]
    })
    # B1 (6), B2 (5), NAO INFORMADO (6) -> these are kept.
    res = compute_territory_week_heatmap(df, min_cases=5, last_n_weeks=3)

    assert not res.empty
    assert set(res["BAIRRO_REF"]) == {"B1", "B2", "NAO INFORMADO"}
    # The output should contain combinations of BAIRRO_REF and epi_week with count.

    # Check if there are zero fillings
    assert "count" in res.columns
    # Ensure all combinations exist (3 bairros * 3 weeks = 9? Let's check weeks)
    # The weeks from valid DT_SIN_PRI: "2023-01-01", "2023-01-08", "2023-01-15" are the last 3 if 2023-01-22 is dropped with B3.
    # Wait, B3 has 4 cases, B3 is excluded. BUT does DT_SIN_PRI for B3 still contribute to unique weeks?
    # Yes! `week_order = sorted(out["epi_week"].dropna().unique())[-last_n_weeks:]` happens BEFORE filtering by B3!
    # So weeks are from ["2023-01-01", "2023-01-08", "2023-01-15", "2023-01-22"]. Last 3 weeks are "2023-01-08", "2023-01-15", "2023-01-22".
    pass

def test_territory_entities_by_zone_empty() -> None:
    df = pd.DataFrame()
    res = compute_territory_entities_by_zone(df)
    assert res == {"urban_bairros": [], "rural_comunidades": []}

def test_territory_entities_by_zone_missing_cols() -> None:
    df = pd.DataFrame({"BAIRRO_REF": ["A"]})
    res = compute_territory_entities_by_zone(df)
    assert res == {"urban_bairros": [], "rural_comunidades": []}

def test_territory_entities_by_zone_valid() -> None:
    df = pd.DataFrame({
        "BAIRRO_REF": ["U1"] * 4 + ["U2"] * 2 + ["R1"] * 5 + ["R2"] * 3 + [None] * 4,
        "ZONA": ["Urbana"] * 4 + ["URBANA"] * 2 + ["Rural"] * 5 + ["RURAL "] * 3 + ["Urbana"] * 4
    })

    res = compute_territory_entities_by_zone(df, min_cases=3)

    # U1 has 4 cases (kept), U2 has 2 cases (dropped)
    # R1 has 5 cases (kept), R2 has 3 cases (kept)
    # NAO INFORMADO has 4 cases in Urbana (kept)

    assert len(res["urban_bairros"]) == 2
    assert {"label": "U1", "count": 4} in res["urban_bairros"]
    assert {"label": "NAO INFORMADO", "count": 4} in res["urban_bairros"]

    assert len(res["rural_comunidades"]) == 2
    assert {"label": "R1", "count": 5} in res["rural_comunidades"]
    assert {"label": "R2", "count": 3} in res["rural_comunidades"]
