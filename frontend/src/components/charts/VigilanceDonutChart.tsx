import React, { useEffect, useRef } from 'react';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface VigilanceDonutChartProps {
  data: Array<{ label: string; count: number }>;
  title: string;
}

const VigilanceDonutChart: React.FC<VigilanceDonutChartProps> = ({ data, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      
      const colors = [
        '#0f766e', '#0d9488', '#2dd4bf', '#99f6e4', '#ccfbf1',
        '#64748b', '#94a3b8', '#cbd5e1'
      ];

      chartInstance.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: data.map((d) => d.label),
          datasets: [{ 
            data: data.map((d) => d.count), 
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fff'
          }],
        },
        options: { 
          maintainAspectRatio: false, 
          plugins: { 
            legend: { 
              position: 'right',
              labels: { boxWidth: 10, font: { size: 10 } }
            },
            title: { display: false }
          },
          cutout: '60%'
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [data]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: '10px', textTransform: 'uppercase' }}>{title}</p>
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default VigilanceDonutChart;
