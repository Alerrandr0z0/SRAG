import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';
import * as Epi from '../../types/epi';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface PiramideEtariaProps {
  data: Epi.PyramidRow[];
}

const PiramideEtariaChart: React.FC<PiramideEtariaProps> = ({ data = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      const maleValues = data.map((r) => Number(r.male || 0));
      const femaleValues = data.map((r) => Number(r.female || 0));
      const maxAbs = Math.max(1, ...maleValues, ...femaleValues) * 1.1;

      if (chartInstance.current) chartInstance.current.destroy();

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: data.map((r) => r.age_band || 'N/A'),
          datasets: [
            {
              label: 'Masculino',
              data: maleValues.map((v) => -v),
              backgroundColor: COLORS.SECONDARY
            },
            {
              label: 'Feminino',
              data: femaleValues,
              backgroundColor: COLORS.ACCENT
            },
          ],
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const label = context.dataset.label;
                  const value = Math.abs(context.raw);
                  return `${label}: ${value} casos`;
                }
              }
            }
          },
          scales: {
            x: {
              min: -maxAbs,
              max: maxAbs,
              ticks: { callback: (value) => Math.abs(Number(value)) }
            },
            y: { stacked: true },
          },
        },
      });
    };

    render();
    return () => {
      cancelled = true;
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default PiramideEtariaChart;
