import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import PiramideEtariaChart from '../../../../src/components/charts/PiramideEtariaChart';

describe('PiramideEtariaChart', () => {
  it('renders without crashing', () => {
    render(<PiramideEtariaChart data={[{ age_band: '0-9', male: 20, female: 18 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
