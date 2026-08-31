import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useAuditData(
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
  _months?: number[],
  _days?: number[],
) {
  const queryKey = [
    'auditData',
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
  ];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.fetchAuditBootstrap(
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
        _months,
        _days,
      ),
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });

  return {
    completeness: data?.completeness || [],
    completenessTrend: data?.completeness_trend || [],
    qualityByUnit: data?.quality_by_unit || [],
    qualityByBairro: data?.quality_by_bairro || [],
    qualityByLaboratory: data?.quality_by_laboratory || [],
    inconsistencies: data?.inconsistencies || [],
    timelinessFlow: data?.timeliness_flow || { nodes: [], links: [], kpis: [], total_cases: 0 },
    loading: isLoading && active,
  };
}
