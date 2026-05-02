export interface SummaryData {
  uti_rate: number;
  uti_total?: number;
  death_rate: number;
  total: number;
  available_years?: number[];
}

export interface VirusData {
  virus: string;
  count: number;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
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
  is_forecast: boolean;
}

export interface TrendsData {
  history: EpiWeekData[];
  forecast: ForecastEntry[];
  thresholds?: { medium: number; high: number; very_high: number };
  composition?: Array<{ epi_week: string; virus: string; count: number }>;
  base_cumulative?: number;
}

export interface VirusStats {
  pathogen: string;
  count: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface UnitStats {
  id_unidade: string;
  count: number;
  uti_rate: number;
  death_rate: number;
}

export interface NeighborhoodStats {
  bairro: string;
  count: number;
  percentage?: number;
}

export interface ZoneStats {
  zona: string;
  count: number;
  percentage?: number;
}

export interface TerritoryDistribution {
  bairros: NeighborhoodStats[];
  zonas: ZoneStats[];
}

export interface TerritoryBootstrap {
  territory: TerritoryDistribution;
  boundary: any;
  choropleth: {
    available: boolean;
    feature_collection: any;
  };
  territory_entities: {
    urban_bairros: Array<{ name: string; count: number }>;
    rural_comunidades: Array<{ name: string; count: number }>;
  };
}

export interface ClinicalFlow {
  nodes: Array<{ name: string }>;
  links: Array<{ source: string; target: string; value: number; pct?: number }>;
}

export interface AggregatedTimeline {
  perfil: string;
  status_key: string;
  mediana_dose_sintoma: number | null;
  mediana_sintoma_internacao: number;
  mediana_internacao_desfecho: number;
  taxa_cura: number;
  taxa_obito: number;
  severity_score: number;
  count: number;
}

export interface IcuBottleneckRecord {
  date: string;
  wait_days: number;
}

export type TemporalGrouping = 'year' | 'month' | 'week';

export interface LaboratoryNetwork {
  labs: Array<{ lab_ref?: string; tested_cases: number; positive_count?: number; positive_rate?: number }>;
  overall: {
    tested_cases: number;
    positive_rate: number;
    median_turnaround_days: number;
  };
  positivity_trend: Array<{ epi_week: string; tested: number; positive: number; positivity_rate: number }>;
  influenza_subtypes: Array<{ label: string; count: number }>;
  antiviral_usage: { adherence_rate: number; total_indicated: number; treated: number };
  closure_criteria: Array<{ label: string; count: number }>;
  notification_delay: Array<{ epi_week: string; median_delay: number }>;
  mortality_by_treatment_agent?: Array<{ treatment: string; agent: string; deaths: number }>;
  genomic_variants?: {
    weeks: string[];
    variants: Record<string, number[]>;
  };
  virus_trends?: Array<{ epi_week: string; virus: string; count: number }>;
  imaging_profile?: {
    raiox: Array<{ label: string; count: number }>;
    tomo: Array<{ label: string; count: number }>;
  };
  serology_profile?: {
    types: Array<{ label: string; count: number }>;
    igg: Array<{ label: string; count: number }>;
    igm: Array<{ label: string; count: number }>;
  };
  antiviral_types?: Array<{ label: string; count: number }>;
  virus_ranking?: Array<{ label: string; count: number }>;
}

export interface PyramidRow {
  age_band: string;
  male: number;
  female: number;
}

export interface VaccinationProfile {
  gripe: Record<string, number>;
  covid_detailed: Record<string, number>;
}

export interface VaccineSurvival {
  covid: { timeline: number[]; survival: number[]; ci_upper: number[]; ci_lower: number[] };
  gripe: { timeline: number[]; survival: number[]; ci_upper: number[]; ci_lower: number[] };
}

export interface CitizenProfile {
  key: string;
  label: string;
  count: number;
  hospital_rate: number;
  uti_rate: number;
  death_rate: number;
  covid_vaccinated_rate: number;
  subprofiles: any[];
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
  race_profile: Array<{ label: string; count: number }>;
  schooling_profile: Array<{ label: string; count: number }>;
  symptoms_signature: SymptomSignature;
  symptoms_heatmap: { labels: string[]; matrix: number[][] };
  risk_factors_full: Array<{ factor: string; count: number; percentage: number }>;
  maternal_profile?: {
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
