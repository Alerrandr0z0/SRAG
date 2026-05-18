import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SchoolingChart from '../../../../src/components/charts/SchoolingChart';

describe('SchoolingChart', () => {
  it('renders without crashing', () => {
    render(<SchoolingChart data={[{ label: 'Ensino Médio', count: 142 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
