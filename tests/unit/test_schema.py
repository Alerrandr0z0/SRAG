from datetime import date
from srag.data.schema import SragCase, is_mossoro_case

def test_is_mossoro_case_by_code():
    case = SragCase(
        DT_NOTIFIC="20/05/2024",
        ID_MUNICIP="2408003", # Mossoró
        ID_MN_RESI="2408003",
        SEM_NOT=21,
        SG_UF_NOT="RN",
        ID_UNIDADE="UPA",
        DT_SIN_PRI="15/05/2024",
        SEM_PRI=20,
        NU_IDADE_N=30,
        TP_IDADE=3,
        CS_SEXO="M",
        CS_GESTANT=9,
        SG_UF="RN"
    )
    assert is_mossoro_case(case) is True

def test_is_mossoro_case_by_name():
    case = SragCase(
        DT_NOTIFIC="20/05/2024",
        ID_MUNICIP="MOSSORO",
        ID_MN_RESI="NATAL",
        SEM_NOT=21,
        SG_UF_NOT="RN",
        ID_UNIDADE="UPA",
        DT_SIN_PRI="15/05/2024",
        SEM_PRI=20,
        NU_IDADE_N=30,
        TP_IDADE=3,
        CS_SEXO="M",
        CS_GESTANT=9,
        SG_UF="RN"
    )
    assert is_mossoro_case(case) is True

def test_is_not_mossoro_case():
    case = SragCase(
        DT_NOTIFIC="20/05/2024",
        ID_MUNICIP="2408102", # Natal
        ID_MN_RESI="2408102",
        SEM_NOT=21,
        SG_UF_NOT="RN",
        ID_UNIDADE="UPA",
        DT_SIN_PRI="15/05/2024",
        SEM_PRI=20,
        NU_IDADE_N=30,
        TP_IDADE=3,
        CS_SEXO="M",
        CS_GESTANT=9,
        SG_UF="RN"
    )
    assert is_mossoro_case(case) is False
