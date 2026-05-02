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

interface UnitsChartProps {
  data: Epi.UnitStats[];
}

const UnitsChart: React.FC<UnitsChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: data.map((u) => u.id_unidade),
          datasets: [{
            data: data.map((u) => u.count),
            backgroundColor: COLORS.PRIMARY,
            borderRadius: 7
          }],
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default UnitsChart;
