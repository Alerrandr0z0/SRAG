"""Utilities for epidemiological week (SE) calculations."""

from datetime import date, timedelta

import pandas as pd


def get_epi_week(dt: object) -> tuple[int, int]:
    """Calculate the epidemiological week (SE) and year for a given date.

    In Brazil, SE follows the international standard (Sunday to Saturday),
    but with specific rules for the first week of the year (SE 1 must have
    at least 4 days of the new year).

    Compatible with Python date/datetime and Pandas Timestamps.

    Args:
        dt: The date to calculate for.

    Returns:
        A tuple (year, week_number).
    """
    if dt is None:
        return 0, 0
    try:
        if pd.isna(dt):  # type: ignore
            return 0, 0
    except TypeError, ValueError:
        return 0, 0

    # Ensure we have a datetime.date object
    try:
        date_attr = getattr(dt, "date", None)
        if date_attr and callable(date_attr):
            dt = date_attr()
        elif isinstance(dt, str):
            dt_converted = pd.to_datetime(dt)
            dt = getattr(dt_converted, "date", lambda: None)()
    except TypeError, ValueError, AttributeError, Exception:
        return 0, 0

    if dt is None or pd.isna(dt):  # type: ignore
        return 0, 0

    if not isinstance(dt, date):
        return 0, 0

    # The first SE of the year is the one that contains the first Wednesday
    # of the year (or the one with at least 4 days in January).
    # This is equivalent to the ISO week standard but starting on Sunday.

    # Adjust date to the previous Sunday (start of the week)
    idx = (dt.weekday() + 1) % 7  # Sunday=0, Monday=1, ..., Saturday=6
    sun = dt - timedelta(days=idx)

    # Use the Wednesday of that week to determine the year of the SE
    wed = sun + timedelta(days=3)
    year = wed.year

    # Find the first Sunday of the year's first SE
    # First SE of year 'year' starts on the Sunday of the week containing Jan 4th
    jan4 = date(year, 1, 4)
    first_sun = jan4 - timedelta(days=(jan4.weekday() + 1) % 7)

    week_num = int((sun - first_sun).days / 7) + 1

    # Handle edge case: if week_num is 0, it belongs to the last week of previous year
    if week_num <= 0:
        # Belong to the last week of the previous year
        return get_epi_week(sun - timedelta(days=1))

    return year, week_num


def format_epi_week(year: int, week: int) -> str:
    """Format SE as YYYY-WW string."""
    if year == 0:
        return "N/A"
    return f"{year}-{week:02d}"


def get_date_from_epi_week(year: int, week: int) -> date:
    """Return the start date (Sunday) of a given epidemiological week.

    Inverse of `get_epi_week`.
    """
    if year == 0:
        return date(1900, 1, 1)
    # The first SE of the year is the week containing Jan 4th
    jan4 = date(year, 1, 4)
    first_sun = jan4 - timedelta(days=(jan4.weekday() + 1) % 7)

    return first_sun + timedelta(weeks=week - 1)
