"""API dependency injections for SRAG Mossoró."""

from fastapi import Query
from pydantic import BaseModel


class CommonFilters(BaseModel):
    """Common filter parameters for SRAG data analysis."""

    profile: list[str] | None = None
    race: list[str] | None = None
    gender: list[str] | None = None
    zonas: list[str] | None = None
    bairros: list[str] | None = None
    unidades: list[str] | None = None
    years: list[int] | None = None
    agents: list[str] | None = None
    maternal: list[str] | None = None
    occupations: list[str] | None = None


def get_common_filters(
    profile: list[str] | None = Query(None),  # noqa: B008
    race: list[str] | None = Query(None),  # noqa: B008
    gender: list[str] | None = Query(None),  # noqa: B008
    zonas: list[str] | None = Query(None),  # noqa: B008
    bairros: list[str] | None = Query(None),  # noqa: B008
    unidades: list[str] | None = Query(None),  # noqa: B008
    years: list[int] | None = Query(None),  # noqa: B008
    agents: list[str] | None = Query(None),  # noqa: B008
    maternal: list[str] | None = Query(None),  # noqa: B008
    occupations: list[str] | None = Query(None),  # noqa: B008
) -> CommonFilters:
    """Dependency provider for common filters across endpoints."""
    return CommonFilters(
        profile=profile,
        race=race,
        gender=gender,
        zonas=zonas,
        bairros=bairros,
        unidades=unidades,
        years=years,
        agents=agents,
        maternal=maternal,
        occupations=occupations,
    )
