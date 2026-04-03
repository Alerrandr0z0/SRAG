"""Data schemas for SIVEP-Gripe SRAG Unificado dataset."""

from datetime import date
from enum import IntEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClassiFin(IntEnum):
    """Final classification of the SRAG case."""

    INFLUENZA = 1
    OTHER_VIRUS = 2
    OTHER_AGENT = 3
    UNSPECIFIED = 4
    COVID_19 = 5


class Evolucao(IntEnum):
    """Outcome of the case."""

    CURE = 1
    DEATH = 2
    DEATH_OTHER = 3
    IGNORED = 9


class YesNoIgnored(IntEnum):
    """Standard 1-Yes, 2-No, 9-Ignored field."""

    YES = 1
    NO = 2
    IGNORED = 9


class SragCase(BaseModel):
    """Schema for a single SRAG case from the Unificado dataset."""

    # Identificação e Localização
    DT_NOTIFIC: date = Field(alias="DT_NOTIFIC")
    ID_MUNICIP: str = Field(alias="ID_MUNICIP")
    SEM_NOT: int | None = Field(alias="SEM_NOT", default=None)
    SG_UF_NOT: str | None = Field(alias="SG_UF_NOT", default=None)
    ID_UNIDADE: str | None = Field(alias="ID_UNIDADE", default=None)
    NM_BAIRRO: str | None = Field(alias="NM_BAIRRO", default=None)
    BAIRRO_REF: str | None = Field(alias="BAIRRO_REF", default=None)
    ZONA: str | None = Field(alias="ZONA", default=None)
    CS_ZONA: int | None = Field(alias="CS_ZONA", default=None)

    # Dados do Paciente
    DT_SIN_PRI: date = Field(alias="DT_SIN_PRI")
    SEM_PRI: int | None = Field(alias="SEM_PRI", default=None)
    DT_NASC: date | None = Field(alias="DT_NASC", default=None)
    NU_IDADE_N: int | None = Field(alias="NU_IDADE_N", default=None)
    TP_IDADE: int | None = Field(alias="TP_IDADE", default=None)
    CS_SEXO: str | None = Field(alias="CS_SEXO", default=None)
    CS_GESTANT: int | None = Field(alias="CS_GESTANT", default=None)
    CS_RACA: int | None = Field(alias="CS_RACA", default=None)
    CS_ESCOL_N: int | None = Field(alias="CS_ESCOL_N", default=None)
    NOSOCOMIAL: int | None = Field(alias="NOSOCOMIAL", default=None)
    ID_MN_RESI: str = Field(alias="ID_MN_RESI")
    SG_UF: str | None = Field(alias="SG_UF", default=None)

    # Sinais e Sintomas
    FEBRE: int | None = Field(alias="FEBRE", default=None)
    TOSSE: int | None = Field(alias="TOSSE", default=None)
    GARGANTA: int | None = Field(alias="GARGANTA", default=None)
    DISPNEIA: int | None = Field(alias="DISPNEIA", default=None)
    DESC_RESP: int | None = Field(alias="DESC_RESP", default=None)
    SATURACAO: int | None = Field(alias="SATURACAO", default=None)
    DIARREIA: int | None = Field(alias="DIARREIA", default=None)
    VOMITO: int | None = Field(alias="VOMITO", default=None)
    DOR_ABD: int | None = Field(alias="DOR_ABD", default=None)
    FADIGA: int | None = Field(alias="FADIGA", default=None)
    PERD_OLFT: int | None = Field(alias="PERD_OLFT", default=None)
    PERD_PALA: int | None = Field(alias="PERD_PALA", default=None)
    OUTRO_SIN: int | None = Field(alias="OUTRO_SIN", default=None)

    # Fatores de Risco
    FATOR_RISC: int | None = Field(alias="FATOR_RISC", default=None)
    PUERPERA: int | None = Field(alias="PUERPERA", default=None)
    CARDIOPATI: int | None = Field(alias="CARDIOPATI", default=None)
    HEMATOLOGI: int | None = Field(alias="HEMATOLOGI", default=None)
    SIND_DOWN: int | None = Field(alias="SIND_DOWN", default=None)
    HEPATICA: int | None = Field(alias="HEPATICA", default=None)
    DIABETES: int | None = Field(alias="DIABETES", default=None)
    NEUROLOGIC: int | None = Field(alias="NEUROLOGIC", default=None)
    PNEUMOPATI: int | None = Field(alias="PNEUMOPATI", default=None)
    OBESIDADE: int | None = Field(alias="OBESIDADE", default=None)
    TABAG: int | None = Field(alias="TABAG", default=None)
    OUT_MORBI: int | None = Field(alias="OUT_MORBI", default=None)

    # Atendimento e Evolução
    HOSPITAL: int | None = Field(alias="HOSPITAL", default=None)
    DT_INTERNA: date | None = Field(alias="DT_INTERNA", default=None)
    UTI: int | None = Field(alias="UTI", default=None)
    DT_ENTUTI: date | None = Field(alias="DT_ENTUTI", default=None)
    DT_SAIDUTI: date | None = Field(alias="DT_SAIDUTI", default=None)
    SUPORT_VEN: int | None = Field(alias="SUPORT_VEN", default=None)
    CLASSI_FIN: int | None = Field(alias="CLASSI_FIN", default=None)
    PCR_VSR: int | None = Field(alias="PCR_VSR", default=None)
    AN_VSR: int | None = Field(alias="AN_VSR", default=None)
    PCR_SARS2: int | None = Field(alias="PCR_SARS2", default=None)
    AN_SARS2: int | None = Field(alias="AN_SARS2", default=None)
    TP_FLU_PCR: int | None = Field(alias="TP_FLU_PCR", default=None)
    TP_FLU_AN: int | None = Field(alias="TP_FLU_AN", default=None)
    PCR_RESUL: int | None = Field(alias="PCR_RESUL", default=None)
    RES_AN: int | None = Field(alias="RES_AN", default=None)
    DT_PCR: date | None = Field(alias="DT_PCR", default=None)
    DT_RES_AN: date | None = Field(alias="DT_RES_AN", default=None)
    DT_COLETA: date | None = Field(alias="DT_COLETA", default=None)
    LAB_AN: str | None = Field(alias="LAB_AN", default=None)
    CO_LAB_AN: str | None = Field(alias="CO_LAB_AN", default=None)
    POS_PCRFLU: int | None = Field(alias="POS_PCRFLU", default=None)
    PCR_FLUASU: int | None = Field(alias="PCR_FLUASU", default=None)
    PCR_FLUBLI: int | None = Field(alias="PCR_FLUBLI", default=None)
    PCR_RINO: int | None = Field(alias="PCR_RINO", default=None)
    PCR_METAP: int | None = Field(alias="PCR_METAP", default=None)
    PCR_ADENO: int | None = Field(alias="PCR_ADENO", default=None)
    PCR_PARA1: int | None = Field(alias="PCR_PARA1", default=None)
    PCR_PARA2: int | None = Field(alias="PCR_PARA2", default=None)
    PCR_PARA3: int | None = Field(alias="PCR_PARA3", default=None)
    PCR_PARA4: int | None = Field(alias="PCR_PARA4", default=None)
    POS_AN_OUT: int | None = Field(alias="POS_AN_OUT", default=None)
    AN_ADENO: int | None = Field(alias="AN_ADENO", default=None)
    AN_PARA1: int | None = Field(alias="AN_PARA1", default=None)
    AN_PARA2: int | None = Field(alias="AN_PARA2", default=None)
    AN_PARA3: int | None = Field(alias="AN_PARA3", default=None)
    EVOLUCAO: int | None = Field(alias="EVOLUCAO", default=None)
    DT_EVOLUCA: date | None = Field(alias="DT_EVOLUCA", default=None)

    # Exames de imagem
    RAIOX_RES: int | None = Field(alias="RAIOX_RES", default=None)
    TOMO_RES: int | None = Field(alias="TOMO_RES", default=None)

    # Comorbidades adicionais
    ASMA: int | None = Field(alias="ASMA", default=None)
    IMUNODEPRE: int | None = Field(alias="IMUNODEPRE", default=None)
    RENAL: int | None = Field(alias="RENAL", default=None)

    # Vacinação e tratamento
    VACINA_COV: int | None = Field(alias="VACINA_COV", default=None)
    DOSE_1_COV: date | None = Field(alias="DOSE_1_COV", default=None)
    DOSE_2_COV: date | None = Field(alias="DOSE_2_COV", default=None)
    DOSE_REF: date | None = Field(alias="DOSE_REF", default=None)
    DOSE_2REF: date | None = Field(alias="DOSE_2REF", default=None)
    DOSE_ADIC: date | None = Field(alias="DOSE_ADIC", default=None)
    DOS_RE_BI: date | None = Field(alias="DOS_RE_BI", default=None)
    VACINA: int | None = Field(alias="VACINA", default=None)
    DT_UT_DOSE: date | None = Field(alias="DT_UT_DOSE", default=None)
    ANTIVIRAL: int | None = Field(alias="ANTIVIRAL", default=None)
    TRAT_COV: int | None = Field(alias="TRAT_COV", default=None)

    model_config = ConfigDict(
        populate_by_name=True,
    )

    @field_validator(
        "DT_NOTIFIC",
        "DT_SIN_PRI",
        "DT_NASC",
        "DT_INTERNA",
        "DT_ENTUTI",
        "DT_SAIDUTI",
        "DT_EVOLUCA",
        "DT_PCR",
        "DT_RES_AN",
        "DT_COLETA",
        "DOSE_1_COV",
        "DOSE_2_COV",
        "DOSE_REF",
        "DOSE_2REF",
        "DOSE_ADIC",
        "DOS_RE_BI",
        "DT_UT_DOSE",
        mode="before",
    )
    @classmethod
    def parse_date(cls, v: str | date | None) -> date | None:
        """Parse dates from DD/MM/YYYY or YYYY-MM-DD string format."""
        if isinstance(v, str) and v.strip():
            # Try YYYY-MM-DD
            try:
                from datetime import datetime

                return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                pass

            # Try DD/MM/YYYY
            try:
                day, month, year = map(int, v.split("/"))
                return date(year, month, day)
            except ValueError:
                return None
        return v if isinstance(v, date) else None


def is_mossoro_case(case: SragCase) -> bool:
    """Check if the case is related to Mossoró/RN."""
    mossoro_codes = ["2408003", "240800"]
    mossoro_name = "MOSSORO"

    id_mun = str(case.ID_MUNICIP).strip().upper()
    id_res = str(case.ID_MN_RESI).strip().upper()

    return any(c in (id_mun, id_res) for c in mossoro_codes) or mossoro_name in (id_mun, id_res)
