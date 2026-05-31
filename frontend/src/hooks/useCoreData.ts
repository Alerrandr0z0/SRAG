import { useEffect, useState } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

interface CoreDataState {
  summary: Epi.SummaryData | null;
  trends: Epi.TrendsData | null;
  virus: Epi.VirusData[] | null;
  laboratoryNetwork?: Epi.LaboratoryNetwork;
}

type CoreStatus = 'loading' | 'online' | 'offline';

export function useCoreData(
  weeksWindow: string,
  lookback: string,
  virusDetail: string,
  profile?: string[],
  raceFilter?: string[],
  genderFilter?: string[],
  zoneFilter?: string[],
  bairroFilter?: string[],
  unitFilter?: string[],
  years?: number[],
  agents?: string[],
  maternal?: string[],
  occupations?: string[],
  _months?: number[],
  _days?: number[],
) {
  const [data, setData] = useState<CoreDataState | null>(null);
  const [status, setStatus] = useState<CoreStatus>('loading');
  const [lastUpdateIso, setLastUpdateIso] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCore() {
      try {
        setError('');
        setStatus('loading');

        const [summary, trends, virus, lab] = await Promise.all([
          api.fetchSummary(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternal,
            occupations,
          ),
          api.fetchTrends(
            weeksWindow,
            lookback,
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternal,
            occupations,
          ),
          api.fetchVirus(
            virusDetail,
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternal,
            occupations,
          ),
          api.fetchLaboratoryNetwork(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternal,
            occupations,
          ),
        ]);

        if (!active) return;

        setData({
          summary,
          trends,
          virus,
          laboratoryNetwork: lab,
        });

        setStatus('online');
        setLastUpdateIso(new Date().toISOString());
      } catch {
        if (!active) return;
        setStatus('offline');
        setError('Falha ao consultar API');
      }
    }

    loadCore();
    return () => {
      active = false;
    };
  }, [
    weeksWindow,
    lookback,
    virusDetail,
    profile,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    years,
    agents,
    maternal,
    occupations,
  ]);

  return { data, setData, status, setStatus, lastUpdateIso, error, setError };
}
