import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useTerritoryData(active: boolean, mapZoneMode: string) {
  const [territory, setTerritory] = useState<Epi.TerritoryBootstrap['territory']>({ bairros: [], zonas: [] });
  const [boundary, setBoundary] = useState<any>(null);
  const [choropleth, setChoropleth] = useState<Epi.TerritoryBootstrap['choropleth'] | null>(null);
  const [macroPoints, setMacroPoints] = useState<Record<string, { available: boolean; points: any[] }>>({ 
    Rural: { available: false, points: [] }, 
    Periurbana: { available: false, points: [] } 
  });
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
    if (!active || mapZoneMode === 'Urbana') return;
    const modeKey = mapZoneMode === 'Rural' ? 'Rural' : 'Periurbana';
    if (macroPoints[modeKey]?.available) return;

    let isMounted = true;
    async function loadPoints() {
      try {
        const points = await api.fetchMacrosectorPoints(modeKey);
        if (isMounted) {
          setMacroPoints(prev => ({ ...prev, [modeKey]: points }));
        }
      } catch (e) {
        console.error("Failed to load macro points", e);
      }
    }
    loadPoints();
    return () => { isMounted = false; };
  }, [active, mapZoneMode]);

  return { territory, boundary, choropleth, macroPoints, entities, loading };
}
