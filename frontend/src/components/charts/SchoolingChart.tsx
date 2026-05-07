import React from 'react';
import { COLORS } from '../../constants';
import * as Epi from '../../types/epi';
import { useChartJs } from '../../hooks/useChartJs';

interface SchoolingChartProps {
  data: Epi.CitizenBootstrap['schooling_profile'];
}

const SchoolingChart: React.FC<SchoolingChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((x) => x.label),
        datasets: [{
          data: data.map((x) => x.count),
          backgroundColor: COLORS.PRIMARY,
          borderRadius: 7,
        }],
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
              callback: (value: string | number) => {
                const label = String(value);
                return label.length > 15 ? label.substring(0, 15) + '...' : label;
              },
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
