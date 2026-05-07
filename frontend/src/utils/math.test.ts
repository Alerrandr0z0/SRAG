import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildBand, cumulative } from './math';

describe('math helpers', () => {
  it('cumulative is monotonic for non-negative values', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 30 }), (values) => {
        const result = cumulative(values);
        for (let i = 1; i < result.length; i += 1) {
          expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
        }
      }),
    );
  });

  it('buildBand preserves forecast bounds in weekly mode', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 12 }),
        fc.array(
          fc.record({
            epi_week: fc.string({ minLength: 1, maxLength: 8 }),
            predicted_cases: fc.integer({ min: 0, max: 500 }),
            predicted_cases_lower: fc.integer({ min: 0, max: 500 }),
            predicted_cases_upper: fc.integer({ min: 0, max: 600 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        fc.integer({ min: 0, max: 6 }),
        (labels, forecast, histLen) => {
          const band = buildBand(labels, forecast, Math.min(histLen, labels.length), 'weekly', 0);
          expect(band.lower.length).toBe(labels.length);
          expect(band.upper.length).toBe(labels.length);
        },
      ),
    );
  });
});
