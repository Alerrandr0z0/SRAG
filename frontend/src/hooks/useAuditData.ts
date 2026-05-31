import { useEffect, useState } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

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
) {
  const [completeness, setCompleteness] = useState<Epi.DataCompletenessGroup[]>([]);
  const [completenessTrend, setCompletenessTrend] = useState<Epi.CompletenessTrendPoint[]>([]);
  const [qualityByUnit, setQualityByUnit] = useState<Epi.UnitQualityScore[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Epi.LogicalInconsistency[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await api.fetchAuditBootstrap(
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
          setCompleteness(data.completeness || []);
          setCompletenessTrend(data.completeness_trend || []);
          setQualityByUnit(data.quality_by_unit || []);
          setInconsistencies(data.inconsistencies || []);
        }
      } catch (error) {
        console.error('Failed to load audit data', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [
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
  ]);

  return {
    completeness,
    completenessTrend,
    qualityByUnit,
    inconsistencies,
    loading,
  };
}
