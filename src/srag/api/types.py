"""Type definitions for API responses."""

from typing import Any, TypedDict


class SummaryResponse(TypedDict):
    """Summary metrics response."""

    uti_rate: float
    uti_total: int
    death_rate: float
    total: int
    available_years: list[int]


class TrendsResponse(TypedDict):
    """Trends with history and forecast."""

    history: list[dict[str, Any]]
    forecast: list[dict[str, Any]]
    thresholds: dict[str, Any]
    composition: list[dict[str, Any]]
    base_cumulative: int


class VirusDistributionItem(TypedDict):
    """Virus distribution item."""

    virus: str
    count: int


class ClinicalFlowNode(TypedDict):
    """Clinical flow node."""

    name: str


class ClinicalFlowLink(TypedDict):
    """Clinical flow link between nodes."""

    source: str
    target: str
    value: int
    pct: float


class ClinicalFlowResponse(TypedDict):
    """Clinical flow graph response."""

    nodes: list[ClinicalFlowNode]
    links: list[ClinicalFlowLink]


class TerritoryBootstrapResponse(TypedDict):
    """Territory bootstrap response."""

    territory: dict[str, Any]
    boundary: dict[str, Any]
    choropleth: dict[str, Any]
    territory_entities: list[dict[str, Any]]


class GeoBoundaryResponse(TypedDict):
    """Geo boundary response."""

    type: str
    features: list[dict[str, Any]]


class GeoRuralHeatpointsResponse(TypedDict):
    """Rural heatpoints response."""

    available: bool
    sectors: list[dict[str, Any]]
    center: dict[str, Any] | None


class LaboratoryNetworkResponse(TypedDict):
    """Laboratory network metrics."""

    total_cases: int
    positivity_rate: float
    positivity_trend: list[dict[str, Any]]
    influenza_subtypes: list[dict[str, Any]]
    antiviral_usage: dict[str, Any]
    closure_criteria: list[dict[str, Any]]
    notification_delay: list[dict[str, Any]]
    mortality_by_treatment_agent: list[dict[str, Any]]
    genomic_variants: dict[str, Any]
    virus_trends: list[dict[str, Any]]
    imaging_profile: dict[str, Any]
    serology_profile: dict[str, Any]
    antiviral_types: list[dict[str, Any]]


class VaccinationProfileResponse(TypedDict):
    """Vaccination profile response."""

    gripe: dict[str, Any]
    covid_detailed: dict[str, Any]


class AggregatedTimeline(TypedDict):
    """Aggregated clinical timeline by vaccine profile."""

    perfil: str
    status_key: str
    mediana_dose_sintoma: float | None
    mediana_sintoma_internacao: float
    mediana_internacao_desfecho: float
    taxa_cura: float
    taxa_obito: float
    severity_score: float
    count: int


class CitizenBootstrapResponse(TypedDict):
    """Citizen bootstrap response."""

    citizen_profiles: dict[str, Any]
    citizen_pyramid: list[dict[str, Any]]
    race_profile: list[dict[str, Any]]
    schooling_profile: list[dict[str, Any]]
    occupation_profile: list[dict[str, Any]]
    animal_contact: list[dict[str, Any]]
    symptoms_signature: dict[str, Any]
    risk_factors_full: list[dict[str, Any]]
    maternal_profile: dict[str, Any]
