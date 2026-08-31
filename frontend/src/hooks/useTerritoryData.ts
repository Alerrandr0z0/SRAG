import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useTerritoryData(
  active: boolean,
  _mapZoneMode: string,
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
  const bootstrapQuery = useQuery({
    queryKey: [
      'territoryBootstrap',
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
    ],
    queryFn: () =>
      api.fetchTerritoryBootstrap(
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
    staleTime: 5 * 60 * 1000,
  });

  const ruralQuery = useQuery({
    queryKey: ['territoryRuralData'],
    queryFn: async () => {
      const [points, geo] = await Promise.all([
        api.fetchRuralHeatpoints(),
        api.fetchRuralSectorsGeo(),
      ]);
      return {
        ruralData: {
          sectors: points.points || [],
          points: [],
          center: points.center,
          urban_points: points.urban_points || [],
          urban_center: points.urban_center || null,
        },
        ruralSectorsGeo: geo,
      };
    },
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });

  return {
    territory: bootstrapQuery.data?.territory || { bairros: [], zonas: [] },
    boundary: bootstrapQuery.data?.boundary || null,
    choropleth: bootstrapQuery.data?.choropleth || null,
    entities: bootstrapQuery.data?.territory_entities || {
      urban_bairros: [],
      rural_comunidades: [],
    },
    delayByBairro: bootstrapQuery.data?.delay_by_bairro || [],
    ruralData: ruralQuery.data?.ruralData || null,
    ruralSectorsGeo: ruralQuery.data?.ruralSectorsGeo || null,
    loading: bootstrapQuery.isLoading || (active && ruralQuery.isLoading),
  };
}
