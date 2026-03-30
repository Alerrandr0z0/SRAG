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

interface ZonesChartProps {
  data: Epi.ZoneStats[];
}

const ZonesChart: React.FC<ZonesChartProps> = ({ data }) => {
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
          labels: data.map((z) => z.ZONA),
          datasets: [{ 
            data: data.map((z) => z.count), 
            backgroundColor: COLORS.PRIMARY, 
            borderRadius: 7 
          }],
        },
        options: { 
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

export default ZonesChart;
