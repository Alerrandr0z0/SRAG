import contextlib
import logging

import logfire
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine

from srag.api import core as _core
from srag.api.routes import register_routes
from srag.data import analytics as _analytics
from srag.data.database import DB_URL
from srag.models import forecasting as _forecasting

logger = logging.getLogger(__name__)

_cache = _core._cache
apply_surveillance_filters = _core.apply_surveillance_filters
get_df = _core.get_df
sanitize_data = _core.sanitize_data

apply_global_filters = _analytics.apply_global_filters
classificar_status_gripe = _analytics.classificar_status_gripe
compute_alert_thresholds = _analytics.compute_alert_thresholds
compute_antiviral_types = _analytics.compute_antiviral_types
compute_antiviral_usage = _analytics.compute_antiviral_usage
compute_citizen_profile_tree = _analytics.compute_citizen_profile_tree
compute_occupation_profile = _analytics.compute_occupation_profile
compute_animal_contact_distribution = _analytics.compute_animal_contact_distribution
compute_clinical_timing_metrics = _analytics.compute_clinical_timing_metrics
compute_citizen_pyramid = _analytics.compute_citizen_pyramid
compute_closure_criteria = _analytics.compute_closure_criteria
compute_genomic_variants = _analytics.compute_genomic_variants
compute_imaging_profile = _analytics.compute_imaging_profile
compute_influenza_subtypes = _analytics.compute_influenza_subtypes
compute_laboratory_network_summary = _analytics.compute_laboratory_network_summary
compute_maternal_profile = _analytics.compute_maternal_profile
compute_mortality_by_treatment_agent = _analytics.compute_mortality_by_treatment_agent
compute_notification_delay_series = _analytics.compute_notification_delay_series
compute_positivity_trend = _analytics.compute_positivity_trend
compute_race_profile = _analytics.compute_race_profile
compute_risk_factors_full_profile = _analytics.compute_risk_factors_full_profile
compute_schooling_profile = _analytics.compute_schooling_profile
compute_serology_profile = _analytics.compute_serology_profile
compute_symptoms_signature = _analytics.compute_symptoms_signature
compute_symptoms_heatmap = _analytics.compute_symptoms_heatmap
compute_territory_distribution = _analytics.compute_territory_distribution
compute_traditional_community_distribution = _analytics.compute_traditional_community_distribution
compute_territory_entities_by_zone = _analytics.compute_territory_entities_by_zone
compute_time_series = _analytics.compute_time_series
compute_time_series_by_virus = _analytics.compute_time_series_by_virus
compute_unit_distribution = _analytics.compute_unit_distribution
compute_data_completeness = _analytics.compute_data_completeness
compute_vaccine_survival = _analytics.compute_vaccine_survival
compute_vaccine_manufacturer_distribution = _analytics.compute_vaccine_manufacturer_distribution
compute_virus_detailed_distribution = _analytics.compute_virus_detailed_distribution
compute_virus_distribution = _analytics.compute_virus_distribution
compute_lethality_heatmap = _analytics.compute_lethality_heatmap
compute_codetection_matrix = _analytics.compute_codetection_matrix
compute_zone_distribution = _analytics.compute_zone_distribution
compute_aggregated_timeline = _analytics.compute_aggregated_timeline
compute_diagnostic_latency = _analytics.compute_diagnostic_latency
compute_sample_type_distribution = _analytics.compute_sample_type_distribution
compute_testing_coverage = _analytics.compute_testing_coverage
compute_antiviral_latency = _analytics.compute_antiviral_latency
compute_antiviral_outcome_impact = _analytics.compute_antiviral_outcome_impact
infer_etiologic_agent = _analytics.infer_etiologic_agent
outcome_death_mask = _analytics.outcome_death_mask
outcome_valid_mask = _analytics.outcome_valid_mask
predict_next_weeks = _forecasting.predict_next_weeks

app = FastAPI(title="SRAG Mossoró API")

# Configure Logfire (Optional for local development)
try:
    logfire.configure(send_to_logfire="if-token-present")
    logfire.instrument_fastapi(app)
    logfire.instrument_pydantic()
except Exception as e:
    logger.warning("Logfire not configured: %s", e)

engine = create_engine(DB_URL, pool_pre_ping=True)
with contextlib.suppress(Exception):
    logfire.instrument_sqlalchemy(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

register_routes(app)
