import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface BarChartProps {
  labels: string[];
  data: number[];
  horizontal?: boolean;
  color?: string;
}

const BarChart: React.FC<BarChartProps> = ({ labels, data, horizontal = true, color = COLORS.PRIMARY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      if (chartInstance.current) chartInstance.current.destroy();

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: color,
            borderRadius: 7
          }],
        },
        options: {
          indexAxis: horizontal ? 'y' : 'x',
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true },
            y: { beginAtZero: true }
          }
        },
      });
    };

    render();

    return () => {
      cancelled = true;
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [labels, data, horizontal, color]);

  return <canvas ref={canvasRef} />;
};

export default BarChart;
