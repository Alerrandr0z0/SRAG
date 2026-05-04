import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useUnitsData(
  active: boolean,
  swimmerVirus: 'covid' | 'gripe',
  profile?: string[],
  raceFilter?: string[],
  genderFilter?: string[],
  zoneFilter?: string[],
  bairroFilter?: string[],
  unitFilter?: string[],
  years?: number[]
) {
  const [units, setUnits] = useState<Epi.UnitStats[]>([]);
  const [clinicalFlow, setClinicalFlow] = useState<Epi.ClinicalFlow>({ nodes: [], links: [] });
  const [hospitalization, setHospitalization] = useState<number[]>([]);
  const [timelineData, setTimelineData] = useState<Epi.AggregatedTimeline[]>([]);
  const [icuBottleneck, setIcuBottleneck] = useState<Epi.IcuBottleneckRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;

    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [unitsData, flowData, hospData, timeline, bottleneck] = await Promise.all([
          api.fetchUnits(profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years),
          api.fetchClinicalFlow(profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years),
          api.fetchHospitalizationDuration(profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years),
          api.fetchTimelineAgg(swimmerVirus, profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years),
          api.fetchIcuBottleneck(profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years)
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
  }, [active, swimmerVirus, profile, raceFilter, genderFilter, zoneFilter, bairroFilter, unitFilter, years]);

  return { units, clinicalFlow, hospitalization, timelineData, icuBottleneck, loading };
}
