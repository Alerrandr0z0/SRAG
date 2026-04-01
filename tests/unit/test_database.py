import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from srag.data.database import Base, SragRecord, save_cases, generate_case_hash, init_db
from datetime import date

# Use a temporary file for testing instead of :memory: to avoid 
# new engines creating new empty databases.
TEST_DB_FILE = "test_srag_temp.db"
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"

@pytest.fixture
def test_db_setup(monkeypatch):
    # Patch DB_URL in database.py
    import srag.data.database
    monkeypatch.setattr(srag.data.database, "DB_URL", TEST_DB_URL)
    
    # Initialize DB
    init_db()
    
    yield
    
    # Cleanup
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

def test_generate_case_hash():
    record = {
        "DT_NOTIFIC": date(2024, 5, 1),
        "ID_MUNICIP": "2408003",
        "DT_SIN_PRI": date(2024, 4, 25),
        "NU_IDADE_N": 30,
        "CS_SEXO": "M",
        "ID_UNIDADE": "UPA"
    }
    h1 = generate_case_hash(record)
    h2 = generate_case_hash(record)
    assert h1 == h2
    assert len(h1) == 32

def test_save_cases_deduplication(test_db_setup):
    cases = [
        {
            "DT_NOTIFIC": date(2024, 5, 1),
            "ID_MUNICIP": "2408003",
            "ID_MN_RESI": "2408003",
            "DT_SIN_PRI": date(2024, 4, 25),
            "NU_IDADE_N": 30,
            "CS_SEXO": "M",
            "ID_UNIDADE": "UPA",
            "CLASSI_FIN": 5
        }
    ]
    
    # Save once
    added = save_cases(cases)
    assert added == 1
    
    # Save same case again
    added_again = save_cases(cases)
    assert added_again == 0

def test_save_cases_enrichment(test_db_setup):
    base_case = {
        "DT_NOTIFIC": date(2024, 5, 1),
        "ID_MUNICIP": "2408003",
        "ID_MN_RESI": "2408003",
        "DT_SIN_PRI": date(2024, 4, 25),
        "NU_IDADE_N": 30,
        "CS_SEXO": "M",
        "ID_UNIDADE": "UPA",
        "CLASSI_FIN": None,
        "TP_IDADE": None
    }
    
    save_cases([base_case])
    
    enriched_case = base_case.copy()
    enriched_case["TP_IDADE"] = 3
    
    added = save_cases([enriched_case])
    assert added == 0
    
    # Verify in DB
    engine = create_engine(TEST_DB_URL)
    session_factory = sessionmaker(bind=engine)
    with session_factory() as session:
        record = session.query(SragRecord).first()
        assert record.TP_IDADE == 3
