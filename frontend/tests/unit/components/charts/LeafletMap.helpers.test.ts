import { describe, expect, it } from 'vitest';
import {
  formatRangeValue,
  getChoroplethStyle,
} from '../../../../src/components/charts/LeafletMap.helpers';

describe('LeafletMap helpers', () => {
  it('formats range values with pt-BR separators', () => {
    expect(formatRangeValue(1234)).toBe('1.234');
  });

  it('raises emphasis for hovered values', () => {
    const normal = getChoroplethStyle({
      count: 10,
      rangeMin: 0,
      rangeMax: 20,
      hoverValue: null,
      theme: 'light',
      colorForCount: '#ff0000',
    });

    const hovered = getChoroplethStyle({
      count: 10,
      rangeMin: 0,
      rangeMax: 20,
      hoverValue: 10,
      theme: 'light',
      colorForCount: '#ff0000',
    });

    expect(hovered.weight).toBeGreaterThan(normal.weight);
    expect(hovered.fillOpacity).toBeGreaterThan(normal.fillOpacity);
  });
});
