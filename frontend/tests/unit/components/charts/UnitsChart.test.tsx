import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UnitsChart from '../../../../src/components/charts/UnitsChart';

describe('UnitsChart', () => {
  it('renders without crashing', () => {
    render(<UnitsChart data={[{ id_unidade: 'UPA Centro', count: 120 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
