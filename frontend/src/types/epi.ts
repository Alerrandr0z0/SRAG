export interface SummaryData {
  uti_rate: number;
  uti_total: number;
  death_rate: number;
  death_count: number;
  total: number;
  notification_total: number;
  available_years: number[];
}

export interface VirusData {
  virus: string;
  count: number;
  percentage?: number;
}

export interface TrendData {
  epi_week: string;
  total: number;
}

export interface EpiWeekData {
  epi_week: string;
  total: number;
}

export interface ForecastEntry {
  epi_week: string;
  predicted_cases: number;
  predicted_cases_lower: number;
  predicted_cases_upper: number;
}

export interface Thresholds {
  medium: number;
  high: number;
  very_high: number;
}

export interface TrendsData {
  history: TrendData[];
  forecast: ForecastEntry[];
  thresholds: Thresholds;
  composition: Array<{ epi_week: string; virus: string; count: number }>;
  base_cumulative: number;
}

export interface NeighborhoodStats {
  bairro: string;
  count: number;
  curados?: number;
  obitos?: number;
  ignorados?: number;
}

export interface ZoneStats {
  zona: string;
  count: number;
}

export interface UnitStats {
  id_unidade: string;
  count: number;
  curados?: number;
  obitos?: number;
  ignorados?: number;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  [key: string]: unknown;
}

export interface ClinicalFlow {
  nodes: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
}

export interface IcuBottleneckRecord {
  date: string;
  wait_days: number;
  [key: string]: unknown;
}

export interface TerritoryBootstrap {
  territory: {
    bairros: NeighborhoodStats[];
    zonas: ZoneStats[];
  };
  boundary: unknown;
  choropleth: Array<{ bairro: string; count: number; rate?: number }>;
  ruralData?: {
    sectors: Array<{
      codigo_cnes: string;
      label: string;
      count: number;
      latitude?: number | null;
      longitude?: number | null;
      endereco?: string | null;
      zona?: string;
      bairro?: string | null;
    }>;
    points: unknown[];
    center: { lat: number; lon: number } | null;
    urban_points?: Array<{
      codigo_cnes: string;
      label: string;
      count: number;
      latitude?: number | null;
      longitude?: number | null;
      endereco?: string | null;
      zona?: string;
      bairro?: string | null;
    }>;
    urban_center?: { lat: number; lon: number } | null;
  } | null;
  ruralSectorsGeo?: unknown;
  territory_entities: {
    urban_bairros: Array<{ label: string; count: number }>;
    rural_comunidades: Array<{ label: string; count: number }>;
  };
}

export interface LaboratoryNetwork {
  labs: Array<{
    LAB_REF?: string;
    lab_ref?: string;
    tested_cases: number;
    positive_count?: number;
    positive_rate?: number;
  }>;
  overall: {
    tested_cases: number;
    positive_rate: number;
    median_turnaround_days: number;
    avg_turnaround_days?: number;
    turnaround_p90?: number;
    turnaround_p99?: number;
    turnaround_boxplot?: number[];
    turnaround_count?: number;
    codetection_cases?: number;
    protocol_48h_adherence_rate?: number;
    reinfection_total?: number;
  };
  reinfection_trend?: Array<{ epi_week: string; count: number }>;
  quality_metrics?: {
    testing_coverage: { collected: number; total: number; rate: number };
    sample_type_distribution: Array<{ label: string; count: number }>;
    diagnostic_latency: {
      boxplot_data: number[];
      median: number;
      count: number;
      p95?: number;
      p99?: number;
      target_adherence_rate?: number;
    };
  };
  treatment_metrics?: {
    antiviral_latency: { boxplot_data: number[]; median: number; count: number };
    antiviral_outcome_impact: Array<{
      group: string;
      cure_rate: number;
      death_rate: number;
      total: number;
    }>;
    antiviral_age_profile?: Array<{
      drug: string;
      age_samples: number[];
      count: number;
    }>;
    antiviral_latency_per_drug?: Array<{
      drug: string;
      latency_samples: number[];
      median: number;
      count: number;
      specifications?: string[];
    }>;
    treatment_window_outcomes?: Array<{
      window: string;
      total: number;
      cure_rate: number;
      death_rate: number;
      margin: number;
    }>;
  };
  agent_lethality_heatmap?: {
    agents: string[];
    age_bands: string[];
    matrix: number[][];
  };
  vaccine_survival?: VaccineSurvival;
  codetection_matrix?: {
    labels: string[];
    matrix: number[][];
  };
  positivity_trend: Array<{
    epi_week: string;
    tested: number;
    positive: number;
    positivity_rate: number;
  }>;
  influenza_subtypes: Array<{ label: string; count: number }>;
  antiviral_usage: { adherence_rate: number; total_indicated: number; treated: number };
  closure_criteria: Array<{ label: string; count: number }>;
  notification_delay: Array<{ epi_week: string; median_delay: number; record_count: number }>;
  mortality_by_treatment?: Array<{ treatment: string; agent: string; deaths: number }>;
  mortality_by_treatment_agent?: Array<{ treatment: string; agent: string; deaths: number }>;
  imaging_profile?: {
    raiox: Array<{ label: string; count: number }>;
    tomo: Array<{ label: string; count: number }>;
  };
  genomic_variants: {
    weeks: string[];
    variants: Record<string, number[]>;
  };
  antiviral_types?: Array<{ label: string; count: number }>;
  virus_ranking?: Array<{ virus: string; count: number }>;
  virus_trends?: Array<{ epi_week: string; virus: string; count: number }>;
  closure_by_agent?: Array<{
    agent: string;
    total: number;
    Laboratorial: number;
    'Vínculo Epidemiológico': number;
    'Clínico / Imagem': number;
    Óbito: number;
    'Ignorado/Em Aberto': number;
  }>;
  imaging_by_severity?: {
    raiox: Array<{
      finding: string;
      total: number;
      uti_count: number;
      uti_rate: number;
      death_count: number;
      death_rate: number;
    }>;
    tomo: Array<{
      finding: string;
      total: number;
      uti_count: number;
      uti_rate: number;
      death_count: number;
      death_rate: number;
    }>;
  };
  delay_by_unit?: Array<{
    id_unidade: string;
    nome_fantasia: string;
    total: number;
    median_delay: number;
    avg_delay: number;
    delay_samples: number[];
  }>;
  positivity_by_sample_type?: Array<{
    sample_type: string;
    tested: number;
    positive: number;
    positivity_rate: number;
  }>;
  diagnostic_latency_phases?: {
    symptom_to_notification: number;
    notification_to_collection: number;
    collection_to_result: number;
    symptom_to_treatment: number;
  };
}

export interface PyramidRow {
  age_band: string;
  male: number;
  female: number;
}

export interface CitizenProfile {
  key: string;
  label: string;
  count: number;
  hospital_rate: number;
  uti_rate: number;
  death_rate: number;
  covid_vaccinated_rate: number;
  subprofiles?: CitizenProfile[];
}

export interface SymptomSignature {
  labels: string[];
  bands: string[];
  matrices: {
    covid: [number, number][][];
    gripe: [number, number][][];
    vsr: [number, number][][];
  };
}

export interface CitizenBootstrap {
  citizen_profiles: { macro_profiles: CitizenProfile[] };
  citizen_pyramid: PyramidRow[];
  race_profile: Array<{ code: number; label: string; count: number }>;
  schooling_profile: Array<{ label: string; count: number }>;
  occupation_profile: Array<{ label: string; count: number }>;
  animal_contact: Array<{ label: string; count: number }>;
  traditional_communities?: Array<{ label: string; count: number }>;
  symptoms_signature: SymptomSignature;
  symptoms_heatmap: {
    labels: string[];
    matrix: number[][];
  };
  risk_factors_full: Array<{ factor: string; count: number }>;
  maternal_profile: {
    maternal_outcomes: Array<{
      group: string;
      cure: number;
      icu: number;
      death: number;
      total: number;
    }>;
    gestantes_total: number;
    puerperas_total: number;
    maternal_cases: number;
  };
}

export interface VaccinationProfile {
  gripe: Record<string, number>;
  covid_detailed: Record<string, number>;
  manufacturers?: Array<{ label: string; count: number }>;
}

export interface VaccineSurvival {
  covid: { timeline: number[]; survival: number[]; ci_upper: number[]; ci_lower: number[] };
  gripe: { timeline: number[]; survival: number[]; ci_upper: number[]; ci_lower: number[] };
}

export interface AggregatedTimeline {
  perfil: string;
  status_key: string;
  gripe_status?: 'protegido' | 'vencida' | 'nao_vacinado' | 'ignorado' | 'inconsistencia';
  mediana_dose_sintoma: number | null;
  doseP25?: number | null;
  doseP75?: number | null;
  mediana_sintoma_internacao: number;
  internP25: number;
  internP75: number;
  mediana_internacao_desfecho: number;
  desfP25: number;
  desfP75: number;
  taxa_cura: number;
  taxa_obito: number;
  uti_pct: number;
  severity_score: number;
  n: number;
  count: number;
}

export interface HospitalizationDurationData {
  cure: number[];
  death: number[];
  kde_x: number[];
  kde_cure: number[];
  kde_death: number[];
  median_cure: number;
  median_death: number;
  difference: number;
  ratio: number;
  cure_count: number;
  death_count: number;
}

export interface DataCompletenessGroup {
  group: string;
  overall_score: number;
  fields: Array<{ field: string; rate: number }>;
}

export interface CompletenessTrendPoint {
  epi_week: string;
  score: number;
  total: number;
  blocks?: Record<string, number>;
}

export interface UnitQualityScore {
  id_unidade: string;
  nome_fantasia: string;
  score: number;
  total: number;
  worst_field: string;
  worst_rate: number;
  municipio?: string;
  uf?: string;
}

export interface BairroQualityScore {
  bairro: string;
  score: number;
  total: number;
  worst_field: string;
  worst_rate: number;
}

export interface LaboratorioQualityScore {
  laboratorio: string;
  score: number;
  total: number;
  diagnostico_score: number;
  resultado_pct: number;
  median_turnaround_days?: number;
}

export interface LogicalInconsistency {
  rule: string;
  description: string;
  count: number;
  pct: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface AuditBootstrap {
  completeness: DataCompletenessGroup[];
  completeness_trend: CompletenessTrendPoint[];
  quality_by_unit: UnitQualityScore[];
  quality_by_bairro: BairroQualityScore[];
  quality_by_laboratory: LaboratorioQualityScore[];
  inconsistencies: LogicalInconsistency[];
}

export type TemporalGrouping = 'year' | 'month' | 'week';

export interface DashboardData {
  summary: SummaryData | null;
  trends: TrendsData | null;
  virus: VirusData[] | null;
  laboratoryNetwork?: LaboratoryNetwork;
}

export interface SeverityKpiPoint {
  hospitalization_rate: number;
  uti_rate: number;
  ventilatory_support_rate: number;
  death_rate: number;
  median_hospitalization_days: number;
  median_uti_days: number;
  epi_week?: string | null;
}

export interface SeverityKpisResponse {
  current: SeverityKpiPoint;
  trend: SeverityKpiPoint[];
}

export interface SeasonalTrendsResponse {
  years: string[];
  weeks: number[];
  series: Record<string, number[]>;
}

export interface SeverityPyramidPoint {
  age_group: string;
  total_cases: number;
  uti_rate: number;
  support_rate: number;
  death_rate: number;
}

export type SeverityPyramidResponse = SeverityPyramidPoint[];

export interface GravityCascadePoint {
  epi_week: string;
  notified: number;
  hospitalized: number;
  uti: number;
  death: number;
}

export type GravityCascadeResponse = GravityCascadePoint[];

export interface EpidemicHeatmapResponse {
  weeks: string[];
  age_groups: string[];
  data: [number, number, number][];
}

export interface ComorbiditiesTreemapItem {
  name: string;
  value: number;
  deaths: number;
  lethality: number;
}

export type ComorbiditiesTreemapResponse = ComorbiditiesTreemapItem[];

export interface VentilatorySupportPoint {
  epi_week: string;
  invasive: number;
  non_invasive: number;
  no_support: number;
  ignored: number;
}

export type VentilatorySupportResponse = VentilatorySupportPoint[];
