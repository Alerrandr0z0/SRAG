import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useUnitsData(active: boolean) {
  const [units, setUnits] = useState<Epi.UnitStats[]>([]);
  const [clinicalFlow, setClinicalFlow] = useState<Epi.ClinicalFlow>({ nodes: [], links: [] });
  const [hospitalization, setHospitalization] = useState<number[]>([]);
  const [timelineData, setTimelineData] = useState<Epi.AggregatedTimeline[]>([]);
  const [icuBottleneck, setIcuBottleneck] = useState<Epi.IcuBottleneckRecord[]>([]);
  const [swimmerVirus, setSwimmerVirus] = useState<'covid' | 'gripe'>('covid');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [unitsData, flowData, hospData, timeline, bottleneck] = await Promise.all([
          api.fetchUnits(),
          api.fetchClinicalFlow(),
          api.fetchHospitalizationDuration(),
          api.fetchTimelineAgg(swimmerVirus),
          api.fetchIcuBottleneck()
        ]);
        
        if (isMounted) {
          setUnits(unitsData);
          setClinicalFlow(flowData);
          setHospitalization(hospData);
          setTimelineData(timeline);
          setIcuBottleneck(bottleneck);
        }
      } catch (error) {
        console.error("Failed to load units data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [active, swimmerVirus]);

  return { units, clinicalFlow, hospitalization, timelineData, icuBottleneck, swimmerVirus, setSwimmerVirus, loading };
}
