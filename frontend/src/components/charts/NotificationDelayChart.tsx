import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface NotificationDelayChartProps {
  data: Array<{ epi_week: string; median_delay: number }>;
}

const NotificationDelayChart: React.FC<NotificationDelayChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: data.map((d) => d.epi_week),
          datasets: [{ 
            label: 'Atraso Mediano (dias)',
            data: data.map((d) => d.median_delay), 
            borderColor: COLORS.PRIMARY,
            backgroundColor: 'rgba(15, 118, 110, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          }],
        },
        options: { 
          maintainAspectRatio: false, 
          plugins: { 
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Atraso: ${ctx.raw} dias`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Dias', font: { size: 10 } }
            }
          }
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default NotificationDelayChart;
