import { useEffect, useState } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

export function useCitizenData(
  active: boolean,
  profile: string[],
  raceFilter: string[],
  genderFilter: string[],
  zoneFilter?: string[],
  bairroFilter?: string[],
  unitFilter?: string[],
  years?: number[],
  agents?: string[],
  maternalFilter?: string[],
  occupationFilter?: string[],
) {
  const [profiles, setProfiles] = useState<Epi.CitizenProfile[]>([]);
  const [pyramid, setPyramid] = useState<Epi.PyramidRow[]>([]);
  const [raceProfile, setRaceProfile] = useState<Epi.CitizenBootstrap['race_profile']>([]);
  const [schooling, setSchooling] = useState<Epi.CitizenBootstrap['schooling_profile']>([]);
  const [occupation, setOccupation] = useState<Epi.CitizenBootstrap['occupation_profile']>([]);
  const [animalContact, setAnimalContact] = useState<Epi.CitizenBootstrap['animal_contact']>([]);
  const [traditionalCommunities, setTraditionalCommunities] = useState<
    Epi.CitizenBootstrap['traditional_communities']
  >([]);
  const [symptomsSignature, setSymptomsSignature] = useState<Epi.SymptomSignature | null>(null);
  const [riskFactors, setRiskFactors] = useState<Epi.CitizenBootstrap['risk_factors_full']>([]);
  const [maternalProfile, setMaternalProfile] = useState<
    Epi.CitizenBootstrap['maternal_profile'] | null
  >(null);
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
          api.fetchCitizenBootstrap(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternalFilter,
            occupationFilter,
          ),
          api.fetchVaccinationProfile(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternalFilter,
            occupationFilter,
          ),
          api.fetchVaccineSurvival(
            profile,
            raceFilter,
            genderFilter,
            zoneFilter,
            bairroFilter,
            unitFilter,
            years,
            agents,
            maternalFilter,
            occupationFilter,
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
            maternalFilter,
            occupationFilter,
          ),
        ]);

        if (isMounted) {
          setProfiles(bootstrap.citizen_profiles?.macro_profiles || []);
          setPyramid(bootstrap.citizen_pyramid || []);
          setRaceProfile(bootstrap.race_profile || []);
          setSchooling(bootstrap.schooling_profile || []);
          setOccupation(bootstrap.occupation_profile || []);
          setAnimalContact(bootstrap.animal_contact || []);
          setTraditionalCommunities(bootstrap.traditional_communities || []);
          setSymptomsSignature(bootstrap.symptoms_signature || null);
          setRiskFactors(bootstrap.risk_factors_full || []);
          setMaternalProfile(bootstrap.maternal_profile || null);
          setVaccination(vaccine);
          setSurvival(survivalData);
          setTimelineData(timeline);
        }
      } catch (error) {
        console.error('Failed to load citizen data', error);
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
    swimmerVirus,
    zoneFilter,
    bairroFilter,
    unitFilter,
    years,
    agents,
    maternalFilter,
    occupationFilter,
  ]);

  return {
    profiles,
    pyramid,
    raceProfile,
    schooling,
    occupation,
    animalContact,
    traditionalCommunities,
    symptomsSignature,
    riskFactors,
    maternalProfile,
    vaccination,
    survival,
    timelineData,
    swimmerVirus,
    setSwimmerVirus,
    loading,
  };
}
