import { useEffect, useState } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

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
  _months?: number[],
  _days?: number[],
) {
  const [territory, setTerritory] = useState<Epi.TerritoryBootstrap['territory']>({
    bairros: [],
    zonas: [],
  });
  const [boundary, setBoundary] = useState<unknown>(null);
  const [choropleth, setChoropleth] = useState<Epi.TerritoryBootstrap['choropleth'] | null>(null);
  const [ruralData, setRuralData] = useState<{
    sectors: Array<{ sector: string; count: number }>;
    points: unknown[];
    center: { lat: number; lon: number } | null;
    urban_points?: Array<{
      codigo_cnes: string;
      label: string;
      count: number;
      latitude?: number | null;
      longitude?: number | null;
      endereco?: string | null;
      zona?: string;
      bairro?: string | null;
    }>;
    urban_center?: { lat: number; lon: number } | null;
  } | null>(null);
  const [ruralSectorsGeo, setRuralSectorsGeo] = useState<unknown>(null);
  const [entities, setEntities] = useState<Epi.TerritoryBootstrap['territory_entities']>({
    urban_bairros: [],
    rural_comunidades: [],
  });
  const [delayByBairro, setDelayByBairro] = useState<Epi.BairroDelayRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBootstrap() {
      setLoading(true);
      try {
        const bootstrap = await api.fetchTerritoryBootstrap(
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
        );
        if (isMounted) {
          setTerritory(bootstrap.territory);
          setBoundary(bootstrap.boundary);
          setChoropleth(bootstrap.choropleth);
          setEntities(bootstrap.territory_entities);
          setDelayByBairro(bootstrap.delay_by_bairro || []);
        }
      } catch (e) {
        console.error('Failed to load territory bootstrap', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadBootstrap();
    return () => {
      isMounted = false;
    };
  }, [
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

  useEffect(() => {
    if (!active) return;
    let isMounted = true;

    async function loadRuralData() {
      try {
        const [points, geo] = await Promise.all([
          api.fetchRuralHeatpoints(),
          api.fetchRuralSectorsGeo(),
        ]);
        if (isMounted) {
          setRuralData({
            sectors: points.points || [],
            points: [],
            center: points.center,
            urban_points: points.urban_points || [],
            urban_center: points.urban_center || null,
          });
          setRuralSectorsGeo(geo);
        }
      } catch (e) {
        console.error('Failed to load rural data', e);
        if (isMounted) {
          setRuralData(null);
          setRuralSectorsGeo(null);
        }
      }
    }
    loadRuralData();
    return () => {
      isMounted = false;
    };
  }, [active]);

  return { territory, boundary, choropleth, ruralData, ruralSectorsGeo, entities, delayByBairro, loading };
}
