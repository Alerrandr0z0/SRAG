"""Territory and geographic distribution metrics."""

import pandas as pd

from srag.data.analytics.filters import outcome_death_mask
from srag.data.cnes_lookup import lookup_unit_name
from srag.utils.epi_weeks import format_epi_week, get_epi_week


def _status_counts(df: pd.DataFrame, group_col: str) -> pd.DataFrame:
    out = df.copy()
    out[group_col] = out[group_col].fillna("NAO INFORMADO")
    if "EVOLUCAO" in out.columns:
        evolucao = pd.to_numeric(out["EVOLUCAO"], errors="coerce")
    else:
        evolucao = pd.Series(pd.NA, index=out.index, dtype="Float64")
    out["_is_cura"] = evolucao == 1
    out["_is_obito"] = outcome_death_mask(evolucao)
    out["_is_ignorado"] = evolucao == 3
    return (
        out.groupby(group_col)
        .agg(
            count=(group_col, "size"),
            curados=("_is_cura", "sum"),
            obitos=("_is_obito", "sum"),
            ignorados=("_is_ignorado", "sum"),
        )
        .reset_index()
    )


def compute_territory_distribution(
    df: pd.DataFrame,
    min_cases: int = 5,
) -> pd.DataFrame:
    """Aggregate cases by neighborhood reference with privacy threshold."""
    if df.empty or "BAIRRO_REF" not in df.columns:
        return pd.DataFrame(columns=["bairro", "count", "curados", "obitos", "ignorados"])

    grouped = _status_counts(df, "BAIRRO_REF")
    grouped = grouped[grouped["count"] >= min_cases]
    grouped = grouped.rename(columns={"BAIRRO_REF": "bairro"})
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_zone_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate cases by inferred urban/rural zone."""
    if df.empty or "ZONA" not in df.columns:
        return pd.DataFrame(columns=["zona", "count"])

    out = df.copy()
    out["ZONA"] = out["ZONA"].fillna("Nao informado")
    grouped = out.groupby("ZONA").size().reset_index(name="count")
    grouped = grouped.rename(columns={"ZONA": "zona"})
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_unit_distribution(df: pd.DataFrame, min_cases: int = 3) -> pd.DataFrame:
    """Aggregate notification records by notifying unit/hospital with CNES names."""
    if df.empty or "ID_UNIDADE" not in df.columns:
        return pd.DataFrame(
            columns=["id_unidade", "nome_fantasia", "count", "curados", "obitos", "ignorados"]
        )

    grouped = _status_counts(df, "ID_UNIDADE")
    grouped = grouped[grouped["count"] >= min_cases]
    grouped = grouped.rename(columns={"ID_UNIDADE": "id_unidade"})
    grouped["nome_fantasia"] = grouped["id_unidade"].apply(lookup_unit_name)
    return grouped.sort_values("count", ascending=False).reset_index(drop=True)


def compute_territory_week_heatmap(
    df: pd.DataFrame,
    top_n_bairros: int = 12,
    last_n_weeks: int = 12,
    min_cases: int = 5,
) -> pd.DataFrame:
    """Build neighborhood x epidemiological-week matrix for heatmap visualizations."""
    if df.empty:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    required = {"BAIRRO_REF", "DT_SIN_PRI"}
    if not required.issubset(set(df.columns)):
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    out = df.copy()
    out = out[out["DT_SIN_PRI"].notna()]
    out["BAIRRO_REF"] = out["BAIRRO_REF"].fillna("NAO INFORMADO")
    out["se_year_week"] = out["DT_SIN_PRI"].apply(get_epi_week)
    out["epi_week"] = out["se_year_week"].apply(lambda x: format_epi_week(*x))

    bairros = (
        out.groupby("BAIRRO_REF")
        .size()
        .reset_index(name="count")
        .query("count >= @min_cases")
        .sort_values("count", ascending=False)
        .head(top_n_bairros)["BAIRRO_REF"]
        .tolist()
    )
    if not bairros:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    week_order = sorted(out["epi_week"].dropna().unique())[-last_n_weeks:]
    if not week_order:
        return pd.DataFrame(columns=["BAIRRO_REF", "epi_week", "count"])

    filtered = out[out["BAIRRO_REF"].isin(bairros) & out["epi_week"].isin(week_order)]
    grouped = filtered.groupby(["BAIRRO_REF", "epi_week"]).size().reset_index(name="count")

    full_grid = pd.MultiIndex.from_product([bairros, week_order], names=["BAIRRO_REF", "epi_week"])
    matrix = (
        grouped.set_index(["BAIRRO_REF", "epi_week"])
        .reindex(full_grid, fill_value=0)
        .reset_index()
    )
    return matrix


def compute_territory_entities_by_zone(
    df: pd.DataFrame,
    min_cases: int = 3,
    limit: int = 40,
) -> dict[str, list[dict[str, int | str]]]:
    """Return selectable urban bairros and rural communities for filters."""
    if df.empty or "BAIRRO_REF" not in df.columns or "ZONA" not in df.columns:
        return {"urban_bairros": [], "rural_comunidades": []}

    out = df.copy()
    out["BAIRRO_REF"] = out["BAIRRO_REF"].fillna("NAO INFORMADO")
    out["zona_norm"] = out["ZONA"].fillna("").astype(str).str.upper().str.strip()

    grouped = out.groupby(["zona_norm", "BAIRRO_REF"]).size().reset_index(name="count")
    grouped = grouped[grouped["count"] >= min_cases]

    urban = (
        grouped[grouped["zona_norm"] == "URBANA"].sort_values("count", ascending=False).head(limit)
    )
    rural = (
        grouped[grouped["zona_norm"] == "RURAL"].sort_values("count", ascending=False).head(limit)
    )

    return {
        "urban_bairros": [
            {"label": str(r["BAIRRO_REF"]), "count": int(r["count"])} for _, r in urban.iterrows()
        ],
        "rural_comunidades": [
            {"label": str(r["BAIRRO_REF"]), "count": int(r["count"])} for _, r in rural.iterrows()
        ],
    }
