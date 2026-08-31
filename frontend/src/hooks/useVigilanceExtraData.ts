import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useVigilanceExtraData(
  active: boolean,
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
  schooling?: string[],
  riskFactors?: string[],
  months?: number[],
  days?: number[],
) {
  const queryKey = [
    'vigilanceExtra',
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
    schooling,
    riskFactors,
    months,
    days,
  ];

  const diagQuery = useQuery({
    queryKey: [...queryKey, 'diagResilience'],
    queryFn: () =>
      api.fetchDiagnosticResilience(
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
        schooling,
        riskFactors,
        months,
        days,
      ),
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });

  const nosoQuery = useQuery({
    queryKey: [...queryKey, 'nosocomialRisk'],
    queryFn: () =>
      api.fetchNosocomialRisk(
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
        schooling,
        riskFactors,
        months,
        days,
      ),
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });

  return {
    diagResData: diagQuery.data || null,
    diagResLoading: diagQuery.isLoading,
    nosoRiskData: nosoQuery.data || null,
    nosoRiskLoading: nosoQuery.isLoading,
  };
}
