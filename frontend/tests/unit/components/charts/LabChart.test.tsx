import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LabChart from '../../../../src/components/charts/LabChart';

describe('LabChart', () => {
  it('renders without crashing', () => {
    render(<LabChart data={[{ lab_ref: 'LACEN', tested_cases: 420 }]} />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
