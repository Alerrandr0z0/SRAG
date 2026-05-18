import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface VirusProfileChartProps {
  data: Epi.VirusData[];
}

const VirusProfileChart: React.FC<VirusProfileChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'doughnut',
      data: {
        labels: data.map((d) => d.virus),
        datasets: [
          {
            data: data.map((d) => d.count),
            backgroundColor: COLORS.CHART,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    }),
    [data],
  );

  return <canvas ref={canvasRef} />;
};

export default VirusProfileChart;
