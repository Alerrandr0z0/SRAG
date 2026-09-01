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
  months?: number[],
  days?: number[],
) {
  const baseQueryKey = [
    'unitsDataBase',
    active,
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

  const timelineQueryKey = [
    'unitsTimeline',
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
    months,
    days,
  ];

  const baseQuery = useQuery({
    queryKey: baseQueryKey,
    queryFn: async () => {
      if (active) {
        const [unitsData, flowData, hospData, labNetwork] = await Promise.all([
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
            months,
            days,
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
            months,
            days,
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
            months,
            days,
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
            schooling,
            riskFactors,
            months,
            days,
          ),
        ]);
        return {
          unitsData,
          flowData,
          hospData,
          delayByUnit: labNetwork.delay_by_unit ?? null,
        };
      }
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
        months,
        days,
      );
      return {
        unitsData,
        flowData: { nodes: [], links: [] },
        hospData: null,
        delayByUnit: null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const timelineQuery = useQuery({
    queryKey: timelineQueryKey,
    queryFn: () =>
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
        months,
        days,
      ),
    enabled: active,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  return {
    units: baseQuery.data?.unitsData || [],
    clinicalFlow: baseQuery.data?.flowData || { nodes: [], links: [] },
    hospitalization: baseQuery.data?.hospData || null,
    timelineData: (timelineQuery.data as never[]) || [],
    delayByUnit:
      (baseQuery.data?.delayByUnit as
        | import('../components/charts/DelayByUnitRidgelinePlot').UnitDelayRecord[]
        | null) ?? null,
    loading: baseQuery.isLoading,
    timelineLoading: timelineQuery.isLoading || timelineQuery.isFetching,
  };
}
