import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useCitizenData(active: boolean, profile: string[], raceFilter: string[]) {
  const [profiles, setProfiles] = useState<Epi.CitizenProfile[]>([]);
  const [pyramid, setPyramid] = useState<Epi.PyramidRow[]>([]);
  const [raceProfile, setRaceProfile] = useState<Epi.CitizenBootstrap['race_profile']>([]);
  const [schooling, setSchooling] = useState<Epi.CitizenBootstrap['schooling_profile']>([]);
  const [symptomsSignature, setSymptomsSignature] = useState<Epi.SymptomSignature | null>(null);
  const [riskFactors, setRiskFactors] = useState<Epi.CitizenBootstrap['risk_factors_full']>([]);
  const [vaccination, setVaccination] = useState<Epi.VaccinationProfile | null>(null);
  const [survival, setSurvival] = useState<Epi.VaccineSurvival | null>(null);
  const [timelineData, setTimelineData] = useState<Epi.AggregatedTimeline[]>([]);
  const [swimmerVirus, setSwimmerVirus] = useState<'covid' | 'gripe'>('covid');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [bootstrap, vaccine, survivalData, timeline] = await Promise.all([
          api.fetchCitizenBootstrap(profile, raceFilter),
          api.fetchVaccinationProfile(profile, raceFilter),
          api.fetchVaccineSurvival(profile, raceFilter),
          api.fetchTimelineAgg(swimmerVirus, profile, raceFilter)
        ]);
        
        if (isMounted) {
          setProfiles(bootstrap.citizen_profiles?.macro_profiles || []);
          setPyramid(bootstrap.citizen_pyramid || []);
          setRaceProfile(bootstrap.race_profile || []);
          setSchooling(bootstrap.schooling_profile || []);
          setSymptomsSignature(bootstrap.symptoms_signature || null);
          setRiskFactors(bootstrap.risk_factors_full || []);
          setVaccination(vaccine);
          setSurvival(survivalData);
          setTimelineData(timeline);
        }
      } catch (error) {
        console.error("Failed to load citizen data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [active, profile, raceFilter, swimmerVirus]);

  return { 
    profiles, pyramid, raceProfile, schooling, 
    symptomsSignature, riskFactors, vaccination, survival, 
    timelineData, swimmerVirus, setSwimmerVirus, loading 
  };
}
