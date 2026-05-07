import React from 'react';
import { COLORS } from '../../constants';
import * as Epi from '../../types/epi';
import { useChartJs } from '../../hooks/useChartJs';

interface LabChartProps {
  data: Epi.LaboratoryNetwork['labs'];
}

const LabChart: React.FC<LabChartProps> = ({ data }) => {
  const items = data.slice(0, 10);
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: items.map((l) => l.LAB_REF || l.lab_ref),
        datasets: [{
          data: items.map((l) => l.tested_cases),
          backgroundColor: COLORS.SECONDARY,
          borderRadius: 8,
        }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }),
    [items],
  );

  return <canvas ref={canvasRef} />;
};

export default LabChart;
