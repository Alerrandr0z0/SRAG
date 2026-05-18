import type { ForecastEntry } from '../types/epi';

/**
 * Computes the cumulative sum of a numeric array.
 */
export function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => {
    sum += Number(v || 0);
    return sum;
  });
}

/**
 * Builds confidence bands for forecasting charts.
 */

export function buildBand(
  labels: string[],
  forecast: ForecastEntry[],
  histLen: number,
  seriesMode: string,
  histLast = 0,
) {
  const lower = labels.map(() => null as number | null);
  const upper = labels.map(() => null as number | null);

  for (let i = histLen; i < labels.length; i += 1) {
    const f = forecast[i - histLen];
    if (!f) continue;
    lower[i] = f.predicted_cases_lower;
    upper[i] = f.predicted_cases_upper;
  }

  if (seriesMode === 'cumulative') {
    const lowRaw = forecast.map((f) => f.predicted_cases_lower);
    const upRaw = forecast.map((f) => f.predicted_cases_upper);
    const lowCum = cumulative(lowRaw).map((v) => v + histLast);
    const upCum = cumulative(upRaw).map((v) => v + histLast);

    return {
      lower: labels.map((_, i) => (i < histLen ? null : (lowCum[i - histLen] ?? null))),
      upper: labels.map((_, i) => (i < histLen ? null : (upCum[i - histLen] ?? null))),
    };
  }

  return { lower, upper };
}
