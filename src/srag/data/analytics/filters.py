"""Data filtering and core logic."""

import pandas as pd

from srag.data.references import DEATH_OUTCOMES, VALID_OUTCOMES


def _age_years(df: pd.DataFrame) -> pd.Series:
    """Normalize age into years whenever possible."""
    if "IDADE_ANOS" in df.columns and df["IDADE_ANOS"].notna().any():
        return pd.to_numeric(df["IDADE_ANOS"], errors="coerce")

    nu_idade = df.get("NU_IDADE_N", pd.Series(index=df.index))
    idade_bruta = pd.to_numeric(nu_idade, errors="coerce").fillna(0)
    tp = pd.to_numeric(df.get("TP_IDADE", pd.Series(index=df.index)), errors="coerce")

    idade_anos = pd.Series(pd.NA, index=df.index, dtype="Float64")
    idade_anos = idade_anos.mask(tp == 3, idade_bruta)
    idade_anos = idade_anos.mask(tp == 2, idade_bruta / 12.0)
    idade_anos = idade_anos.mask(tp == 1, idade_bruta / 365.25)
    idade_anos = idade_anos.mask(tp.isna(), idade_bruta)

    return pd.to_numeric(idade_anos, errors="coerce")


def _filter_by_years(df: pd.DataFrame, years: list[int] | None) -> pd.DataFrame:
    """Filter the DataFrame by SIVEP epidemiological week year."""
    if not years:
        return df
    # Normalize years to int to handle potential string inputs from API
    years_int = [int(y) for y in years if str(y).isdigit()]
    dt_s = pd.to_datetime(df["DT_SIN_PRI"], errors="coerce")
    # Calculate SE Year vectorized: Start of week (Sunday) + 3 days (Wednesday)
    idx = (dt_s.dt.weekday + 1) % 7
    sun = dt_s - pd.to_timedelta(idx, unit="D")
    df_copy = df.copy()
    df_copy["_tmp_year"] = (sun + pd.to_timedelta(3, unit="D")).dt.year
    df_copy = df_copy[df_copy["_tmp_year"].isin(years_int)]
    return df_copy.drop(columns=["_tmp_year"])


def _filter_by_profiles(df: pd.DataFrame, profiles: list[str] | None) -> pd.DataFrame:
    """Filter by age profile (crianca, adolescente, adulto, idoso)."""
    if not profiles:
        return df
    age = _age_years(df)
    masks = []
    if "crianca" in profiles:
        masks.append(age < 12)
    if "adolescente" in profiles:
        masks.append((age >= 12) & (age < 20))
    if "adulto" in profiles:
        masks.append((age >= 20) & (age < 60))
    if "idoso" in profiles:
        masks.append(age >= 60)
    if masks:
        combined_mask = masks[0].fillna(False)
        for m in masks[1:]:
            combined_mask |= m.fillna(False)
        return df[combined_mask]
    return df


def _filter_by_races(df: pd.DataFrame, races: list[str] | None) -> pd.DataFrame:
    """Filter by race codes."""
    if not races:
        return df
    race_map = {"Branca": 1, "Preta": 2, "Amarela": 3, "Parda": 4, "Indígena": 5}
    codes = [race_map.get(r) for r in races if r in race_map]
    if codes:
        return df[df["CS_RACA"].isin(codes)]
    return df


def _filter_by_genders_and_maternal(
    df: pd.DataFrame, genders: list[str] | None, maternal: list[str] | None
) -> tuple[pd.DataFrame, list[str] | None]:
    """Filter by gender, taking maternal into account to avoid female duplication."""
    if not genders:
        return df, maternal

    gender_codes = [g.upper() for g in genders if g.upper() in ["M", "F", "I"]]
    if not gender_codes:
        return df, maternal

    # LOGIC: If 'F' is selected AND 'maternal' sub-filters are active,
    # the maternal filters should define the female subset to avoid duplication.
    if "F" in gender_codes and maternal:
        other_genders = [g for g in gender_codes if g != "F"]
        if other_genders:
            # If M or I are also selected, we need a complex mask
            m_base = pd.to_numeric(df["CS_GESTANT"], errors="coerce")
            is_maternal = pd.Series(False, index=df.index)
            if "gestante" in maternal:
                is_maternal |= m_base.isin([1, 2, 3, 4])
            if "puerpera" in maternal:
                is_maternal |= m_base == 6

            out = df[df["CS_SEXO"].isin(other_genders) | ((df["CS_SEXO"] == "F") & is_maternal)]
            # Mark maternal as handled so the next block doesn't filter again
            return out, None
        else:
            # ONLY F selected with maternal filters, let the maternal block handle it
            return df, maternal
    else:
        return df[df["CS_SEXO"].isin(gender_codes)], maternal


def _filter_by_maternal(df: pd.DataFrame, maternal: list[str] | None) -> pd.DataFrame:
    """Filter by maternal status (gestante/puérpera) for female patients."""
    if not maternal:
        return df
    # CS_GESTANT codes: 1-1o, 2-2o, 3-3o, 4-Idade gestacional ignorada,
    # 5-Não se aplica, 6-Puérpera, 9-Ignorado
    m_masks = []
    m_base = pd.to_numeric(df["CS_GESTANT"], errors="coerce")
    if "gestante" in maternal:
        m_masks.append(m_base.isin([1, 2, 3, 4]))
    if "puerpera" in maternal:
        m_masks.append(m_base == 6)

    if m_masks:
        m_combined = m_masks[0].fillna(False)
        for m in m_masks[1:]:
            m_combined |= m.fillna(False)
        # Apply maternal filter AND ensure they are Female (SIVEP rule)
        return df[(df["CS_SEXO"] == "F") & m_combined]
    return df


def _filter_by_occupations(df: pd.DataFrame, occupations: list[str] | None) -> pd.DataFrame:
    """Filter by patient occupations (CBO)."""
    if not occupations:
        return df
    occ_norm = [str(o).strip().upper() for o in occupations]
    return df[df["PAC_DSCBO"].fillna("").astype(str).str.upper().str.strip().isin(occ_norm)]


def _filter_by_location(
    df: pd.DataFrame,
    zonas: list[str] | None,
    bairros: list[str] | None,
    unidades: list[str] | None,
) -> pd.DataFrame:
    """Filter by geographic attributes: zona, bairro, unidade."""
    out = df
    if zonas:
        zona_norm = [str(z).strip().upper() for z in zonas]
        out = out[out["ZONA"].fillna("").astype(str).str.upper().str.strip().isin(zona_norm)]

    if bairros:
        bairro_norm = [str(b).strip().upper() for b in bairros]
        out = out[
            out["BAIRRO_REF"].fillna("").astype(str).str.upper().str.strip().isin(bairro_norm)
        ]

    if unidades:
        unidade_norm = [str(u).strip().upper() for u in unidades]
        out = out[
            out["ID_UNIDADE"].fillna("").astype(str).str.upper().str.strip().isin(unidade_norm)
        ]

    return out


def apply_global_filters(
    df: pd.DataFrame,
    profiles: list[str] | None = None,
    races: list[str] | None = None,
    genders: list[str] | None = None,
    zonas: list[str] | None = None,
    bairros: list[str] | None = None,
    unidades: list[str] | None = None,
    years: list[int] | None = None,
    maternal: list[str] | None = None,
    occupations: list[str] | None = None,
) -> pd.DataFrame:
    """Apply hierarchy of filters with support for multi-selection."""
    if df.empty:
        return df

    # Normalize inputs
    p_list = [p for p in (profiles or []) if p]
    r_list = [r for r in (races or []) if r]
    g_list = [g for g in (genders or []) if g]
    z_list = [z for z in (zonas or []) if z]
    b_list = [b for b in (bairros or []) if b]
    u_list = [u for u in (unidades or []) if u]
    m_list = [m for m in (maternal or []) if m]
    o_list = [o for o in (occupations or []) if o]

    out = df.copy()
    out = _filter_by_years(out, years)
    out = _filter_by_profiles(out, p_list)
    out = _filter_by_races(out, r_list)
    out, m_list = _filter_by_genders_and_maternal(out, g_list, m_list)
    out = _filter_by_maternal(out, m_list)
    out = _filter_by_occupations(out, o_list)
    out = _filter_by_location(out, z_list, b_list, u_list)

    return out


def outcome_death_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for fatal outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(DEATH_OUTCOMES)


def outcome_valid_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for clinically resolved outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(VALID_OUTCOMES)
