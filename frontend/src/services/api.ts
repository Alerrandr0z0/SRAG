import { API_ENDPOINTS } from '../constants';
import * as Epi from '../types/epi';
import type { FeatureCollection } from 'geojson';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} at ${url}`);
  }
  return response.json();
}

function withFilters(
  baseUrl: string,
  profile?: string[],
  raceFilter?: string[],
  genderFilter?: string[],
  zoneFilter?: string[],
  bairroFilter?: string[],
  unitFilter?: string[],
  years?: number[],
  agents?: string[],
  maternal?: string[],
  occupations?: string[]
) {
  const params = new URLSearchParams(baseUrl.includes('?') ? baseUrl.split('?')[1] : '');
  const base = baseUrl.split('?')[0];

  if (profile) profile.forEach(p => params.append('profile', p));
  if (raceFilter) raceFilter.forEach(r => params.append('race', r));
  if (genderFilter) genderFilter.forEach(g => params.append('gender', g));
  if (zoneFilter) zoneFilter.forEach(z => params.append('zonas', z));
  if (bairroFilter) bairroFilter.forEach(b => params.append('bairros', b));
  if (unitFilter) unitFilter.forEach(u => params.append('unidades', u));
  if (years) years.forEach(y => params.append('years', String(y)));
  if (agents) agents.forEach(a => params.append('agents', a));
  if (maternal) maternal.forEach(m => params.append('maternal', m));
  if (occupations) occupations.forEach(o => params.append('occupations', o));

  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export const api = {
  fetchSummary: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.SummaryData>(withFilters(`${API_BASE}${API_ENDPOINTS.SUMMARY}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchTrends: (weeksWindow: string, lookback: string, p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.TrendsData>(withFilters(`${API_BASE}${API_ENDPOINTS.TRENDS}?last_n_weeks=${weeksWindow}&weeks_to_predict=4&lookback_weeks=${lookback}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchVirus: (detailLevel: string, p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.VirusData[]>(withFilters(`${API_BASE}${API_ENDPOINTS.VIRUS}?detail_level=${detailLevel}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchTerritoryBootstrap: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.TerritoryBootstrap>(withFilters(`${API_BASE}${API_ENDPOINTS.TERRITORY_BOOTSTRAP}?min_cases=5&entities_min_cases=3&entities_limit=40`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchUnits: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.UnitStats[]>(withFilters(`${API_BASE}${API_ENDPOINTS.UNITS}?min_cases=3`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchClinicalFlow: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.ClinicalFlow>(withFilters(`${API_BASE}${API_ENDPOINTS.CLINICAL_FLOW}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchHospitalizationDuration: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<number[]>(withFilters(`${API_BASE}${API_ENDPOINTS.HOSPITALIZATION_DURATION}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchCitizenBootstrap: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.CitizenBootstrap>(withFilters(`${API_BASE}${API_ENDPOINTS.CITIZEN_BOOTSTRAP}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchVaccinationProfile: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.VaccinationProfile>(withFilters(`${API_BASE}${API_ENDPOINTS.VACCINATION_PROFILE}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchVaccineSurvival: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.VaccineSurvival>(withFilters(`${API_BASE}${API_ENDPOINTS.VACCINE_SURVIVAL}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchTimelineAgg: (virus: string = "covid", p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.AggregatedTimeline[]>(withFilters(`${API_BASE}/timeline_agg?virus=${virus}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchIcuBottleneck: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.IcuBottleneckRecord[]>(withFilters(`${API_BASE}/icu_bottleneck`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchDataCompleteness: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.DataCompletenessGroup[]>(withFilters(`${API_BASE}/data_completeness`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchLaboratoryNetwork: (p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.LaboratoryNetwork>(withFilters(`${API_BASE}${API_ENDPOINTS.LABORATORY_NETWORK}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchOccupations: (years?: number[], zonas?: string[], bairros?: string[]) =>
    fetchJson<Array<{ label: string; count: number }>>(withFilters(`${API_BASE}/occupations?limit=60`, undefined, undefined, undefined, zonas, bairros, undefined, years)),

  fetchContextTrends: (key: string, weeksWindow: string, lookback: string, p?: string[], r?: string[], g?: string[], z?: string[], b?: string[], u?: string[], years?: number[], agents?: string[], m?: string[], occ?: string[]) =>
    fetchJson<Epi.TrendsData>(withFilters(`${API_BASE}${API_ENDPOINTS.CONTEXT_TRENDS}?key=${encodeURIComponent(key)}&last_n_weeks=${weeksWindow}&weeks_to_predict=4&lookback_weeks=${lookback}`, p, r, g, z, b, u, years, agents, m, occ)),

  fetchMacrosectorPoints: (zone: string) =>
    fetchJson<{ available: boolean, points: Array<{ lat: number; lon: number; count: number }> }>(`${API_BASE}${API_ENDPOINTS.MACROSECTOR_HEATPOINTS}?zone=${encodeURIComponent(zone)}&min_cases=1`),

  fetchRuralHeatpoints: () =>
    fetchJson<{ available: boolean; sectors: Array<{ sector: string; count: number }>; center: { lat: number; lon: number } }>(`${API_BASE}/geo/rural_heatpoints?min_cases=1`),

  fetchRuralSectorsGeo: () =>
    fetchJson<FeatureCollection>(`${API_BASE}/geo/rural_sectors`),
};
