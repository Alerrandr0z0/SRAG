import React from 'react';
import { COLORS } from '../../constants';
import { useChartJs } from '../../hooks/useChartJs';

interface BarChartProps {
  labels: string[];
  data: number[];
  horizontal?: boolean;
  color?: string;
}

const BarChart: React.FC<BarChartProps> = ({ labels, data, horizontal = true, color = COLORS.PRIMARY }) => {
  const { canvasRef } = useChartJs(
    () => ({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: color,
          borderRadius: 7,
        }],
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true },
          y: { beginAtZero: true },
        },
      },
    }),
    [labels, data, horizontal, color],
  );

  return <canvas ref={canvasRef} />;
};

export default BarChart;
