import pytest

from srag.data.loader import (
    _infer_zone_from_bairro,
    _normalize_age_to_years,
    _normalize_bairro_name,
    _normalize_zone,
)


def test_normalize_bairro_name() -> None:
    assert _normalize_bairro_name("CENTRO") == "CENTRO"
    assert _normalize_bairro_name(" centro ") == "CENTRO"
    assert _normalize_bairro_name("SANTO ANTÔNIO") == "SANTO ANTONIO"
    assert _normalize_bairro_name(None) is None
    assert _normalize_bairro_name("NAN") is None
    assert _normalize_bairro_name("IGNORADO") is None
    assert _normalize_bairro_name("SEM INFORMACAO") is None
    assert _normalize_bairro_name("  ") is None


def test_infer_zone_from_bairro() -> None:
    assert _infer_zone_from_bairro("CENTRO") == "Urbana"
    assert _infer_zone_from_bairro("ZONA RURAL") == "Rural"
    assert _infer_zone_from_bairro("SITIO SAO JOAO") == "Rural"
    assert _infer_zone_from_bairro("FAZENDA FELIZ") == "Rural"
    assert _infer_zone_from_bairro(None) is None


def test_normalize_zone() -> None:
    assert _normalize_zone(1) == "Urbana"
    assert _normalize_zone(2) == "Rural"
    assert _normalize_zone(3) == "Periurbana"
    assert _normalize_zone(9) is None
    assert _normalize_zone(None) is None


def test_normalize_age_to_years() -> None:
    # tp_idade: 1=days, 2=months, 3=years
    assert _normalize_age_to_years(365, 1) == pytest.approx(0.9993, rel=1e-3)
    assert _normalize_age_to_years(6, 2) == 0.5
    assert _normalize_age_to_years(25, 3) == 25.0
    assert _normalize_age_to_years(25, None) == 25.0
    assert _normalize_age_to_years(None, 3) is None
    assert _normalize_age_to_years(-1, 3) is None
