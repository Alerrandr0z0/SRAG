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

interface VirusProfileChartProps {
  data: Epi.VirusData[];
}

const VirusProfileChart: React.FC<VirusProfileChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: data.map((d) => d.virus),
          datasets: [{ 
            data: data.map((d) => d.count), 
            backgroundColor: COLORS.CHART, 
            borderWidth: 2 
          }],
        },
        options: { 
          maintainAspectRatio: false, 
          plugins: { legend: { position: 'bottom' } } 
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default VirusProfileChart;
