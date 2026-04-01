import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useTerritoryData(active: boolean, mapZoneMode: string) {
  const [territory, setTerritory] = useState<Epi.TerritoryBootstrap['territory']>({ bairros: [], zonas: [] });
  const [boundary, setBoundary] = useState<any>(null);
  const [choropleth, setChoropleth] = useState<Epi.TerritoryBootstrap['choropleth'] | null>(null);
  const [ruralData, setRuralData] = useState<{ sectors: any[]; center: any } | null>(null);
  const [ruralSectorsGeo, setRuralSectorsGeo] = useState<any>(null);
  const [entities, setEntities] = useState<Epi.TerritoryBootstrap['territory_entities']>({ urban_bairros: [], rural_comunidades: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let isMounted = true;
    
    async function loadBootstrap() {
      setLoading(true);
      try {
        const bootstrap = await api.fetchTerritoryBootstrap();
        if (isMounted) {
          setTerritory(bootstrap.territory);
          setBoundary(bootstrap.boundary);
          setChoropleth(bootstrap.choropleth);
          setEntities(bootstrap.territory_entities);
        }
      } catch (e) {
        console.error("Failed to load territory bootstrap", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadBootstrap();
    return () => { isMounted = false; };
  }, [active]);

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
           setRuralData(points);
           setRuralSectorsGeo(geo);
         }
      } catch (e) {
        console.error("Failed to load rural data", e);
        if (isMounted) {
          setRuralData(null);
          setRuralSectorsGeo(null);
        }
      }
    }
    loadRuralData();
    return () => { isMounted = false; };
  }, [active]);

  return { territory, boundary, choropleth, ruralData, ruralSectorsGeo, entities, loading };
}
