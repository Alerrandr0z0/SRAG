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
  maternal?: string[],
  occupations?: string[],
) {
  const [completeness, setCompleteness] = useState<Epi.DataCompletenessGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await api.fetchDataCompleteness(
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
        );
        if (isMounted) {
          setCompleteness(data);
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
    maternal,
    occupations,
  ]);

  return { completeness, loading };
}
