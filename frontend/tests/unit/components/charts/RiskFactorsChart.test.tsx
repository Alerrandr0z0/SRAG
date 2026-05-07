import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import RiskFactorsChart from '../../../../src/components/charts/RiskFactorsChart';

describe('RiskFactorsChart', () => {
  it('renders without crashing', () => {
    render(<RiskFactorsChart data={[{ factor: 'Hipertensão', count: 120 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
