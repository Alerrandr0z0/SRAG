"""Unit tests for internal helpers exposed by src/srag/api/routers_clinical.py.

These helpers are pure functions; testing them in isolation gives
coverage without booting the FastAPI app.
"""

import pandas as pd

from srag.api.routers_clinical import (
    _get_last_covid_dose,
    _normalize_flu_labels,
)


class TestGetLastCovidDose:
    """The cascade maps the highest-priority recorded dose to a human label.

    Priority (top to bottom): Bivalente, 2nd booster, 1st booster,
    full scheme, dose 1, unvaccinated, ignored. The first NaN check wins.
    """

    def test_bivalente_takes_priority_over_anything(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": "2024-03-01",
                "DOSE_2REF": "2024-01-01",
                "DOSE_REF": "2023-10-01",
                "DOSE_2_COV": "2023-06-01",
                "DOSE_1_COV": "2023-01-01",
                "VACINA_COV": 1,
            }
        )
        assert _get_last_covid_dose(row) == "Bivalente"

    def test_2_refoco_wins_when_no_bivalente(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": "2024-01-01",
                "DOSE_REF": "2023-10-01",
                "DOSE_2_COV": "2023-06-01",
                "DOSE_1_COV": "2023-01-01",
                "VACINA_COV": 1,
            }
        )
        assert _get_last_covid_dose(row) == "2º Reforço"

    def test_1_refoco(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": "2023-10-01",
                "DOSE_2_COV": "2023-06-01",
                "DOSE_1_COV": "2023-01-01",
                "VACINA_COV": 1,
            }
        )
        assert _get_last_covid_dose(row) == "1º Reforço"

    def test_esquema_completo(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": None,
                "DOSE_2_COV": "2023-06-01",
                "DOSE_1_COV": "2023-01-01",
                "VACINA_COV": 1,
            }
        )
        assert _get_last_covid_dose(row) == "Esquema Completo"

    def test_dose_1(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": None,
                "DOSE_2_COV": None,
                "DOSE_1_COV": "2023-01-01",
                "VACINA_COV": 1,
            }
        )
        assert _get_last_covid_dose(row) == "Dose 1"

    def test_nao_vacinado_when_vacina_cov_is_2(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": None,
                "DOSE_2_COV": None,
                "DOSE_1_COV": None,
                "VACINA_COV": 2,
            }
        )
        assert _get_last_covid_dose(row) == "Não Vacinado"

    def test_ignorado_when_nothing_recorded(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": None,
                "DOSE_2_COV": None,
                "DOSE_1_COV": None,
                "VACINA_COV": 9,
            }
        )
        assert _get_last_covid_dose(row) == "Ignorado"

    def test_ignorado_when_vacina_cov_missing(self) -> None:
        row = pd.Series(
            {
                "DOS_RE_BI": None,
                "DOSE_2REF": None,
                "DOSE_REF": None,
                "DOSE_2_COV": None,
                "DOSE_1_COV": None,
            }
        )
        assert _get_last_covid_dose(row) == "Ignorado"


class TestNormalizeFluLabels:
    """Maps raw classifier keys to readable labels and pre-populates zeros."""

    def test_known_labels_translated(self) -> None:
        raw = {"protegido": 10, "vencida": 2, "nao_vacinado": 5}
        out = _normalize_flu_labels(raw)
        assert out["Protegido (Campanha Atual)"] == 10
        assert out["Imunidade Vencida"] == 2
        assert out["Não Vacinado"] == 5

    def test_unknown_label_preserved_as_string(self) -> None:
        raw = {"label_desconhecido": 7}
        out = _normalize_flu_labels(raw)
        assert out["label_desconhecido"] == 7

    def test_all_known_labels_present_with_zero_default(self) -> None:
        out = _normalize_flu_labels({})
        expected = {
            "Protegido (Campanha Atual)",
            "Gripe: Dose 1",
            "Gripe: Dose 2",
            "Gripe: Dose Única",
            "Imunidade Vencida",
            "Não Vacinado",
            "Ignorado",
            "Inconsistência",
        }
        for label in expected:
            assert label in out
            assert out[label] == 0

    def test_partial_input_still_pre_populates_known_labels(self) -> None:
        out = _normalize_flu_labels({"dose_1": 3})
        assert out["Gripe: Dose 1"] == 3
        assert out["Gripe: Dose 2"] == 0
        assert out["Protegido (Campanha Atual)"] == 0

    def test_string_keys_coerced_to_int(self) -> None:
        raw = {"protegido": "10", "vencida": "5"}
        out = _normalize_flu_labels(raw)
        assert out["Protegido (Campanha Atual)"] == 10
        assert isinstance(out["Protegido (Campanha Atual)"], int)
