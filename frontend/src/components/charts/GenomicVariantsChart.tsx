import React, { useEffect, useRef } from 'react';
import { COLORS } from '../../constants';

let chartLoader: Promise<any>;
function loadChart() {
  if (!chartLoader) {
    chartLoader = import('chart.js/auto').then((mod) => mod.Chart);
  }
  return chartLoader;
}

interface GenomicVariantsChartProps {
  data: {
    weeks: string[];
    variants: Record<string, number[]>;
  };
}

const VARIANT_COLORS: Record<string, string> = {
  'Ômicron': '#0f766e',
  'Delta': '#1d4ed8',
  'Alfa': '#b91c1c',
  'Beta': '#7c3aed',
  'Gama': '#d97706',
  'Recombinante': '#0369a1',
  'Desconhecida': '#94a3b8',
  'Outra': '#475569'
};

const GenomicVariantsChart: React.FC<GenomicVariantsChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const Chart = await loadChart();
      if (cancelled || !canvasRef.current) return;

      const weeks = data?.weeks || [];
      const variantsDict = data?.variants || {};
      const variantNames = Object.keys(variantsDict);

      // Skip rendering if no actual genomic data exists
      if (weeks.length === 0 || variantNames.length === 0) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
          chartInstance.current = null;
        }
        return;
      }

      const datasets = variantNames.map((variant) => ({
        label: variant,
        data: variantsDict[variant],
        backgroundColor: VARIANT_COLORS[variant] || COLORS.SECONDARY,
        borderColor: 'white',
        borderWidth: 1,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4
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
              labels: {
                usePointStyle: true,
                boxWidth: 8
              }
            },
            tooltip: { 
              callbacks: {
                label: function(context: any) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    label += context.parsed.y + '%';
                  }
                  return label;
                }
              }
            },
          },
          scales: {
            x: { 
              grid: { display: false }
            },
            y: { 
              stacked: true, 
              min: 0, 
              max: 100,
              ticks: {
                callback: function(value: any) {
                  return value + "%";
                }
              }
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

  if (!data?.weeks || data.weeks.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <p>Aguardando dados de sequenciamento genômico para o período selecionado.</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
};

export default GenomicVariantsChart;
