import { useQuery } from '@tanstack/react-query';
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
  const queryKey = [
    'coreData',
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
  ];

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<CoreDataState>({
    queryKey,
    queryFn: async () => {
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
      return { summary, trends, virus, laboratoryNetwork: lab };
    },
    staleTime: 5 * 60 * 1000,
  });

  const status: CoreStatus = isLoading ? 'loading' : isError ? 'offline' : 'online';
  const error = isError ? 'Falha ao consultar API' : '';
  const lastUpdateIso = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null;

  return {
    data: data || null,
    status,
    lastUpdateIso,
    error,
  };
}
