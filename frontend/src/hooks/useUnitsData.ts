import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useUnitsData(
  active: boolean,
  swimmerVirus: 'covid' | 'gripe',
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
    'unitsData',
    active,
    swimmerVirus,
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
    queryFn: async () => {
      if (active) {
        const [unitsData, flowData, hospData, timeline] = await Promise.all([
          api.fetchUnits(
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
          api.fetchClinicalFlow(
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
          api.fetchHospitalizationDuration(
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
          api.fetchTimelineAgg(
            swimmerVirus,
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
        ]);
        return { unitsData, flowData, hospData, timeline };
      } else {
        const unitsData = await api.fetchUnits(
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
        );
        return { unitsData, flowData: { nodes: [], links: [] }, hospData: null, timeline: [] };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    units: data?.unitsData || [],
    clinicalFlow: data?.flowData || { nodes: [], links: [] },
    hospitalization: data?.hospData || null,
    timelineData: data?.timeline || [],
    loading: isLoading,
  };
}
