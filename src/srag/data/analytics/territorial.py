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


def _resolve_mun_uf(mun_code: str | float | int | None) -> tuple[str, str]:
    if pd.isna(mun_code):
        return "Nao informado", "RN"
    code = str(mun_code).strip()[:6]
    if not code or not code.isdigit():
        return "Nao informado", "RN"

    uf_map = {
        "11": "RO",
        "12": "AC",
        "13": "AM",
        "14": "RR",
        "15": "PA",
        "16": "AP",
        "17": "TO",
        "21": "MA",
        "22": "PI",
        "23": "CE",
        "24": "RN",
        "25": "PB",
        "26": "PE",
        "27": "AL",
        "28": "SE",
        "29": "BA",
        "31": "MG",
        "32": "ES",
        "33": "RJ",
        "35": "SP",
        "41": "PR",
        "42": "SC",
        "43": "RS",
        "50": "MS",
        "51": "MT",
        "52": "GO",
        "53": "DF",
    }

    mun_map = {
        "240800": "Mossoró",
        "240810": "Natal",
        "240200": "Caicó",
        "240020": "Açu",
        "240140": "Baraúna",
        "240050": "Almino Afonso",
        "240060": "Apodi",
        "240080": "Areia Branca",
        "240260": "Carnaubais",
        "240325": "Parnamirim",
        "240440": "Grossos",
        "240470": "Ielmo Marinho",
        "240560": "Ipanguaçu",
        "240750": "Martins",
        "240970": "Pau dos Ferros",
        "240940": "Pau dos Ferros",
        "241030": "Portalegre",
        "241250": "São Miguel",
        "241440": "Tibau",
        "241490": "Umarizal",
        "240450": "Guamaré",
        "240310": "Currais Novos",
        "240100": "Apodi",
        "230440": "Fortaleza",
        "230100": "Aracati",
        "230523": "Horizonte",
        "230670": "Itapipoca",
        "230765": "Maracanaú",
        "230730": "Juazeiro do Norte",
        "230960": "Pacajus",
        "231130": "Quixadá",
        "231140": "Quixeramobim",
        "231240": "Russas",
        "231340": "Sobral",
        "231350": "Tabuleiro do Norte",
        "130260": "Manaus",
        "250400": "Campina Grande",
        "250750": "João Pessoa",
        "251370": "Santa Rita",
        "270430": "Maceió",
        "290830": "Conceição do Almeida",
        "292740": "Salvador",
        "312770": "Governador Valadares",
        "330455": "Rio de Janeiro",
        "355030": "São Paulo",
        "411990": "Ponta Grossa",
    }

    uf = uf_map.get(code[:2], "RN")
    mun_name = mun_map.get(code, f"Município {code}")
    return mun_name, uf


def compute_unit_distribution(df: pd.DataFrame, min_cases: int = 1) -> pd.DataFrame:
    """Aggregate notification records by notifying unit/hospital with CNES names and locations."""
    if df.empty or "ID_UNIDADE" not in df.columns:
        return pd.DataFrame(
            columns=[
                "id_unidade",
                "nome_fantasia",
                "count",
                "curados",
                "obitos",
                "ignorados",
                "municipio",
                "uf",
            ]
        )

    grouped = _status_counts(df, "ID_UNIDADE")
    grouped = grouped[grouped["count"] >= min_cases]
    grouped = grouped.rename(columns={"ID_UNIDADE": "id_unidade"})
    grouped["nome_fantasia"] = grouped["id_unidade"].apply(lookup_unit_name)

    # Resolve unit locations (municipio and uf)
    unit_to_mun = {}
    if "ID_UNIDADE" in df.columns and "ID_MUNICIP" in df.columns:
        has_uid = df["ID_UNIDADE"].notna()
        is_not_empty = df["ID_UNIDADE"].astype(str).str.strip() != ""
        valid_df = df[has_uid & is_not_empty]
        if not valid_df.empty:
            freq = valid_df.groupby(["ID_UNIDADE", "ID_MUNICIP"]).size().reset_index(name="sz")
            idx = freq.groupby("ID_UNIDADE")["sz"].idxmax()
            unit_to_mun = dict(
                zip(freq.loc[idx, "ID_UNIDADE"], freq.loc[idx, "ID_MUNICIP"], strict=False)
            )

    def get_unit_location(unit_id: str) -> tuple[str, str]:
        # Try CNES record first
        from srag.data.cnes_lookup import lookup_unit_record

        rec = lookup_unit_record(unit_id)
        if rec and isinstance(rec, dict) and rec.get("codigo_municipio"):
            return _resolve_mun_uf(rec["codigo_municipio"])
        # Fallback to database notifications
        fallback_code = unit_to_mun.get(unit_id)
        return _resolve_mun_uf(fallback_code)

    locs = [get_unit_location(str(uid)) for uid in grouped["id_unidade"]]
    grouped["municipio"] = [loc[0] for loc in locs]
    grouped["uf"] = [loc[1] for loc in locs]

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
