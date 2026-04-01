"""Database management for SRAG Mossoró historical data."""

import hashlib
from typing import Any

from sqlalchemy import Column, Date, Float, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Database path (local SQLite file)
DB_URL = "sqlite:///data/processed/srag_mossoro.db"


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""

    pass


class SragRecord(Base):
    """SQLAlchemy model for an anonymized SRAG case."""

    __tablename__ = "casos_srag"

    # unique_hash: MD5 of (DT_NOTIFIC, ID_MUNICIP, DT_SIN_PRI, NU_IDADE_N, CS_SEXO)
    # to prevent duplication in re-uploads.
    unique_hash = Column(String(32), primary_key=True)

    DT_NOTIFIC = Column(Date, nullable=False)
    ID_MUNICIP = Column(String(10), nullable=False)
    ID_MN_RESI = Column(String(10), nullable=False)
    DT_SIN_PRI = Column(Date, nullable=False)
    ID_UNIDADE = Column(String(30))
    BAIRRO_REF = Column(String(80))
    NM_BAIRRO = Column(String(120))
    ZONA = Column(String(20))
    CS_ZONA = Column(Integer)
    NU_IDADE_N = Column(Integer)
    TP_IDADE = Column(Integer)
    IDADE_ANOS = Column(Float)
    CS_SEXO = Column(String(1))
    CS_RACA = Column(Integer)
    CS_ESCOL_N = Column(Integer)
    CLASSI_FIN = Column(Integer)
    PCR_VSR = Column(Integer)
    AN_VSR = Column(Integer)
    PCR_SARS2 = Column(Integer)
    AN_SARS2 = Column(Integer)
    TP_FLU_PCR = Column(Integer)
    TP_FLU_AN = Column(Integer)
    PCR_RESUL = Column(Integer)
    RES_AN = Column(Integer)
    DT_PCR = Column(Date)
    DT_RES_AN = Column(Date)
    DT_COLETA = Column(Date)
    LAB_AN = Column(String(120))
    CO_LAB_AN = Column(String(20))
    POS_PCRFLU = Column(Integer)
    PCR_FLUASU = Column(Integer)
    PCR_FLUBLI = Column(Integer)
    PCR_RINO = Column(Integer)
    PCR_METAP = Column(Integer)
    PCR_ADENO = Column(Integer)
    PCR_PARA1 = Column(Integer)
    PCR_PARA2 = Column(Integer)
    PCR_PARA3 = Column(Integer)
    PCR_PARA4 = Column(Integer)
    POS_AN_OUT = Column(Integer)
    AN_ADENO = Column(Integer)
    AN_PARA1 = Column(Integer)
    AN_PARA2 = Column(Integer)
    AN_PARA3 = Column(Integer)
    DT_INTERNA = Column(Date)
    DT_ENTUTI = Column(Date)
    DT_SAIDUTI = Column(Date)
    EVOLUCAO = Column(Integer)
    DT_EVOLUCA = Column(Date)
    UTI = Column(Integer)
    HOSPITAL = Column(Integer)
    SUPORT_VEN = Column(Integer)
    RAIOX_RES = Column(Integer)
    TOMO_RES = Column(Integer)
    ASMA = Column(Integer)
    HEMATOLOGI = Column(Integer)
    SIND_DOWN = Column(Integer)
    HEPATICA = Column(Integer)
    NEUROLOGIC = Column(Integer)
    PNEUMOPATI = Column(Integer)
    IMUNODEPRE = Column(Integer)
    RENAL = Column(Integer)
    DIABETES = Column(Integer)
    OBESIDADE = Column(Integer)
    TABAG = Column(Integer)
    OUT_MORBI = Column(Integer)
    CARDIOPATI = Column(Integer)
    FEBRE = Column(Integer)
    TOSSE = Column(Integer)
    GARGANTA = Column(Integer)
    DISPNEIA = Column(Integer)
    DESC_RESP = Column(Integer)
    SATURACAO = Column(Integer)
    DIARREIA = Column(Integer)
    VOMITO = Column(Integer)
    DOR_ABD = Column(Integer)
    FADIGA = Column(Integer)
    PERD_OLFT = Column(Integer)
    PERD_PALA = Column(Integer)
    OUTRO_SIN = Column(Integer)
    NOSOCOMIAL = Column(Integer)
    CS_GESTANT = Column(Integer)
    PUERPERA = Column(Integer)
    VACINA_COV = Column(Integer)
    DOSE_1_COV = Column(Date)
    DOSE_2_COV = Column(Date)
    DOSE_REF = Column(Date)
    DOSE_2REF = Column(Date)
    DOSE_ADIC = Column(Date)
    DOS_RE_BI = Column(Date)
    VACINA = Column(Integer)
    DT_UT_DOSE = Column(Date)
    MAE_VAC = Column(Integer)
    DT_VAC_MAE = Column(Date)
    DT_DOSEUNI = Column(Date)
    DT_1_DOSE = Column(Date)
    DT_2_DOSE = Column(Date)
    ANTIVIRAL = Column(Integer)
    TRAT_COV = Column(Integer)


def generate_case_hash(record: dict[str, Any]) -> str:
    """Generate a unique hash for a case to prevent duplicates."""
    # Key fields that identify a case (even after anonymization)
    key_fields = [
        str(record.get("DT_NOTIFIC")),
        str(record.get("ID_MUNICIP")),
        str(record.get("DT_SIN_PRI")),
        str(record.get("NU_IDADE_N")),
        str(record.get("CS_SEXO")),
        str(record.get("ID_UNIDADE")),
    ]
    hash_input = "|".join(key_fields).encode("utf-8")
    return hashlib.md5(hash_input).hexdigest()


def init_db() -> None:
    """Initialize the SQLite database and create tables."""
    engine = create_engine(DB_URL)
    Base.metadata.create_all(engine)

    # Lightweight migration for existing local databases
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(casos_srag)")).fetchall()
        col_names = {col[1] for col in cols}
        if "IDADE_ANOS" not in col_names and "idade_anos" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN IDADE_ANOS FLOAT"))
        if "IDADE_ANOS" not in col_names and "idade_anos" in col_names:
             conn.execute(text("ALTER TABLE casos_srag RENAME COLUMN idade_anos TO IDADE_ANOS"))
        if "ID_UNIDADE" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN ID_UNIDADE VARCHAR(30)"))
        if "BAIRRO_REF" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN BAIRRO_REF VARCHAR(80)"))
        if "NM_BAIRRO" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN NM_BAIRRO VARCHAR(120)"))
        if "ZONA" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN ZONA VARCHAR(20)"))
        if "CS_ZONA" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN CS_ZONA INTEGER"))
        if "TP_IDADE" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN TP_IDADE INTEGER"))
        if "CS_RACA" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN CS_RACA INTEGER"))
        if "CS_ESCOL_N" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN CS_ESCOL_N INTEGER"))
        if "MAE_VAC" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN MAE_VAC INTEGER"))
        if "DT_VAC_MAE" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN DT_VAC_MAE DATE"))
        if "DT_DOSEUNI" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN DT_DOSEUNI DATE"))
        if "DT_1_DOSE" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN DT_1_DOSE DATE"))
        if "DT_2_DOSE" not in col_names:
            conn.execute(text("ALTER TABLE casos_srag ADD COLUMN DT_2_DOSE DATE"))


def save_cases(cases: list[dict[str, Any]]) -> int:
    """Save a list of cases to the database, skipping duplicates.

    Returns:
        The number of NEW cases added.
    """
    engine = create_engine(DB_URL)
    session_factory = sessionmaker(bind=engine)

    new_count = 0
    with session_factory() as session:
        for case_dict in cases:
            case_hash = generate_case_hash(case_dict)

            # Check if exists
            exists = session.query(SragRecord).filter_by(unique_hash=case_hash).first()
            if not exists:
                record = SragRecord(
                    unique_hash=case_hash,
                    DT_NOTIFIC=case_dict.get("DT_NOTIFIC"),
                    ID_MUNICIP=case_dict.get("ID_MUNICIP"),
                    ID_MN_RESI=case_dict.get("ID_MN_RESI"),
                    DT_SIN_PRI=case_dict.get("DT_SIN_PRI"),
                    ID_UNIDADE=case_dict.get("ID_UNIDADE"),
                    BAIRRO_REF=case_dict.get("BAIRRO_REF"),
                    NM_BAIRRO=case_dict.get("NM_BAIRRO"),
                    ZONA=case_dict.get("ZONA"),
                    CS_ZONA=case_dict.get("CS_ZONA"),
                    NU_IDADE_N=case_dict.get("NU_IDADE_N"),
                    TP_IDADE=case_dict.get("TP_IDADE"),
                    IDADE_ANOS=case_dict.get("IDADE_ANOS"),
                    CS_SEXO=case_dict.get("CS_SEXO"),
                    CS_RACA=case_dict.get("CS_RACA"),
                    CS_ESCOL_N=case_dict.get("CS_ESCOL_N"),
                    CLASSI_FIN=case_dict.get("CLASSI_FIN"),
                    PCR_VSR=case_dict.get("PCR_VSR"),
                    AN_VSR=case_dict.get("AN_VSR"),
                    PCR_SARS2=case_dict.get("PCR_SARS2"),
                    AN_SARS2=case_dict.get("AN_SARS2"),
                    TP_FLU_PCR=case_dict.get("TP_FLU_PCR"),
                    TP_FLU_AN=case_dict.get("TP_FLU_AN"),
                    PCR_RESUL=case_dict.get("PCR_RESUL"),
                    RES_AN=case_dict.get("RES_AN"),
                    DT_PCR=case_dict.get("DT_PCR"),
                    DT_RES_AN=case_dict.get("DT_RES_AN"),
                    DT_COLETA=case_dict.get("DT_COLETA"),
                    LAB_AN=case_dict.get("LAB_AN"),
                    CO_LAB_AN=case_dict.get("CO_LAB_AN"),
                    POS_PCRFLU=case_dict.get("POS_PCRFLU"),
                    PCR_FLUASU=case_dict.get("PCR_FLUASU"),
                    PCR_FLUBLI=case_dict.get("PCR_FLUBLI"),
                    PCR_RINO=case_dict.get("PCR_RINO"),
                    PCR_METAP=case_dict.get("PCR_METAP"),
                    PCR_ADENO=case_dict.get("PCR_ADENO"),
                    PCR_PARA1=case_dict.get("PCR_PARA1"),
                    PCR_PARA2=case_dict.get("PCR_PARA2"),
                    PCR_PARA3=case_dict.get("PCR_PARA3"),
                    PCR_PARA4=case_dict.get("PCR_PARA4"),
                    POS_AN_OUT=case_dict.get("POS_AN_OUT"),
                    AN_ADENO=case_dict.get("AN_ADENO"),
                    AN_PARA1=case_dict.get("AN_PARA1"),
                    AN_PARA2=case_dict.get("AN_PARA2"),
                    AN_PARA3=case_dict.get("AN_PARA3"),
                    DT_INTERNA=case_dict.get("DT_INTERNA"),
                    DT_ENTUTI=case_dict.get("DT_ENTUTI"),
                    DT_SAIDUTI=case_dict.get("DT_SAIDUTI"),
                    EVOLUCAO=case_dict.get("EVOLUCAO"),
                    DT_EVOLUCA=case_dict.get("DT_EVOLUCA"),
                    UTI=case_dict.get("UTI"),
                    HOSPITAL=case_dict.get("HOSPITAL"),
                    SUPORT_VEN=case_dict.get("SUPORT_VEN"),
                    RAIOX_RES=case_dict.get("RAIOX_RES"),
                    TOMO_RES=case_dict.get("TOMO_RES"),
                    ASMA=case_dict.get("ASMA"),
                    HEMATOLOGI=case_dict.get("HEMATOLOGI"),
                    SIND_DOWN=case_dict.get("SIND_DOWN"),
                    HEPATICA=case_dict.get("HEPATICA"),
                    NEUROLOGIC=case_dict.get("NEUROLOGIC"),
                    PNEUMOPATI=case_dict.get("PNEUMOPATI"),
                    IMUNODEPRE=case_dict.get("IMUNODEPRE"),
                    RENAL=case_dict.get("RENAL"),
                    DIABETES=case_dict.get("DIABETES"),
                    OBESIDADE=case_dict.get("OBESIDADE"),
                    TABAG=case_dict.get("TABAG"),
                    OUT_MORBI=case_dict.get("OUT_MORBI"),
                    CARDIOPATI=case_dict.get("CARDIOPATI"),
                    FEBRE=case_dict.get("FEBRE"),
                    TOSSE=case_dict.get("TOSSE"),
                    GARGANTA=case_dict.get("GARGANTA"),
                    DISPNEIA=case_dict.get("DISPNEIA"),
                    DESC_RESP=case_dict.get("DESC_RESP"),
                    SATURACAO=case_dict.get("SATURACAO"),
                    DIARREIA=case_dict.get("DIARREIA"),
                    VOMITO=case_dict.get("VOMITO"),
                    DOR_ABD=case_dict.get("DOR_ABD"),
                    FADIGA=case_dict.get("FADIGA"),
                    PERD_OLFT=case_dict.get("PERD_OLFT"),
                    PERD_PALA=case_dict.get("PERD_PALA"),
                    OUTRO_SIN=case_dict.get("OUTRO_SIN"),
                    NOSOCOMIAL=case_dict.get("NOSOCOMIAL"),
                    CS_GESTANT=case_dict.get("CS_GESTANT"),
                    PUERPERA=case_dict.get("PUERPERA"),
                    VACINA_COV=case_dict.get("VACINA_COV"),
                    DOSE_1_COV=case_dict.get("DOSE_1_COV"),
                    DOSE_2_COV=case_dict.get("DOSE_2_COV"),
                    DOSE_REF=case_dict.get("DOSE_REF"),
                    DOSE_2REF=case_dict.get("DOSE_2REF"),
                    DOSE_ADIC=case_dict.get("DOSE_ADIC"),
                    DOS_RE_BI=case_dict.get("DOS_RE_BI"),
                    VACINA=case_dict.get("VACINA"),
                    DT_UT_DOSE=case_dict.get("DT_UT_DOSE"),
                    MAE_VAC=case_dict.get("MAE_VAC"),
                    DT_VAC_MAE=case_dict.get("DT_VAC_MAE"),
                    DT_DOSEUNI=case_dict.get("DT_DOSEUNI"),
                    DT_1_DOSE=case_dict.get("DT_1_DOSE"),
                    DT_2_DOSE=case_dict.get("DT_2_DOSE"),
                    ANTIVIRAL=case_dict.get("ANTIVIRAL"),
                    TRAT_COV=case_dict.get("TRAT_COV"),
                )
                session.add(record)
                new_count += 1
            else:
                # Lightweight enrichment for already-seen cases.
                if exists.TP_IDADE is None and case_dict.get("TP_IDADE") is not None:
                    exists.TP_IDADE = case_dict.get("TP_IDADE")
                if exists.MAE_VAC is None and case_dict.get("MAE_VAC") is not None:
                    exists.MAE_VAC = case_dict.get("MAE_VAC")
                if exists.DT_VAC_MAE is None and case_dict.get("DT_VAC_MAE") is not None:
                    exists.DT_VAC_MAE = case_dict.get("DT_VAC_MAE")
                if exists.DT_DOSEUNI is None and case_dict.get("DT_DOSEUNI") is not None:
                    exists.DT_DOSEUNI = case_dict.get("DT_DOSEUNI")
                if exists.DT_1_DOSE is None and case_dict.get("DT_1_DOSE") is not None:
                    exists.DT_1_DOSE = case_dict.get("DT_1_DOSE")
                if exists.DT_2_DOSE is None and case_dict.get("DT_2_DOSE") is not None:
                    exists.DT_2_DOSE = case_dict.get("DT_2_DOSE")
                if exists.PCR_VSR is None and case_dict.get("PCR_VSR") is not None:
                    exists.PCR_VSR = case_dict.get("PCR_VSR")
                if exists.AN_VSR is None and case_dict.get("AN_VSR") is not None:
                    exists.AN_VSR = case_dict.get("AN_VSR")
                if exists.PCR_SARS2 is None and case_dict.get("PCR_SARS2") is not None:
                    exists.PCR_SARS2 = case_dict.get("PCR_SARS2")
                if exists.AN_SARS2 is None and case_dict.get("AN_SARS2") is not None:
                    exists.AN_SARS2 = case_dict.get("AN_SARS2")
                if exists.TP_FLU_PCR is None and case_dict.get("TP_FLU_PCR") is not None:
                    exists.TP_FLU_PCR = case_dict.get("TP_FLU_PCR")
                if exists.TP_FLU_AN is None and case_dict.get("TP_FLU_AN") is not None:
                    exists.TP_FLU_AN = case_dict.get("TP_FLU_AN")
                if exists.PCR_RESUL is None and case_dict.get("PCR_RESUL") is not None:
                    exists.PCR_RESUL = case_dict.get("PCR_RESUL")
                if exists.RES_AN is None and case_dict.get("RES_AN") is not None:
                    exists.RES_AN = case_dict.get("RES_AN")
                if exists.DT_PCR is None and case_dict.get("DT_PCR") is not None:
                    exists.DT_PCR = case_dict.get("DT_PCR")
                if exists.DT_RES_AN is None and case_dict.get("DT_RES_AN") is not None:
                    exists.DT_RES_AN = case_dict.get("DT_RES_AN")
                if exists.DT_COLETA is None and case_dict.get("DT_COLETA") is not None:
                    exists.DT_COLETA = case_dict.get("DT_COLETA")
                if exists.LAB_AN is None and case_dict.get("LAB_AN") is not None:
                    exists.LAB_AN = case_dict.get("LAB_AN")
                if exists.CO_LAB_AN is None and case_dict.get("CO_LAB_AN") is not None:
                    exists.CO_LAB_AN = case_dict.get("CO_LAB_AN")
                if exists.ID_UNIDADE is None and case_dict.get("ID_UNIDADE") is not None:
                    exists.ID_UNIDADE = case_dict.get("ID_UNIDADE")
                if exists.BAIRRO_REF is None and case_dict.get("BAIRRO_REF") is not None:
                    exists.BAIRRO_REF = case_dict.get("BAIRRO_REF")
                if exists.NM_BAIRRO is None and case_dict.get("NM_BAIRRO") is not None:
                    exists.NM_BAIRRO = case_dict.get("NM_BAIRRO")
                if exists.ZONA is None and case_dict.get("ZONA") is not None:
                    exists.ZONA = case_dict.get("ZONA")
                if exists.CS_ZONA is None and case_dict.get("CS_ZONA") is not None:
                    exists.CS_ZONA = case_dict.get("CS_ZONA")
                if exists.CS_RACA is None and case_dict.get("CS_RACA") is not None:
                    exists.CS_RACA = case_dict.get("CS_RACA")
                if exists.CS_ESCOL_N is None and case_dict.get("CS_ESCOL_N") is not None:
                    exists.CS_ESCOL_N = case_dict.get("CS_ESCOL_N")
                if exists.NOSOCOMIAL is None and case_dict.get("NOSOCOMIAL") is not None:
                    exists.NOSOCOMIAL = case_dict.get("NOSOCOMIAL")
                if exists.DOS_RE_BI is None and case_dict.get("DOS_RE_BI") is not None:
                    exists.DOS_RE_BI = case_dict.get("DOS_RE_BI")
                if exists.DOSE_1_COV is None and case_dict.get("DOSE_1_COV") is not None:
                    exists.DOSE_1_COV = case_dict.get("DOSE_1_COV")
                if exists.DOSE_2_COV is None and case_dict.get("DOSE_2_COV") is not None:
                    exists.DOSE_2_COV = case_dict.get("DOSE_2_COV")
                if exists.DOSE_REF is None and case_dict.get("DOSE_REF") is not None:
                    exists.DOSE_REF = case_dict.get("DOSE_REF")
                if exists.DOSE_2REF is None and case_dict.get("DOSE_2REF") is not None:
                    exists.DOSE_2REF = case_dict.get("DOSE_2REF")
                if exists.DOSE_ADIC is None and case_dict.get("DOSE_ADIC") is not None:
                    exists.DOSE_ADIC = case_dict.get("DOSE_ADIC")
                if exists.CS_SEXO is None and case_dict.get("CS_SEXO") is not None:
                    exists.CS_SEXO = case_dict.get("CS_SEXO")
                if exists.NU_IDADE_N is None and case_dict.get("NU_IDADE_N") is not None:
                    exists.NU_IDADE_N = case_dict.get("NU_IDADE_N")
                if exists.IDADE_ANOS is None and case_dict.get("IDADE_ANOS") is not None:
                    exists.IDADE_ANOS = case_dict.get("IDADE_ANOS")
                if exists.CS_GESTANT is None and case_dict.get("CS_GESTANT") is not None:
                    exists.CS_GESTANT = case_dict.get("CS_GESTANT")
                if exists.PUERPERA is None and case_dict.get("PUERPERA") is not None:
                    exists.PUERPERA = case_dict.get("PUERPERA")
                if exists.ASMA is None and case_dict.get("ASMA") is not None:
                    exists.ASMA = case_dict.get("ASMA")
                if exists.IMUNODEPRE is None and case_dict.get("IMUNODEPRE") is not None:
                    exists.IMUNODEPRE = case_dict.get("IMUNODEPRE")
                if exists.RENAL is None and case_dict.get("RENAL") is not None:
                    exists.RENAL = case_dict.get("RENAL")
                if exists.DIABETES is None and case_dict.get("DIABETES") is not None:
                    exists.DIABETES = case_dict.get("DIABETES")
                if exists.OBESIDADE is None and case_dict.get("OBESIDADE") is not None:
                    exists.OBESIDADE = case_dict.get("OBESIDADE")
                if exists.HEMATOLOGI is None and case_dict.get("HEMATOLOGI") is not None:
                    exists.HEMATOLOGI = case_dict.get("HEMATOLOGI")
                if exists.SIND_DOWN is None and case_dict.get("SIND_DOWN") is not None:
                    exists.SIND_DOWN = case_dict.get("SIND_DOWN")
                if exists.HEPATICA is None and case_dict.get("HEPATICA") is not None:
                    exists.HEPATICA = case_dict.get("HEPATICA")
                if exists.NEUROLOGIC is None and case_dict.get("NEUROLOGIC") is not None:
                    exists.NEUROLOGIC = case_dict.get("NEUROLOGIC")
                if exists.PNEUMOPATI is None and case_dict.get("PNEUMOPATI") is not None:
                    exists.PNEUMOPATI = case_dict.get("PNEUMOPATI")
                if exists.TABAG is None and case_dict.get("TABAG") is not None:
                    exists.TABAG = case_dict.get("TABAG")
                if exists.OUT_MORBI is None and case_dict.get("OUT_MORBI") is not None:
                    exists.OUT_MORBI = case_dict.get("OUT_MORBI")
                if exists.CARDIOPATI is None and case_dict.get("CARDIOPATI") is not None:
                    exists.CARDIOPATI = case_dict.get("CARDIOPATI")
                if exists.FEBRE is None and case_dict.get("FEBRE") is not None:
                    exists.FEBRE = case_dict.get("FEBRE")
                if exists.TOSSE is None and case_dict.get("TOSSE") is not None:
                    exists.TOSSE = case_dict.get("TOSSE")
                if exists.GARGANTA is None and case_dict.get("GARGANTA") is not None:
                    exists.GARGANTA = case_dict.get("GARGANTA")
                if exists.DISPNEIA is None and case_dict.get("DISPNEIA") is not None:
                    exists.DISPNEIA = case_dict.get("DISPNEIA")
                if exists.DESC_RESP is None and case_dict.get("DESC_RESP") is not None:
                    exists.DESC_RESP = case_dict.get("DESC_RESP")
                if exists.SATURACAO is None and case_dict.get("SATURACAO") is not None:
                    exists.SATURACAO = case_dict.get("SATURACAO")
                if exists.DIARREIA is None and case_dict.get("DIARREIA") is not None:
                    exists.DIARREIA = case_dict.get("DIARREIA")
                if exists.VOMITO is None and case_dict.get("VOMITO") is not None:
                    exists.VOMITO = case_dict.get("VOMITO")
                if exists.DOR_ABD is None and case_dict.get("DOR_ABD") is not None:
                    exists.DOR_ABD = case_dict.get("DOR_ABD")
                if exists.FADIGA is None and case_dict.get("FADIGA") is not None:
                    exists.FADIGA = case_dict.get("FADIGA")
                if exists.PERD_OLFT is None and case_dict.get("PERD_OLFT") is not None:
                    exists.PERD_OLFT = case_dict.get("PERD_OLFT")
                if exists.PERD_PALA is None and case_dict.get("PERD_PALA") is not None:
                    exists.PERD_PALA = case_dict.get("PERD_PALA")
                if exists.OUTRO_SIN is None and case_dict.get("OUTRO_SIN") is not None:
                    exists.OUTRO_SIN = case_dict.get("OUTRO_SIN")
                if exists.SUPORT_VEN is None and case_dict.get("SUPORT_VEN") is not None:
                    exists.SUPORT_VEN = case_dict.get("SUPORT_VEN")
                if exists.VACINA_COV is None and case_dict.get("VACINA_COV") is not None:
                    exists.VACINA_COV = case_dict.get("VACINA_COV")
                if exists.VACINA is None and case_dict.get("VACINA") is not None:
                    exists.VACINA = case_dict.get("VACINA")
                if exists.DT_UT_DOSE is None and case_dict.get("DT_UT_DOSE") is not None:
                    exists.DT_UT_DOSE = case_dict.get("DT_UT_DOSE")
                if exists.ANTIVIRAL is None and case_dict.get("ANTIVIRAL") is not None:
                    exists.ANTIVIRAL = case_dict.get("ANTIVIRAL")
                if exists.TRAT_COV is None and case_dict.get("TRAT_COV") is not None:
                    exists.TRAT_COV = case_dict.get("TRAT_COV")

        session.commit()
    return new_count
