import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import BairrosChart from '../../../../src/components/charts/BairrosChart';

describe('BairrosChart', () => {
  it('renders without crashing', () => {
    render(<BairrosChart data={[{ bairro: 'Centro', count: 140 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
