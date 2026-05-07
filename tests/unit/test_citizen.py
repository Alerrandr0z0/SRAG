import pandas as pd

from srag.data.analytics.demographics import (
    compute_animal_contact_distribution,
    compute_occupation_profile,
)


def test_compute_occupation_profile() -> None:
    """Test occupation profile aggregation."""
    df = pd.DataFrame(
        {
            "PAC_DSCBO": [
                "PROFESSOR",
                "MEDICO",
                "PROFESSOR",
                "ESTUDANTE",
                "NAN",
                "",
                "MEDICO",
                "PROFESSOR",
            ]
        }
    )
    result = compute_occupation_profile(df)

    # Check if grouped and sorted
    assert result[0]["label"] == "PROFESSOR"
    assert result[0]["count"] == 3
    assert result[1]["label"] == "MEDICO"
    assert result[1]["count"] == 2
    assert result[2]["label"] == "ESTUDANTE"
    assert result[2]["count"] == 1

    # Check that empty/nan are excluded
    labels = [r["label"] for r in result]
    assert "NAN" not in labels
    assert "" not in labels


def test_compute_animal_contact_distribution() -> None:
    """Test animal contact risk factor distribution."""
    df = pd.DataFrame({"AVE_SUINO": [1, 2, 2, 3, 9, 1, None]})
    result = compute_animal_contact_distribution(df)

    # Expected: 2 Aves/Suínos (1), 1 Outros Animais (3), 2 Sem Contato (2), 2 Ignorado (9 and None)
    res_dict = {r["label"]: r["count"] for r in result}

    assert res_dict["Aves/Suínos"] == 2
    assert res_dict["Sem Contato"] == 2
    assert res_dict["Outros Animais"] == 1
    assert res_dict["Ignorado"] == 2

    # Check ordering
    labels = [r["label"] for r in result]
    assert labels == ["Aves/Suínos", "Outros Animais", "Sem Contato", "Ignorado"]
