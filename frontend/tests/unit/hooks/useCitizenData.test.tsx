import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const apiMocks = vi.hoisted(() => ({
  fetchCitizenBootstrap: vi.fn(async () => ({
    citizen_profiles: { macro_profiles: [] },
    citizen_pyramid: [],
    race_profile: [],
    schooling_profile: [],
    occupation_profile: [],
    animal_contact: [],
    traditional_communities: [],
    symptoms_signature: null,
    risk_factors_full: [],
    maternal_profile: null,
  })),
  fetchVaccinationProfile: vi.fn(async () => ({
    gripe: {},
    covid_detailed: {},
    manufacturers: [],
  })),
  fetchVaccineSurvival: vi.fn(async () => ({ covid: {}, gripe: {} })),
  fetchTimelineAgg: vi.fn(async () => []),
}));

vi.mock('../../../src/services/api', () => ({
  api: {
    fetchCitizenBootstrap: apiMocks.fetchCitizenBootstrap,
    fetchVaccinationProfile: apiMocks.fetchVaccinationProfile,
    fetchVaccineSurvival: apiMocks.fetchVaccineSurvival,
    fetchTimelineAgg: apiMocks.fetchTimelineAgg,
  },
}));

import { useCitizenData } from '../../../src/hooks/useCitizenData';

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCitizenData', () => {
  it('forwards agents to fetchTimelineAgg', async () => {
    renderHook(() => useCitizenData(true, [], [], [], [], [], [], [2024], ['Influenza'], [], []), {
      wrapper,
    });

    await waitFor(() => expect(apiMocks.fetchTimelineAgg).toHaveBeenCalled());
    expect(apiMocks.fetchTimelineAgg).toHaveBeenCalledWith(
      'covid',
      [],
      [],
      [],
      [],
      [],
      [],
      [2024],
      ['Influenza'],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
