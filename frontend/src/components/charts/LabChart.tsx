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

interface LabChartProps {
  data: Epi.LaboratoryNetwork['labs'];
}

const LabChart: React.FC<LabChartProps> = ({ data }) => {
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
          labels: items.map((l) => l.LAB_REF || l.lab_ref),
          datasets: [{ 
            data: items.map((l) => l.tested_cases), 
            backgroundColor: COLORS.SECONDARY, 
            borderRadius: 8 
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

export default LabChart;
