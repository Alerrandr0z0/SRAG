"""Utilities for epidemiological week (SE) calculations."""

from datetime import date, timedelta


def get_epi_week(dt: date) -> tuple[int, int]:
    """Calculate the epidemiological week (SE) and year for a given date.
    
    In Brazil, SE follows the international standard (Sunday to Saturday), 
    but with specific rules for the first week of the year (SE 1 must have 
    at least 4 days of the new year).
    
    Args:
        dt: The date to calculate for.
        
    Returns:
        A tuple (year, week_number).
    """
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
    first_day_of_year = date(year, 1, 1)
    # First SE of year 'year' starts on the Sunday of the week containing Jan 4th
    jan4 = date(year, 1, 4)
    first_sun = jan4 - timedelta(days=(jan4.weekday() + 1) % 7)
    
    week_num = int((sun - first_sun).days / 7) + 1
    
    # Handle edge case: if week_num is 0, it belongs to the last week of previous year
    if week_num == 0:
        return get_epi_week(dt - timedelta(days=dt.day + 1))
        
    return year, week_num


def format_epi_week(year: int, week: int) -> str:
    """Format SE as YYYY-WW string."""
    return f"{year}-{week:02d}"
