from datetime import date

from srag.utils.epi_weeks import format_epi_week, get_epi_week


def test_get_epi_week_standard():
    # April 10, 2024 (Wednesday) -> SE 15 of 2024
    assert get_epi_week(date(2024, 4, 10)) == (2024, 15)


def test_get_epi_week_sunday():
    # April 7, 2024 (Sunday) -> Start of SE 15
    assert get_epi_week(date(2024, 4, 7)) == (2024, 15)


def test_get_epi_week_saturday():
    # April 13, 2024 (Saturday) -> End of SE 15
    assert get_epi_week(date(2024, 4, 13)) == (2024, 15)


def test_get_epi_week_year_transition():
    # Jan 1, 2024 (Monday) -> Should belong to SE 1 of 2024
    # since Jan 4 is in the same week.
    assert get_epi_week(date(2024, 1, 1)) == (2024, 1)


def test_format_epi_week():
    assert format_epi_week(2024, 5) == "2024-05"
    assert format_epi_week(2024, 15) == "2024-15"
