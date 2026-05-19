import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/hooks/useEcharts', () => ({
  useEcharts: () => ({ chartRef: () => {} }),
}));

import TrendChart from '../../../../src/components/charts/TrendChart';

describe('TrendChart', () => {
  it('renders without crashing', () => {
    render(
      <TrendChart
        history={[{ epi_week: '2024-W01', total: 120 }]}
        forecast={[
          {
            epi_week: '2024-W02',
            predicted_cases: 130,
            predicted_cases_lower: 110,
            predicted_cases_upper: 150,
          },
        ]}
        thresholds={{ medium: 100, high: 140, very_high: 180 }}
        composition={[]}
        baseCumulative={0}
        seriesMode="weekly"
      />,
    );
    expect(document.querySelector('div')).toBeTruthy();
  });
});
