import { useEffect, useState } from 'react';
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
  years?: number[],
  maternal?: string[],
  occupations?: string[],
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
          api.fetchUnits(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            undefined,
            maternal,
            occupations,
          ),
          api.fetchClinicalFlow(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            undefined,
            maternal,
            occupations,
          ),
          api.fetchHospitalizationDuration(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            undefined,
            maternal,
            occupations,
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
            undefined,
            maternal,
            occupations,
          ),
          api.fetchIcuBottleneck(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            undefined,
            maternal,
            occupations,
          ),
        ]);

        if (isMounted) {
          setUnits(unitsData);
          setClinicalFlow(flowData);
          setHospitalization(hospData);
          setTimelineData(timeline);
          setIcuBottleneck(bottleneck);
        }
      } catch (error) {
        console.error('Failed to load units data', error);
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
    swimmerVirus,
    profile,
    raceFilter,
    genderFilter,
    zoneFilter,
    bairroFilter,
    unitFilter,
    years,
    maternal,
    occupations,
  ]);

  return { units, clinicalFlow, hospitalization, timelineData, icuBottleneck, loading };
}
