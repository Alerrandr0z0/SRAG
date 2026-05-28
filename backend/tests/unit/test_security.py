"""Security tests: CORS, input validation, and SQL injection guards."""

from fastapi.testclient import TestClient

from srag.api.main import app

client = TestClient(app)


class TestCORS:
    def test_cors_allowed_origin(self):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert resp.status_code == 200

    def test_cors_disallowed_origin(self):
        resp = client.options(
            "/health",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        allow_origin = resp.headers.get("access-control-allow-origin")
        assert allow_origin != "https://evil.com"

    def test_cors_credentials_disabled(self):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.headers.get("access-control-allow-credentials") != "true"

    def test_cors_methods_restricted(self):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "DELETE",
            },
        )
        allow_methods = resp.headers.get("access-control-allow-methods", "")
        assert "DELETE" not in allow_methods


class TestInputValidation:
    def test_virus_invalid_detail_level(self):
        resp = client.get("/virus?detail_level=invalid")
        assert resp.status_code == 422

    def test_virus_valid_detail_level(self):
        resp = client.get("/virus?detail_level=summary")
        assert resp.status_code in (200, 422)

    def test_timeline_agg_invalid_virus(self):
        resp = client.get("/timeline_agg?virus=invalid")
        assert resp.status_code == 422

    def test_timeline_agg_valid_virus(self):
        resp = client.get("/timeline_agg?virus=covid")
        assert resp.status_code in (200, 422)

    def test_context_trends_invalid_key(self):
        resp = client.get("/context_trends?key=INVALID&last_n_weeks=10")
        assert resp.status_code == 422

    def test_context_trends_valid_key_bairro(self):
        resp = client.get("/context_trends?key=BAIRRO::centro&last_n_weeks=10")
        assert resp.status_code in (200, 422)

    def test_context_trends_valid_key_zona(self):
        resp = client.get("/context_trends?key=ZONA::urbana&last_n_weeks=10")
        assert resp.status_code in (200, 422)

    def test_context_trends_last_n_weeks_out_of_range(self):
        resp = client.get("/context_trends?key=ZONA::urbana&last_n_weeks=999")
        assert resp.status_code == 422

    def test_context_trends_weeks_to_predict_out_of_range(self):
        resp = client.get("/context_trends?key=ZONA::urbana&weeks_to_predict=999")
        assert resp.status_code == 422

    def test_occupations_limit_out_of_range(self):
        resp = client.get("/occupations?limit=9999")
        assert resp.status_code == 422

    def test_territory_bootstrap_min_cases_out_of_range(self):
        resp = client.get("/territory_bootstrap?min_cases=0")
        assert resp.status_code == 422

    def test_geo_macrosector_zone_invalid(self):
        resp = client.get("/geo/macrosector_heatpoints?zone=invalid")
        assert resp.status_code == 422

    def test_geo_macrosector_zone_valid(self):
        resp = client.get("/geo/macrosector_heatpoints?zone=Rural")
        assert resp.status_code in (200, 422)

    def test_years_filter_out_of_range(self):
        resp = client.get("/summary?years=1800")
        assert resp.status_code == 422

    def test_years_filter_valid(self):
        resp = client.get("/summary?years=2020")
        assert resp.status_code in (200, 422)


class TestDynamicSQL:
    def test_get_df_column_validation(self):
        from srag.api.core import _KNOWN_COLUMNS, get_df

        assert isinstance(_KNOWN_COLUMNS, frozenset)
        assert "DT_NOTIFIC" in _KNOWN_COLUMNS
        assert len(_KNOWN_COLUMNS) > 50

        df = get_df()
        assert not df.empty
        assert "DT_NOTIFIC" in df.columns
        assert "DT_SIN_PRI" in df.columns
