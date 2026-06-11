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
  _months?: number[],
  _days?: number[],
) {
  const [completeness, setCompleteness] = useState<Epi.DataCompletenessGroup[]>([]);
  const [completenessTrend, setCompletenessTrend] = useState<Epi.CompletenessTrendPoint[]>([]);
  const [qualityByUnit, setQualityByUnit] = useState<Epi.UnitQualityScore[]>([]);
  const [qualityByBairro, setQualityByBairro] = useState<Epi.BairroQualityScore[]>([]);
  const [qualityByLaboratory, setQualityByLaboratory] = useState<Epi.LaboratorioQualityScore[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Epi.LogicalInconsistency[]>([]);
  const [timelinessFlow, setTimelinessFlow] = useState<Epi.TimelinessFlow>({
    nodes: [],
    links: [],
    kpis: [],
    total_cases: 0,
  });
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
          setQualityByBairro(data.quality_by_bairro || []);
          setQualityByLaboratory(data.quality_by_laboratory || []);
          setInconsistencies(data.inconsistencies || []);
          setTimelinessFlow(
            data.timeliness_flow || { nodes: [], links: [], kpis: [], total_cases: 0 },
          );
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
    qualityByBairro,
    qualityByLaboratory,
    inconsistencies,
    timelinessFlow,
    loading,
  };
}
