import sqlite3

from srag.data.cnes_lookup import build_mossoro_cnes_geo, build_unit_record, lookup_unit_name


def test_lookup_unit_name_uses_cnes_name_mapping(tmp_path, monkeypatch) -> None:
    mapping = tmp_path / "cnes_units.json"
    mapping.write_text('{"123": "UBS TESTE"}', encoding="utf-8")
    geo_mapping = tmp_path / "cnes_units_geo.json"
    monkeypatch.setattr("srag.data.cnes_lookup._CNES_JSON_PATH", mapping)
    monkeypatch.setattr("srag.data.cnes_lookup._CNES_GEO_PATH", geo_mapping)
    monkeypatch.setattr("srag.data.cnes_lookup._unit_records", None)
    monkeypatch.setattr("srag.data.cnes_lookup._load_error", None)

    assert lookup_unit_name("123") == "UBS TESTE"


def test_build_unit_record_keeps_address_and_coordinates() -> None:
    raw = {
        "codigo_cnes": 2408001,
        "nome_fantasia": "UPA RURAL",
        "nome_razao_social": "UPA RURAL LTDA",
        "endereco_estabelecimento": "RUA PRINCIPAL",
        "numero_estabelecimento": "100",
        "bairro_estabelecimento": "ZONA RURAL",
        "latitude_estabelecimento_decimo_grau": -5.123,
        "longitude_estabelecimento_decimo_grau": -37.456,
    }

    record = build_unit_record(raw)

    assert record["codigo_cnes"] == "2408001"
    assert record["nome_fantasia"] == "UPA RURAL"
    assert record["endereco"] == "RUA PRINCIPAL, 100 - ZONA RURAL"
    assert record["latitude"] == -5.123
    assert record["longitude"] == -37.456


def test_build_mossoro_cnes_geo_uses_database_unit_codes(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "srag.sqlite"
    con = sqlite3.connect(db_path)
    con.execute("CREATE TABLE casos_srag (ID_UNIDADE TEXT)")
    con.executemany(
        "INSERT INTO casos_srag (ID_UNIDADE) VALUES (?)",
        [("111",), ("222",), ("222",), ("333",)],
    )
    con.commit()
    con.close()

    records = {
        "111": {
            "codigo_cnes": "111",
            "nome_fantasia": "UBS A",
            "nome_razao_social": "UBS A LTDA",
            "endereco": "A, 1 - CENTRO",
            "latitude": None,
            "longitude": None,
        },
        "222": {
            "codigo_cnes": "222",
            "nome_fantasia": "UBS B",
            "nome_razao_social": "UBS B LTDA",
            "endereco": "B, 2 - CENTRO",
            "latitude": -5.2,
            "longitude": -37.2,
        },
    }

    monkeypatch.setattr(
        "srag.data.cnes_lookup.fetch_unit_record_from_api", lambda code: records.get(code)
    )
    monkeypatch.setattr(
        "srag.data.cnes_lookup.geocode_unit_address",
        lambda code, address: (
            {"codigo_cnes": code, "endereco": address, "latitude": -5.1, "longitude": -37.1}
            if code == "111"
            else None
        ),
    )

    monkeypatch.setattr("srag.data.cnes_lookup._save_geo_mapping", lambda _m: None)

    result = build_mossoro_cnes_geo(db_path=db_path, refresh=True)

    assert set(result) == {"111", "222"}
    assert result["111"]["latitude"] == -5.1
    assert result["111"]["longitude"] == -37.1
