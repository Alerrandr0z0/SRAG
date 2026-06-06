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
  agents?: string[],
  maternal?: string[],
  occupations?: string[],
  _months?: number[],
  _days?: number[],
) {
  const [units, setUnits] = useState<Epi.UnitStats[]>([]);
  const [clinicalFlow, setClinicalFlow] = useState<Epi.ClinicalFlow>({ nodes: [], links: [] });
  const [hospitalization, setHospitalization] = useState<Epi.HospitalizationDurationData | null>(
    null,
  );
  const [timelineData, setTimelineData] = useState<Epi.AggregatedTimeline[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        if (active) {
          const [unitsData, flowData, hospData, timeline] = await Promise.all([
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
              agents,
              maternal,
              occupations,
            ),
          ]);

          if (isMounted) {
            setUnits(unitsData);
            setClinicalFlow(flowData);
            setHospitalization(hospData);
            setTimelineData(timeline);
          }
        } else {
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
          );
          if (isMounted) {
            setUnits(unitsData);
          }
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
    agents,
    maternal,
    occupations,
  ]);

  return { units, clinicalFlow, hospitalization, timelineData, loading };
}
