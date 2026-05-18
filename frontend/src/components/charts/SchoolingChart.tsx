import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface SchoolingChartProps {
  data: Epi.CitizenBootstrap['schooling_profile'];
}

const SchoolingChart: React.FC<SchoolingChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((x) => x.label),
        datasets: [
          {
            data: data.map((x) => x.count),
            backgroundColor: COLORS.PRIMARY,
            borderRadius: 7,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        layout: {
          padding: { left: 10, right: 20 },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c: { raw: unknown }) => `Casos: ${c.raw}`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { display: false } },
          y: {
            ticks: {
              font: { size: 10 },
            },
          },
        },
      },
    }),
    [data],
  );

  return <canvas ref={canvasRef} />;
};

export default SchoolingChart;
