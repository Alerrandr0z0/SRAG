import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';
import * as Epi from '../../types/epi';

interface RiskFactorsChartProps {
  data: Epi.CitizenBootstrap['risk_factors_full'];
}

const RiskFactorsChart: React.FC<RiskFactorsChartProps> = ({ data }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((x) => x.factor),
        datasets: [
          {
            data: data.map((x) => x.count),
            backgroundColor: COLORS.ACCENT,
            borderRadius: 7,
          },
        ],
      },
      options: {
        indexAxis: 'x',
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        layout: {
          padding: { top: 10, bottom: 0, left: 0, right: 0 },
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
          y: { beginAtZero: true, grid: { display: true } },
          x: {
            ticks: {
              font: { size: 9 },
              maxRotation: 45,
              minRotation: 45,
              callback: (value: string | number) => {
                const label = String(value);
                return label.length > 12 ? `${label.substring(0, 12)}...` : label;
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

export default RiskFactorsChart;
