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

    out = df.copy()

    if years:
        # Normalize years to int to handle potential string inputs from API
        years_int = [int(y) for y in years if str(y).isdigit()]
        out["_tmp_year"] = pd.to_datetime(out["DT_SIN_PRI"], errors="coerce").dt.year
        out = out[out["_tmp_year"].isin(years_int)]
        out = out.drop(columns=["_tmp_year"])

    profiles = [p for p in (profiles or []) if p]
    races = [r for r in (races or []) if r]
    genders = [g for g in (genders or []) if g]
    zonas = [z for z in (zonas or []) if z]
    bairros = [b for b in (bairros or []) if b]
    unidades = [u for u in (unidades or []) if u]
    maternal = [m for m in (maternal or []) if m]
    occupations = [o for o in (occupations or []) if o]

    if profiles:
        age = _age_years(out)
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
            out = out[combined_mask]

    if races:
        race_map = {"Branca": 1, "Preta": 2, "Amarela": 3, "Parda": 4, "Indígena": 5}
        codes = [race_map.get(r) for r in races if r in race_map]
        if codes:
            out = out[out["CS_RACA"].isin(codes)]

    if genders:
        gender_codes = [g.upper() for g in genders if g.upper() in ["M", "F", "I"]]

        # LOGIC: If 'F' is selected AND 'maternal' sub-filters are active,
        # the maternal filters should define the female subset to avoid duplication.
        if "F" in gender_codes and maternal:
            # We don't apply the 'F' filter here, because the 'maternal' block below
            # will handle the specific female subset. We only apply 'M' or 'I' if present.
            other_genders = [g for g in gender_codes if g != "F"]
            if other_genders:
                # If M or I are also selected, we need a complex mask
                m_base = pd.to_numeric(out["CS_GESTANT"], errors="coerce")
                is_maternal = False
                if "gestante" in maternal:
                    is_maternal |= m_base.isin([1, 2, 3, 4])
                if "puerpera" in maternal:
                    is_maternal |= m_base == 6

                out = out[
                    out["CS_SEXO"].isin(other_genders) | ((out["CS_SEXO"] == "F") & is_maternal)
                ]
                # Mark maternal as handled so the next block doesn't filter again
                maternal = None
            else:
                # ONLY F selected with maternal filters, let the maternal block handle it
                pass
        elif gender_codes:
            out = out[out["CS_SEXO"].isin(gender_codes)]

    if maternal:
        # CS_GESTANT codes: 1-1o, 2-2o, 3-3o, 4-Idade gestacional ignorada,
        # 5-Não se aplica, 6-Puérpera, 9-Ignorado
        m_masks = []
        m_base = pd.to_numeric(out["CS_GESTANT"], errors="coerce")
        if "gestante" in maternal:
            m_masks.append(m_base.isin([1, 2, 3, 4]))
        if "puerpera" in maternal:
            m_masks.append(m_base == 6)

        if m_masks:
            m_combined = m_masks[0].fillna(False)
            for m in m_masks[1:]:
                m_combined |= m.fillna(False)
            # Apply maternal filter AND ensure they are Female (SIVEP rule)
            out = out[(out["CS_SEXO"] == "F") & m_combined]

    if occupations:
        occ_norm = [str(o).strip().upper() for o in occupations]
        out = out[out["PAC_DSCBO"].fillna("").astype(str).str.upper().str.strip().isin(occ_norm)]

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


def outcome_death_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for fatal outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(DEATH_OUTCOMES)


def outcome_valid_mask(values: pd.Series) -> pd.Series:
    """Return a boolean mask for clinically resolved outcomes."""
    return pd.to_numeric(values, errors="coerce").isin(VALID_OUTCOMES)
