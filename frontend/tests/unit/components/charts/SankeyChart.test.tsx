import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../../src/hooks/useEcharts', () => ({
  useEcharts: () => ({ chartRef: { current: null }, chartInstance: { current: null } }),
}));

import SankeyChart from '../../../../src/components/charts/SankeyChart';

describe('SankeyChart', () => {
  it('renders without crashing', () => {
    render(
      <SankeyChart
        nodes={[{ name: 'Comunitária' }, { name: 'Cura' }]}
        links={[{ source: 'Comunitária', target: 'Cura', value: 10, pct: 100 }]}
      />,
    );
    expect(document.querySelector('.echart-host')).toBeTruthy();
  });
});
