export interface SummaryData {
  uti_rate: number;
  uti_total: number;
  death_rate: number;
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
}

export interface ZoneStats {
  zona: string;
  count: number;
}

export interface UnitStats {
  id_unidade: string;
  count: number;
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
  ruralData?: { sectors: unknown[]; points: unknown[]; center: unknown } | null;
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
    codetection_cases?: number;
    protocol_48h_adherence_rate?: number;
    reinfection_total?: number;
  };
  reinfection_trend?: Array<{ epi_week: string; count: number }>;
  quality_metrics?: {
    testing_coverage: { collected: number; total: number; rate: number };
    sample_type_distribution: Array<{ label: string; count: number }>;
    diagnostic_latency: { boxplot_data: number[]; median: number; count: number };
  };
  treatment_metrics?: {
    antiviral_latency: { boxplot_data: number[]; median: number; count: number };
    antiviral_outcome_impact: Array<{
      group: string;
      cure_rate: number;
      death_rate: number;
      total: number;
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
  mortality_by_treatment: Array<{ treatment: string; agent: string; deaths: number }>;
  genomic_variants: {
    weeks: string[];
    variants: Record<string, number[]>;
  };
  antiviral_types?: Array<{ label: string; count: number }>;
  virus_ranking?: Array<{ virus: string; count: number }>;
  virus_trends?: Array<{ epi_week: string; virus: string; count: number }>;
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

export interface DataCompletenessGroup {
  group: string;
  overall_score: number;
  fields: Array<{ field: string; rate: number }>;
}

export type TemporalGrouping = 'year' | 'month' | 'week';
