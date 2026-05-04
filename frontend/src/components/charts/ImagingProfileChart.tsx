import React, { useEffect, useRef } from 'react';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface ImagingProfileChartProps {
  data: {
    raiox: Array<{ label: string; count: number }>;
    tomo: Array<{ label: string; count: number }>;
  };
}

const RESULT_COLORS: Record<string, string> = {
  // Raio-X
  'Normal': '#10b981',
  'Infiltrado': '#f59e0b',
  'Consolidação': '#ef4444',
  'Misto': '#8b5cf6',
  'Outro': '#64748b',
  // Tomografia
  'Típico': '#059669',
  'Indeterminado': '#fbbf24',
  'Atípico': '#f87171',
  'Negativo': '#3b82f6',
};

const ImagingProfileChart: React.FC<ImagingProfileChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      const labels = ['Raio-X', 'Tomografia'];
      
      // We need a common set of possible result types to stack them
      // But Raio-X and Tomo have different labels in SIVEP.
      // So we'll treat them as separate datasets but plotted on the same bars.
      
      const allPossibleLabels = Array.from(new Set([
        ...data.raiox.map(d => d.label),
        ...data.tomo.map(d => d.label)
      ]));

      const datasets = allPossibleLabels.map(label => {
        return {
          label: label,
          data: [
            data.raiox.find(d => d.label === label)?.count || 0,
            data.tomo.find(d => d.label === label)?.count || 0
          ],
          backgroundColor: RESULT_COLORS[label] || '#e2e8f0',
          borderWidth: 0,
          borderRadius: 4,
        };
      }).filter(ds => ds.data[0] > 0 || ds.data[1] > 0);

      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: labels,
          datasets,
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: { 
              stacked: true, 
              min: 0, 
              max: 100,
              ticks: { callback: (v: any) => v + '%' } 
            },
            y: { stacked: true },
          },
        },
      });
      
      // Calculate percentages for 100% stacked
      const raioxTotal = data.raiox.reduce((s, d) => s + d.count, 0) || 1;
      const tomoTotal = data.tomo.reduce((s, d) => s + d.count, 0) || 1;
      
      chartInstance.current.data.datasets.forEach((ds: any) => {
        ds.data[0] = Number(((ds.data[0] / raioxTotal) * 100).toFixed(1));
        ds.data[1] = Number(((ds.data[1] / tomoTotal) * 100).toFixed(1));
      });
      chartInstance.current.update();
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return <canvas ref={canvasRef} />;
};

export default ImagingProfileChart;
