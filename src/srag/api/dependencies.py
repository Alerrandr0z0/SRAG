"""API dependency injections for SRAG Mossoró."""

from typing import Annotated

from fastapi import Depends, HTTPException, Query
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
    months: list[int] | None = None
    days: list[int] | None = None
    agents: list[str] | None = None
    maternal: list[str] | None = None
    occupations: list[str] | None = None


def _validate_years(years: list[int] | None) -> None:
    if years is None:
        return
    for y in years:
        if not (1900 <= y <= 2030):
            raise HTTPException(status_code=422, detail=f"Year {y} out of range [1900, 2030]")


def _validate_months(months: list[int] | None) -> None:
    if months is None:
        return
    for m in months:
        if not (1 <= m <= 12):
            raise HTTPException(status_code=422, detail=f"Month {m} out of range [1, 12]")


def _validate_days(days: list[int] | None) -> None:
    if days is None:
        return
    for d in days:
        if not (1 <= d <= 31):
            raise HTTPException(status_code=422, detail=f"Day {d} out of range [1, 31]")


def _validate_string_lists(v: list[str] | None) -> None:
    if v is None:
        return
    for item in v:
        if len(item) > 100:
            raise HTTPException(status_code=422, detail=f"Filter value too long: {item[:50]}...")


def get_common_filters(
    profile: Annotated[list[str] | None, Query()] = None,
    race: Annotated[list[str] | None, Query()] = None,
    gender: Annotated[list[str] | None, Query()] = None,
    zonas: Annotated[list[str] | None, Query()] = None,
    bairros: Annotated[list[str] | None, Query()] = None,
    unidades: Annotated[list[str] | None, Query()] = None,
    years: Annotated[list[int] | None, Query()] = None,
    months: Annotated[list[int] | None, Query()] = None,
    days: Annotated[list[int] | None, Query()] = None,
    agents: Annotated[list[str] | None, Query()] = None,
    maternal: Annotated[list[str] | None, Query()] = None,
    occupations: Annotated[list[str] | None, Query()] = None,
) -> CommonFilters:
    """Dependency provider for common filters across endpoints."""
    _validate_years(years)
    _validate_months(months)
    _validate_days(days)
    _validate_string_lists(profile)
    _validate_string_lists(race)
    _validate_string_lists(gender)
    _validate_string_lists(zonas)
    _validate_string_lists(bairros)
    _validate_string_lists(unidades)
    _validate_string_lists(agents)
    _validate_string_lists(maternal)
    _validate_string_lists(occupations)
    return CommonFilters(
        profile=profile,
        race=race,
        gender=gender,
        zonas=zonas,
        bairros=bairros,
        unidades=unidades,
        years=years,
        months=months,
        days=days,
        agents=agents,
        maternal=maternal,
        occupations=occupations,
    )


CommonFiltersDep = Annotated[CommonFilters, Depends(get_common_filters)]
