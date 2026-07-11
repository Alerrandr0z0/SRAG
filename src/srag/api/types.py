"""Type definitions for API responses."""

from typing import Any, NotRequired, TypedDict


class SummaryResponse(TypedDict):
    """Summary metrics response."""

    uti_rate: float
    uti_total: int
    death_rate: float
    death_count: int
    total: int
    hospitalized: int
    notification_total: int
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


class HospitalizationDurationResponse(TypedDict):
    """Hospitalization duration distribution by outcome with KDE curves."""

    cure: list[float]
    death: list[float]
    kde_x: list[float]
    kde_cure: list[float]
    kde_death: list[float]
    median_cure: float
    median_death: float
    difference: float
    ratio: float
    cure_count: int
    death_count: int


class TerritoryBootstrapResponse(TypedDict):
    """Territory bootstrap response."""

    territory: dict[str, Any]
    boundary: dict[str, Any]
    choropleth: dict[str, Any]
    territory_entities: list[dict[str, Any]]


class TerritoryMetricItem(TypedDict):
    """Territory ranking row."""

    bairro: str
    count: int
    curados: int
    obitos: int
    ignorados: int


class UnitMetricItem(TypedDict):
    """Unit ranking row."""

    id_unidade: str
    nome_fantasia: str
    count: int
    curados: int
    obitos: int
    ignorados: int


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
    closure_by_agent: list[dict[str, Any]]
    imaging_by_severity: dict[str, Any]
    delay_by_unit: list[dict[str, Any]]
    positivity_by_sample_type: list[dict[str, Any]]
    diagnostic_latency_phases: dict[str, float]


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


class AuditBootstrapResponse(TypedDict):
    """Audit bootstrap response."""

    completeness: list[dict[str, Any]]
    completeness_trend: list[dict[str, Any]]
    quality_by_unit: list[dict[str, Any]]
    quality_by_bairro: list[dict[str, Any]]
    quality_by_laboratory: list[dict[str, Any]]
    inconsistencies: list[dict[str, Any]]
    timeliness_flow: dict[str, Any]


class LaboratoryQualityRow(TypedDict):
    """Per-laboratory quality metrics."""

    laboratory: str
    score: float
    total: int
    diagnostico_score: float
    resultado_pct: float
    median_turnaround_days: float


class SeverityKpiPoint(TypedDict):
    """A single data point representing severity KPIs for a specific week or overall."""

    hospitalization_rate: float
    uti_rate: float
    ventilatory_support_rate: float
    death_rate: float
    median_hospitalization_days: float
    median_uti_days: float
    epi_week: NotRequired[str | None]


class SeverityKpisResponse(TypedDict):
    """Severity KPIs response with current status and trend over time."""

    current: SeverityKpiPoint
    trend: list[SeverityKpiPoint]


class SeasonalTrendsResponse(TypedDict):
    """Seasonal trends response with case counts by year and week."""

    years: list[str]
    weeks: list[int]
    series: dict[str, list[int]]


class SeverityPyramidPoint(TypedDict):
    """A single age group's severity rates."""

    age_group: str
    total_cases: int
    uti_rate: float
    support_rate: float
    death_rate: float


SeverityPyramidResponse = list[SeverityPyramidPoint]


class GravityCascadePoint(TypedDict):
    """Weekly count of cases in each severity layer."""

    epi_week: str
    notified: int
    hospitalized: int
    uti: int
    death: int


GravityCascadeResponse = list[GravityCascadePoint]


class EpidemicHeatmapResponse(TypedDict):
    """2D Heatmap response containing weeks, age groups, and counts matrix."""

    weeks: list[str]
    age_groups: list[str]
    data: list[list[int]]


class ComorbiditiesTreemapItem(TypedDict):
    """A comorbidity item for treemap visualization."""

    name: str
    value: int
    deaths: int
    lethality: float


ComorbiditiesTreemapResponse = list[ComorbiditiesTreemapItem]


class VentilatorySupportPoint(TypedDict):
    """Weekly count of cases for each ventilatory support type."""

    epi_week: str
    invasive: int
    non_invasive: int
    no_support: int
    ignored: int


VentilatorySupportResponse = list[VentilatorySupportPoint]

class DiagnosticStreamgraphItem(TypedDict):
    time_key: str
    diag_method: str
    count: int

class DiagnosticScatterItem(TypedDict):
    diag_method: str
    avg_latency: float
    volume: int

class DiagnosticResilienceResponse(TypedDict):
    streamgraph: list[DiagnosticStreamgraphItem]
    scatter: list[DiagnosticScatterItem]

class NosocomialControlChartItem(TypedDict):
    time_key: str
    rate: float
    mean: float
    ucl: float
    volume: int

class NosocomialLethalityItem(TypedDict):
    nosocomial: float
    community: float

class NosocomialRiskResponse(TypedDict):
    control_chart: list[NosocomialControlChartItem]
    lethality: NosocomialLethalityItem
