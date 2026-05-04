import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface VirusStackedTrendChartProps {
  data: Array<{ epi_week: string; virus: string; count: number }>;
}

const AGENT_COLORS: Record<string, string> = {
  'VSR': '#0f766e',
  'Influenza': '#1d4ed8',
  'COVID-19': '#b91c1c',
  'Outros Vírus': '#7c3aed',
  'Outro Agente': '#475569',
  'Não Especificada': '#94a3b8',
};

const VirusStackedTrendChart: React.FC<VirusStackedTrendChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current || !data.length) return;

      const weeks = Array.from(new Set(data.map(d => d.epi_week))).sort();
      const agents = Array.from(new Set(data.map(d => d.virus))).filter(Boolean);

      const datasets = agents.map((agent) => ({
        label: agent,
        data: weeks.map((week) => {
          const found = data.find(d => d.epi_week === week && d.virus === agent);
          return found ? found.count : 0;
        }),
        backgroundColor: AGENT_COLORS[agent] || COLORS.SECONDARY,
        borderColor: AGENT_COLORS[agent] || COLORS.SECONDARY,
        borderWidth: 1,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3
      }));

      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: weeks,
          datasets,
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { 
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8 }
            },
          },
          scales: {
            x: { 
              grid: { display: false },
              ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12
              }
            },
            y: { 
              stacked: true, 
              beginAtZero: true,
              title: { display: true, text: 'Casos Positivos' }
            },
          },
        },
      });
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default VirusStackedTrendChart;
