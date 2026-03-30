export interface TrendsData {
  history: Array<{ epi_week: string; cases: number }>;
  forecast: Array<{ epi_week: string; predicted_cases: number; lower_ci: number; upper_cases: number }>;
}

export interface VirusStats {
  pathogen: string;
  count: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface UnitStats {
  ID_UNIDADE: string;
  count: number;
  uti_rate: number;
  death_rate: number;
}

export interface TerritoryDistribution {
  bairros: Array<{ BAIRRO_REF: string; count: number; percentage: number }>;
  zonas: Array<{ ZONA: string; count: number; percentage: number }>;
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
  labs: Array<{ lab_ref?: string; tested_cases: number }>;
  overall: {
    tested_cases: number;
    positive_rate: number;
    avg_turnaround_days: number;
  };
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
  risk_factors_full: Array<{ factor: string; count: number; percentage: number }>;
}
