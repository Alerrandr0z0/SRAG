import { describe, it, expect } from 'vitest';
import { cumulative, buildBand } from '../../../src/utils/math';
import type { ForecastEntry } from '../../../src/types/epi';

describe('math utils', () => {
  describe('cumulative', () => {
    it('computes cumulative sum', () => {
      expect(cumulative([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
    });

    it('handles empty array', () => {
      expect(cumulative([])).toEqual([]);
    });

    it('handles single value', () => {
      expect(cumulative([5])).toEqual([5]);
    });

    it('treats null/undefined as 0', () => {
      expect(cumulative([1, null as unknown as number, 2])).toEqual([1, 1, 3]);
    });
  });

  describe('buildBand', () => {
    const labels = ['W1', 'W2', 'W3', 'W4', 'W5'];
    const forecast: ForecastEntry[] = [
      { epi_week: 'W3', predicted_cases: 10, predicted_cases_lower: 8, predicted_cases_upper: 12 },
      { epi_week: 'W4', predicted_cases: 15, predicted_cases_lower: 12, predicted_cases_upper: 18 },
      { epi_week: 'W5', predicted_cases: 20, predicted_cases_lower: 16, predicted_cases_upper: 24 },
    ];

    it('builds forecast bands for weekly mode', () => {
      const result = buildBand(labels, forecast, 2, 'weekly');
      expect(result.lower).toEqual([null, null, 8, 12, 16]);
      expect(result.upper).toEqual([null, null, 12, 18, 24]);
    });

    it('builds cumulative forecast bands', () => {
      const result = buildBand(labels, forecast, 2, 'cumulative', 100);
      expect(result.lower[0]).toBeNull();
      expect(result.lower[1]).toBeNull();
      expect(result.lower[2]).not.toBeNull();
      expect(result.lower[3]).not.toBeNull();
      expect(result.lower[4]).not.toBeNull();
    });

    it('handles empty forecast', () => {
      const result = buildBand(labels, [], 2, 'weekly');
      expect(result.lower).toEqual([null, null, null, null, null]);
      expect(result.upper).toEqual([null, null, null, null, null]);
    });
  });
});
