import { API_ENDPOINTS } from '../constants';
import * as Epi from '../types/epi';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} at ${url}`);
  }
  return response.json();
}

export const api = {
  fetchSummary: () => 
    fetchJson<Epi.SummaryData>(`${API_BASE}${API_ENDPOINTS.SUMMARY}`),
  
  fetchTrends: (weeksWindow: string, lookback: string) => 
    fetchJson<Epi.TrendsData>(`${API_BASE}${API_ENDPOINTS.TRENDS}?last_n_weeks=${weeksWindow}&weeks_to_predict=4&lookback_weeks=${lookback}`),
  
  fetchVirus: (detailLevel: string) => 
    fetchJson<Epi.VirusData[]>(`${API_BASE}${API_ENDPOINTS.VIRUS}?detail_level=${detailLevel}`),
  
  fetchTerritoryBootstrap: () => 
    fetchJson<Epi.TerritoryBootstrap>(`${API_BASE}${API_ENDPOINTS.TERRITORY_BOOTSTRAP}?min_cases=5&entities_min_cases=3&entities_limit=40`),
  
  fetchUnits: () => 
    fetchJson<Epi.UnitStats[]>(`${API_BASE}${API_ENDPOINTS.UNITS}?min_cases=3`),
  
  fetchClinicalFlow: () => 
    fetchJson<Epi.ClinicalFlow>(`${API_BASE}${API_ENDPOINTS.CLINICAL_FLOW}`),
  
  fetchHospitalizationDuration: () => 
    fetchJson<number[]>(`${API_BASE}${API_ENDPOINTS.HOSPITALIZATION_DURATION}`),
  
  fetchCitizenBootstrap: (profile?: string[], raceFilter?: string[]) => {
    const params = new URLSearchParams();
    if (profile) profile.forEach(p => params.append('profile', p));
    if (raceFilter) raceFilter.forEach(r => params.append('race', r));
    return fetchJson<Epi.CitizenBootstrap>(`${API_BASE}${API_ENDPOINTS.CITIZEN_BOOTSTRAP}?${params.toString()}`);
  },
  
  fetchVaccinationProfile: (profile?: string[], raceFilter?: string[]) => {
    const params = new URLSearchParams();
    if (profile) profile.forEach(p => params.append('profile', p));
    if (raceFilter) raceFilter.forEach(r => params.append('race', r));
    return fetchJson<Epi.VaccinationProfile>(`${API_BASE}${API_ENDPOINTS.VACCINATION_PROFILE}?${params.toString()}`);
  },
  
  fetchVaccineSurvival: (profile?: string[], raceFilter?: string[]) => {
    const params = new URLSearchParams();
    if (profile) profile.forEach(p => params.append('profile', p));
    if (raceFilter) raceFilter.forEach(r => params.append('race', r));
    return fetchJson<Epi.VaccineSurvival>(`${API_BASE}${API_ENDPOINTS.VACCINE_SURVIVAL}?${params.toString()}`);
  },

  fetchTimelineAgg: (virus: string = "covid", profile?: string[], raceFilter?: string[]) => {
    const params = new URLSearchParams();
    params.append('virus', virus);
    if (profile) profile.forEach(p => params.append('profile', p));
    if (raceFilter) raceFilter.forEach(r => params.append('race', r));
    return fetchJson<Epi.AggregatedTimeline[]>(`${API_BASE}/timeline_agg?${params.toString()}`);
  },

  fetchIcuBottleneck: () =>
    fetchJson<Epi.IcuBottleneckRecord[]>(`${API_BASE}/icu_bottleneck`),
  
  fetchLaboratoryNetwork: () => 
    fetchJson<Epi.LaboratoryNetwork>(`${API_BASE}${API_ENDPOINTS.LABORATORY_NETWORK}`),
    
  fetchContextTrends: (key: string, weeksWindow: string, lookback: string) =>
    fetchJson<Epi.TrendsData>(`${API_BASE}${API_ENDPOINTS.CONTEXT_TRENDS}?panel=territorio&key=${encodeURIComponent(key)}&last_n_weeks=${weeksWindow}&weeks_to_predict=4&lookback_weeks=${lookback}`),
    
  fetchMacrosectorPoints: (zone: string) =>
    fetchJson<{ available: boolean, points: any[] }>(`${API_BASE}${API_ENDPOINTS.MACROSECTOR_HEATPOINTS}?zone=${encodeURIComponent(zone)}&min_cases=1`),

  fetchRuralHeatpoints: () =>
    fetchJson<{ available: boolean; sectors: any[]; center: any }>(`${API_BASE}/geo/rural_heatpoints?min_cases=1`),

  fetchRuralSectorsGeo: () =>
    fetchJson<any>(`${API_BASE}/geo/rural_sectors`),
};
