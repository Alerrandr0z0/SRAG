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

interface BairrosChartProps {
  data: Epi.NeighborhoodStats[];
}

const BairrosChart: React.FC<BairrosChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      const items = data.slice(0, 10);
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: items.map((b) => b.bairro),
          datasets: [{
            data: items.map((b) => b.count),
            backgroundColor: COLORS.SECONDARY,
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

export default BairrosChart;
