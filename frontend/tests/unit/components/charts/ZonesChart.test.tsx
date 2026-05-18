import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ZonesChart from '../../../../src/components/charts/ZonesChart';

describe('ZonesChart', () => {
  it('renders without crashing', () => {
    render(<ZonesChart data={[{ zona: 'Urbana', count: 312 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
